"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getAddress } from "viem"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { settlement } from "@/lib/settlement"
import {
  isWorkerConfigured,
  escrowFactoryAddress,
  createEscrowForOrder,
  releaseEscrow,
  readEscrowState,
  ESCROW_FACTORY_ABI,
} from "@/lib/settlement/escrow"
import { publicClient, cusdWeiToHuman, settlementChainId, explorerTxUrl } from "@/lib/celo"
import { notifyUser } from "@/lib/notify"

type OrderRow = {
  id: string
  client_id: string
  shopkeeper_id: string
  status: string
  amount_cusd_wei: string | null
  total_cusd_wei: string | null
  escrow_address: string | null
  purchase_ref: string | null
}

function orderAmountWei(o: OrderRow): bigint {
  return BigInt(String(o.total_cusd_wei ?? o.amount_cusd_wei ?? "0"))
}

/**
 * Prepare settlement for an authorized order.
 *
 * On-chain mode (escrow factory + worker configured): the settlement worker
 * deploys the per-order escrow clone and returns everything the buyer's wallet
 * needs to fund it (escrow address, token, amount, chain). The order moves to
 * `awaiting_settlement` (escrow created, awaiting the buyer's deposit).
 *
 * Off-chain mode (no contracts yet): honest fallback — real balance gate, order
 * parked at `awaiting_settlement`, no tx, no fake "paid".
 */
export async function prepareSettlement(orderId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, client_id, shopkeeper_id, status, amount_cusd_wei, total_cusd_wei, escrow_address, purchase_ref",
    )
    .eq("id", orderId)
    .single<OrderRow>()
  if (error || !order) return { ok: false as const, error: "No encontramos la orden." }
  if (order.client_id !== user.id) return { ok: false as const, error: "Esta orden no es tuya." }
  if (!["pending", "preinscribed", "awaiting_settlement"].includes(order.status)) {
    return { ok: false as const, error: "Esta orden ya no se puede pagar.", status: order.status }
  }

  const amountWei = orderAmountWei(order)
  if (amountWei <= BigInt(0)) return { ok: false as const, error: "El total de la orden no es válido." }

  // --- On-chain escrow mode ---
  if (isWorkerConfigured()) {
    const { data: buyerProfile } = await supabase
      .from("profiles").select("primary_address").eq("id", order.client_id).single()
    const { data: sellerProfile } = await supabase
      .from("profiles").select("primary_address").eq("id", order.shopkeeper_id).single()

    const buyer = buyerProfile?.primary_address as `0x${string}` | undefined
    const seller = sellerProfile?.primary_address as `0x${string}` | undefined
    if (!buyer) return { ok: false as const, error: "No tienes una wallet vinculada a tu cuenta." }
    if (!seller) return { ok: false as const, error: "El vendedor aún no tiene wallet para recibir el pago." }
    if (buyer.toLowerCase() === seller.toLowerCase())
      return { ok: false as const, error: "Comprador y vendedor no pueden ser la misma wallet." }

    try {
      const { escrow, txHash } = await createEscrowForOrder({
        orderId: order.id,
        buyer: getAddress(buyer),
        seller: getAddress(seller),
        amountWei,
      })

      // Token the escrow expects (factory default token).
      const factory = escrowFactoryAddress()!
      const token = (await publicClient().readContract({
        address: factory,
        abi: ESCROW_FACTORY_ABI,
        functionName: "defaultToken",
      })) as `0x${string}`

      const admin = createAdminClient()
      await admin
        .from("orders")
        .update({ escrow_address: escrow, status: "awaiting_settlement" })
        .eq("id", order.id)
      await admin.from("order_events").insert({
        order_id: order.id,
        actor_id: user.id,
        event_type: "escrow_created",
        payload: { escrow, status: "awaiting_settlement" },
        tx_hash: txHash,
      })

      revalidatePath("/dashboard")
      return {
        ok: true as const,
        mode: "onchain" as const,
        escrow: getAddress(escrow),
        token: getAddress(token),
        amountWei: amountWei.toString(),
        amountLabel: cusdWeiToHuman(amountWei),
        chainId: settlementChainId(),
        createTxUrl: txHash ? explorerTxUrl(txHash) : null,
      }
    } catch (err) {
      console.error("[prepareSettlement] escrow error:", err)
      return { ok: false as const, error: "No pudimos preparar la garantía on-chain. Intenta de nuevo." }
    }
  }

  // --- Off-chain honest fallback ---
  const buyerAddr = (
    await supabase.from("profiles").select("primary_address").eq("id", user.id).single()
  ).data?.primary_address as `0x${string}` | undefined
  if (buyerAddr) {
    const funds = await settlement.checkFunds(buyerAddr, amountWei)
    if (!funds.sufficient) {
      return {
        ok: false as const,
        error: "insufficient_funds",
        balanceCusd: cusdWeiToHuman(funds.balanceWei),
        requiredCusd: cusdWeiToHuman(funds.requiredWei),
      }
    }
  }
  const admin = createAdminClient()
  await admin.from("orders").update({ status: "awaiting_settlement" }).eq("id", order.id)
  revalidatePath("/dashboard")
  return {
    ok: true as const,
    mode: "offchain" as const,
    status: "awaiting_settlement" as const,
    amountLabel: cusdWeiToHuman(amountWei),
  }
}

