import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { SiteHeader } from "@/components/site-header"
import { ProductCard } from "@/components/product-card"
import type { Product } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function Home() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(24)

  const list = (products ?? []) as Product[]

  return (
    <div className="min-h-svh">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div
          aria-hidden
          className="absolute inset-0 bg-grid opacity-25 [mask-image:radial-gradient(ellipse_at_top,oklch(0_0_0_/_0.5),transparent_70%)]"
        />
        <div
          aria-hidden
          className="absolute -right-40 top-1/2 h-96 w-96 -translate-y-1/2 rounded-full bg-accent/15 blur-3xl"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-20 sm:py-28">
          <div className="flex items-center gap-3 self-start font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            <span className="h-1 w-6 bg-accent" />
            agentic · cUSD · celo mainnet
          </div>
          <h1 className="max-w-3xl font-serif text-6xl leading-[0.95] tracking-tight text-balance sm:text-7xl">
            A marketplace where the
            <span className="italic text-accent"> agent does the work</span>.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            List inventory or place an offer in plain English. Sablon&apos;s
            agent quotes in COP, settles in cUSD, and sponsors gas on your
            first trade — no seed phrase, no spreadsheet.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-11">
              <Link href="/auth/login">Open the marketplace</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11">
              <Link href="/auth/login?role=shopkeeper" className="gap-2">
                List inventory
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border/60 pt-8 sm:grid-cols-4">
            {[
              { k: "Settlement", v: "cUSD on Celo" },
              { k: "Display", v: "COP, off-chain" },
              { k: "Wallets", v: "ERC-4337" },
              { k: "Gas", v: "Sponsored" },
            ].map((s) => (
              <div key={s.k} className="flex flex-col gap-1">
                <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {s.k}
                </dt>
                <dd className="text-sm">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Listings */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Live listings
            </span>
            <h2 className="font-serif text-3xl tracking-tight">
              On the shelf today
            </h2>
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {list.length.toString().padStart(3, "0")} items
          </span>
        </div>

        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/40 px-6 py-20 text-center">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              empty shelves
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">
              No live listings yet. Sign in as a shopkeeper to put the first
              item on the shelf.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/auth/login?role=shopkeeper">List something</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {list.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      <footer className="mx-auto flex max-w-6xl items-center justify-between gap-4 border-t border-border/60 px-4 py-8 text-[11px] text-muted-foreground">
        <span className="font-mono uppercase tracking-widest">
          Sablon · v0
        </span>
        <span className="font-mono uppercase tracking-widest">
          Celo · 42220
        </span>
      </footer>
    </div>
  )
}
