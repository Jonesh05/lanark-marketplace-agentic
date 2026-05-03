"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

const PlaceOfferInput = z.object({
  product_id: z.string().uuid(),
  qty: z.coerce.number().int().min(1),
  amount_cusd: z.coerce.number().positive(),
})

export async function placeOffer(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const parsed = PlaceOfferInput.safeParse({
    product_id: formData.get("product_id"),
    qty: formData.get("qty"),
    amount_cusd: formData.get("amount_cusd"),
  })
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  // micros = 6-decimal fixed point
  const amount_cusd_micro = Math.round(parsed.data.amount_cusd * 1_000_000)

  const { error, data } = await supabase
    .from("offers")
    .insert({
      product_id: parsed.data.product_id,
      client_id: user.id,
      qty: parsed.data.qty,
      amount_cusd_micro,
      status: "pending",
    })
    .select("id")
    .single()

  if (error) return { ok: false as const, error: error.message }

  revalidatePath("/dashboard")
  revalidatePath(`/marketplace/${parsed.data.product_id}`)
  return { ok: true as const, id: data.id }
}

export async function decideOffer(
  offerId: string,
  decision: "accepted" | "rejected",
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: offer, error: oerr } = await supabase
    .from("offers")
    .select("*, products!inner(shopkeeper_id, stock)")
    .eq("id", offerId)
    .single()
  if (oerr || !offer) return { ok: false as const, error: "Offer not found" }

  // RLS already enforces this, but double-check.
  if ((offer as any).products.shopkeeper_id !== user.id) {
    return { ok: false as const, error: "Not your product" }
  }

  const { error } = await supabase
    .from("offers")
    .update({ status: decision, decided_at: new Date().toISOString() })
    .eq("id", offerId)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath("/dashboard")
  return { ok: true as const }
}
