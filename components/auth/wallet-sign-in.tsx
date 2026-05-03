"use client"

import { useEffect, useRef, useState } from "react"
import { useAccount, useDisconnect, useSignMessage } from "wagmi"
import { useAppKit } from "@reown/appkit/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Wallet, Sparkles } from "lucide-react"

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
  const triggered = useRef(false)

  useEffect(() => {
    if (!isConnected || !address || !triggered.current) return
    void runSignIn(address)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address])

  async function runSignIn(addr: string) {
    triggered.current = false
    setStage("signing")
    try {
      const nonce = makeNonce()
      const message = buildMessage(addr, nonce)
      const signature = await signMessageAsync({ message })
      setStage("verifying")
      // Heuristic: Reown's social/email connector ID typically contains
      // "auth" or "appKitAuth"; we tag those as `guest` (smart account) so
      // the agent loop knows it can sponsor gas.
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
      toast.success("Welcome to Sablon.")
      router.push("/dashboard")
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
    triggered.current = true
    if (isConnected && address) {
      await runSignIn(address)
      return
    }
    setStage("connecting")
    await open({ view: variant === "guest" ? "Connect" : "Connect" })
  }

  const label = (() => {
    if (stage === "connecting") return "Opening wallet…"
    if (stage === "signing") return "Sign the message…"
    if (stage === "verifying") return "Verifying…"
    return variant === "guest"
      ? "Continue with email or social"
      : "Continue with wallet"
  })()

  return (
    <Button
      size="lg"
      variant={variant === "guest" ? "default" : "outline"}
      className="h-12 w-full justify-start gap-3 text-sm"
      onClick={onClick}
      disabled={stage !== "idle"}
      type="button"
    >
      {variant === "guest" ? (
        <Sparkles className="h-4 w-4" />
      ) : (
        <Wallet className="h-4 w-4" />
      )}
      {label}
    </Button>
  )
}
