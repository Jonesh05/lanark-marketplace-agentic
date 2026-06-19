import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SiteHeader } from "@/components/site-header"
import { ProfileSettings } from "@/components/profile/profile-settings"
import type { Profile, Store } from "@/lib/types"

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

  const profileData = profile as Profile

  // Fetch audit log + the shopkeeper's storefront (renameable brand identity).
  const [{ data: auditLog }, { data: store }] = await Promise.all([
    supabase
      .from("audit_log")
      .select("*")
      .eq("actor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    profileData.role === "shopkeeper"
      ? supabase.from("stores").select("*").eq("owner_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <ProfileSettings
        profile={profileData}
        store={(store ?? null) as Store | null}
        auditLog={auditLog ?? []}
      />
    </div>
  )
}
