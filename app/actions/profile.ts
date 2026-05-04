"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

const ProfileInput = z.object({
  role: z.enum(["client", "shopkeeper"]),
  displayName: z.string().max(50).nullable(),
})

export async function updateProfile(input: z.infer<typeof ProfileInput>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const parsed = ProfileInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  // Fetch existing profile for audit
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!existing) {
    return { ok: false as const, error: "Profile not found" }
  }

  // Build changes object
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  const updates: Record<string, unknown> = {}

  if (parsed.data.role !== existing.role) {
    updates.role = parsed.data.role
    changes.role = { from: existing.role, to: parsed.data.role }
  }
  if (parsed.data.displayName !== existing.display_name) {
    updates.display_name = parsed.data.displayName
    changes.display_name = { from: existing.display_name, to: parsed.data.displayName }
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true as const, message: "No changes" }
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("*")
    .single()

  if (error) {
    return { ok: false as const, error: error.message }
  }

  // Record in audit log
  await supabase.from("audit_log").insert({
    entity_type: "profile",
    entity_id: user.id,
    action: "update",
    actor_id: user.id,
    actor_type: "user",
    changes,
    old_values: existing,
    new_values: updated,
  })

  revalidatePath("/profile")
  revalidatePath("/dashboard")
  revalidatePath("/")
  
  return { ok: true as const }
}