/**
 * Record the buyer's on-chain deposit. Verifies the escrow is actually Funded
 * on-chain before advancing the order to `escrowed`, writes the real tx hash,
 * and notifies the buyer's phone that the purchase is paid into escrow.
 */
export async function recordDeposit(orderId: string, txHash: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash))
    return { ok: false as const, error: "Hash de transacción inválido." }

  const { data: order } = await supabase
    .from("orders")
    .select("id, client_id, escrow_address, status, purchase_ref")
    .eq("id", orderId)
    .single<OrderRow>()
  if (!order || order.client_id !== user.id)
    return { ok: false as const, error: "No encontramos la orden." }
  if (!order.escrow_address)
    return { ok: false as const, error: "Esta orden no tiene garantía on-chain." }

  // Verify on-chain: escrow must be Funded (State.Funded = 1) before we claim it.
  const state = await readEscrowState(order.escrow_address as `0x${string}`)
  if (state !== null && state < 1) {
    return { ok: false as const, error: "Aún no vemos el depósito confirmado en la red. Intenta en unos segundos." }
  }

  const { error: uerr } = await supabase
    .from("orders")
    .update({ status: "escrowed", deposit_tx_hash: txHash, tx_hash: txHash })
    .eq("id", orderId)
    .eq("client_id", user.id)
  if (uerr) return { ok: false as const, error: "No pudimos registrar tu pago." }

  await supabase.from("order_events").insert({
    order_id: orderId,
    actor_id: user.id,
    event_type: "deposited",
    payload: { status: "escrowed" },
    tx_hash: txHash,
  })

  // Notify the buyer's phone that the purchase is paid into escrow.
  try {
    const { data: prof } = await supabase
      .from("profiles").select("phone").eq("id", user.id).single()
    const ref = order.purchase_ref ?? orderId.slice(0, 8)
    await notifyUser({
      userId: user.id,
      phone: prof?.phone ?? null,
      kind: "order_paid",
      orderId,
      body: `LANARK: tu compra ${ref} fue pagada y está protegida en garantía. Sigue su estado: ${explorerTxUrl(txHash)}`,
    })
  } catch {
    /* notification must not break the flow */
  }

  revalidatePath("/dashboard")
  return { ok: true as const, status: "escrowed" as const, txUrl: explorerTxUrl(txHash) }
}

/**
 * Release a funded escrow to the seller (settlement worker, who is the arbiter).
 * Called when the seller delivers or the buyer confirms receipt. Advances the
 * order to `settled` with the real release tx and notifies the buyer.
 */
export async function releaseOrder(orderId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: order } = await supabase
    .from("orders")
    .select("id, client_id, shopkeeper_id, status, escrow_address, purchase_ref")
    .eq("id", orderId)
    .single<OrderRow>()
  if (!order) return { ok: false as const, error: "No encontramos la orden." }
  if (order.client_id !== user.id && order.shopkeeper_id !== user.id)
    return { ok: false as const, error: "Esta orden no es tuya." }
  if (order.status !== "escrowed")
    return { ok: false as const, error: "Esta orden no está lista para liberar el pago.", status: order.status }
  if (!isWorkerConfigured() || !order.escrow_address)
    return { ok: false as const, error: "La liberación on-chain no está disponible." }

  try {
    const { txHash } = await releaseEscrow(orderId)
    const admin = createAdminClient()
    await admin
      .from("orders")
      .update({ status: "settled", release_tx_hash: txHash, settled_at: new Date().toISOString() })
      .eq("id", orderId)
    await admin.from("order_events").insert({
      order_id: orderId,
      actor_id: user.id,
      event_type: "settled",
      payload: { status: "settled" },
      tx_hash: txHash,
    })

    try {
      const { data: prof } = await admin
        .from("profiles").select("phone").eq("id", order.client_id).single()
      const ref = order.purchase_ref ?? orderId.slice(0, 8)
      await notifyUser({
        userId: order.client_id,
        phone: prof?.phone ?? null,
        kind: "order_settled",
        orderId,
        body: `LANARK: tu compra ${ref} se completó y el pago fue liberado al vendedor. Comprobante: ${explorerTxUrl(txHash)}`,
      })
    } catch {
      /* ignore */
    }

    revalidatePath("/dashboard")
    return { ok: true as const, status: "settled" as const, txUrl: explorerTxUrl(txHash) }
  } catch (err) {
    console.error("[releaseOrder] error:", err)
    return { ok: false as const, error: "No pudimos liberar el pago. Intenta de nuevo." }
  }
}
