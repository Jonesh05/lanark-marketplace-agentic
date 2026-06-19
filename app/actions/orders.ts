"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { settlement } from "@/lib/settlement"
import { cusdWeiToHuman } from "@/lib/celo"

/**
 * Client confirms an accepted order and proceeds to payment.
 *
 * This is the off-chain checkout step. It performs a real on-chain cUSD
 * balance gate before moving the order to 'awaiting_settlement'. It does NOT
 * move funds and never marks the order paid — settlement requires a deployed
 * escrow contract. On insufficient funds it returns an explicit, typed error
 * with the buyer's balance and the required amount so the UI can be specific.
 */
export async function confirmOrder(orderId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  try {
    const { data: order, error: oerr } = await supabase
      .from("orders")
      .select("id, client_id, status, amount_cusd_wei, total_cusd_wei")
      .eq("id", orderId)
      .single()
    if (oerr || !order) return { ok: false as const, error: "Order not found" }

    if (order.client_id !== user.id) {
      return { ok: false as const, error: "Not your order" }
    }
    if (order.status !== "pending") {
      // Idempotent: already moved past pending. Surface current state.
      return { ok: false as const, error: "Order is no longer pending", status: order.status }
    }

    const orderWei = BigInt(String(order.total_cusd_wei ?? order.amount_cusd_wei ?? "0"))
    if (orderWei <= BigInt(0)) {
      return { ok: false as const, error: "invalid_total" }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("primary_address")
      .eq("id", user.id)
      .single()

    const address = profile?.primary_address as `0x${string}` | undefined
    if (!address) {
      return { ok: false as const, error: "No wallet linked to this account" }
    }

    const quote = await settlement.quote(orderWei)
    const requiredWei = quote.amountWei + quote.feesWei
    const funds = await settlement.checkFunds(address, requiredWei)
    if (!funds.sufficient) {
      return {
        ok: false as const,
        error: "insufficient_funds",
        balanceCusd: cusdWeiToHuman(funds.balanceWei),
        requiredCusd: cusdWeiToHuman(funds.requiredWei),
      }
    }

    const receipt = await settlement.initiate({
      orderId: order.id,
      buyerAddress: address,
      amountWei: requiredWei,
    })

    const { error: uerr } = await supabase
      .from("orders")
      .update({ status: receipt.status })
      .eq("id", order.id)
      .eq("client_id", user.id)
    if (uerr) {
      return { ok: false as const, error: "Could not update order status" }
    }

    revalidatePath("/dashboard")
    return { ok: true as const, status: receipt.status }
  } catch (err) {
    console.error("[confirmOrder] error:", err)
    return { ok: false as const, error: "Could not process the order" }
  }
}

/**
 * Seller fulfillment lifecycle. This is the missing counterpart to the buyer's
 * "POR AUTORIZAR" view: the shopkeeper reviews and advances the operational
 * state of an order without touching its payment/chain `status`.
 *
 * Role-locked to `shopkeeper_id === auth.uid()` and gated by a per-action
 * transition table so states cannot be skipped. `reject` also restores the
 * stock that checkout reserved and cancels the payment lifecycle.
 */
export type FulfillmentAction =
  | "accept"
  | "prepare"
  | "dispatch"
  | "deliver"
  | "reject"

const FULFILLMENT_TRANSITIONS: Record<
  FulfillmentAction,
  { from: string[]; to: string; event?: string }
> = {
  accept: { from: ["pending_review"], to: "accepted", event: "accepted" },
  prepare: { from: ["accepted"], to: "preparing" },
  dispatch: { from: ["preparing", "accepted"], to: "dispatched", event: "shipped" },
  deliver: { from: ["dispatched"], to: "delivered", event: "delivered" },
  reject: {
    from: ["pending_review", "accepted", "preparing"],
    to: "rejected",
    event: "rejected",
  },
}

export async function advanceFulfillment(
  orderId: string,
  action: FulfillmentAction,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const rule = FULFILLMENT_TRANSITIONS[action]
  if (!rule) return { ok: false as const, error: "Acción inválida." }

  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, shopkeeper_id, fulfillment_status, status, product_id, qty")
      .eq("id", orderId)
      .single()
    if (error || !order)
      return { ok: false as const, error: "No encontramos la orden." }
    if (order.shopkeeper_id !== user.id)
      return { ok: false as const, error: "Esta orden no es tuya." }

    const current = (order.fulfillment_status as string) ?? "pending_review"
    if (!rule.from.includes(current))
      return {
        ok: false as const,
        error: `No puedes "${action}" una orden en estado ${current}.`,
        fulfillment_status: current,
      }

    const patch: Record<string, string> = { fulfillment_status: rule.to }
    // Rejecting the order also closes its payment lifecycle.
    if (action === "reject") patch.status = "cancelled"

    const { error: uerr } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", orderId)
      .eq("shopkeeper_id", user.id)
    if (uerr) {
      console.error("[advanceFulfillment] update error:", uerr)
      return { ok: false as const, error: "No pudimos actualizar la orden." }
    }

    // Restore the stock checkout reserved for a rejected order. Cart orders
    // carry order_items; legacy offer orders carry a single product_id/qty.
    if (action === "reject") {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, quantity")
        .eq("order_id", orderId)
      const lines =
        items && items.length > 0
          ? items.map((it) => ({ product_id: it.product_id, quantity: it.quantity }))
          : order.product_id
            ? [{ product_id: order.product_id, quantity: order.qty }]
            : []
      for (const it of lines) {
        const { data: prod } = await supabase
          .from("products")
          .select("stock")
          .eq("id", it.product_id)
          .eq("shopkeeper_id", user.id)
          .single()
        if (prod) {
          await supabase
            .from("products")
            .update({ stock: (prod.stock ?? 0) + (it.quantity ?? 0) })
            .eq("id", it.product_id)
            .eq("shopkeeper_id", user.id)
        }
      }
    }

    if (rule.event) {
      await supabase.from("order_events").insert({
        order_id: orderId,
        actor_id: user.id,
        event_type: rule.event,
        payload: { fulfillment_status: rule.to, by: "shopkeeper" },
      })
    }

    revalidatePath("/dashboard")
    return { ok: true as const, fulfillment_status: rule.to }
  } catch (err) {
    console.error("[advanceFulfillment] error:", err)
    return { ok: false as const, error: "No pudimos procesar la orden." }
  }
}
