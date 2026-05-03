"use client"

import { useEffect, useState } from "react"
import { Boxes, Coins, Loader2, ScrollText, ShieldCheck } from "lucide-react"
import { formatCop, formatCusdMicro, shortAddress } from "@/lib/format"

type Snapshot = {
  role: "client" | "shopkeeper"
  primaryAddress: string | null
  offers: Array<{
    id: string
    qty: number
    amount_cusd_micro: number
    status: string
    created_at: string
    products: { id?: string; title: string } | { id?: string; title: string }[]
  }>
  orders: Array<{
    id: string
    qty: number
    amount_cusd_micro: number
    status: string
    tx_hash: string | null
    products: { title: string } | { title: string }[]
    created_at: string
  }>
  products: Array<{
    id: string
    title: string
    price_cents: number
    stock: number
    active: boolean
  }>
  reputation: { score: number; events: number }
}

function pickTitle(rel: any): string {
  if (Array.isArray(rel)) return rel[0]?.title ?? "—"
  return rel?.title ?? "—"
}

export function StateBoard({ refreshKey }: { refreshKey: number }) {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setError(null)
        const res = await fetch("/api/state", { cache: "no-store" })
        if (!res.ok) {
          if (!cancelled) setError(`state ${res.status}`)
          return
        }
        const json = (await res.json()) as Snapshot
        if (!cancelled) setSnap(json)
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "network error")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (loading && !snap) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Loading state…
      </div>
    )
  }
  if (!snap) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          State unavailable
        </div>
        <div className="text-xs text-muted-foreground">
          {error ?? "Sign in to see your live state."}
        </div>
      </div>
    )
  }

  const isShop = snap.role === "shopkeeper"

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/50 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" />
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Identity
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-widest text-foreground">
            {snap.role}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {snap.primaryAddress ? shortAddress(snap.primaryAddress) : "no wallet"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Reputation"
          value={String(snap.reputation.score ?? 0)}
          sub={`${snap.reputation.events ?? 0} events`}
        />
        <Stat
          label={isShop ? "Open offers" : "Pending offers"}
          value={String(
            snap.offers.filter((o) => o.status === "pending").length,
          )}
          sub={`${snap.offers.length} total`}
        />
      </div>

      <Section icon={ScrollText} label={isShop ? "Offers on your shop" : "Your offers"}>
        {snap.offers.length === 0 && (
          <div className="px-3 py-3 text-xs text-muted-foreground">No offers.</div>
        )}
        {snap.offers.map((o) => (
          <Row
            key={o.id}
            primary={pickTitle((o as any).products)}
            secondary={`${o.qty} × · ${formatCusdMicro(o.amount_cusd_micro)} cUSD`}
            badge={o.status}
          />
        ))}
      </Section>

      <Section icon={Coins} label="Orders">
        {snap.orders.length === 0 && (
          <div className="px-3 py-3 text-xs text-muted-foreground">No orders yet.</div>
        )}
        {snap.orders.map((o) => (
          <Row
            key={o.id}
            primary={pickTitle((o as any).products)}
            secondary={`${formatCusdMicro(o.amount_cusd_micro)} cUSD${o.tx_hash ? " · tx " + o.tx_hash.slice(0, 8) : ""}`}
            badge={o.status}
          />
        ))}
      </Section>

      <Section icon={Boxes} label={isShop ? "Inventory" : "Top listings"}>
        {snap.products.length === 0 && (
          <div className="px-3 py-3 text-xs text-muted-foreground">Nothing here.</div>
        )}
        {snap.products.map((p) => (
          <Row
            key={p.id}
            primary={p.title}
            secondary={`${formatCop(p.price_cents)} · stock ${p.stock}`}
            badge={p.active ? "live" : "off"}
          />
        ))}
      </Section>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-serif text-2xl tracking-tight">{value}</div>
      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{sub}</div>
    </div>
  )
}

function Section({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40">
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <Icon className="h-3 w-3 text-accent" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  )
}

function Row({
  primary,
  secondary,
  badge,
}: {
  primary: string
  secondary: string
  badge: string
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 text-xs">
      <div className="min-w-0 flex-1">
        <div className="truncate text-foreground">{primary}</div>
        <div className="truncate font-mono text-[10px] text-muted-foreground">
          {secondary}
        </div>
      </div>
      <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {badge}
      </span>
    </div>
  )
}
