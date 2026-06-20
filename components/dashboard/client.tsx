"use client"

import Link from "next/link"
import type { Offer, Order, Profile } from "@/lib/types"
import { formatPrice, shortAddress } from "@/lib/format"
import { cusdWeiToHuman, SETTLEMENT_SYMBOL, explorerTxUrl } from "@/lib/celo"
import { formatCopm } from "@/lib/currency"
import { Button } from "@/components/ui/button"
import { AuthorizeOrderButton } from "@/components/dashboard/authorize-order"
import { SettleOrderButton, ReleaseOrderButton } from "@/components/dashboard/settle-order"

function safeWei(value: string | number | bigint | null | undefined): bigint {
  if (value === null || value === undefined || value === "") return BigInt(0)
  if (typeof value === "bigint") return value
  const raw = String(value).split(".")[0]
  if (!/^-?\d+$/.test(raw)) return BigInt(0)
  try {
    return BigInt(raw)
  } catch {
    return BigInt(0)
  }
}

export function ClientDashboard({
  profile,
  offers,
  orders,
}: {
  profile: Profile | null
  offers: Offer[]
  orders: Order[]
}) {
  const pending = offers.filter((o) => o.status === "pending").length
  const paidStates = ["escrowed", "settled", "confirmed"]
  const settled = orders.filter((o) => paidStates.includes(o.status)).length
  const totalSpent = orders
    .filter((o) => paidStates.includes(o.status))
    .reduce((s, o) => s + safeWei(o.total_cusd_wei ?? o.amount_cusd_wei), BigInt(0))

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Client · {shortAddress(profile?.primary_address)}
          </span>
          <h1 className="font-serif text-4xl tracking-tight">Your trades</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/chat">Ask the agent</Link>
          </Button>
          <Button asChild>
            <Link href="/">Browse marketplace</Link>
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Open offers" value={pending.toString()} accent />
        <Stat label="Completed orders" value={settled.toString()} />
        <Stat
          label={`Spent (${SETTLEMENT_SYMBOL})`}
          value={cusdWeiToHuman(totalSpent)}
          sub={formatCopm(totalSpent)}
          mono
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <span className="h-1 w-4 bg-accent" />
          Open offers
        </h2>
        {offers.length === 0 ? (
          <Empty
            href="/"
            cta="Find something to buy"
            text="No offers yet. Pick something from the marketplace and let the agent settle it."
          />
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card/40">
            {offers.map((o) => {
              const prod = (o as any).products
              return (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <Link
                    href={`/marketplace/${o.product_id}`}
                    className="flex min-w-0 flex-col gap-0.5 hover:text-accent"
                  >
                    <span className="truncate text-sm">
                      {prod?.title ?? "Listing"}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                      qty {o.qty} ·{" "}
                      {prod
                        ? formatPrice(prod.price_cents, prod.currency)
                        : "—"}{" "}
                      · offer {cusdWeiToHuman(o.amount_cusd_wei)} {SETTLEMENT_SYMBOL}
                    </span>
                  </Link>
                  <StatusPill status={o.status} />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <span className="h-1 w-4 bg-accent" />
          Order history
        </h2>
        {orders.length === 0 ? (
          <Empty text="No orders yet." />
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card/40">
            {orders.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm">
                    {(o as any).products?.title ?? "Order"}
                    {(o as any).purchase_ref ? (
                      <span className="ml-2 font-mono text-[10px] normal-case text-muted-foreground">
                        {(o as any).purchase_ref}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    {cusdWeiToHuman(o.total_cusd_wei ?? o.amount_cusd_wei)} {SETTLEMENT_SYMBOL}
                    <span className="ml-1 normal-case text-muted-foreground/70">
                      · {formatCopm(o.total_cusd_wei ?? o.amount_cusd_wei)}
                    </span>
                    {" · "}
                    {o.tx_hash ? (
                      <a
                        href={explorerTxUrl(o.tx_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent normal-case underline-offset-2 hover:underline"
                      >
                        {shortAddress(o.tx_hash)} ↗
                      </a>
                    ) : (
                      "sin tx"
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {o.status === "preinscribed" && (
                    <AuthorizeOrderButton orderId={o.id} />
                  )}
                  {(o.status === "pending" ||
                    o.status === "awaiting_settlement") && (
                    <SettleOrderButton orderId={o.id} />
                  )}
                  {o.status === "escrowed" && (
                    <ReleaseOrderButton orderId={o.id} />
                  )}
                  <StatusPill status={o.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
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
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
          {sub}
        </span>
      ) : null}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    pending: "border-border/60 text-muted-foreground",
    accepted: "border-accent/40 text-accent",
    rejected: "border-destructive/40 text-destructive",
    expired: "border-border/60 text-muted-foreground",
    settled: "border-accent/40 text-accent",
    confirmed: "border-accent/40 text-accent",
    escrowed: "border-emerald-500/40 text-emerald-400",
    submitted: "border-border/60 text-muted-foreground",
    preinscribed: "border-amber-500/40 text-amber-400",
    awaiting_settlement: "border-amber-500/40 text-amber-400",
    disputed: "border-destructive/40 text-destructive",
    failed: "border-destructive/40 text-destructive",
  }
  const label: Record<string, string> = {
    preinscribed: "por autorizar",
    pending: "por pagar",
    awaiting_settlement: "por pagar",
    escrowed: "en garantía",
    settled: "completado",
    confirmed: "completado",
  }
  return (
    <span
      className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${tone[status] ?? ""}`}
    >
      {label[status] ?? status}
    </span>
  )
}

function Empty({ text, href, cta }: { text: string; href?: string; cta?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-card/30 px-6 py-10 text-center text-sm text-muted-foreground">
      <span>{text}</span>
      {href && (
        <Button asChild variant="outline" size="sm">
          <Link href={href}>{cta}</Link>
        </Button>
      )}
    </div>
  )
}
