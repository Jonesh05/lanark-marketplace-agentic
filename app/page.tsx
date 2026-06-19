import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { SiteHeader } from "@/components/site-header"
import { ProductCard } from "@/components/product-card"
import MobileBand from "@/components/ui/mobile-band"
import { StoreRail } from "@/components/store-rail"
import type { Product } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "lucide-react"
import copy from "@/lib/copy/en"

export const dynamic = "force-dynamic"

type Search = { category?: string; q?: string; store?: string }
type StoreChipData = { name: string; slug: string }

async function fetchListings(filter: Search) {
  const supabase = await createClient()
  // Public marketplace surface: public_catalog exposes only active products
  // across ALL stores, joined with the store brand (Rappi/Amazon style).
  let q = supabase
    .from("public_catalog")
    .select("*", { count: "exact" })
    .order("rating", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(48)

  if (filter.category) {
    q = q.eq("category", filter.category.toLowerCase())
  }
  // Brand-scoped browsing: a client can drill into one seller by store slug.
  if (filter.store) {
    q = q.eq("store_slug", filter.store)
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
    .from("public_catalog")
    .select("category")
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

// Client-facing global view of sellers by brand name (e.g. "El Cafecito").
// A shopkeeper never sees this rail; it is the buyer's storefront directory.
async function fetchStores(): Promise<StoreChipData[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("stores")
    .select("name, slug")
    .eq("active", true)
    .not("slug", "is", null)
    .order("name", { ascending: true })
    .limit(24)
  return (data ?? [])
    .filter((s) => Boolean((s as any).slug))
    .map((s) => ({ name: (s as any).name as string, slug: (s as any).slug as string }))
}

type StoreGroup = { name: string; slug: string | null; items: Product[] }

// Group the live listings into per-seller bands so the buyer browses sellers
// as horizontal blocks (Rappi/Amazon style), each linking into its storefront.
function groupByStore(items: Product[]): StoreGroup[] {
  const map = new Map<string, StoreGroup>()
  for (const p of items) {
    const slug = (p.store_slug ?? null) as string | null
    const key = slug ?? p.store_name ?? "unknown"
    if (!map.has(key)) {
      map.set(key, { name: p.store_name ?? "Tienda", slug, items: [] })
    }
    map.get(key)!.items.push(p)
  }
  return Array.from(map.values())
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
    store: params.store?.toString(),
  }

  // No auto-sync - use /api/ingest to populate catalog. Fetch the three
  // independent surfaces in parallel to keep the homepage fast under load.
  const [{ items: list, count: total }, categories, stores] = await Promise.all([
    fetchListings(filter),
    fetchCategories(),
    fetchStores(),
  ])

  const activeStore = filter.store
    ? stores.find((s) => s.slug === filter.store)?.name ?? filter.store
    : null

  // Default marketplace view (no active filter) shows per-seller bands. Any
  // active filter (store/category/search) collapses to a uniform grid so the
  // result reads as one focused list.
  const showRails = !filter.store && !filter.category && !filter.q
  const rails = showRails ? groupByStore(list) : []

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
            {copy.hero.preline}
          </div>
          <h1 className="max-w-3xl font-serif text-6xl leading-[0.95] tracking-tight text-balance sm:text-7xl">
            {copy.hero.title}
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            {copy.hero.subtitle}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-11">
              <Link href="/auth/login">{copy.hero.ctaPrimary}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11">
              <Link href="/auth/login?role=shopkeeper" className="gap-2">
                {copy.hero.ctaSecondary}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border/60 pt-8 sm:grid-cols-4">
            {[
              { k: "Settlement", v: "USDm on Celo" },
              { k: "Catalog", v: "USD priced" },
              { k: "Cart & history", v: "Off-chain" },
              { k: "Sales", v: "On-chain" },
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

      {/* Store directory rail — clients browse sellers by brand name */}
      {stores.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-10">
          <div className="mb-3 flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="h-1 w-4 bg-accent" />
            Browse by store
          </div>
          <div className="flex flex-wrap gap-2">
            <StoreChip
              label="All stores"
              href={hrefWith(filter, { store: undefined })}
              active={!filter.store}
            />
            {stores.map((s) => (
              <StoreChip
                key={s.slug}
                label={s.name}
                href={hrefWith(filter, { store: s.slug })}
                active={filter.store === s.slug}
              />
            ))}
          </div>
        </section>
      )}

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
              href={hrefWith(filter, { category: undefined })}
              active={!filter.category}
              count={total}
            />
            {categories.map((c) => (
              <CategoryChip
                key={c.name}
                label={c.name}
                href={hrefWith(filter, { category: c.name })}
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
              {activeStore
                ? `Store · ${activeStore}`
                : filter.category
                  ? `Category · ${filter.category}`
                  : "Live listings"}
            </span>
            <h2 className="font-serif text-3xl tracking-tight">
              {activeStore
                ? `${activeStore} on the shelf`
                : filter.category
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
              {activeStore
                ? `Nothing from ${activeStore} right now.`
                : filter.category
                  ? `Nothing in ${filter.category} right now.`
                  : "No live listings yet. Sign in as a shopkeeper to put the first item on the shelf."}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/">Reset filters</Link>
            </Button>
          </div>
        ) : showRails && rails.length > 0 ? (
          // Per-seller horizontal bands (works on every breakpoint)
          <div className="flex flex-col gap-6">
            {rails.map((r) => (
              <StoreRail
                key={r.slug ?? r.name}
                name={r.name}
                slug={r.slug}
                items={r.items}
              />
            ))}
          </div>
        ) : (
          <div>
            {/* Mobile auto-rail (CSS/JS) */}
            <div className="block md:hidden">
              <MobileBand items={list} />
            </div>
            {/* Desktop: uniform marketplace grid — every card identical size */}
            <div className="hidden grid-cols-2 gap-4 md:grid md:grid-cols-3 lg:grid-cols-4">
              {list.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
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

// Build a homepage href that preserves the other active filters.
function hrefWith(
  current: Search,
  patch: Partial<Record<keyof Search, string | undefined>>,
): string {
  const next: Search = { ...current, ...patch }
  const sp = new URLSearchParams()
  if (next.category) sp.set("category", next.category)
  if (next.store) sp.set("store", next.store)
  if (next.q) sp.set("q", next.q)
  const qs = sp.toString()
  return qs ? `/?${qs}` : "/"
}

function StoreChip({
  label,
  href,
  active,
}: {
  label: string
  href: string
  active: boolean
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
      <span className="max-w-[12rem] truncate">{label}</span>
    </Link>
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
