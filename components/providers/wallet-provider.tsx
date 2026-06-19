"use client"

import dynamic from "next/dynamic"
import type { ReactNode } from "react"
import { Spinner } from "@/components/ui/spinner"

/**
 * Lazy-load the wallet provider (wagmi + Reown AppKit, ~2.5 MB uncompressed).
 *
 * Reasons for dynamic import with ssr:false:
 * 1. The chunk is large and on-demand — if it fails to load (stale build,
 *    transient network), the error boundary catches without crashing the route.
 * 2. AppKit and wagmi access browser globals at init; ssr:false ensures they
 *    never run during server-side rendering.
 * 3. Turbopack generates a separate chunk for the import; failed chunks can be
 *    retried instead of blocking the full page.
 */
const WalletShell = dynamic(
  () =>
    import("@/components/providers/wallet-shell").then((m) => ({
      default: m.WalletShell,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[40svh] items-center justify-center">
        <Spinner className="h-5 w-5 text-muted-foreground" />
      </div>
    ),
  },
)

export function WalletProvider({ children }: { children: ReactNode }) {
  return <WalletShell>{children}</WalletShell>
}
