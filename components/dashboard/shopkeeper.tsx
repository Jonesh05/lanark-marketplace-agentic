import Link from "next/link"
import type { Product, Offer, Order, OrderItem, Profile, Store } from "@/lib/types"
import type { SellerMetrics } from "@/lib/metrics/seller"
import { formatPrice, shortAddress } from "@/lib/format"
import { cusdWeiToHuman, SETTLEMENT_SYMBOL, explorerTxUrl } from "@/lib/celo"
import { formatCopm } from "@/lib/currency"
import { NewProductDialog } from "@/components/dashboard/new-product-dialog"
import { OfferDecisionButtons } from "@/components/dashboard/offer-decision"
import { EditProductDialog } from "@/components/dashboard/edit-product-dialog"
import { ProductActions } from "@/components/dashboard/product-actions"
import { OrderFulfillmentActions } from "@/components/dashboard/order-fulfillment"
import { ReleaseOrderButton } from "@/components/dashboard/settle-order"

import { ExternalLink } from "lucide-react"

const FULFILLMENT_LABEL: Record<string, string> = {
  pending_review: "por aprobar",
  accepted: "aceptada",
  preparing: "en preparación",
  dispatched: "despachada",
  delivered: "entregada",
  rejected: "rechazada",
  cancelled: "cancelada",
}

const FULFILLMENT_TONE: Record<string, string> = {
  pending_review: "border-amber-500/40 text-amber-400",
  accepted: "border-accent/40 text-accent",
  preparing: "border-accent/40 text-accent",
  dispatched: "border-sky-500/40 text-sky-400",
  delivered: "border-emerald-500/40 text-emerald-400",
  rejected: "border-destructive/40 text-destructive",
  cancelled: "border-destructive/40 text-destructive",
}

const PAYMENT_LABEL: Record<string, string> = {
  preinscribed: "por autorizar",
  pending: "pago pendiente",
  awaiting_settlement: "pago en curso",
  escrowed: "pagada (garantía)",
  submitted: "enviada",
  settled: "pagada",
  confirmed: "pagada",
  failed: "fallida",
  disputed: "en disputa",
  cancelled: "cancelada",
}

const ACTIVE_FULFILLMENT = new Set([
  "pending_review",
  "accepted",
  "preparing",
  "dispatched",
])

