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
    await supabase
      .from("profiles")
      .update({ role: "shopkeeper", is_guest: false })
      .eq("id", user.id)
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

export async function toggleProductActive(productId: string, active: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("products")
    .update({ active })
    .eq("id", productId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath("/")
  revalidatePath("/dashboard")
  return { ok: true as const }
}

export async function deleteProduct(productId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("products").delete().eq("id", productId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath("/")
  revalidatePath("/dashboard")
  return { ok: true as const }
}
