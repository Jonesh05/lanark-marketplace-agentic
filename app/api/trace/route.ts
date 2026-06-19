import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * The trace timeline. The chat surface polls this so the user always sees
 * what the agent decided, executed, and confirmed - independent of the
 * streamed assistant text. State is the truth.
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  const url = new URL(req.url)
  const raw = Number(url.searchParams.get("limit") ?? 25)
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 100) : 25

  const { data, error } = await supabase
    .from("agent_actions")
    .select("id,step,kind,resource,payload,receipt,status,message,created_at,thread_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[trace] query error:", error)
    return NextResponse.json({ error: "Could not load trace" }, { status: 500 })
  }
  return NextResponse.json({ items: data ?? [] })
}
