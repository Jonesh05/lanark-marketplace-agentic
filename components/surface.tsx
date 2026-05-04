"use client"

import { useState } from "react"
import { ChatUI } from "@/components/chat-ui"
import { StateBoard } from "@/components/state-board"
import { AgentTrace } from "@/components/agent-trace"
import { MessageSquare, LayoutDashboard, Activity } from "lucide-react"

/**
 * Mobile-first Surface Component
 * 
 * - Chat is the central hub (primary view on mobile)
 * - Bottom tabs for mobile navigation
 * - Side-by-side layout on desktop
 * - All views sync via refreshKey when agent performs actions
 */
export function Surface({ role }: { role: "client" | "shopkeeper" }) {
  const [tick, setTick] = useState(0)
  const [mobileView, setMobileView] = useState<"chat" | "state" | "trace">("chat")

  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col lg:flex-row">
      {/* Desktop: Side-by-side layout */}
      {/* Mobile: Single view with bottom nav */}
      
      {/* Chat Column - Always rendered, hidden on mobile when not active */}
      <div 
        className={`flex-1 border-border/60 lg:border-r ${
          mobileView === "chat" ? "flex" : "hidden lg:flex"
        } flex-col`}
      >
        <ChatUI
          role={role}
          embedded
          onActivity={() => setTick((t) => t + 1)}
        />
      </div>

      {/* State + Trace Column - Desktop: always visible, Mobile: tab-based */}
      <div 
        className={`lg:flex lg:w-[380px] lg:flex-col ${
          mobileView !== "chat" ? "flex flex-1 flex-col" : "hidden"
        }`}
      >
        {/* State Board */}
        <div 
          className={`flex-1 overflow-hidden border-border/60 lg:border-b ${
            mobileView === "state" || mobileView === "chat" ? "lg:block" : ""
          } ${mobileView === "state" ? "block" : "hidden lg:block"}`}
        >
          <StateBoard refreshKey={tick} />
        </div>

        {/* Agent Trace */}
        <div 
          className={`lg:h-[260px] overflow-hidden ${
            mobileView === "trace" ? "flex-1" : "hidden lg:block"
          }`}
        >
          <AgentTrace refreshKey={tick} />
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="flex border-t border-border/60 bg-background/95 backdrop-blur lg:hidden">
        <MobileNavButton
          icon={MessageSquare}
          label="Chat"
          active={mobileView === "chat"}
          onClick={() => setMobileView("chat")}
        />
        <MobileNavButton
          icon={LayoutDashboard}
          label="State"
          active={mobileView === "state"}
          onClick={() => setMobileView("state")}
        />
        <MobileNavButton
          icon={Activity}
          label="Trace"
          active={mobileView === "trace"}
          onClick={() => setMobileView("trace")}
        />
      </nav>
    </div>
  )
}

function MobileNavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1 py-3 transition ${
        active
          ? "text-accent"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="font-mono text-[9px] uppercase tracking-widest">
        {label}
      </span>
    </button>
  )
}
