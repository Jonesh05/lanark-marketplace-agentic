"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

const ProductInput = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(800).optional(),
  image_url: z.string().url().optional().or(z.literal("")),
  // accepted as a decimal string in COP (e.g. "120000.00"); converted to cents
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Use a number like 120000 or 120000.50"),
  stock: z.coerce.number().int().min(0),
  currency: z.string().default("COP"),
})

export async function createProduct(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const parsed = ProductInput.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    image_url: formData.get("image_url") ?? "",
    price: formData.get("price"),
    stock: formData.get("stock"),
    currency: formData.get("currency") ?? "COP",
  })
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  // Ensure shopkeeper role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (profile?.role !== "shopkeeper") {
    // Role-lock: a client cannot silently self-promote to shopkeeper just by
    // posting a product. Selling requires explicit shopkeeper registration so
    // the seller and client surfaces stay strictly separated (BIZ-01).
    return {
      ok: false as const,
      error: "Debes registrarte como vendedor para publicar productos.",
    }
  }

  const cents = Math.round(parseFloat(parsed.data.price) * 100)
  const { error } = await supabase.from("products").insert({
    shopkeeper_id: user.id,
    title: parsed.data.title.trim(),
    description: parsed.data.description?.trim() || null,
    image_url: parsed.data.image_url || null,
    price_cents: cents,
    currency: parsed.data.currency,
    stock: parsed.data.stock,
    active: true,
  })

  if (error) return { ok: false as const, error: error.message }

  revalidatePath("/")
  revalidatePath("/dashboard")
  return { ok: true as const }
}

const UpdateInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(800).optional(),
  image_url: z.string().url().optional().or(z.literal("")),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Use a number like 120000").optional(),
  stock: z.coerce.number().int().min(0).optional(),
  currency: z.enum(["USD", "COP"]).optional(),
  active: z.coerce.boolean().optional(),
})

export async function updateProduct(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const parsed = UpdateInput.safeParse({
    id: formData.get("id"),
    title: formData.get("title") || undefined,
    description: formData.get("description") ?? undefined,
    image_url: formData.get("image_url") ?? undefined,
    price: formData.get("price") || undefined,
    stock: formData.get("stock") ?? undefined,
    currency: formData.get("currency") || undefined,
    active: formData.get("active") ?? undefined,
  })
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  // Fetch existing product to verify ownership and track changes
  const { data: existing, error: fetchErr } = await supabase
    .from("products")
    .select("*")
    .eq("id", parsed.data.id)
    .single()
  if (fetchErr || !existing) {
    return { ok: false as const, error: "Product not found" }
  }
  if (existing.shopkeeper_id !== user.id) {
    return { ok: false as const, error: "You can only edit your own products" }
  }

  // Build update object
  const updates: Record<string, unknown> = {}
  const changes: Record<string, { from: unknown; to: unknown }> = {}

  if (parsed.data.title !== undefined && parsed.data.title !== existing.title) {
    updates.title = parsed.data.title.trim()
    changes.title = { from: existing.title, to: updates.title }
  }
  if (parsed.data.description !== undefined) {
    const desc = parsed.data.description.trim() || null
    if (desc !== existing.description) {
      updates.description = desc
      changes.description = { from: existing.description, to: desc }
    }
  }
  if (parsed.data.image_url !== undefined) {
    const img = parsed.data.image_url || null
    if (img !== existing.image_url) {
      updates.image_url = img
      changes.image_url = { from: existing.image_url, to: img }
    }
  }
  if (parsed.data.price !== undefined) {
    const cents = Math.round(parseFloat(parsed.data.price) * 100)
    if (cents !== existing.price_cents) {
      updates.price_cents = cents
      changes.price_cents = { from: existing.price_cents, to: cents }
    }
  }
  if (parsed.data.stock !== undefined && parsed.data.stock !== existing.stock) {
    updates.stock = parsed.data.stock
    changes.stock = { from: existing.stock, to: parsed.data.stock }
  }
  if (parsed.data.currency !== undefined && parsed.data.currency !== existing.currency) {
    updates.currency = parsed.data.currency
    changes.currency = { from: existing.currency, to: parsed.data.currency }
  }
  if (parsed.data.active !== undefined && parsed.data.active !== existing.active) {
    updates.active = parsed.data.active
    changes.active = { from: existing.active, to: parsed.data.active }
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true as const, message: "No changes" }
  }

  const { data: updated, error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", parsed.data.id)
    .select("*")
    .single()

  if (error) return { ok: false as const, error: error.message }

  // Record in audit log
  await supabase.from("audit_log").insert({
    entity_type: "product",
    entity_id: parsed.data.id,
    action: "update",
    actor_id: user.id,
    actor_type: "user",
    changes,
    old_values: existing,
    new_values: updated,
  })

  revalidatePath("/")
  revalidatePath("/dashboard")
  return { ok: true as const, updated }
}

export async function toggleProductActive(productId: string, active: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: "Not authenticated" }

  // Fetch existing for audit and ownership verification
  const { data: existing } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .single()

  if (!existing) return { ok: false as const, error: "Product not found" }
  if (existing.shopkeeper_id !== user.id) {
    return { ok: false as const, error: "You can only edit your own products" }
  }

  const { error } = await supabase
    .from("products")
    .update({ active })
    .eq("id", productId)
    .eq("shopkeeper_id", user.id)

  if (error) return { ok: false as const, error: "Could not update product" }

  // Audit log
  if (existing) {
    await supabase.from("audit_log").insert({
      entity_type: "product",
      entity_id: productId,
      action: "update",
      actor_id: user.id,
      actor_type: "user",
      changes: { active: { from: existing.active, to: active } },
      old_values: { active: existing.active },
      new_values: { active },
    })
  }

  revalidatePath("/")
  revalidatePath("/dashboard")
  return { ok: true as const }
}

export async function deleteProduct(productId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: "Not authenticated" }

  // Fetch existing for audit before delete and verify ownership
  const { data: existing } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .single()

  if (!existing) return { ok: false as const, error: "Product not found" }
  if (existing.shopkeeper_id !== user.id) {
    return { ok: false as const, error: "You can only delete your own products" }
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("shopkeeper_id", user.id)
  if (error) return { ok: false as const, error: "Could not delete product" }

  // Audit log
  if (existing) {
    await supabase.from("audit_log").insert({
      entity_type: "product",
      entity_id: productId,
      action: "delete",
      actor_id: user.id,
      actor_type: "user",
      changes: { deleted: true },
      old_values: existing,
    })
  }

  revalidatePath("/")
  revalidatePath("/dashboard")
  return { ok: true as const }
}
