"use client"

import { useState } from "react"
import { useAccount, useDisconnect, useSignMessage } from "wagmi"
import { useAppKit } from "@reown/appkit/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Wallet, Loader2, ArrowRight, Power } from "lucide-react"
import { shortAddress } from "@/lib/format"

function buildMessage(address: string, nonce: string) {
  return [
    "Sign in to Lanark Marketplace",
    "",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued: ${new Date().toISOString()}`,
  ].join("\n")
}

function makeNonce() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function WalletSignIn({ role }: { role: "client" | "shopkeeper" }) {
  // Call useAppKit unconditionally but catch if it throws (safe during init race)
  let appKit: any = null
  try {
    appKit = useAppKit()
  } catch (e) {
    appKit = null
  }

  const { address, isConnected, connector } = useAccount()
  const { disconnectAsync } = useDisconnect()
  const { signMessageAsync } = useSignMessage()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSign() {
    if (!address) return
    setSubmitting(true)
    setError(null)
    try {
      const nonce = makeNonce()
      const message = buildMessage(address, nonce)
      const signature = await signMessageAsync({ message })

      const isSCA = connector?.id === "w3mAuth" ||
        connector?.name?.toLowerCase().includes("appkit") ||
        connector?.name?.toLowerCase().includes("social")

      const res = await fetch("/api/auth/wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address,
          signature,
          message,
          nonce,
          role,
          kind: isSCA ? "sca" : "eoa",
        }),
      })

      const raw = await res.text()
      let json: any = {}
      if (raw) {
        try { json = JSON.parse(raw) } catch {
          json = { ok: false, error: `Server error (HTTP ${res.status}).` }
        }
      }

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Sign-in failed")
      }

      toast.success(json.isNewUser ? `Welcome, ${json.role}.` : `Welcome back, ${json.role}.`)
      window.location.assign("/dashboard")
    } catch (err: any) {
      const msg = err?.shortMessage ?? err?.message ?? "Signature cancelled"
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Show disabled initializer while AppKit isn't ready
  if (!appKit) {
    return (
      <Button size="lg" className="h-12 w-full justify-center gap-3" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        Initializing...
      </Button>
    )
  }

  if (!isConnected || !address) {
    const openWallet = () => {
      try { appKit?.open?.() } catch (e) { console.warn("appKit.open failed", e) }
    }

    return (
      <Button
        size="lg"
        className="h-12 w-full justify-between gap-3"
        onClick={openWallet}
        type="button"
      >
        <span className="flex items-center gap-3">
          <Wallet className="h-4 w-4" /> Open wallet or social login
        </span>
        <ArrowRight className="h-4 w-4 opacity-60" />
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="block h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Connected</span>
          <span className="font-mono text-[11px] text-foreground">{shortAddress(address)}</span>
        </div>
        <button
          type="button"
          onClick={() => disconnectAsync()}
          className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
        >
          <Power className="h-3 w-3" /> Switch
        </button>
      </div>
      <Button
        size="lg"
        className="h-12 w-full justify-between gap-3"
        onClick={onSign}
        disabled={submitting}
        type="button"
      >
        <span className="flex items-center gap-3">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          {submitting ? "Sign the message..." : `Sign in as ${role}`}
        </span>
        {!submitting && <ArrowRight className="h-4 w-4 opacity-60" />}
      </Button>
      {error && <p className="font-mono text-[10px] uppercase text-destructive">{error}</p>}
    </div>
  )
}
