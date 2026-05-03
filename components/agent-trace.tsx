"use client"

import { useEffect, useState } from "react"
import { CircleCheck, CircleAlert, Cpu, ListTree, Loader2 } from "lucide-react"

type Action = {
  id: string
  step: "decide" | "execute" | "confirm" | "error"
  kind: string
  resource: string | null
  status: "ok" | "failed" | "pending"
  message: string | null
  receipt: Record<string, unknown> | null
  payload: Record<string, unknown>
  created_at: string
}

const STEP_TONE: Record<Action["step"], string> = {
  decide: "text-muted-foreground",
  execute: "text-accent",
  confirm: "text-emerald-400",
  error: "text-destructive",
}

export function AgentTrace({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/trace?limit=20", { cache: "no-store" })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setItems(json.items ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
        <ListTree className="h-3.5 w-3.5 text-accent" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Agent trace
        </span>
        {loading && <Loader2 className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && !loading && (
          <div className="px-4 py-6 text-xs text-muted-foreground">
            No agent actions yet. Ask the agent to do something.
          </div>
        )}
        <ol className="flex flex-col">
          {items.map((a) => (
            <li
              key={a.id}
              className="flex gap-3 border-b border-border/40 px-4 py-3 text-xs"
            >
              <div className={`mt-0.5 ${STEP_TONE[a.step]}`}>
                {a.step === "error" ? (
                  <CircleAlert className="h-3.5 w-3.5" />
                ) : a.step === "confirm" ? (
                  <CircleCheck className="h-3.5 w-3.5" />
                ) : (
                  <Cpu className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="flex-1 space-y-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-foreground">
                    {a.kind}
                  </span>
                  <span
                    className={`font-mono text-[9px] uppercase tracking-widest ${STEP_TONE[a.step]}`}
                  >
                    {a.step}
                  </span>
                  <span className="ml-auto font-mono text-[9px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
                {a.resource && (
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {a.resource}
                  </div>
                )}
                {a.message && (
                  <div className="text-[11px] text-destructive">{a.message}</div>
                )}
                {a.receipt && (
                  <pre className="overflow-hidden rounded bg-muted/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    {JSON.stringify(a.receipt, null, 0).slice(0, 240)}
                  </pre>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
