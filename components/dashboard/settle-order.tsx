"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Loader2, Wallet, ExternalLink, CheckCircle2 } from "lucide-react"
import { releaseOrder } from "@/app/actions/settlement"
import { useSettleOrder, type SettlePhase } from "@/hooks/use-settle-order"

/**
 * Buyer-facing "pay" button. Drives the full on-chain settlement from the
 * buyer's own wallet: prepare escrow (server worker) -> optional testnet mint ->
 * approve -> deposit -> record the real tx. The wallet opens for the signature;
 * the order ends in a final, visible state with a CeloScan/Blockscout link.
 */
export function SettleOrderButton({
  orderId,
  onSettled,
  autoRun = false,
}: {
  orderId: string
  onSettled?: () => void
  autoRun?: boolean
}) {
  const { settle, phase, busy, txUrl } = useSettleOrder(onSettled)
  const autoStarted = React.useRef(false)

  React.useEffect(() => {
    if (!autoRun || autoStarted.current) return
    autoStarted.current = true
    void settle(orderId)
  }, [autoRun, orderId, settle])

  const phaseLabel: Record<SettlePhase, string> = {
    idle: "Pagar ahora",
    preparing: "Preparando garantía…",
    switching: "Cambiando de red…",
    funding: "Obteniendo fondos…",
    approving: "Aprobando…",
    depositing: "Confirma en tu wallet…",
    recording: "Registrando pago…",
    done: "Pagado",
  }

  if (phase === "done") {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-accent">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Pagado
        {txUrl && (
          <a
            href={txUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
          >
            ver en CeloScan <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </span>
    )
  }

  if (autoRun && busy) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {phaseLabel[phase]}
      </span>
    )
  }

  return (
    <Button size="sm" disabled={busy} onClick={() => void settle(orderId)} className="gap-1.5">
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Wallet className="h-3.5 w-3.5" />
      )}
      {phaseLabel[phase]}
    </Button>
  )
}

/**
 * Release a funded escrow to the seller. The settlement worker (arbiter) signs
 * the on-chain release; this just triggers it. Shown to either party once the
 * order is in escrow (e.g. buyer confirms receipt / seller confirms delivery).
 */
export function ReleaseOrderButton({
  orderId,
  label = "Confirmar recepción",
}: {
  orderId: string
  label?: string
}) {
  const [pending, setPending] = React.useState(false)
  const [txUrl, setTxUrl] = React.useState<string | null>(null)

  async function run() {
    setPending(true)
    try {
      const res = await releaseOrder(orderId)
      if (!res.ok) {
        toast.error(res.error ?? "No pudimos liberar el pago.")
        return
      }
      setTxUrl(res.txUrl ?? null)
      toast.success("Pago liberado al vendedor. Compra completada.")
    } finally {
      setPending(false)
    }
  }

  if (txUrl) {
    return (
      <a
        href={txUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-accent underline-offset-2 hover:underline"
      >
        liberado · ver tx <ExternalLink className="h-3 w-3" />
      </a>
    )
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={run} className="gap-1.5">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {pending ? "Liberando…" : label}
    </Button>
  )
}
