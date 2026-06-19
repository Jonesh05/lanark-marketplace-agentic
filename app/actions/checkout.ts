"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

/**
 * Direct-purchase checkout. Converts the buyer's open cart into one order per
 * shopkeeper (single-shopkeeper purchase rule), reserving stock atomically in
 * the database (checkout_cart). The order is created in 'preinscribed' state:
 * seller + shipping address + buyer are bound, but no payment has happened.
 * The buyer then authorizes payment (authorizeOrder) and confirms (confirmOrder).
 *
 * No funds move here and nothing is marked paid — settlement stays off-chain
 * until an escrow contract is deployed.
 */
export async function checkoutCart(shippingAddress: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const address = (shippingAddress ?? "").trim()
  if (!address) {
    return { ok: false as const, error: "Necesitamos una dirección de entrega." }
  }

  const { data, error } = await supabase.rpc("checkout_cart", {
    p_shipping_address: address,
  })

  if (error) {
    const m = error.message.toLowerCase()
    if (m.includes("empty_cart"))
      return { ok: false as const, error: "Tu carrito está vacío." }
    if (m.includes("insufficient_stock"))
      return {
        ok: false as const,
        error: "Uno de los productos se quedó sin stock. Revisa tu carrito.",
      }
    if (m.includes("not_authenticated")) redirect("/auth/login")
    return { ok: false as const, error: "No pudimos crear tu orden. Intenta de nuevo." }
  }

  revalidatePath("/dashboard")
  revalidatePath("/cart")
  return {
    ok: true as const,
    orders: (data ?? []) as Array<{
      order_id: string
      shopkeeper_id: string
      total_cusd_wei: string
      purchase_ref: string
    }>,
  }
}

/**
 * "Authorize payment" step: moves a preinscribed order to 'pending' so the
 * buyer can sign and the settlement balance gate (confirmOrder) can run.
 */
export async function authorizeOrder(orderId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, client_id, status")
    .eq("id", orderId)
    .single()
  if (error || !order)
    return { ok: false as const, error: "No encontramos la orden." }
  if (order.client_id !== user.id)
    return { ok: false as const, error: "Esta orden no es tuya." }
  if (order.status !== "preinscribed")
    return {
      ok: false as const,
      error: "Esta orden ya no está pendiente de autorización.",
      status: order.status,
    }

  const { error: uerr } = await supabase
    .from("orders")
    .update({ status: "pending" })
    .eq("id", orderId)
    .eq("client_id", user.id)
  if (uerr)
    return { ok: false as const, error: "No pudimos autorizar el pago." }

  await supabase.from("order_events").insert({
    order_id: orderId,
    actor_id: user.id,
    event_type: "created",
    payload: { status: "authorized" },
  })

  revalidatePath("/dashboard")
  return { ok: true as const, status: "pending" as const }
}
