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

declare global {
  // eslint-disable-next-line no-var
  var __sablonAppKit: ReturnType<typeof createAppKit> | undefined
}

// Initialise AppKit ONLY in the browser. Doing this at module load on the
// server makes Lit/web-component internals touch `window` and the page
// silently falls back to a blank screen.
if (typeof window !== "undefined" && !globalThis.__sablonAppKit) {
  globalThis.__sablonAppKit = createAppKit({
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
