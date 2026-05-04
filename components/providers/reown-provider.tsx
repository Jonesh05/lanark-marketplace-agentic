"use client"

import { type ReactNode, useState, useEffect } from "react"
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

// Track if AppKit has been initialized
let appKitInitialized = false

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
if (projectId && !appKitInitialized) {
  try {
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
    appKitInitialized = true
  } catch (e) {
    console.error("[v0] AppKit initialization error:", e)
  }
}

export function ReownProvider({
  children,
  cookies,
}: {
  children: ReactNode
  cookies: string | null
}) {
  // Track if component has mounted (for SSR hydration)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Hydrate wagmi store from cookies so the connection survives navigation
  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig as Config,
    cookies,
  )

  // Always render children to maintain consistent hook order across renders.
  // Use CSS to show/hide instead of conditional rendering to avoid
  // "Rendered more hooks than during the previous render" error.
  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig as Config}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>
        {/* Loading indicator - shown only before mount */}
        <div
          className="flex min-h-svh items-center justify-center"
          style={{ display: mounted ? "none" : "flex" }}
        >
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground animate-pulse">
            Loading wallet…
          </span>
        </div>
        {/* Children always rendered to preserve hook order, hidden until mounted */}
        <div style={{ display: mounted ? "contents" : "none" }}>
          {children}
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
