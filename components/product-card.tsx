import Link from "next/link"
import Image from "next/image"
import type { Product } from "@/lib/types"
import { formatPrice } from "@/lib/format"
import AddToListButton from "@/components/ui/add-to-list"
import FavoriteButton from "@/components/ui/favorite-button"
import ProductQuickView from "@/components/product-quick-view"

function SettleBadge({ token }: { token: string }) {
  return (
    <div className="absolute right-2 top-2 rounded-full border border-border/60 bg-background/85 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest text-muted-foreground backdrop-blur-sm">
      {token}
    </div>
  )
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <span className="inline-flex items-center rounded-sm border border-destructive/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-destructive">
        sold out
      </span>
    )
  }
  if (stock <= 10) {
    return (
      <span className="inline-flex items-center rounded-sm border border-amber-500/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-amber-400">
        {stock} left
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-sm border border-accent/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent">
      in stock
    </span>
  )
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating)
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`Rated ${rating.toFixed(1)} of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          aria-hidden
          className={
            "text-[11px] leading-none " +
            (i <= full ? "text-accent" : "text-border")
          }
        >
          ★
        </span>
      ))}
      <span className="ml-1 font-mono text-[10px] tabular-nums text-muted-foreground">
        {rating.toFixed(1)}
      </span>
    </div>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card animate-pulse">
      <div className="aspect-square w-full bg-secondary/50" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="h-3 w-3/4 rounded bg-secondary/60" />
        <div className="h-2.5 w-1/2 rounded bg-secondary/40" />
        <div className="mt-auto flex justify-between">
          <div className="h-5 w-20 rounded bg-secondary/60" />
          <div className="h-4 w-14 rounded bg-secondary/40" />
        </div>
      </div>
    </div>
  )
}

/**
 * World-class catalog card. Single fixed layout: every card has an identical
 * square media area and an equal-height body, so a grid of cards is perfectly
 * uniform regardless of whether a product has an image. No "initials" stand-in
 * — the product name is always the primary label.
 */
export function ProductCard({
  product,
  loading,
}: {
  product?: Product
  loading?: boolean
}) {
  if (loading || !product) return <ProductCardSkeleton />

  const imageSrc = product.image_url ?? product.thumbnail_url ?? null
  const hasImage = Boolean(imageSrc)
  const isSoldOut = product.stock <= 0
  const cop = product.price_cop

  return (
    <article
      aria-label={product.title}
      data-sold-out={isSoldOut || undefined}
      className={
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-all duration-200 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 " +
        (isSoldOut ? "opacity-70" : "")
      }
    >
      {/* Uniform square media area for every card */}
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        <Link
          href={`/marketplace/${product.id}`}
          className="absolute inset-0 block"
          aria-label={product.title}
        >
          {hasImage ? (
            imageSrc!.includes("collection.cloudinary.com") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageSrc!}
                alt={product.title}
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
              />
            ) : (
              <Image
                src={imageSrc!}
                alt={product.title}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover transition duration-500 group-hover:scale-[1.04]"
              />
            )
          ) : (
            // Image-less fallback that keeps the SAME square footprint: the
            // product name is shown large and centered (never initials).
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-secondary/40 to-muted px-4 text-center">
              {product.category && (
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                  {product.category}
                </span>
              )}
              <span className="line-clamp-4 font-serif text-base leading-tight text-foreground/90">
                {product.title}
              </span>
            </div>
          )}
        </Link>

        <div className="absolute left-2 top-2 z-10">
          <FavoriteButton productId={product.id} />
        </div>

        <SettleBadge token={product.settle_token} />

        {typeof product.discount_percentage === "number" &&
          product.discount_percentage > 0 && (
            <div className="absolute right-2 top-9 rounded-sm bg-accent px-1.5 py-0.5 font-mono text-[9px] font-semibold text-accent-foreground">
              -{Math.round(product.discount_percentage)}%
            </div>
          )}

        {isSoldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-destructive">
              Sold out
            </span>
          </div>
        )}

        {/* Quick-view appears on hover, never shifts layout */}
        {!isSoldOut && (
          <div className="absolute inset-x-2 bottom-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <ProductQuickView product={product} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-h-[2.5rem]">
          <Link href={`/marketplace/${product.id}`} className="block">
            <h3 className="line-clamp-2 text-sm font-medium leading-snug text-balance transition-colors group-hover:text-accent">
              {product.title}
            </h3>
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {product.store_name &&
              (product.store_slug ? (
                <Link
                  href={`/store/${product.store_slug}`}
                  className="inline-flex max-w-full items-center gap-1 truncate rounded-sm bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent transition-colors hover:bg-accent/20 hover:text-accent"
                  aria-label={`Ver la tienda ${product.store_name}`}
                >
                  {product.store_name}
                </Link>
              ) : (
                <span className="inline-flex max-w-full items-center gap-1 truncate rounded-sm bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent">
                  {product.store_name}
                </span>
              ))}
            {product.brand && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {product.brand}
              </span>
            )}
            {product.category && (
              <span className="rounded-sm bg-secondary/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                {product.category}
              </span>
            )}
          </div>
        </div>

        {typeof product.rating === "number" && product.rating > 0 ? (
          <Stars rating={product.rating} />
        ) : (
          <div className="h-[14px]" aria-hidden />
        )}

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-border/40 pt-2">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-base font-semibold tabular-nums text-foreground">
              {formatPrice(product.price_cents, product.currency)}
            </span>
            {typeof cop === "number" && cop > 0 ? (
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                ≈ COP {cop.toLocaleString("es-CO")}
              </span>
            ) : (
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                per unit · {product.settle_token}
              </span>
            )}
          </div>
          <StockBadge stock={product.stock} />
        </div>

        <div className="mt-1 flex items-center gap-1.5">
          {!isSoldOut && <AddToListButton productId={product.id} />}
          <Link
            href={`/marketplace/${product.id}`}
            className={
              "inline-flex items-center gap-1 rounded border border-border/40 bg-card/20 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent " +
              (isSoldOut ? "flex-1 justify-center" : "")
            }
          >
            {isSoldOut ? "Ver" : "Ver producto"}
          </Link>
        </div>
      </div>
    </article>
  )
}
