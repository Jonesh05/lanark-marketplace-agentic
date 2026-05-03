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

export const runtime = "nodejs"
export const maxDuration = 30

export type SablonChatMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<ReturnType<typeof buildTools>>
>

export async function POST(req: Request) {
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
    "You are Sablon's marketplace agent.",
    `The signed-in user is a ${role}. Their address is ${profile?.primary_address ?? "(unknown)"}.`,
    "Listings are priced in COP (Colombian pesos) but settle on Celo in cUSD.",
    "When the user asks about products, prefer searchProducts. When they ask about money, prefer getCusdBalance.",
    "Clients can placeOffer; shopkeepers can decideOffer. Never invoke a tool the role isn't allowed to use.",
    "Always quote amounts with the unit. Be concise; prefer bullet lists over paragraphs.",
    "If a tool returns an error, surface it plainly and suggest a recovery step.",
  ].join(" ")

  const result = streamText({
    model: "openai/gpt-5-mini",
    system,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(8),
  })

  return result.toUIMessageStreamResponse()
}
