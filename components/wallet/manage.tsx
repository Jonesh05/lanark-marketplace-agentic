"use client"

import { useEffect, useState } from "react"
import { useAccount, useDisconnect } from "wagmi"
import { useAppKit } from "@reown/appkit/react"
import { erc20Abi, formatUnits } from "viem"
import { CUSD_ADDRESS, publicClient } from "@/lib/celo"
import { shortAddress } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Wallet,
  Globe,
  Power,
  Plug,
  ShieldCheck,
  RefreshCcw,
} from "lucide-react"

export function WalletManage({
  boundAddress,
  role,
  isGuest,
}: {
  boundAddress: string | null
  role: "client" | "shopkeeper"
  isGuest: boolean
}) {
  const { address, isConnected, chain } = useAccount()
  const { open } = useAppKit()
  const { disconnectAsync } = useDisconnect()
  const [balance, setBalance] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const liveAddress = address ?? boundAddress
  const isMatch =
    !!boundAddress &&
    !!address &&
    boundAddress.toLowerCase() === address.toLowerCase()

  async function loadBalance(addr: string) {
    setRefreshing(true)
    try {
      const wei = await publicClient().readContract({
        address: CUSD_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [addr as `0x${string}`],
      })
      setBalance(Number(formatUnits(wei, 18)).toFixed(2))
    } catch {
      setBalance(null)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!liveAddress) return
    void loadBalance(liveAddress)
  }, [liveAddress])

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border/60 bg-card/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Bound to your Sablon account
            </span>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" />
              <span className="font-mono text-sm">
                {boundAddress ? shortAddress(boundAddress) : "no wallet"}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                {role}
              </span>
              {isGuest && (
                <span className="rounded border border-accent/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent">
                  guest
                </span>
              )}
            </div>
          </div>
          <Button onClick={() => open()} variant="outline" className="h-9 gap-2">
            <Plug className="h-3.5 w-3.5" />
            {isConnected ? "Switch network" : "Open AppKit"}
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Stat
          icon={Wallet}
          label="Live balance"
          value={balance !== null ? `${balance} cUSD` : isConnected ? "—" : "connect to read"}
          action={
            liveAddress
              ? {
                  label: refreshing ? "Loading…" : "Refresh",
                  onClick: () => loadBalance(liveAddress),
                  icon: RefreshCcw,
                  spin: refreshing,
                }
              : undefined
          }
        />
        <Stat
          icon={Globe}
          label="Network"
          value={
            isConnected
              ? `${chain?.name ?? "Celo"} · ${chain?.id ?? 42220}`
              : "Celo Mainnet · 42220"
          }
        />
      </section>

      <section className="rounded-xl border border-border/60 bg-card/40 p-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Plug className="h-3.5 w-3.5 text-accent" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Live wallet session
            </span>
          </div>
          {!isConnected ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Open AppKit to connect a wallet, view your account, or change
                network. Your bound address stays the same — this only
                hydrates the in-page session.
              </p>
              <Button onClick={() => open()} className="h-10 w-fit gap-2">
                <Wallet className="h-4 w-4" />
                Open AppKit
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="block h-1.5 w-1.5 rounded-full bg-accent" />
                  <span className="font-mono">
                    {address ? shortAddress(address) : ""}
                  </span>
                </span>
                {!isMatch && boundAddress && (
                  <span className="rounded border border-destructive/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-destructive">
                    different from bound
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => open({ view: "Account" })}
                  variant="outline"
                  className="h-9 gap-2"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Account
                </Button>
                <Button
                  onClick={() => open({ view: "Networks" })}
                  variant="outline"
                  className="h-9 gap-2"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Networks
                </Button>
                <Button
                  onClick={() => disconnectAsync().catch(() => {})}
                  variant="ghost"
                  className="h-9 gap-2 text-muted-foreground"
                >
                  <Power className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  action?: {
    label: string
    onClick: () => void
    icon: React.ComponentType<{ className?: string }>
    spin?: boolean
  }
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Icon className="h-3 w-3" />
          {label}
        </span>
        {action && (
          <button
            onClick={action.onClick}
            type="button"
            className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground transition hover:text-foreground"
          >
            <action.icon
              className={`h-3 w-3 ${action.spin ? "animate-spin" : ""}`}
            />
            {action.label}
          </button>
        )}
      </div>
      <span className="font-serif text-2xl tracking-tight">{value}</span>
    </div>
  )
}
