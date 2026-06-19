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

  // Role is locked once established at sign-in. A client cannot self-promote
  // to shopkeeper from settings, and a shopkeeper cannot silently downgrade.
  // This keeps the seller/client surfaces strictly separated (role-lock).
  if (parsed.data.role !== existing.role) {
    return { ok: false as const, error: "Role change forbidden" }
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

const StoreInput = z.object({
  name: z.string().min(2, "El nombre del negocio debe tener al menos 2 caracteres").max(80),
  taxId: z.string().max(40).nullable().optional(),
})

// Slugify a brand name into a URL-safe, ASCII storefront slug.
function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "tienda"
  )
}

/**
 * Create or rename the shopkeeper's store (the renameable business identifier
 * shown to clients as the brand). Role-locked: only a shopkeeper owns a store.
 * One store per owner; slug is unique and derived from the brand name.
 */
export async function updateStore(input: z.infer<typeof StoreInput>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const parsed = StoreInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  // Role-lock: a client cannot own a storefront.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "shopkeeper") {
    return { ok: false as const, error: "Solo un vendedor puede crear o renombrar su tienda." }
  }

  const name = parsed.data.name.trim()
  const taxId = parsed.data.taxId?.trim() || null

  const { data: existing } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (existing) {
    const { data: updated, error } = await supabase
      .from("stores")
      .update({ name, tax_id: taxId, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("*")
      .single()
    if (error) return { ok: false as const, error: error.message }

    await supabase.from("audit_log").insert({
      entity_type: "store",
      entity_id: existing.id,
      action: "update",
      actor_id: user.id,
      actor_type: "user",
      changes: { name: { from: existing.name, to: name } },
      old_values: existing,
      new_values: updated,
    })

    revalidatePath("/profile")
    revalidatePath("/dashboard")
    revalidatePath("/")
    return { ok: true as const }
  }

  // New store: derive a slug and guard against the UNIQUE(slug) constraint.
  const base = slugify(name)
  let slug = base
  let created: Record<string, unknown> | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("stores")
      .insert({ owner_id: user.id, name, slug, tax_id: taxId, active: true })
      .select("*")
      .single()
    if (!error) {
      created = data
      break
    }
    // Unique violation on slug -> retry with a short owner-scoped suffix.
    if ((error as { code?: string }).code === "23505" && attempt < 2) {
      slug = `${base}-${user.id.slice(0, 6)}${attempt > 0 ? `-${attempt}` : ""}`
      continue
    }
    return { ok: false as const, error: error.message }
  }
  if (!created) {
    return { ok: false as const, error: "No se pudo crear la tienda. Intenta con otro nombre." }
  }

  // Link this owner's existing products that have no store yet.
  await supabase
    .from("products")
    .update({ store_id: created.id })
    .eq("shopkeeper_id", user.id)
    .is("store_id", null)

  await supabase.from("audit_log").insert({
    entity_type: "store",
    entity_id: created.id as string,
    action: "create",
    actor_id: user.id,
    actor_type: "user",
    changes: { name: { from: null, to: name } },
    new_values: created,
  })

  revalidatePath("/profile")
  revalidatePath("/dashboard")
  revalidatePath("/")
  return { ok: true as const }
}

const PhoneInput = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, "Número inválido (formato internacional E.164).")
    .nullable(),
  country: z.string().trim().length(2).optional(),
})

/**
 * Persist the user's mobile number (E.164) and dialing country. Used for
 * post-purchase SMS and abandoned-cart recovery links. The full number is
 * masked in the audit trail to avoid duplicating PII in plaintext logs.
 */
export async function updatePhone(input: z.infer<typeof PhoneInput>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const parsed = PhoneInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const phone = parsed.data.phone
  const country = (parsed.data.country ?? "CO").toUpperCase()

  const { error } = await supabase
    .from("profiles")
    .update({ phone, phone_country: country })
    .eq("id", user.id)
  if (error) return { ok: false as const, error: error.message }

  const masked = phone ? `${phone.slice(0, 3)}***${phone.slice(-2)}` : null
  await supabase.from("audit_log").insert({
    entity_type: "profile",
    entity_id: user.id,
    action: "update",
    actor_id: user.id,
    actor_type: "user",
    changes: { phone: { from: null, to: masked } },
  })

  revalidatePath("/profile")
  return { ok: true as const }
}
