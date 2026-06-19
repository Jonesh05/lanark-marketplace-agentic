"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSettleOrder } from "@/hooks/use-settle-order"

/**
 * After the agent authorizes an order via chat tools, auto-open the wallet for
 * the on-chain deposit. Surface has WalletProvider via app/app/layout.tsx.
 */
export function AgentCheckoutSettle({
  orderId,
  onDone,
}: {
  orderId: string | null
  onDone?: () => void
}) {
  const router = useRouter()
  const { settle, phase } = useSettleOrder(() => {
    router.refresh()
    onDone?.()
  })
  const started = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!orderId || started.current === orderId) return
    started.current = orderId
    void settle(orderId)
  }, [orderId, settle])

  if (!orderId || phase === "idle" || phase === "done") return null

  return (
    <div className="mx-4 mb-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-muted-foreground">
      Abriendo tu wallet para firmar el pago…
    </div>
  )
}

/**
 * Scan chat message parts for a freshly authorized order id.
 */
export function extractAuthorizedOrderId(messages: unknown[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as { parts?: unknown[] }
    for (const part of msg.parts ?? []) {
      const p = part as {
        type?: string
        state?: string
        output?: { orderId?: string; ok?: boolean; status?: string }
      }
      if (p.type !== "tool-authorizeOrder") continue
      if (p.state !== "output-available") continue
      const out = p.output
      if (out?.ok && out.orderId && out.status === "pending") return out.orderId
    }
  }
  return null
}
