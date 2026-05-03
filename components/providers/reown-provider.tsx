"use client"

import { useState, type ReactNode } from "react"
import { WagmiProvider, type State } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createAppKit } from "@reown/appkit/react"
import { wagmiAdapter, reownProjectId, networks } from "@/lib/reown/config"

const metadata = {
  name: "Sablon",
  description: "Agentic on-chain marketplace · cUSD on Celo",
  url:
    typeof window !== "undefined"
      ? window.location.origin
      : "https://sablon.app",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
}

// createAppKit must run at module scope so `useAppKit()` finds the singleton
// during the first render, including the SSR pass. AppKit is SSR-safe; the
// global flag prevents duplicate init across HMR / fast-refresh.
declare global {
  // eslint-disable-next-line no-var
  var __sablonAppKitReady: boolean | undefined
}
if (typeof window !== "undefined" && !globalThis.__sablonAppKitReady) {
  globalThis.__sablonAppKitReady = true
  createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId: reownProjectId,
    metadata,
    features: {
      analytics: false,
      email: true,
      socials: ["google", "x", "github"],
      emailShowWallets: true,
    },
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#22c55e",
    },
  })
}

export function ReownProvider({
  children,
  initialState,
}: {
  children: ReactNode
  initialState?: State
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  )

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
