import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { SiteHeader } from "@/components/site-header"
import { ProductCard } from "@/components/product-card"
import type { Product } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "lucide-react"
import { syncDummyJsonCatalog } from "@/lib/dummyjson"

export const dynamic = "force-dynamic"

type Search = { category?: string; q?: string }

async function fetchListings(filter: Search) {
  const supabase = await createClient()
  let q = supabase
    .from("products")
    .select("*", { count: "exact" })
    .eq("active", true)
    .order("rating", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(48)

  if (filter.category) {
    q = q.eq("category", filter.category.toLowerCase())
  }
  if (filter.q && filter.q.trim().length > 0) {
    const t = filter.q.replace(/[%,]/g, " ").trim()
    q = q.or(`title.ilike.%${t}%,description.ilike.%${t}%`)
  }

  const { data, count } = await q
  return { items: (data ?? []) as Product[], count: count ?? 0 }
}

async function fetchCategories() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("products")
    .select("category")
    .eq("active", true)
    .not("category", "is", null)
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const c = (row as any).category as string | null
    if (!c) continue
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 16)
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const params = await searchParams
  const filter: Search = {
    category: params.category?.toString(),
    q: params.q?.toString(),
  }

  // Bootstrap: if the catalog is empty, ingest DummyJSON once.
  let { items: list, count: total } = await fetchListings(filter)
  if (total === 0 && !filter.category && !filter.q) {
    try {
      await syncDummyJsonCatalog()
      ;({ items: list, count: total } = await fetchListings(filter))
    } catch (err) {
      console.error("[v0] Initial DummyJSON sync failed:", err)
    }
  }

  const categories = await fetchCategories()

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
            Browse a real product catalog, place an offer in plain English,
            and let Lanark&apos;s agent settle the trade in cUSD on Celo —
            no seed phrase, no spreadsheet, gas sponsored on your first trade.
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
              { k: "Catalog", v: "USD priced" },
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

      {/* Category rail */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-10">
          <div className="mb-3 flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="h-1 w-4 bg-accent" />
            Browse by category
          </div>
          <div className="flex flex-wrap gap-2">
            <CategoryChip
              label="All"
              href="/"
              active={!filter.category}
              count={total}
            />
            {categories.map((c) => (
              <CategoryChip
                key={c.name}
                label={c.name}
                href={`/?category=${encodeURIComponent(c.name)}`}
                active={filter.category === c.name}
                count={c.count}
              />
            ))}
          </div>
        </section>
      )}

      {/* Listings */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {filter.category
                ? `Category · ${filter.category}`
                : "Live listings"}
            </span>
            <h2 className="font-serif text-3xl tracking-tight">
              {filter.category
                ? `${cap(filter.category)} on the shelf`
                : "On the shelf today"}
            </h2>
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {list.length.toString().padStart(3, "0")} of {total} shown
          </span>
        </div>

        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/40 px-6 py-20 text-center">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              empty shelves
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">
              {filter.category
                ? `Nothing in ${filter.category} right now.`
                : "No live listings yet. Sign in as a shopkeeper to put the first item on the shelf."}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/">Reset filters</Link>
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
          Lanark · agentic
        </span>
        <span className="font-mono uppercase tracking-widest">
          Celo · 42220
        </span>
      </footer>
    </div>
  )
}

function CategoryChip({
  label,
  href,
  active,
  count,
}: {
  label: string
  href: string
  active: boolean
  count: number
}) {
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition " +
        (active
          ? "border-accent bg-accent/10 text-accent"
          : "border-border/60 bg-card/40 text-muted-foreground hover:border-accent/40 hover:text-foreground")
      }
    >
      <span className="capitalize">{label}</span>
      <span className="font-mono text-[10px] tabular-nums opacity-70">
        {count}
      </span>
    </Link>
  )
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
