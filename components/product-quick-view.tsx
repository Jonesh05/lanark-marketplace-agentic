"use client"

import Link from "next/link"
import Image from "next/image"
import type { Product } from "@/lib/types"
import { formatPrice } from "@/lib/format"
import AddToListButton from "@/components/ui/add-to-list"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/**
 * Quick-view modal: fast product glance without leaving the listing. Uses the
 * shared Radix Dialog. The full detail + checkout lives at /marketplace/[id].
 */
export default function ProductQuickView({ product }: { product: Product }) {
  const imageSrc = product.image_url ?? product.thumbnail_url ?? null
  const cop = product.price_cop
  const isSoldOut = product.stock <= 0

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="w-full rounded-md border border-border/60 bg-background/85 px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-foreground backdrop-blur-sm transition-colors hover:border-accent/50 hover:text-accent"
        >
          Quick view
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-balance">{product.title}</DialogTitle>
          {product.brand && (
            <DialogDescription className="font-mono text-[10px] uppercase tracking-widest">
              {product.brand}
              {product.category ? ` · ${product.category}` : ""}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex gap-4">
          <div className="relative aspect-square w-32 shrink-0 overflow-hidden rounded-lg bg-muted">
            {imageSrc ? (
              imageSrc.includes("collection.cloudinary.com") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageSrc}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Image
                  src={imageSrc}
                  alt={product.title}
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center p-2 text-center font-serif text-xs text-foreground/80">
                {product.title}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {product.description && (
              <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            )}
            <div className="mt-auto flex flex-col gap-0.5">
              <span className="font-mono text-lg font-semibold tabular-nums">
                {formatPrice(product.price_cents, product.currency)}
              </span>
              {typeof cop === "number" && cop > 0 && (
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  ≈ COP {cop.toLocaleString("es-CO")}
                </span>
              )}
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {isSoldOut ? "Sold out" : `${product.stock} in stock`} ·{" "}
                {product.settle_token}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          {!isSoldOut && <AddToListButton productId={product.id} />}
          <Link
            href={`/marketplace/${product.id}`}
            className="inline-flex flex-1 items-center justify-center rounded-md bg-accent px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-accent-foreground transition-opacity hover:opacity-90"
          >
            View detail & checkout
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
