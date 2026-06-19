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
import {
  prepareSettlement,
  stageDepositTx,
  recordDeposit,
} from "@/app/actions/settlement"
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

export type SettlePhase =
  | "idle"
  | "preparing"
  | "switching"
  | "funding"
  | "approving"
  | "depositing"
  | "recording"
  | "done"

/**
 * Shared buyer settlement runner. Used by dashboard button and Surface auto-pay.
 */
export function useSettleOrder(onSettled?: () => void) {
  const { address, isConnected } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const { open } = useAppKit()
  const isMiniPay = useIsMiniPay()
  const [phase, setPhase] = React.useState<SettlePhase>("idle")
  const [txUrl, setTxUrl] = React.useState<string | null>(null)
  const running = React.useRef(false)

  const busy = phase !== "idle" && phase !== "done"

  async function settle(orderId: string) {
    if (running.current) return
    running.current = true
    try {
      setPhase("preparing")
      const prep = await prepareSettlement(orderId)
      if (!prep.ok) {
        setPhase("idle")
        if (prep.error === "insufficient_funds") {
          toast.error(
            `Saldo insuficiente: tienes ${(prep as { balanceCusd?: string }).balanceCusd} y necesitas ${(prep as { requiredCusd?: string }).requiredCusd}.`,
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

      if (!isConnected || !address) {
        setPhase("idle")
        if (isMiniPay) {
          toast.message("Conectando con MiniPay… vuelve a intentar en un momento.")
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
        /* may already be on chain */
      }

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

      setPhase("depositing")
      const depositHash = await writeContractAsync({
        address: escrow,
        abi: ESCROW_ABI,
        functionName: "deposit",
        args: [],
        chainId: PUBLIC_CHAIN_ID,
      })

      // Persist txHash immediately so CeloScan is available before receipt.
      setTxUrl(explorerTxUrl(depositHash))
      await stageDepositTx(orderId, depositHash)

      setPhase("recording")
      await pub.waitForTransactionReceipt({ hash: depositHash as Hex })

      const rec = await recordDeposit(orderId, depositHash)
      if (!rec.ok) {
        setPhase("idle")
        toast.error(rec.error ?? "El pago se envió pero no pudimos confirmarlo.")
        return
      }

      setTxUrl(rec.txUrl ?? explorerTxUrl(depositHash))
      setPhase("done")
      toast.success("Pago confirmado y protegido en garantía.")
      onSettled?.()
    } catch (err: unknown) {
      setPhase("idle")
      const msg =
        (err as { shortMessage?: string; message?: string })?.shortMessage ??
        (err as { message?: string })?.message ??
        "No pudimos completar el pago."
      if (/user rejected|denied/i.test(String(msg))) {
        toast.error("Cancelaste la firma en la wallet.")
      } else {
        toast.error(msg)
      }
    } finally {
      running.current = false
    }
  }

  return { settle, phase, busy, txUrl, setPhase }
}
