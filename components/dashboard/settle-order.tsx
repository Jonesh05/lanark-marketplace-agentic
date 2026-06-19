"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  createPublicClient,
  http,
  getAddress,
  type Hex,
} from "viem"
import { useAccount, useSwitchChain, useWriteContract } from "wagmi"
import { useAppKit } from "@reown/appkit/react"
import { Button } from "@/components/ui/button"
import { Loader2, Wallet, ExternalLink, CheckCircle2 } from "lucide-react"
import { prepareSettlement, recordDeposit, releaseOrder } from "@/app/actions/settlement"
import { useIsMiniPay } from "@/hooks/use-minipay"
import { explorerTxUrl, CELO_SEPOLIA_CHAIN_ID } from "@/lib/celo"
import {
  ESCROW_ABI,
  ERC20_FAUCET_ABI,
  PUBLIC_CHAIN_ID,
  PUBLIC_RPC_URL,
} from "@/lib/settlement/abi"

function reader() {
  return createPublicClient({ transport: http(PUBLIC_RPC_URL) })
}

type Phase =
  | "idle"
  | "preparing"
  | "switching"
  | "funding"
  | "approving"
  | "depositing"
  | "recording"
  | "done"

/**
 * Buyer-facing "pay" button. Drives the full on-chain settlement from the
 * buyer's own wallet: prepare escrow (server worker) -> optional testnet mint ->
 * approve -> deposit -> record the real tx. The wallet opens for the signature;
 * the order ends in a final, visible state with a CeloScan/Blockscout link.
 */
export function SettleOrderButton({
  orderId,
  onSettled,
}: {
  orderId: string
  onSettled?: () => void
}) {
  const { address, isConnected } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const { open } = useAppKit()
  const isMiniPay = useIsMiniPay()
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [txUrl, setTxUrl] = React.useState<string | null>(null)

  const busy = phase !== "idle" && phase !== "done"

  const phaseLabel: Record<Phase, string> = {
    idle: "Pagar ahora",
    preparing: "Preparando garantía…",
    switching: "Cambiando de red…",
    funding: "Obteniendo fondos…",
    approving: "Aprobando…",
    depositing: "Confirma en tu wallet…",
    recording: "Registrando pago…",
    done: "Pagado",
  }

  async function run() {
    try {
      setPhase("preparing")
      const prep = await prepareSettlement(orderId)
      if (!prep.ok) {
        setPhase("idle")
        if (prep.error === "insufficient_funds") {
          toast.error(
            `Saldo insuficiente: tienes ${(prep as any).balanceCusd} y necesitas ${(prep as any).requiredCusd}.`,
          )
        } else {
          toast.error(prep.error ?? "No pudimos preparar el pago.")
        }
        return
      }

      if (prep.mode === "offchain") {
        setPhase("idle")
        toast.success("Tu orden quedó en cola de liquidación. Te avisaremos al confirmarse.")
        onSettled?.()
        return
      }

      // On-chain: ensure wallet + correct chain.
      if (!isConnected || !address) {
        setPhase("idle")
        if (isMiniPay) {
          // MiniPay auto-connects the embedded wallet; no modal to open.
          toast.message("Conectando con MiniPay… vuelve a tocar Pagar.")
        } else {
          toast.message("Conecta tu wallet para firmar el pago.")
          open?.()
        }
        return
      }

      const escrow = getAddress(prep.escrow)
      const token = getAddress(prep.token)
      const amount = BigInt(prep.amountWei)
      const account = getAddress(address)
      const pub = reader()

      setPhase("switching")
      try {
        await switchChainAsync({ chainId: PUBLIC_CHAIN_ID })
      } catch {
        // user may already be on the right chain or rejected; verify by reading
      }

      // Ensure the buyer holds enough settlement token. On testnet the MockERC20
      // exposes open mint, so we can self-fund a demo purchase.
      const bal = (await pub.readContract({
        address: token,
        abi: ERC20_FAUCET_ABI,
        functionName: "balanceOf",
        args: [account],
      })) as bigint
      if (bal < amount) {
        if (PUBLIC_CHAIN_ID === CELO_SEPOLIA_CHAIN_ID) {
          setPhase("funding")
          toast.message("Acuñando fondos de prueba en tu wallet…")
          try {
            const mintHash = await writeContractAsync({
              address: token,
              abi: ERC20_FAUCET_ABI,
              functionName: "mint",
              args: [account, amount],
              chainId: PUBLIC_CHAIN_ID,
            })
            await pub.waitForTransactionReceipt({ hash: mintHash as Hex })
          } catch {
            setPhase("idle")
            toast.error("No tienes suficiente saldo y no se pudo acuñar fondos de prueba.")
            return
          }
        } else {
          setPhase("idle")
          toast.error("Saldo insuficiente para cubrir esta compra.")
          return
        }
      }

      // Approve escrow to pull the deposit, if needed.
      const allowance = (await pub.readContract({
        address: token,
        abi: ERC20_FAUCET_ABI,
        functionName: "allowance",
        args: [account, escrow],
      })) as bigint
      if (allowance < amount) {
        setPhase("approving")
        const approveHash = await writeContractAsync({
          address: token,
          abi: ERC20_FAUCET_ABI,
          functionName: "approve",
          args: [escrow, amount],
          chainId: PUBLIC_CHAIN_ID,
        })
        await pub.waitForTransactionReceipt({ hash: approveHash as Hex })
      }

      // Deposit into escrow — this is the buyer's payment signature.
      setPhase("depositing")
      const depositHash = await writeContractAsync({
        address: escrow,
        abi: ESCROW_ABI,
        functionName: "deposit",
        args: [],
        chainId: PUBLIC_CHAIN_ID,
      })
      await pub.waitForTransactionReceipt({ hash: depositHash as Hex })

      setPhase("recording")
      const rec = await recordDeposit(orderId, depositHash)
      if (!rec.ok) {
        setPhase("idle")
        toast.error(rec.error ?? "El pago se envió pero no pudimos registrarlo.")
        return
      }

      setTxUrl(rec.txUrl ?? explorerTxUrl(depositHash))
      setPhase("done")
      toast.success("Pago confirmado y protegido en garantía.")
      onSettled?.()
    } catch (err: any) {
      setPhase("idle")
      const msg = err?.shortMessage ?? err?.message ?? "No pudimos completar el pago."
      if (/user rejected|denied/i.test(String(msg))) {
        toast.error("Cancelaste la firma en la wallet.")
      } else {
        toast.error(msg)
      }
    }
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

  return (
    <Button size="sm" disabled={busy} onClick={run} className="gap-1.5">
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
