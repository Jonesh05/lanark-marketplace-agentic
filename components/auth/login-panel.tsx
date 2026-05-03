"use client"

import { useState } from "react"
import { WalletSignIn } from "@/components/auth/wallet-sign-in"
import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"

export function LoginPanel({ initialRole }: { initialRole: Role }) {
  const [role, setRole] = useState<Role>(initialRole)

  return (
    <div className="flex flex-col gap-5">
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

      <div className="flex flex-col gap-2">
        <WalletSignIn role={role} variant="guest" />
        <div className="relative my-1 flex items-center gap-3">
          <div className="h-px flex-1 bg-border/60" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            or
          </span>
          <div className="h-px flex-1 bg-border/60" />
        </div>
        <WalletSignIn role={role} variant="wallet" />
      </div>
    </div>
  )
}
