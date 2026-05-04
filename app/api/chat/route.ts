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
    "The catalog is real product data (DummyJSON) plus any native shopkeeper listings.",
    "Listings are priced in their native currency (USD for DummyJSON imports) and SETTLE in cUSD on Celo (chainId 42220).",
    "Use listCategories to discover categories. Use searchProducts(query, maxPrice, category, brand, limit) to fetch listings.",
    "Use getCusdBalance to read on-chain balance. Use getMyOrders / getMyOffers for the user's history.",
    "Clients place offers via placeOffer. Shopkeepers decide offers via decideOffer. Never call a tool the role isn't allowed to use.",
    "When a client asks about price in cUSD, assume 1 USD ≈ 1 cUSD (cUSD is a USD stablecoin).",
    "Always quote amounts WITH the unit and decimals. Prefer concise bullet lists over paragraphs.",
    "When you call a tool, do not restate its raw output - summarise the result for the user.",
    "If a tool returns an error, surface it plainly and propose a recovery step.",
  ].join(" ")

  const result = streamText({
    model: azureChatModel,
    system,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(8),
  })

  return result.toUIMessageStreamResponse()
}
