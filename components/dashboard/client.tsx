import Link from "next/link"
import type { Offer, Order, Profile } from "@/lib/types"
import { formatPrice, shortAddress } from "@/lib/format"
import { microToCusd } from "@/lib/celo"
import { Button } from "@/components/ui/button"

export function ClientDashboard({
  profile,
  offers,
  orders,
}: {
  profile: Profile
  offers: Offer[]
  orders: Order[]
}) {
  const pending = offers.filter((o) => o.status === "pending").length
  const settled = orders.filter((o) => o.status === "confirmed").length
  const totalSpent = orders
    .filter((o) => o.status === "confirmed")
    .reduce((s, o) => s + o.amount_cusd_micro, 0)

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Client · {shortAddress(profile.primary_address)}
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
        <Stat label="Spent (cUSD)" value={microToCusd(totalSpent)} mono />
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
                      · offer {microToCusd(o.amount_cusd_micro)} cUSD
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
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    {microToCusd(o.amount_cusd_micro)} cUSD ·{" "}
                    {o.tx_hash ? shortAddress(o.tx_hash) : "no tx"}
                  </span>
                </div>
                <StatusPill status={o.status} />
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
  accent,
  mono,
}: {
  label: string
  value: string
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
    submitted: "border-border/60 text-muted-foreground",
    failed: "border-destructive/40 text-destructive",
  }
  return (
    <span
      className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${tone[status] ?? ""}`}
    >
      {status}
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
