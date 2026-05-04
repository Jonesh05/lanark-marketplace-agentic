/**
 * Agent API Route - Real Operations Only
 * 
 * POST /api/agent
 * 
 * Handles chat with the Lanark agent. All tools perform actual
 * database operations. No mocks, no fabricated responses.
 */

import { streamText, convertToModelMessages } from "ai"
import { createClient } from "@/lib/supabase/server"
import { azureChatModel, AZURE_OPENAI_CONFIGURED } from "@/lib/ai/azure"
import {
  getProductInfo,
  getInventory,
  submitOffer,
  createOrder,
  getAccountHistory,
  updateProduct,
  getCusdBalance,
} from "@/lib/tools"
import type { ToolContext } from "@/lib/tools/types"

export const maxDuration = 60

export async function POST(req: Request) {
  if (!AZURE_OPENAI_CONFIGURED) {
    return Response.json(
      { error: "AI model not configured. Set Azure OpenAI environment variables." },
      { status: 500 }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, primary_address")
    .eq("id", user.id)
    .single()

  const role = (profile?.role ?? "client") as "client" | "shopkeeper"

  const body = await req.json()
  const threadId = String(body.id ?? body.threadId ?? `agent-${user.id}`)
  const messages = body.messages ?? []

  // Build tool context
  const ctx: ToolContext = {
    supabase,
    userId: user.id,
    role,
    threadId,
  }

  // Build tools - only functional tools, no mocks
  const tools = {
    getProductInfo: getProductInfo(ctx),
    getInventory: getInventory(ctx),
    submitOffer: submitOffer(ctx),
    createOrder: createOrder(ctx),
    getAccountHistory: getAccountHistory(ctx),
    updateProduct: updateProduct(ctx),
    getCusdBalance: getCusdBalance(ctx),
  }

  // System prompt - emphasizes real operations
  const system = [
    "You are Lanark, an autonomous agent for the Lanark on-chain marketplace on Celo.",
    `User role: ${role}. Wallet: ${profile?.primary_address ?? "not connected"}.`,
    "",
    "CRITICAL RULES:",
    "- All tools perform REAL database operations. Do not fabricate data.",
    "- If a tool returns an error, report it honestly. Do not make up results.",
    "- If the database is empty, say so. Do not pretend products exist.",
    "- Never provide 'example' or 'sample' data. Only show real results.",
    "",
    "AVAILABLE TOOLS:",
    "- getProductInfo: Search or get details for products",
    "- getInventory: List products (shopkeeper sees own, client sees catalog)",
    "- submitOffer: Place offer on product (clients only)",
    "- createOrder: Create order from accepted offer",
    "- getAccountHistory: View offers and orders",
    "- updateProduct: Edit product details (shopkeepers only)",
    "- getCusdBalance: Check cUSD balance on Celo",
    "",
    "BEHAVIOR:",
    "- Be concise. Use bullet points for lists.",
    "- Prices are in USD, settlement in cUSD on Celo (1:1 peg).",
    "- All changes are recorded in the audit log for traceability.",
    "- If an operation fails, explain what went wrong and suggest next steps.",
  ].join("\n")

  try {
    const result = streamText({
      model: azureChatModel,
      system,
      messages: await convertToModelMessages(messages),
      tools,
      maxSteps: 5,
    })

    return result.toDataStreamResponse()
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent error"
    return Response.json({ error: message }, { status: 500 })
  }
}
