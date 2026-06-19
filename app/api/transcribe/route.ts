import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

/**
 * Server-side voice transcription (fallback for browsers without the Web Speech
 * API, e.g. Firefox / some in-app webviews). Accepts an audio blob and returns
 * { text }.
 *
 * Uses Azure OpenAI Whisper when a transcription deployment is configured:
 *   AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY,
 *   AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT (a whisper / gpt-4o-transcribe deployment)
 * Falls back to the standard OpenAI endpoint if OPENAI_API_KEY is set.
 *
 * When no transcription provider is configured it returns 501 so the client can
 * gracefully ask the user to type instead — the Web Speech API path needs no
 * server and remains the primary experience.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const form = await req.formData()
  const file = form.get("audio")
  if (!(file instanceof Blob)) {
    return Response.json({ error: "No audio provided." }, { status: 400 })
  }

  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT
  const azureKey = process.env.AZURE_OPENAI_API_KEY
  const azureDeployment = process.env.AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT
  const openaiKey = process.env.OPENAI_API_KEY

  let url: string
  const headers: Record<string, string> = {}

  if (azureEndpoint && azureKey && azureDeployment) {
    url = `${azureEndpoint.replace(/\/$/, "")}/openai/deployments/${azureDeployment}/audio/transcriptions?api-version=2024-06-01`
    headers["api-key"] = azureKey
  } else if (openaiKey) {
    url = "https://api.openai.com/v1/audio/transcriptions"
    headers["Authorization"] = `Bearer ${openaiKey}`
  } else {
    return Response.json(
      {
        error: "transcription_not_configured",
        message:
          "Server transcription is not configured. Set AZURE_OPENAI_TRANSCRIBE_DEPLOYMENT (Whisper) to enable it.",
      },
      { status: 501 },
    )
  }

  try {
    const upstream = new FormData()
    upstream.append(
      "file",
      file,
      (file as File).name || "audio.webm",
    )
    if (!azureEndpoint) upstream.append("model", "whisper-1")
    upstream.append("language", "es")

    const res = await fetch(url, { method: "POST", headers, body: upstream })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      console.error("[transcribe] upstream error:", res.status, detail)
      return Response.json(
        { error: "No pudimos transcribir el audio." },
        { status: 502 },
      )
    }
    const json = (await res.json()) as { text?: string }
    return Response.json({ text: json.text ?? "" })
  } catch (err) {
    console.error("[transcribe] error:", err)
    return Response.json(
      { error: "No pudimos transcribir el audio." },
      { status: 500 },
    )
  }
}
