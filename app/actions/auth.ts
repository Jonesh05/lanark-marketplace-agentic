"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { Role } from "@/lib/types"

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}

export async function setRole(role: Role) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Role-lock: a profile's role is set once (at wallet sign-in / first choice).
  // Do not let an authenticated client silently self-upgrade to shopkeeper by
  // calling this action directly. If a role is already on file, keep it.
  const { data: existing } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (existing?.role && existing.role !== role) {
    return { ok: false as const, error: "Role change forbidden" }
  }

  await supabase
    .from("profiles")
    .update({ role, is_guest: false })
    .eq("id", user.id)

  revalidatePath("/dashboard")
  revalidatePath("/")
  redirect("/dashboard")
}
