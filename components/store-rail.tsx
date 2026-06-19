import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { ProductCard } from "@/components/product-card"
import type { Product } from "@/lib/types"
import copy from "@/lib/copy/en"

/**
 * Client-facing seller band: a soft-bordered block that groups one store's
 * products in a horizontally scrollable rail. The store name is an action
 * link into that seller's full storefront (/store/[slug]). This is the buyer's
 * "browse by seller" surface — a shopkeeper never renders this.
 */
export function StoreRail({
  name,
  slug,
  items,
}: {
  name: string
  slug: string | null
  items: Product[]
}) {
  if (items.length === 0) return null

  return (
    <section className="rounded-2xl border border-border/60 bg-card/30 p-4 sm:p-5">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {copy.store.by}
          </span>
          {slug ? (
            <Link
              href={`/store/${slug}`}
              className="group/store inline-flex items-center gap-1.5"
              aria-label={`${copy.store.viewStore} ${name}`}
            >
              <h3 className="truncate font-serif text-xl tracking-tight transition-colors group-hover/store:text-accent">
                {name}
              </h3>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover/store:text-accent" />
            </Link>
          ) : (
            <h3 className="truncate font-serif text-xl tracking-tight">{name}</h3>
          )}
        </div>
        {slug && (
          <Link
            href={`/store/${slug}`}
            className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-accent"
          >
            {copy.store.viewStore} →
          </Link>
        )}
      </header>

      {/* Horizontal rail — native scroll, touch-friendly, thin scrollbar */}
      <div className="overflow-x-auto pb-2 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        <div className="flex gap-4" style={{ width: "max-content" }}>
          {items.map((p) => (
            <div key={p.id} className="w-[210px] shrink-0 sm:w-[230px]">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
