"use client"

import { type ReactNode, useState, useEffect, useRef } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createAppKit } from "@reown/appkit/react"
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi"

import { wagmiAdapter, projectId, networks } from "@/lib/reown/config"
import { MiniPayAutoConnect } from "./minipay-autoconnect"

const queryClient = new QueryClient()

const metadata = {
  name: "Lanark",
  description: "Agentic on-chain marketplace on Celo",
  url: typeof window !== "undefined" ? window.location.origin : "https://lanark.app",
  icons: [],
}

// Track if AppKit has been initialized (module-level singleton)
let appKitInitialized = false

function initializeAppKit() {
  if (appKitInitialized || !projectId) return
  
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
    // expose a window flag so client components can detect initialization
    try { (window as any).__reownAppKitInitialized = true } catch {}
  } catch (e) {
    // AppKit may throw if already initialized
    if (!(e instanceof Error && e.message.includes("already"))) {
      console.error("[ReownProvider] AppKit init error:", e)
    }
    appKitInitialized = true
    try { (window as any).__reownAppKitInitialized = true } catch {}
  }
}

export function ReownProvider({
  children,
  cookies,
}: {
  children: ReactNode
  cookies: string | null
}) {
  const [ready, setReady] = useState(false)
  const initRef = useRef(false)

  // Initialize AppKit once on mount (client-side only)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    initializeAppKit()
    setReady(true)
  }, [])

  // Hydrate wagmi store from cookies so the connection survives navigation
  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig as Config,
    cookies,
  )

  // Render children only once AppKit is initialized to ensure useAppKit
  // can be used safely in descendants. The WalletShell wrapper ensures
  // this provider is present only for routes that need wagmi/AppKit.
  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig as Config}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>
        {!ready ? (
          <div className="flex min-h-svh items-center justify-center">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground animate-pulse">
              Loading wallet…
            </span>
          </div>
        ) : (
          <>
            <MiniPayAutoConnect />
            {children}
          </>
        )}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
