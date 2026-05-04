"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { User, ShieldCheck, History, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { shortAddress } from "@/lib/format"
import { updateProfile } from "@/app/actions/profile"
import type { Profile } from "@/lib/types"

type AuditEntry = {
  id: string
  entity_type: string
  entity_id: string
  action: string
  changes: Record<string, { from: unknown; to: unknown }>
  created_at: string
}

export function ProfileSettings({
  profile,
  auditLog,
}: {
  profile: Profile
  auditLog: AuditEntry[]
}) {
  const [role, setRole] = useState<"client" | "shopkeeper">(profile.role as "client" | "shopkeeper")
  const [displayName, setDisplayName] = useState(profile.display_name ?? "")
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await updateProfile({ role, displayName: displayName.trim() || null })
      if (!res.ok) toast.error(res.error)
      else toast.success("Profile updated.")
    })
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-2 border-b border-border/60 pb-6">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Profile settings
        </span>
        <h1 className="font-serif text-4xl tracking-tight">Your account</h1>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-6">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-medium">Identity</h2>
          </div>

          <div className="flex flex-col gap-4 pl-7">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wallet" className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Wallet address
              </Label>
              <div className="flex items-center gap-2 font-mono text-sm">
                <span className="block h-2 w-2 rounded-full bg-accent" />
                {profile.primary_address ? shortAddress(profile.primary_address) : "No wallet linked"}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="displayName" className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Display name
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                maxLength={50}
              />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-medium">Role</h2>
          </div>

          <div className="flex flex-col gap-3 pl-7">
            <p className="text-sm text-muted-foreground">
              Your role determines your marketplace capabilities. You can switch anytime.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <RoleCard
                title="Client"
                description="Browse products, place offers, and make purchases"
                selected={role === "client"}
                onClick={() => setRole("client")}
              />
              <RoleCard
                title="Shopkeeper"
                description="List products, manage inventory, and accept offers"
                selected={role === "shopkeeper"}
                onClick={() => setRole("shopkeeper")}
              />
            </div>
          </div>
        </section>

        <Button type="submit" disabled={pending} className="h-11 self-end">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <History className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-medium">Activity log</h2>
        </div>

        {auditLog.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/30 px-6 py-10 text-center text-sm text-muted-foreground">
            No activity recorded yet.
          </div>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card/40">
            {auditLog.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm">
                    <span className="capitalize">{entry.action}</span> {entry.entity_type}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                  {Object.entries(entry.changes).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {Object.entries(entry.changes).slice(0, 3).map(([key, val]) => (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 rounded border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[10px]"
                        >
                          {key}
                          {val && typeof val === "object" && "to" in val && (
                            <>
                              <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                              <span className="text-foreground">{String(val.to).slice(0, 20)}</span>
                            </>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

function RoleCard({
  title,
  description,
  selected,
  onClick,
}: {
  title: string
  description: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-4 text-left transition",
        selected
          ? "border-accent bg-accent/10 ring-1 ring-accent/20"
          : "border-border/60 bg-card/40 hover:border-accent/40"
      )}
    >
      <span className={cn("text-sm font-medium", selected && "text-accent")}>
        {title}
      </span>
      <span className="text-[11px] leading-relaxed text-muted-foreground">
        {description}
      </span>
    </button>
  )
}
