"use client"

import { useState } from "react"
import { WalletSignIn } from "@/components/auth/wallet-sign-in"
import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"

export function LoginPanel({ initialRole }: { initialRole: Role }) {
  const [role, setRole] = useState<Role>(initialRole)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Step 1 — pick your side
        </span>
        <div
          role="radiogroup"
          aria-label="Sign in as"
          className="grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-card/40 p-1"
        >
          {(
            [
              { v: "client", label: "I'm buying" },
              { v: "shopkeeper", label: "I'm selling" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              role="radio"
              aria-checked={role === opt.v}
              onClick={() => setRole(opt.v)}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-medium transition",
                role === opt.v
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Step 2 — connect &amp; sign
        </span>
        <WalletSignIn role={role} />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Use any wallet, or sign in with email/Google/X. Reown will route
          you to the right flow. Your role is stored once on first sign-in
          and reused on every future visit.
        </p>
      </div>
    </div>
  )
}
