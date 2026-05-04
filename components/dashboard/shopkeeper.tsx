import Link from "next/link"
import type { Product, Offer, Order, Profile } from "@/lib/types"
import { formatPrice, shortAddress } from "@/lib/format"
import { microToCusd } from "@/lib/celo"
import { NewProductDialog } from "@/components/dashboard/new-product-dialog"
import { OfferDecisionButtons } from "@/components/dashboard/offer-decision"
import { EditProductDialog } from "@/components/dashboard/edit-product-dialog"
import { ProductActions } from "@/components/dashboard/product-actions"

export function ShopkeeperDashboard({
  profile,
  products,
  offers,
  orders,
}: {
  profile: Profile
  products: Product[]
  offers: Offer[]
  orders: Order[]
}) {
  const live = products.filter((p) => p.active).length
  const pending = offers.filter((o) => o.status === "pending").length
  const settledRevenue = orders
    .filter((o) => o.status === "confirmed")
    .reduce((sum, o) => sum + o.amount_cusd_micro, 0)

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Shopkeeper · {shortAddress(profile.primary_address)}
          </span>
          <h1 className="font-serif text-4xl tracking-tight">
            Inventory &amp; offers
          </h1>
        </div>
        <NewProductDialog />
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Live listings" value={live.toString()} />
        <Stat label="Pending offers" value={pending.toString()} accent />
        <Stat
          label="Revenue (cUSD)"
          value={microToCusd(settledRevenue)}
          mono
        />
        <Stat label="Orders" value={orders.length.toString()} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <span className="h-1 w-4 bg-accent" />
          Offers awaiting you
        </h2>
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
                    qty {o.qty} · {microToCusd(o.amount_cusd_micro)} cUSD ·{" "}
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

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <span className="h-1 w-4 bg-accent" />
          Your inventory
        </h2>
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

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/30 px-6 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}
