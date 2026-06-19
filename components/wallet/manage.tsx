"use client"

import { useEffect, useState } from "react"
import { useAccount, useDisconnect } from "wagmi"
import { useAppKit } from "@reown/appkit/react"
import { erc20Abi, formatUnits } from "viem"
import { settlementToken, publicClient, SETTLEMENT_SYMBOL, explorerAddressUrl } from "@/lib/celo"
import { shortAddress } from "@/lib/format"
import copy from "@/lib/copy/en"
import { useIsMiniPay } from "@/hooks/use-minipay"
import { Button } from "@/components/ui/button"
import {
  Wallet,
  Globe,
  Power,
  Plug,
  ShieldCheck,
  RefreshCcw,
  Coins,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react"

/**
 * Full-address copy field. Shows a truncated address for layout but lets the
 * user copy the COMPLETE address (the brief's "□ que funcione como copy") and
 * open it on the block explorer. Accessible: button has an explicit label and
 * announces the copied state.
 */
function CopyAddress({ address, label }: { address: string; label: string }) {
  const [copied, setCopied] = useState(false)
  async function doCopy() {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be blocked; selection still possible */
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs" title={address}>
          {address}
        </code>
        <button
          type="button"
          onClick={doCopy}
          aria-label={copied ? "Dirección copiada" : "Copiar dirección completa"}
          title="Copiar dirección"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/60 text-muted-foreground transition hover:border-accent/50 hover:text-accent"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-accent" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
        <a
          href={explorerAddressUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ver dirección en el explorador"
          title="Ver en el explorador"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border/60 text-muted-foreground transition hover:border-accent/50 hover:text-accent"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}

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
  // guard useAppKit to avoid init race where AppKit throws during startup
  let appKit: any = null
  try {
    appKit = useAppKit()
  } catch (e) {
    appKit = null
  }
  const open = appKit?.open?.bind(appKit)
  const isMiniPay = useIsMiniPay()
  const { disconnectAsync } = useDisconnect()
  const [balance, setBalance] = useState<string | null>(null)
  const [native, setNative] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const liveAddress = address ?? boundAddress
  const isMatch =
    !!boundAddress &&
    !!address &&
    boundAddress.toLowerCase() === address.toLowerCase()

  async function loadBalance(addr: string) {
    setRefreshing(true)
    try {
      const client = publicClient()
      // cUSD is the settlement asset; native CELO only covers gas. Read both so
      // a seller still waiting on their first payout sees the gas they actually
      // hold (what wallets like MetaMask surface) instead of just "0.00".
      const [wei, nativeWei] = await Promise.all([
        client.readContract({
          address: settlementToken(),
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [addr as `0x${string}`],
        }),
        client.getBalance({ address: addr as `0x${string}` }),
      ])
      setBalance(Number(formatUnits(wei, 18)).toFixed(2))
      setNative(Number(formatUnits(nativeWei, 18)).toFixed(3))
    } catch {
      setBalance(null)
      setNative(null)
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
          {isMiniPay ? (
            <span className="inline-flex h-9 items-center gap-2 rounded-md border border-accent/30 bg-accent/5 px-3 font-mono text-[10px] uppercase tracking-widest text-accent">
              <Plug className="h-3.5 w-3.5" />
              MiniPay wallet
            </span>
          ) : (
            <Button onClick={() => open?.()} variant="outline" className="h-9 gap-2">
              <Plug className="h-3.5 w-3.5" />
              {isConnected ? "Switch network" : "Open AppKit"}
            </Button>
          )}
        </div>

        {/* Full address + copy box. Receiving address for both clients and
            shopkeepers — the real address is never hidden, and it can be copied
            or opened on the explorer to verify the account and its activity. */}
        {liveAddress ? (
          <div className="mt-4">
            <CopyAddress
              address={liveAddress}
              label={
                role === "shopkeeper"
                  ? "Your payout address (share to receive)"
                  : "Your wallet address"
              }
            />
            {boundAddress &&
              address &&
              boundAddress.toLowerCase() !== address.toLowerCase() && (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-amber-400">
                  La wallet conectada difiere de tu dirección vinculada.
                </p>
              )}
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            Conecta una wallet para ver y copiar tu dirección.
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={Wallet}
          label={copy.wallet.liveBalance}
          value={
            balance !== null
              ? `${balance} ${SETTLEMENT_SYMBOL}`
              : isConnected
                ? "—"
                : copy.wallet.connectToRead
          }
          action={
            liveAddress
              ? {
                  label: refreshing ? copy.wallet.loading : copy.wallet.refresh,
                  onClick: () => loadBalance(liveAddress),
                  icon: RefreshCcw,
                  spin: refreshing,
                }
              : undefined
          }
        />
        <Stat
          icon={Coins}
          label={copy.wallet.gasBalance}
          value={
            native !== null
              ? `${native} CELO`
              : isConnected
                ? "—"
                : copy.wallet.connectToRead
          }
        />
        <Stat
          icon={Globe}
          label={copy.wallet.network}
          value={
            isConnected
              ? `${chain?.name ?? "Celo"} · ${chain?.id ?? 42220}`
              : "Celo Mainnet · 42220"
          }
        />
      </section>

      {liveAddress && balance !== null && Number(balance) === 0 && (
        <p className="-mt-3 rounded-lg border border-border/60 bg-card/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {role === "shopkeeper"
            ? copy.wallet.waitingShopkeeper
            : copy.wallet.waitingClient}
        </p>
      )}

      <section className="rounded-xl border border-border/60 bg-card/40 p-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Plug className="h-3.5 w-3.5 text-accent" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Live wallet session
            </span>
          </div>
          {isMiniPay ? (
            <p className="text-sm text-muted-foreground">
              You are inside MiniPay. Lanark uses your embedded MiniPay wallet
              automatically — no separate connection or network switch is
              needed.
            </p>
          ) : !isConnected ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Open AppKit to connect a wallet, view your account, or change
                network. Your bound address stays the same — this only
                hydrates the in-page session.
              </p>
              <Button onClick={() => open?.()} className="h-10 w-fit gap-2">
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
                  onClick={() => open?.({ view: "Account" })}
                  variant="outline"
                  className="h-9 gap-2"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Account
                </Button>
                <Button
                  onClick={() => open?.({ view: "Networks" })}
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