export function ShopkeeperDashboard({
  profile,
  store,
  products,
  offers,
  orders,
  orderItems,
  metrics,
}: {
  profile: Profile | null
  store: Store | null
  products: Product[]
  offers: Offer[]
  orders: Order[]
  orderItems: OrderItem[]
  metrics: SellerMetrics
}) {
  const live = products.filter((p) => p.active).length
  const pendingOffers = offers.filter((o) => o.status === "pending").length

  // First line-item title per order, for human-readable order rows.
  const titleByOrder = new Map<string, string>()
  for (const it of orderItems) {
    if (!titleByOrder.has(it.order_id)) titleByOrder.set(it.order_id, it.title_snapshot)
  }

  const activeOrders = orders.filter((o) =>
    ACTIVE_FULFILLMENT.has(o.fulfillment_status ?? "pending_review"),
  )
  const toReview = activeOrders.filter(
    (o) => (o.fulfillment_status ?? "pending_review") === "pending_review",
  ).length

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Shopkeeper · {shortAddress(profile?.primary_address)}
          </span>
          <h1 className="font-serif text-4xl tracking-tight">
            {store?.name ?? "Inventory & offers"}
          </h1>
          {store ? (
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Storefront · {store.slug ?? "—"}
            </span>
          ) : (
            <Link
              href="/profile"
              className="font-mono text-[11px] uppercase tracking-widest text-accent hover:underline"
            >
              Name your store →
            </Link>
          )}
        </div>
        <NewProductDialog />
      </header>

      {/* Business metrics */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label={`Ingresos (${SETTLEMENT_SYMBOL})`}
          value={cusdWeiToHuman(metrics.revenueWei)}
          sub={formatCopm(metrics.revenueWei)}
          mono
        />
        <Stat
          label="Ventas hoy"
          value={`${metrics.salesTodayCount}`}
          sub={`${cusdWeiToHuman(metrics.salesTodayWei)} ${SETTLEMENT_SYMBOL}`}
          accent
        />
        <Stat
          label="Ventas 7 días"
          value={`${metrics.salesWeekCount}`}
          sub={`${cusdWeiToHuman(metrics.salesWeekWei)} ${SETTLEMENT_SYMBOL}`}
        />
        <Stat label="Ticket promedio" value={cusdWeiToHuman(metrics.avgTicketWei)} mono />
        <Stat
          label="Pedidos"
          value={`${metrics.ordersSale}`}
          sub={`de ${metrics.ordersTotal} · ${metrics.conversionPct}% conv.`}
        />
        <Stat
          label="Clientes"
          value={`${metrics.recurringCustomers}`}
          sub={`recurrentes · ${metrics.newCustomers} nuevos`}
        />
      </section>

      {/* Secondary KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Listings activos" value={live.toString()} />
        <Stat label="Ofertas pendientes" value={pendingOffers.toString()} accent />
        <Stat label="Por aprobar" value={toReview.toString()} accent />
        <Stat label="Inventario crítico" value={metrics.criticalInventory.length.toString()} />
      </section>

      {/* Order fulfillment queue */}
      <section className="flex flex-col gap-4">
        <SectionTitle>Pedidos · gestión</SectionTitle>
        {activeOrders.length === 0 ? (
          <EmptyRow text="No hay pedidos activos. Cuando un cliente compre, aparecerá aquí para que lo apruebes y despaches." />
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card/40">
            {activeOrders.map((o) => {
              const f = o.fulfillment_status ?? "pending_review"
              return (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm">
                      {titleByOrder.get(o.id) ?? "Pedido"}
                      {o.purchase_ref ? (
                        <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                          {o.purchase_ref}
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                      {cusdWeiToHuman(o.total_cusd_wei ?? o.amount_cusd_wei)} {SETTLEMENT_SYMBOL} · {formatCopm(o.total_cusd_wei ?? o.amount_cusd_wei)} · cliente {shortAddress(o.client_id)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={PAYMENT_TONE(o.status)} text={PAYMENT_LABEL[o.status] ?? o.status} />
                    <Pill tone={FULFILLMENT_TONE[f] ?? ""} text={FULFILLMENT_LABEL[f] ?? f} />
                    {(o.deposit_tx_hash || o.tx_hash) && (
                      <a
                        href={explorerTxUrl((o.deposit_tx_hash ?? o.tx_hash) as string)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-accent hover:underline"
                      >
                        pago ↗
                      </a>
                    )}
                    {o.release_tx_hash && (
                      <a
                        href={explorerTxUrl(o.release_tx_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-emerald-400 hover:underline"
                      >
                        liberado <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                    {o.status === "escrowed" && (
                      <ReleaseOrderButton orderId={o.id} label="Liberar pago" />
                    )}
                    <OrderFulfillmentActions orderId={o.id} status={f} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Top products + No movement + Critical inventory */}
      <section className="grid gap-6 lg:grid-cols-3">
        <Panel title="Más vendidos">
          {metrics.topProducts.length === 0 ? (
            <PanelEmpty text="Aún sin ventas registradas." />
          ) : (
            <ul className="flex flex-col gap-2">
              {metrics.topProducts.map((p) => (
                <li key={p.productId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{p.title}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {p.units}u · {cusdWeiToHuman(p.revenueWei)} {SETTLEMENT_SYMBOL}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Sin movimiento">
          {metrics.noMovement.length === 0 ? (
            <PanelEmpty text="Todos tus productos activos han vendido." />
          ) : (
            <ul className="flex flex-col gap-2">
              {metrics.noMovement.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{p.title}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    stock {p.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Inventario crítico">
          {metrics.criticalInventory.length === 0 ? (
            <PanelEmpty text="Sin productos en nivel crítico." />
          ) : (
            <ul className="flex flex-col gap-2">
              {metrics.criticalInventory.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{p.title}</span>
                  <span
                    className={
                      "shrink-0 font-mono text-[11px] " +
                      (p.stock <= 0 ? "text-destructive" : "text-amber-400")
                    }
                  >
                    stock {p.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {/* Offers */}
      <section className="flex flex-col gap-4">
        <SectionTitle>Ofertas dirigidas a ti</SectionTitle>
        {offers.length === 0 ? (
          <EmptyRow text="No offers yet. Listings show up here when a client makes a bid." />
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card/40">
            {offers.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm">
                    {(o as any).products?.title ?? "Item"}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    qty {o.qty} · {cusdWeiToHuman(o.amount_cusd_wei)} {SETTLEMENT_SYMBOL} ·{" "}
                    {o.status}
                  </span>
                </div>
                {o.status === "pending" ? (
                  <OfferDecisionButtons offerId={o.id} />
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {o.status}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Inventory */}
      <section className="flex flex-col gap-4">
        <SectionTitle>Tu inventario</SectionTitle>
        {products.length === 0 ? (
          <EmptyRow text="No products yet. Add your first listing." />
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card/40">
            {products.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <Link
                  href={`/marketplace/${p.id}`}
                  className="flex min-w-0 flex-1 flex-col gap-0.5 hover:text-accent"
                >
                  <span className="truncate text-sm">{p.title}</span>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    {formatPrice(p.price_cents, p.currency)} · stock {p.stock}
                  </span>
                </Link>
                <div className="flex items-center gap-2">
                  <EditProductDialog product={p} />
                  <ProductActions product={p} />
                  <span
                    className={
                      "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest " +
                      (p.active
                        ? "border-accent/40 text-accent"
                        : "border-border/60 text-muted-foreground")
                    }
                  >
                    {p.active ? "live" : "paused"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

function PAYMENT_TONE(status: string): string {
  if (status === "settled" || status === "confirmed" || status === "escrowed")
    return "border-emerald-500/40 text-emerald-400"
  if (status === "failed" || status === "disputed" || status === "cancelled")
    return "border-destructive/40 text-destructive"
  if (status === "preinscribed" || status === "awaiting_settlement")
    return "border-amber-500/40 text-amber-400"
  return "border-border/60 text-muted-foreground"
}

function Pill({ tone, text }: { tone: string; text: string }) {
  return (
    <span
      className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${tone}`}
    >
      {text}
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
      <span className="h-1 w-4 bg-accent" />
      {children}
    </h2>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {title}
      </span>
      {children}
    </div>
  )
}

function PanelEmpty({ text }: { text: string }) {
  return <span className="text-sm text-muted-foreground">{text}</span>
}

function Stat({
  label,
  value,
  sub,
  accent,
  mono,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border/60 bg-card/40 p-4">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className={
          "text-2xl tabular-nums " +
          (mono ? "font-mono " : "font-serif ") +
          (accent ? "text-accent" : "")
        }
      >
        {value}
      </span>
      {sub ? (
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {sub}
        </span>
      ) : null}
    </div>
  )
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/30 px-6 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}
