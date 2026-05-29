"use client"

import React, { useRef, useEffect } from "react"
import type { Product } from "@/lib/types"
import { ProductCard } from "@/components/product-card"

export default function MobileBand({ items }: { items: Product[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const speed = 0.03 // px per ms

  useEffect(() => {
    const el = containerRef.current
    if (!el || !items || items.length === 0) return

    // Respect prefers-reduced-motion
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReduced) return

    el.scrollLeft = 0
    let last = performance.now()
    let stopped = false
    let paused = false

    function step(now: number) {
      if (stopped) return
      if (paused) {
        last = now
        rafRef.current = requestAnimationFrame(step)
        return
      }
      const delta = now - last
      last = now
      try {
        el.scrollLeft += speed * delta
        if (el.scrollLeft >= el.scrollWidth / 2) {
          el.scrollLeft -= el.scrollWidth / 2
        }
      } catch (e) {
        // ignore
      }
      rafRef.current = requestAnimationFrame(step)
    }

    function setPaused(v: boolean) {
      paused = v
    }

    const onPointerEnter = () => setPaused(true)
    const onPointerLeave = () => setPaused(false)
    const onTouchStart = () => setPaused(true)
    const onTouchEnd = () => setPaused(false)
    const onFocusIn = () => setPaused(true)
    const onFocusOut = () => setPaused(false)

    el.addEventListener("pointerenter", onPointerEnter)
    el.addEventListener("pointerleave", onPointerLeave)
    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchend", onTouchEnd)
    el.addEventListener("focusin", onFocusIn)
    el.addEventListener("focusout", onFocusOut)

    rafRef.current = requestAnimationFrame(step)
    return () => {
      stopped = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      el.removeEventListener("pointerenter", onPointerEnter)
      el.removeEventListener("pointerleave", onPointerLeave)
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchend", onTouchEnd)
      el.removeEventListener("focusin", onFocusIn)
      el.removeEventListener("focusout", onFocusOut)
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
