"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { cusdToWei } from "@/lib/celo"

const PlaceOfferInput = z.object({
  product_id: z.string().uuid(),
  qty: z.coerce.number().int().min(1),
  amount_cusd: z.coerce.number().positive(),
})

// Server-authoritative listing floor in cUSD wei. cUSD is a USD stablecoin:
// USD-priced listings map 1:1; COP-priced listings use the same ~4000 COP/USD
// rate the offer form suggests so the floor matches the UI's starting quote.
function listingFloorWei(priceCents: number, currency: string): bigint {
  const usdRate = currency === "COP" ? 4000 : 1
  const humanUsd = priceCents / 100 / usdRate
  return cusdToWei(humanUsd)
}

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

  // Server-authoritative product read: validate availability, stock, ownership
  // and price floor. The client-supplied amount is an intent, not authority.
  const { data: product } = await supabase
    .from("products")
    .select("id, price_cents, currency, stock, active, shopkeeper_id")
    .eq("id", parsed.data.product_id)
    .single()
  if (!product || !product.active) {
    return { ok: false as const, error: "Product not available" }
  }
  if (product.shopkeeper_id && product.shopkeeper_id === user.id) {
    return { ok: false as const, error: "You cannot offer on your own listing" }
  }
  if (product.stock < parsed.data.qty) {
    return { ok: false as const, error: "Not enough stock" }
  }

  const amountWei = cusdToWei(parsed.data.amount_cusd)
  const floorWei = listingFloorWei(product.price_cents, product.currency)
  // Allow a small negotiation margin below list (10%), but reject dust offers.
  if (amountWei < (floorWei * BigInt(90)) / BigInt(100)) {
    return { ok: false as const, error: "Offer is below the acceptable minimum for this listing" }
  }

  const { error, data } = await supabase
    .from("offers")
    .insert({
      product_id: parsed.data.product_id,
      client_id: user.id,
      qty: parsed.data.qty,
      amount_cusd_wei: amountWei.toString(),
      status: "pending",
    })
    .select("id")
    .single()

  if (error) return { ok: false as const, error: "Could not place offer" }

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
  if (error) return { ok: false as const, error: "Could not update offer" }

  // On acceptance, promote the offer to an order in 'pending'. The unique
  // index orders_offer_uq makes this idempotent: a duplicate accept inserts
  // nothing and is not treated as a failure.
  if (decision === "accepted") {
    const o = offer as any
    const { error: ierr } = await supabase.from("orders").insert({
      offer_id: o.id,
      product_id: o.product_id,
      client_id: o.client_id,
      shopkeeper_id: user.id,
      qty: o.qty,
      amount_cusd_wei: o.amount_cusd_wei,
      status: "pending",
    })
    // Ignore unique-violation (23505): order already exists for this offer.
    if (ierr && (ierr as any).code !== "23505") {
      return { ok: false as const, error: "Offer accepted but order could not be created" }
    }
  }

  revalidatePath("/dashboard")
  return { ok: true as const }
}
