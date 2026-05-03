"use client"

import { useEffect, useState } from "react"
import { useAccount } from "wagmi"
import { useAppKit } from "@reown/appkit/react"
import { erc20Abi, formatUnits } from "viem"
import { CUSD_ADDRESS, publicClient } from "@/lib/celo"
import { shortAddress } from "@/lib/format"
import { Wallet } from "lucide-react"

/**
 * Renders the Reown AppKit account button - the canonical wallet UI:
 * connection status, network, address, and balance. Clicking opens the
 * full Account/Networks modal.
 */
export function WalletPill() {
  const { address, isConnected } = useAccount()
  const { open } = useAppKit()
  const [balance, setBalance] = useState<string | null>(null)

  useEffect(() => {
    if (!address) {
      setBalance(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const wei = await publicClient().readContract({
          address: CUSD_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        })
        if (!cancelled) setBalance(Number(formatUnits(wei, 18)).toFixed(2))
      } catch {
        if (!cancelled) setBalance(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [address])

  if (!isConnected || !address) {
    return (
      <button
        onClick={() => open({ view: "Connect" })}
        className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-accent/40 hover:text-foreground sm:inline-flex"
        type="button"
      >
        <Wallet className="h-3 w-3" />
        Connect
      </button>
    )
  }

  return (
    <button
      onClick={() => open({ view: "Account" })}
      className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-[10px] transition hover:border-accent/40 sm:inline-flex"
      type="button"
    >
      <span className="block h-1.5 w-1.5 rounded-full bg-accent" />
      <span className="font-mono text-foreground">
        {shortAddress(address)}
      </span>
      {balance !== null && (
        <span className="font-mono uppercase tracking-widest text-muted-foreground">
          {balance} cUSD
        </span>
      )}
    </button>
  )
}
