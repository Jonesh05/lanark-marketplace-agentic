import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SiteHeader } from "@/components/site-header"
import { ChatUI } from "@/components/chat-ui"

export const dynamic = "force-dynamic"

export default async function ChatPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/chat")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = (profile?.role ?? "client") as "client" | "shopkeeper"

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <ChatUI role={role} />
    </div>
  )
}
