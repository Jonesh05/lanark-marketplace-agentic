"use client"

import React, { useRef, useEffect } from "react"
import type { Product } from "@/lib/types"
import { ProductCard } from "@/components/product-card"

export default function MobileBand({ items }: { items: Product[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const speed = 0.03 // px per ms, tweak for desired velocity

  useEffect(() => {
    const el = containerRef.current
    if (!el || !items || items.length === 0) return

    // Ensure we start near 0
    el.scrollLeft = 0
    let last = performance.now()
    let stopped = false

    function step(now: number) {
      if (stopped) return
      const delta = now - last
      last = now
      try {
        el.scrollLeft += speed * delta
        if (el.scrollLeft >= el.scrollWidth / 2) {
          // wrap-around for seamless loop
          el.scrollLeft -= el.scrollWidth / 2
        }
      } catch (e) {
        // ignore DOM exceptions
      }
      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      stopped = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [items])

  if (!items || items.length === 0) return null

  const duplicated = items.concat(items)

  return (
    <div className="overflow-hidden" ref={containerRef} style={{ WebkitOverflowScrolling: "touch" }}>
      <div className="flex gap-4" style={{ width: "max-content" }}>
        {duplicated.map((p) => (
          <div key={p.id} className="w-[160px] flex-shrink-0">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </div>
  )
}
