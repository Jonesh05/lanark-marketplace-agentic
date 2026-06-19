"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import copy from "@/lib/copy/en"

export default function AddToListButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleAdd() {
    setLoading(true)
    try {
      const res = await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product_id: productId, quantity: 1 }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        console.error("Add to list failed", json)
        toast.error(copy.addToList.addFailed)
      } else {
        toast.success(copy.addToList.added)
        // Refresh the server-rendered header badge + cart so the count is in
        // sync with what was just added (Next Router Cache otherwise lags).
        router.refresh()
      }
    } catch (e) {
      console.error(e)
      toast.error(copy.addToList.networkError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleAdd}
      disabled={loading}
      className="inline-flex items-center justify-center rounded px-2 py-1 text-xs border border-border/40 bg-card/20 hover:bg-card/30"
      aria-label={copy.addToList.ariaLabel}
      type="button"
    >
      {loading ? copy.addToList.adding : copy.addToList.addButton}
    </button>
  )
}
