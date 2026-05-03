import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Surface } from "@/components/surface"

export const dynamic = "force-dynamic"

export default async function MainSurfacePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/app")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  const role = (profile?.role ?? "client") as "client" | "shopkeeper"

  return <Surface role={role} />
}
