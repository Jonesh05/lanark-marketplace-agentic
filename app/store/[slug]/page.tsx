import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SiteHeader } from "@/components/site-header"
import { ProductCard } from "@/components/product-card"
import type { Product } from "@/lib/types"
import copy from "@/lib/copy/en"

export const dynamic = "force-dynamic"

/**
 * Full storefront for a single seller. Reachable from any product card or cart
 * group by clicking the store name. Shows the store brand header plus every
 * active product of that seller. Buying still happens per-store (single-vendor
 * checkout), so this is the natural "enter the shop" surface for the client.
 */
export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: store } = await supabase
    .from("stores")
    .select("name, slug, description, logo_url, country")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle()

  if (!store) notFound()

  const { data: products } = await supabase
    .from("public_catalog")
    .select("*")
    .eq("store_slug", slug)
    .order("rating", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(96)

  const items = (products ?? []) as Product[]
  const storeName = (store as { name: string }).name
  const description = (store as { description: string | null }).description
  const logoUrl = (store as { logo_url: string | null }).logo_url
  const country = (store as { country: string | null }).country

  return (
    <div className="min-h-svh">
      <SiteHeader />

      {/* Brand header */}
      <section className="border-b border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-accent"
          >
            ← {copy.store.back}
          </Link>
          <div className="flex items-center gap-5">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-muted">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={storeName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-serif text-2xl text-muted-foreground">
                  {storeName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="font-serif text-4xl leading-none tracking-tight">
                {storeName}
              </h1>
              {description && (
                <p className="max-w-xl text-sm text-muted-foreground">
                  {description}
                </p>
              )}
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {items.length} {copy.store.products}
                {country ? ` · ${country}` : ""}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/40 px-6 py-20 text-center">
            <p className="text-sm text-muted-foreground">{copy.store.empty}</p>
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
