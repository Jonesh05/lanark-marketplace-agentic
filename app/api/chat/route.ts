import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  validateUIMessages,
  type UIMessage,
  type InferUITools,
  type UIDataTypes,
} from "ai"

import { createClient } from "@/lib/supabase/server"
import { buildTools } from "@/lib/agent/tools"
import { azureChatModel, AZURE_OPENAI_CONFIGURED } from "@/lib/ai/azure"

export const runtime = "nodejs"
export const maxDuration = 30

export type SablonChatMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<ReturnType<typeof buildTools>>
>

export async function POST(req: Request) {
  if (!AZURE_OPENAI_CONFIGURED) {
    return Response.json(
      {
        error:
          "Azure OpenAI is not configured. Set AZURE_OPENAI_API_KEY, " +
          "AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_DEPLOYMENT_NAME.",
      },
      { status: 500 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, primary_address")
    .eq("id", user.id)
    .single()

  const role = (profile?.role ?? "client") as "client" | "shopkeeper"
  const body = await req.json()
  const threadId = String(body.id ?? body.threadId ?? `web-${user.id}`)
  const tools = buildTools({ supabase, userId: user.id, role, threadId })
  const messages = await validateUIMessages<SablonChatMessage>({
    messages: body.messages,
    tools,
  })

  const system = [
    "You are Lanark, the autonomous agent for the Lanark on-chain marketplace.",
    `The signed-in user is a ${role}. Their wallet address is ${profile?.primary_address ?? "(unknown)"}.`,
    "The catalog is real product data (legacy external catalog + native listings) plus any native shopkeeper listings.",
    "Listings are priced in their native currency and SETTLE in cUSD on Celo (chainId 42220).",
    "MODEL: only the SALE settlement and its value record go on-chain. The buyer's cart, purchases and activity history stay OFF-CHAIN. Never tell users their cart or browsing is on-chain, and never claim gas is sponsored or that they use an ERC-4337 smart account.",
    "",
    "BROWSING: listCategories, searchProducts(query, maxPrice, category, brand, limit).",
    "SEARCH RESULTS: each item already includes price (amount in its native currency), currency, priceCusd (already converted to cUSD) and priceLabel (ready to display). Quote priceLabel or priceCusd as-is. These are FINAL human amounts: NEVER multiply price by 100 and never treat price as cents.",
    "SHOPKEEPER INVENTORY: listMyInventory, createProduct, updateProduct (can change title, description, price, stock, active status, image, category, brand), deleteProduct.",
    "CLIENT PURCHASE (the main flow): this is a fixed-price wholesale marketplace. Prices are FINAL; clients buy directly, they do not negotiate. To buy for a client: searchProducts -> addToCart(productId, quantity) -> viewCart -> ask for the delivery address -> checkoutCart(shippingAddress) -> authorizeOrder(orderId) -> confirmOrder(orderId). Each checkout creates a preinscribed order per shopkeeper; nothing is paid until the buyer authorizes.",
    "When the user says something like 'send me X to my usual address', drive the whole flow: find the product, add it, create the order, and present the order summary with its purchase reference and the next step (authorize payment). Ask for the delivery address if you do not have one.",
    "OFFERS ARE EXCEPTIONAL, not the default: only use placeOffer if the user explicitly wants to propose a different price. Otherwise always buy at the listed price. An offer must be between 82% and 100% of the listed cUSD price (never above list price).",
    "CLIENT ACTIONS: addToCart, viewCart, checkoutCart, authorizeOrder, confirmOrder, getMyOffers, getMyOrders, placeOffer (exceptional).",
    "SHOPKEEPER ACTIONS: decideOffer (accept/reject), getMyOrders.",
    "BALANCE: getCusdBalance reads on-chain cUSD.",
    "ORDER STATES: preinscribed (prepared, awaiting authorization) -> pending (authorized, signing) -> awaiting_settlement (payment pending, NOT yet paid) -> confirmed. Never tell the user money has moved or the order is paid before it is confirmed.",
    "",
    "All product changes are recorded in the audit log for traceability.",
    "When updating price, the user specifies price_cents (e.g. 850000000 for 8,500,000 COP, or 999 for $9.99 USD).",
    "Clients place offers via placeOffer. Shopkeepers decide offers via decideOffer. Never call a tool the role isn't allowed to use.",
    "CURRENCY: cUSD is a US-dollar stablecoin, so 1 USD ≈ 1 cUSD. Colombian pesos (COP) are NOT dollars: convert COP to cUSD by dividing by ~4000 (e.g. 8,500,000 COP ≈ 2,125 cUSD). NEVER treat a COP amount as if it were cUSD. If the user gives an amount in COP, convert it to cUSD before calling placeOffer, and tell them the converted cUSD amount.",
    "placeOffer expects amountCusd as a cUSD number (e.g. 2125), never a COP number.",
    "AUDIENCE: users are non-technical shoppers. Write in clear, calm, everyday Spanish. Never show database errors, SQL, JSON, column names, stack traces or codes.",
    "If a tool returns an error field, DO NOT repeat it verbatim and DO NOT retry the same failing call with a slightly different number. Briefly explain in plain language what to do next (e.g. ask for the amount again, or say the item is unavailable). If it looks like a system problem, say it's a temporary issue and to try again shortly.",
    "Always quote amounts WITH the unit and decimals. Prefer concise bullet lists over paragraphs.",
    "When you call a tool, do not restate its raw output - summarise the result for the user in human language.",
  ].join(" ")

  try {
    const convertedMessages = await convertToModelMessages(messages)

    const result = streamText({
      model: azureChatModel,
      system,
      messages: convertedMessages,
      tools,
      stopWhen: stepCountIs(12),
      experimental_telemetry: { isEnabled: false },
    })

    return result.toUIMessageStreamResponse()
  } catch (err) {
    console.error("[chat] route error:", err)
    return Response.json(
      { error: "An error occurred. Please try again." },
      { status: 500 },
    )
  }
}
