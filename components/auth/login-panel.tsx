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
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          1 · Choose your role
        </span>
        <div
          role="radiogroup"
          aria-label="Sign in as"
          className="grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-card/40 p-1"
        >
          {(
            [
              { v: "client", label: "I'm buying", caption: "Place offers" },
              { v: "shopkeeper", label: "I'm selling", caption: "Manage inventory" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              role="radio"
              aria-checked={role === opt.v}
              onClick={() => setRole(opt.v)}
              className={cn(
                "flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition",
                role === opt.v
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="text-xs font-medium">{opt.label}</span>
              <span
                className={cn(
                  "font-mono text-[9px] uppercase tracking-widest",
                  role === opt.v
                    ? "text-background/70"
                    : "text-muted-foreground",
                )}
              >
                {opt.caption}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          2 · Connect &amp; sign
        </span>
        <WalletSignIn role={role} />
      </div>
    </div>
  )
}
