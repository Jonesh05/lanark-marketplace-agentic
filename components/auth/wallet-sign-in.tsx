"use client"

import { useEffect, useState } from "react"
import { useAccount, useDisconnect, useSignMessage } from "wagmi"
import { useAppKit } from "@reown/appkit/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Wallet, Sparkles, Loader2 } from "lucide-react"

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

type Stage = "idle" | "connecting" | "signing" | "verifying"

export function WalletSignIn({
  role = "client",
  variant = "wallet",
}: {
  role?: "client" | "shopkeeper"
  variant?: "wallet" | "guest"
}) {
  const { open } = useAppKit()
  const { address, isConnected, connector } = useAccount()
  const { disconnectAsync } = useDisconnect()
  const { signMessageAsync } = useSignMessage()
  const router = useRouter()
  const [stage, setStage] = useState<Stage>("idle")
  // Pending = the user clicked recently and we are waiting for the wallet
  // connection to complete so we can sign automatically. State-driven (not
  // a ref) so the effect re-runs reliably across re-renders.
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!pending || !isConnected || !address) return
    setPending(false)
    void runSignIn(address)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, isConnected, address])

  async function runSignIn(addr: string) {
    setStage("signing")
    try {
      const nonce = makeNonce()
      const message = buildMessage(addr, nonce)
      const signature = await signMessageAsync({ message })
      setStage("verifying")
      const cid = (connector?.id ?? "").toLowerCase()
      const kind: "guest" | "eoa" =
        cid.includes("auth") || cid.includes("appkit") || variant === "guest"
          ? "guest"
          : "eoa"
      const res = await fetch("/api/auth/wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address: addr,
          signature,
          message,
          nonce,
          role,
          kind,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Wallet sign-in failed")
        await disconnectAsync().catch(() => {})
        return
      }
      toast.success(
        json.isNewUser
          ? `Welcome to Sablon, ${json.role}.`
          : `Welcome back, ${json.role}.`,
      )
      // Replace + refresh so the session cookie is picked up by the
      // dashboard's server component on the next render.
      router.replace("/dashboard")
      router.refresh()
    } catch (err: any) {
      const msg = err?.shortMessage ?? err?.message ?? "Sign-in cancelled"
      toast.error(msg)
      await disconnectAsync().catch(() => {})
    } finally {
      setStage("idle")
    }
  }

  async function onClick() {
    if (stage !== "idle") return
    if (isConnected && address) {
      // Already connected from a prior session - sign right away.
      await runSignIn(address)
      return
    }
    setPending(true)
    setStage("connecting")
    try {
      await open({ view: "Connect" })
    } catch (err: any) {
      setPending(false)
      setStage("idle")
      toast.error(err?.message ?? "Could not open wallet")
    }
  }

  const label = (() => {
    if (stage === "connecting") return "Opening wallet…"
    if (stage === "signing") return "Sign the message…"
    if (stage === "verifying") return "Verifying…"
    return variant === "guest"
      ? "Continue with email or social"
      : "Continue with wallet"
  })()

  const busy = stage !== "idle"

  return (
    <Button
      size="lg"
      variant={variant === "guest" ? "default" : "outline"}
      className="h-12 w-full justify-start gap-3 text-sm"
      onClick={onClick}
      disabled={busy}
      type="button"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : variant === "guest" ? (
        <Sparkles className="h-4 w-4" />
      ) : (
        <Wallet className="h-4 w-4" />
      )}
      {label}
    </Button>
  )
}
