"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { formatPrice } from "@/lib/format"
import { productCusd, COP_PER_USD } from "@/lib/pricing"
import { SETTLEMENT_SYMBOL } from "@/lib/celo"
import { OPERATIONAL_SYMBOL } from "@/lib/currency"
import { checkoutCart, authorizeOrder } from "@/app/actions/checkout"
import copy from "@/lib/copy/en"

type Line = {
  id: string
  title: string
  image_url: string | null
  quantity: number
  unit_price_cents: number
  currency: string
}

type Group = {
  shopkeeper_id: string
  store_name: string
  store_slug: string | null
  lines: Line[]
}

function lineTotal(l: Line) {
  const cents = l.unit_price_cents ?? 0
  return cents * l.quantity
}

export default function CartView({
  groups: initial,
  defaultAddress = "",
}: {
  groups: Group[]
  defaultAddress?: string
}) {
  const router = useRouter()
  const [groups, setGroups] = React.useState<Group[]>(initial)
  const [address, setAddress] = React.useState(defaultAddress)
  const [placing, setPlacing] = React.useState(false)
  const [pendingId, setPendingId] = React.useState<string | null>(null)

  const empty = groups.every((g) => g.lines.length === 0)

  function patchLine(id: string, next: Partial<Line> | null) {
    setGroups((gs) =>
      gs
        .map((g) => ({
          ...g,
          lines:
            next === null
              ? g.lines.filter((l) => l.id !== id)
              : g.lines.map((l) => (l.id === id ? { ...l, ...next } : l)),
        }))
        .filter((g) => g.lines.length > 0),
    )
  }

  async function setQty(id: string, q: number) {
    if (q < 1 || pendingId) return
    setPendingId(id)
    const prev = groups
    patchLine(id, { quantity: q })
    try {
      const res = await fetch("/api/shopping-list", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, quantity: q }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setGroups(prev)
        toast.error(copy.cart.orderError)
      } else {
        router.refresh()
      }
    } catch {
      setGroups(prev)
      toast.error(copy.cart.orderError)
    } finally {
      setPendingId(null)
    }
  }

  async function removeLine(id: string) {
    if (pendingId) return
    setPendingId(id)
    const prev = groups
    patchLine(id, null)
    try {
      const res = await fetch("/api/shopping-list", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setGroups(prev)
        toast.error(copy.cart.orderError)
      } else {
        router.refresh()
      }
    } catch {
      setGroups(prev)
      toast.error(copy.cart.orderError)
    } finally {
      setPendingId(null)
    }
  }

  async function placeOrder() {
    if (!address.trim()) {
      toast.error(copy.cart.needAddress)
      return
    }
    setPlacing(true)
    try {
      const res = await checkoutCart(address.trim())
      if (!res.ok) {
        toast.error(res.error || copy.cart.orderError)
        setPlacing(false)
        return
      }
      // Move each freshly created (preinscribed) order to "pending" so it is
      // ready for the on-chain balance gate (confirm) on the dashboard.
      await Promise.all(
        (res.orders ?? []).map((o) =>
          authorizeOrder(o.order_id).catch(() => null),
        ),
      )
      toast.success(copy.cart.orderOk)
      setPlacing(false)
      const firstOrderId = res.orders?.[0]?.order_id
      router.push(firstOrderId ? `/dashboard?pay=${firstOrderId}` : "/dashboard")
    } catch {
      toast.error(copy.cart.orderError)
      setPlacing(false)
    }
  }

  if (empty) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/40 px-6 py-20 text-center">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {copy.cart.empty}
        </span>
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-accent bg-accent/10 px-4 py-2 text-xs text-accent transition hover:bg-accent/20"
        >
          {copy.cart.emptyCta}
        </Link>
      </div>
    )
  }

  // Grand totals per currency (currencies are not summed together).
  const totals = new Map<string, number>()
  for (const g of groups)
    for (const l of g.lines)
      totals.set(l.currency, (totals.get(l.currency) ?? 0) + lineTotal(l))

  // Operational settlement total: every line, regardless of native currency,
  // projects onto the same cUSD rail (USDm) and its peso view (COPm). This is
  // the amount the escrow actually moves on-chain.
  const settlementCusd = groups.reduce(
    (s, g) =>
      s +
      g.lines.reduce(
        (ls, l) => ls + productCusd(l.unit_price_cents, l.currency) * l.quantity,
        0,
      ),
    0,
  )
  const settlementCop = Math.round(settlementCusd * COP_PER_USD)

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      {/* Items grouped by seller (single-vendor settlement) */}
      <div className="flex flex-col gap-6">
        {groups.map((g) => {
          const sub = g.lines.reduce((s, l) => s + lineTotal(l), 0)
          const currency = g.lines[0]?.currency ?? "USD"
          return (
            <section
              key={g.shopkeeper_id}
              className="overflow-hidden rounded-xl border border-border/60 bg-card"
            >
              <header className="flex items-center justify-between gap-3 border-b border-border/50 bg-secondary/20 px-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    {copy.cart.byStore}
                  </span>
                  {g.store_slug ? (
                    <Link
                      href={`/store/${g.store_slug}`}
                      className="font-serif text-lg leading-tight transition-colors hover:text-accent"
                    >
                      {g.store_name}
                    </Link>
                  ) : (
                    <span className="font-serif text-lg leading-tight">
                      {g.store_name}
                    </span>
                  )}
                </div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatPrice(sub, currency)}
                </span>
              </header>

              <ul className="divide-y divide-border/40">
                {g.lines.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                      {l.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={l.image_url}
                          alt={l.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-1 text-center font-serif text-[10px] leading-tight text-muted-foreground">
                          {l.title}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {formatPrice(l.unit_price_cents, l.currency)} ·{" "}
                        {copy.cart.unit}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setQty(l.id, l.quantity - 1)}
                        disabled={l.quantity <= 1 || pendingId === l.id}
                        className="flex h-7 w-7 items-center justify-center rounded border border-border/50 text-sm hover:bg-accent/10 disabled:opacity-40"
                        aria-label="−"
                      >
                        −
                      </button>
                      <span className="w-7 text-center font-mono text-sm tabular-nums">
                        {l.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(l.id, l.quantity + 1)}
                        disabled={pendingId === l.id}
                        className="flex h-7 w-7 items-center justify-center rounded border border-border/50 text-sm hover:bg-accent/10 disabled:opacity-40"
                        aria-label="+"
                      >
                        +
                      </button>
                    </div>

                    <div className="w-20 shrink-0 text-right font-mono text-sm tabular-nums">
                      {formatPrice(lineTotal(l), l.currency)}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeLine(l.id)}
                      disabled={pendingId === l.id}
                      className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                    >
                      {copy.cart.remove}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      {/* Checkout summary */}
      <aside className="flex h-fit flex-col gap-4 rounded-xl border border-border/60 bg-card p-5 lg:sticky lg:top-20">
        <h2 className="font-serif text-xl">{copy.cart.grandTotal}</h2>
        <div className="flex flex-col gap-1.5 border-b border-border/40 pb-4">
          {Array.from(totals.entries()).map(([cur, amt]) => (
            <div
              key={cur}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{cur}</span>
              <span className="font-mono tabular-nums">
                {formatPrice(amt, cur)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 border-b border-border/40 pb-4">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span className="text-muted-foreground">Liquidación</span>
            <span className="font-mono tabular-nums">
              {settlementCusd.toFixed(2)} {SETTLEMENT_SYMBOL}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground/80">
            <span>En pesos</span>
            <span className="font-mono tabular-nums">
              {OPERATIONAL_SYMBOL} {settlementCop.toLocaleString("es-CO")}
            </span>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {copy.cart.shippingLabel}
          </span>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={copy.cart.shippingPlaceholder}
            rows={3}
            className="resize-none rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-accent/60"
          />
        </label>

        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          {copy.cart.singleVendorNote}
        </p>

        <button
          type="button"
          onClick={placeOrder}
          disabled={placing}
          className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:bg-accent/90 disabled:opacity-50"
        >
          {placing ? copy.cart.placing : copy.cart.checkout}
        </button>
      </aside>
    </div>
  )
}
