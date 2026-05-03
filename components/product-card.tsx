import Link from "next/link"
import Image from "next/image"
import type { Product } from "@/lib/types"
import { formatPrice } from "@/lib/format"

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/marketplace/${product.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition hover:border-accent/40"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-grid">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              no image
            </span>
          </div>
        )}
        <div className="absolute right-2 top-2 rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest text-muted-foreground backdrop-blur">
          {product.settle_token}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-medium text-balance">
            {product.title}
          </h3>
          <span className="shrink-0 font-mono text-xs tabular-nums text-foreground">
            {formatPrice(product.price_cents, product.currency)}
          </span>
        </div>
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {product.description || "No description provided."}
        </p>
        <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>
            {product.stock > 0 ? `${product.stock} in stock` : "Sold out"}
          </span>
          <span className="text-accent">
            {product.active ? "live" : "paused"}
          </span>
        </div>
      </div>
    </Link>
  )
}
