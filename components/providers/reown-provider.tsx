"use client"

import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createAppKit } from "@reown/appkit/react"
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi"

import { wagmiAdapter, projectId, networks } from "@/lib/reown/config"

const queryClient = new QueryClient()

const metadata = {
  name: "Sablon",
  description: "Agentic on-chain marketplace on Celo",
  url:
    typeof window !== "undefined"
      ? window.location.origin
      : "https://sablon.app",
  icons: [],
}

/**
 * Module-scope `createAppKit`. This is the EXACT pattern from Reown's
 * official Next.js example — it must run at module load (not inside the
 * component body, not behind a `typeof window` guard). The Lit web
 * components inside AppKit are only mounted lazily when the modal is
 * opened, so module-scope evaluation is safe during SSR.
 *
 * Without this, `useAppKit()` throws "Please call createAppKit before
 * using useAppKit hook" during SSR, and Next falls back to client-only
 * rendering with the same error.
 */
if (projectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks,
    defaultNetwork: networks[0],
    metadata,
    features: {
      analytics: false,
      email: true,
      socials: ["google", "x", "github", "discord", "apple"],
      emailShowWallets: true,
    },
    themeMode: "dark",
  })
}

export function ReownProvider({
  children,
  cookies,
}: {
  children: ReactNode
  cookies: string | null
}) {
  // Hydrate wagmi store from server-set cookies so the connection survives
  // navigation across server-rendered routes.
  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig as Config,
    cookies,
  )

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig as Config}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
