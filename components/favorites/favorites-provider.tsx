"use client"

import * as React from "react"
import { toast } from "sonner"
import copy from "@/lib/copy/en"

type FavoritesCtx = {
  isFavorite: (id: string) => boolean
  toggle: (id: string) => void
  ready: boolean
}

const FavoritesContext = React.createContext<FavoritesCtx | null>(null)

export function useFavorites() {
  return React.useContext(FavoritesContext)
}

/**
 * Loads the signed-in buyer's favorite product ids once and shares them across
 * every product card / detail view, so toggling a heart is instant (optimistic)
 * and consistent app-wide. For anonymous users the set stays empty and toggling
 * surfaces a sign-in prompt from the API (401).
 */
export function FavoritesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [ids, setIds] = React.useState<Set<string>>(new Set())
  const [ready, setReady] = React.useState(false)
  const pending = React.useRef<Set<string>>(new Set())

  React.useEffect(() => {
    let active = true
    fetch("/api/favorites")
      .then((r) => r.json())
      .then((j) => {
        if (active && j?.ok && Array.isArray(j.ids)) setIds(new Set(j.ids))
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  const isFavorite = React.useCallback((id: string) => ids.has(id), [ids])

  const revert = React.useCallback((id: string, wasFav: boolean) => {
    setIds((prev) => {
      const next = new Set(prev)
      if (wasFav) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggle = React.useCallback(
    (id: string) => {
      if (pending.current.has(id)) return
      pending.current.add(id)
      const willFav = !ids.has(id)

      setIds((prev) => {
        const next = new Set(prev)
        if (willFav) next.add(id)
        else next.delete(id)
        return next
      })

      fetch("/api/favorites", {
        method: willFav ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product_id: id }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (!j?.ok) {
            revert(id, willFav)
            toast.error(j?.error || copy.favorites.error)
          }
        })
        .catch(() => {
          revert(id, willFav)
          toast.error(copy.favorites.error)
        })
        .finally(() => pending.current.delete(id))
    },
    [ids, revert],
  )

  return (
    <FavoritesContext.Provider value={{ isFavorite, toggle, ready }}>
      {children}
    </FavoritesContext.Provider>
  )
}
