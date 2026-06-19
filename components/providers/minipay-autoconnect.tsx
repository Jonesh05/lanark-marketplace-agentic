"use client"

import { useEffect, useRef } from "react"
import { useAccount, useConnect } from "wagmi"
import { useIsMiniPay } from "@/hooks/use-minipay"

/**
 * Inside MiniPay we use ONLY the embedded wallet, so there is no "Connect"
 * step: as soon as the wagmi context is ready we silently connect through the
 * injected MiniPay provider. In a normal browser `isMiniPay` is false and this
 * renders nothing, leaving the AppKit/WalletConnect flow completely intact.
 *
 * Mounted inside ReownProvider (within WagmiProvider) so `useConnect` has its
 * context. Keeps full wagmi/viem compatibility — MiniPay is just an injected
 * EIP-1193 connector to wagmi.
 */
export function MiniPayAutoConnect() {
  const isMiniPay = useIsMiniPay()
  const { isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const tried = useRef(false)

  useEffect(() => {
    if (!isMiniPay || isConnected || tried.current) return
    // EIP-6963 / injected connector — MiniPay's provider is exposed here.
    const injected = connectors.find(
      (c) => c.type === "injected" || c.id === "injected",
    )
    if (!injected) return
    tried.current = true
    connect({ connector: injected })
  }, [isMiniPay, isConnected, connect, connectors])

  return null
}
