"use client"

import * as React from "react"
import { Heart } from "lucide-react"
import { useFavorites } from "@/components/favorites/favorites-provider"
import copy from "@/lib/copy/en"

/**
 * Heart toggle for saving a product. Lives over product media (cards) or beside
 * a product title (detail). Reads/writes shared favorites state, so the same
 * product reflects the same state everywhere without per-card fetches.
 */
export default function FavoriteButton({
  productId,
  className,
}: {
  productId: string
  className?: string
}) {
  const fav = useFavorites()
  const active = fav?.isFavorite(productId) ?? false

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        fav?.toggle(productId)
      }}
      aria-pressed={active}
      aria-label={active ? copy.favorites.remove : copy.favorites.add}
      title={active ? copy.favorites.remove : copy.favorites.add}
      className={
        "inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/85 backdrop-blur-sm transition-colors hover:bg-accent/10 " +
        (className ?? "")
      }
    >
      <Heart
        className={
          "h-4 w-4 transition-colors " +
          (active ? "fill-accent text-accent" : "text-muted-foreground")
        }
      />
    </button>
  )
}
