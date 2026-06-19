"use client"

import { useEffect, useState } from "react"

/**
 * Detect the MiniPay in-app browser.
 *
 * MiniPay injects an EIP-1193 provider at `window.ethereum` with the flag
 * `isMiniPay === true`. Detection is client-only (runs after mount) so SSR and
 * the traditional-browser flow are never affected — in a normal browser this
 * stays `false` and the existing AppKit/WalletConnect flow is used unchanged.
 *
 * See: https://docs.celo.org/developer/build-on-minipay/code-library
 */
export function useIsMiniPay(): boolean {
  const [isMiniPay, setIsMiniPay] = useState(false)

  useEffect(() => {
    try {
      const eth = (window as { ethereum?: { isMiniPay?: boolean } }).ethereum
      if (eth?.isMiniPay) {
        setIsMiniPay(true)
        // Helps verify MiniPay Developer Mode load in remote debugging.
        console.info("[lanark] MiniPay detected — using embedded wallet")
      }
    } catch {
      /* window.ethereum may be absent; not MiniPay */
    }
  }, [])

  return isMiniPay
}
