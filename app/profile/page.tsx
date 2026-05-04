import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SiteHeader } from "@/components/site-header"
import { ProfileSettings } from "@/components/profile/profile-settings"
import type { Profile } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/profile")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/auth/login")

  // Fetch audit log for this user
  const { data: auditLog } = await supabase
    .from("audit_log")
    .select("*")
    .eq("actor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <ProfileSettings
        profile={profile as Profile}
        auditLog={auditLog ?? []}
      />
    </div>
  )
}
