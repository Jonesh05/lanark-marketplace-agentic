'use client'

import * as React from 'react'
import { useEffect, useRef } from 'react'
import { useCarousel } from './carousel'

type AutoRailProps = {
  speed?: number // milliseconds per slide advance
  pauseOnHover?: boolean
  pauseOnTouch?: boolean
  enabled?: boolean
}

export default function AutoRail({
  speed = 4000,
  pauseOnHover = true,
  pauseOnTouch = true,
  enabled = true,
}: AutoRailProps) {
  // This component expects to be used inside the existing <Carousel />
  // It drives a simple autoplay using requestAnimationFrame and the
  // embla API scrollNext method. It respects prefers-reduced-motion and
  // pauses on hover / touch / focus for accessibility.

  const context = React.useContext<any>(
    // import path is relative - carousel exports a context internally.
    // To avoid circular import issues we access the context via module import above
    // but here we attempt to re-use the hook if available.
    // If the hook is not available (older code), gracefully noop.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    (typeof window !== 'undefined' && require('./carousel').useCarousel) || null,
  )

  const carousel = context
  const rafRef = useRef<number | null>(null)
  const lastTime = useRef<number | null>(null)
  const elapsed = useRef(0)
  const isPaused = useRef(false)

  useEffect(() => {
    // Respect prefers-reduced-motion
    const media = window?.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (media?.matches) return
    if (!enabled) return

    const api = carousel?.api
    if (!api || typeof api.scrollNext !== 'function') return

    function onFrame(now: number) {
      if (isPaused.current) {
        lastTime.current = now
        rafRef.current = requestAnimationFrame(onFrame)
        return
      }
      if (lastTime.current == null) lastTime.current = now
      const delta = now - lastTime.current
      lastTime.current = now
      elapsed.current += delta
      if (elapsed.current >= speed) {
        try {
          api.scrollNext()
        } catch (_) {
          // ignore
        }
        elapsed.current = 0
      }
      rafRef.current = requestAnimationFrame(onFrame)
    }

    rafRef.current = requestAnimationFrame(onFrame)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [carousel, speed, enabled])

  // Pause on hover / touch / focus if requested
  useEffect(() => {
    const root = carousel?.carouselRef?.current
    if (!root) return

    function handleEnter() {
      if (pauseOnHover) isPaused.current = true
    }
    function handleLeave() {
      if (pauseOnHover) isPaused.current = false
    }
    function handleTouchStart() {
      if (pauseOnTouch) isPaused.current = true
    }
    function handleTouchEnd() {
      if (pauseOnTouch) isPaused.current = false
    }
    function handleFocusIn() {
      isPaused.current = true
    }
    function handleFocusOut() {
      isPaused.current = false
    }

    root.addEventListener('mouseenter', handleEnter)
    root.addEventListener('mouseleave', handleLeave)
    root.addEventListener('touchstart', handleTouchStart, { passive: true })
    root.addEventListener('touchend', handleTouchEnd)
    root.addEventListener('focusin', handleFocusIn)
    root.addEventListener('focusout', handleFocusOut)

    return () => {
      root.removeEventListener('mouseenter', handleEnter)
      root.removeEventListener('mouseleave', handleLeave)
      root.removeEventListener('touchstart', handleTouchStart)
      root.removeEventListener('touchend', handleTouchEnd)
      root.removeEventListener('focusin', handleFocusIn)
      root.removeEventListener('focusout', handleFocusOut)
    }
  }, [carousel, pauseOnHover, pauseOnTouch])

  return null
}
