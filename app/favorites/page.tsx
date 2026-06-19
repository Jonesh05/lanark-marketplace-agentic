import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { SiteHeader } from "@/components/site-header"
import { ProductCard } from "@/components/product-card"
import type { Product } from "@/lib/types"
import copy from "@/lib/copy/en"

export const dynamic = "force-dynamic"

export default async function FavoritesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/favorites")

  // FK favorites.product_id -> products lets us embed the product row directly.
  const { data: favs } = await supabase
    .from("favorites")
    .select("product_id, created_at, products(*)")
    .order("created_at", { ascending: false })

  const items = ((favs ?? []) as any[])
    .map((f) => (Array.isArray(f.products) ? f.products[0] : f.products))
    .filter(Boolean) as Product[]

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8 flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {copy.favorites.navLabel}
          </span>
          <h1 className="font-serif text-3xl tracking-tight">
            {copy.favorites.title}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            {copy.favorites.subtitle}
          </p>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/40 px-6 py-20 text-center">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {copy.favorites.empty}
            </span>
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-accent bg-accent/10 px-4 py-2 text-xs text-accent transition hover:bg-accent/20"
            >
              {copy.favorites.emptyCta}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
