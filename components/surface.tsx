"use client"

import { useState } from "react"
import { ChatUI } from "@/components/chat-ui"
import { StateBoard } from "@/components/state-board"
import { AgentTrace } from "@/components/agent-trace"

/**
 * The main surface. The chat is one column, the canonical state is the other,
 * and the agent trace is the bottom rail. Every tool call bumps `tick` so the
 * state and trace re-fetch from Supabase. The chat is *not* the truth - it's
 * just the most recent rendering of the truth.
 */
export function Surface({ role }: { role: "client" | "shopkeeper" }) {
  const [tick, setTick] = useState(0)

  return (
    <div className="grid h-[calc(100svh-3.5rem)] grid-rows-[1fr_minmax(180px,30%)] lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:grid-rows-1">
      {/* Chat column */}
      <div className="row-start-1 border-b border-border/60 lg:col-start-1 lg:border-b-0 lg:border-r">
        <ChatUI
          role={role}
          embedded
          onActivity={() => setTick((t) => t + 1)}
        />
      </div>

      {/* State + trace column */}
      <div className="row-start-2 grid grid-rows-[minmax(0,1fr)_minmax(0,260px)] lg:col-start-2 lg:row-start-1">
        <div className="overflow-hidden border-b border-border/60">
          <StateBoard refreshKey={tick} />
        </div>
        <div className="overflow-hidden">
          <AgentTrace refreshKey={tick} />
        </div>
      </div>
    </div>
  )
}
