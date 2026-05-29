"use client"

import React, { useState } from "react"

export default function AddToListButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false)

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
        alert("No se pudo agregar a la lista")
      } else {
        // Minimal UX for now
        alert("Agregado a tu lista")
      }
    } catch (e) {
      console.error(e)
      alert("Error de red")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleAdd}
      disabled={loading}
      className="inline-flex items-center justify-center rounded px-2 py-1 text-xs border border-border/40 bg-card/20 hover:bg-card/30"
      aria-label="Agregar a la lista"
      type="button"
    >
      {loading ? "..." : "Agregar"}
    </button>
  )
}
