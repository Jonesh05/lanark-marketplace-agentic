import type { Order, OrderItem, Product } from "@/lib/types"

/**
 * Seller analytics, computed as a pure function over already-fetched rows so it
 * is deterministic and unit-testable (pass `now` to freeze time windows).
 *
 * Revenue model: with no escrow deployed yet, "committed sales" are orders the
 * buyer has authorized — anything past `preinscribed` that is not cancelled or
 * failed. `preinscribed` is intent without authorization and never counts as
 * revenue; `cancelled`/`failed`/`disputed` are excluded. All money is integer
 * wei stored as numeric strings.
 */

const SALE_STATUSES = new Set([
  "pending",
  "submitted",
  "awaiting_settlement",
  "settled",
  "confirmed",
])

const DAY_MS = 86_400_000
const CRITICAL_STOCK = 5

export interface TopProduct {
  productId: string
  title: string
  units: number
  revenueWei: string
}

export interface SellerMetrics {
  revenueWei: string
  ordersTotal: number
  ordersSale: number
  salesTodayCount: number
  salesTodayWei: string
  salesWeekCount: number
  salesWeekWei: string
  avgTicketWei: string
  conversionPct: number
  newCustomers: number
  recurringCustomers: number
  byFulfillment: Record<string, number>
  byPaymentStatus: Record<string, number>
  topProducts: TopProduct[]
  noMovement: { id: string; title: string; stock: number }[]
  criticalInventory: { id: string; title: string; stock: number }[]
}

/** numeric(wei) strings represent integers; take the integer part defensively. */
const ZERO = BigInt(0)

function toWei(v: string | null | undefined): bigint {
  if (!v) return ZERO
  const intPart = String(v).split(".")[0].replace(/[^0-9-]/g, "")
  if (!intPart || intPart === "-") return ZERO
  try {
    return BigInt(intPart)
  } catch {
    return ZERO
  }
}

function orderWei(o: Order): bigint {
  // total_cusd_wei is the cart-level total; fall back to the single-line amount.
  return toWei(o.total_cusd_wei ?? o.amount_cusd_wei)
}

function startOfUtcDay(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function computeSellerMetrics(
  orders: Order[],
  items: OrderItem[],
  products: Product[],
  now: number = Date.now(),
): SellerMetrics {
  const todayStart = startOfUtcDay(now)
  const weekStart = now - 7 * DAY_MS

  const saleOrders = orders.filter((o) => SALE_STATUSES.has(o.status))
  const saleOrderIds = new Set(saleOrders.map((o) => o.id))

  let revenueWei = ZERO
  let salesTodayWei = ZERO
  let salesTodayCount = 0
  let salesWeekWei = ZERO
  let salesWeekCount = 0

  const byClient = new Map<string, number>()

  for (const o of saleOrders) {
    const wei = orderWei(o)
    revenueWei += wei
    const t = Date.parse(o.created_at)
    if (!Number.isNaN(t)) {
      if (t >= todayStart) {
        salesTodayWei += wei
        salesTodayCount += 1
      }
      if (t >= weekStart) {
        salesWeekWei += wei
        salesWeekCount += 1
      }
    }
    if (o.client_id) byClient.set(o.client_id, (byClient.get(o.client_id) ?? 0) + 1)
  }

  let recurringCustomers = 0
  let newCustomers = 0
  for (const count of byClient.values()) {
    if (count >= 2) recurringCustomers += 1
    else newCustomers += 1
  }

  const byFulfillment: Record<string, number> = {}
  const byPaymentStatus: Record<string, number> = {}
  for (const o of orders) {
    const f = o.fulfillment_status ?? "pending_review"
    byFulfillment[f] = (byFulfillment[f] ?? 0) + 1
    byPaymentStatus[o.status] = (byPaymentStatus[o.status] ?? 0) + 1
  }

  // Top products: aggregate line items that belong to committed sale orders.
  const agg = new Map<string, { title: string; units: number; revenue: bigint }>()
  const movedProductIds = new Set<string>()
  for (const it of items) {
    if (!saleOrderIds.has(it.order_id)) continue
    movedProductIds.add(it.product_id)
    const prev = agg.get(it.product_id) ?? {
      title: it.title_snapshot ?? "Item",
      units: 0,
      revenue: ZERO,
    }
    prev.units += it.quantity ?? 0
    prev.revenue += toWei(it.line_total_cusd_wei)
    agg.set(it.product_id, prev)
  }

  const topProducts: TopProduct[] = [...agg.entries()]
    .map(([productId, v]) => ({
      productId,
      title: v.title,
      units: v.units,
      revenueWei: v.revenue.toString(),
    }))
    .sort((a, b) => {
      const d = toWei(b.revenueWei) - toWei(a.revenueWei)
      return d > ZERO ? 1 : d < ZERO ? -1 : b.units - a.units
    })
    .slice(0, 5)

  const noMovement = products
    .filter((p) => p.active && !movedProductIds.has(p.id))
    .slice(0, 8)
    .map((p) => ({ id: p.id, title: p.title, stock: p.stock }))

  const criticalInventory = products
    .filter((p) => p.active && (p.stock ?? 0) <= CRITICAL_STOCK)
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
    .slice(0, 8)
    .map((p) => ({ id: p.id, title: p.title, stock: p.stock }))

  const ordersSale = saleOrders.length
  const ordersTotal = orders.length
  const avgTicketWei = ordersSale > 0 ? (revenueWei / BigInt(ordersSale)).toString() : "0"
  const conversionPct =
    ordersTotal > 0 ? Math.round((ordersSale / ordersTotal) * 100) : 0

  return {
    revenueWei: revenueWei.toString(),
    ordersTotal,
    ordersSale,
    salesTodayCount,
    salesTodayWei: salesTodayWei.toString(),
    salesWeekCount,
    salesWeekWei: salesWeekWei.toString(),
    avgTicketWei,
    conversionPct,
    newCustomers,
    recurringCustomers,
    byFulfillment,
    byPaymentStatus,
    topProducts,
    noMovement,
    criticalInventory,
  }
}
