"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type Action = {
  id: string
  step: "decide" | "execute" | "confirm" | "error"
  kind: string
  status: "ok" | "failed" | "pending"
  created_at: string
}

/**
 * Live indicator of recent agent activity. Polls /api/trace and pulses
 * green when fresh actions land. Makes the agentic operation visible
 * from anywhere in the app.
 */
export function AgentPulse() {
  const [last, setLast] = useState<Action | null>(null)
  const [glow, setGlow] = useState(false)

  useEffect(() => {
    let stop = false
    let prevId: string | null = null
    async function tick() {
      try {
        const res = await fetch("/api/trace?limit=1", { cache: "no-store" })
        if (!res.ok) return
        const json = (await res.json()) as { items: Action[] }
        const next = json.items?.[0] ?? null
        if (next && next.id !== prevId) {
          prevId = next.id
          setLast(next)
          setGlow(true)
          setTimeout(() => !stop && setGlow(false), 1200)
        }
      } catch {
        // ignore
      }
    }
    tick()
    const id = window.setInterval(tick, 4000)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [])

  return (
    <Link
      href="/app"
      className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-accent/40 hover:text-foreground md:inline-flex"
    >
      <span
        className={`block h-1.5 w-1.5 rounded-full transition-all ${
          glow
            ? "bg-accent shadow-[0_0_12px_2px_oklch(0.84_0.18_142_/_0.6)]"
            : last
              ? "bg-accent"
              : "bg-muted-foreground/40"
        }`}
      />
      <span className="text-foreground">
        {last ? last.kind.replace(/_/g, " ") : "agent idle"}
      </span>
      {last && (
        <span className="text-muted-foreground">{last.step}</span>
      )}
    </Link>
  )
}
