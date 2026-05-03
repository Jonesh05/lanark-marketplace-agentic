"use client"

import { useState } from "react"
import { useAccount, useDisconnect, useSignMessage } from "wagmi"
import { useAppKit } from "@reown/appkit/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Wallet, Loader2, ArrowRight, Power } from "lucide-react"
import { shortAddress } from "@/lib/format"

function buildMessage(address: string, nonce: string) {
  return [
    "Sign in to Sablon",
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

/**
 * Two-step, fully explicit sign-in:
 *   Step 1: user clicks "Open wallet" -> AppKit modal opens.
 *   Step 2: once wagmi reports `isConnected`, the signing step renders
 *           with a clear "Sign in as <role>" button. The user signs the
 *           message and we POST it to /api/auth/wallet.
 *
 * No auto-firing effects, no refs, no race between modal open and
 * connection. The user always sees what is going to happen next.
 */
export function WalletSignIn({
  role,
}: {
  role: "client" | "shopkeeper"
}) {
  const { open } = useAppKit()
  const { address, isConnected } = useAccount()
  const { disconnectAsync } = useDisconnect()
  const { signMessageAsync } = useSignMessage()
  const router = useRouter()
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
      const res = await fetch("/api/auth/wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address,
          signature,
          message,
          nonce,
          role,
          kind: "eoa",
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        const msg = json.error ?? "Sign-in failed"
        setError(msg)
        toast.error(msg)
        return
      }
      toast.success(
        json.isNewUser
          ? `Welcome to Sablon, ${json.role}.`
          : `Welcome back, ${json.role}.`,
      )
      router.replace("/dashboard")
      router.refresh()
    } catch (err: any) {
      const msg = err?.shortMessage ?? err?.message ?? "Signature cancelled"
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Step 1: not yet connected
  if (!isConnected || !address) {
    return (
      <Button
        size="lg"
        className="h-12 w-full justify-between gap-3"
        onClick={() => open()}
        type="button"
      >
        <span className="flex items-center gap-3">
          <Wallet className="h-4 w-4" />
          Open wallet or social login
        </span>
        <ArrowRight className="h-4 w-4 opacity-60" />
      </Button>
    )
  }

  // Step 2: connected, ready to sign
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="block h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Connected
          </span>
          <span className="font-mono text-[11px] text-foreground">
            {shortAddress(address)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => disconnectAsync().catch(() => {})}
          className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
        >
          <Power className="h-3 w-3" />
          Switch
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
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wallet className="h-4 w-4" />
          )}
          {submitting ? "Sign the message in your wallet…" : `Sign in as ${role}`}
        </span>
        {!submitting && <ArrowRight className="h-4 w-4 opacity-60" />}
      </Button>
      {error && (
        <p className="font-mono text-[10px] uppercase tracking-widest text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
