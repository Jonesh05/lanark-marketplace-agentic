import { cookieStorage, createStorage } from "@wagmi/core"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { celo, celoAlfajores } from "@reown/appkit/networks"
import type { AppKitNetwork } from "@reown/appkit/networks"

/**
 * Reown / WalletConnect project ID. Pulled from either
 * `NEXT_PUBLIC_REOWN_PROJECT_ID` or `NEXT_PUBLIC_WC_PROJECT_ID`. We do not
 * throw on missing — that would crash the whole app at import time. Instead
 * we surface the absence in the UI and let everything else still render.
 */
export const projectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ??
  process.env.NEXT_PUBLIC_WC_PROJECT_ID ??
  ""

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  celo,
  celoAlfajores,
]

/**
 * Wagmi adapter. Lives in a non-`'use client'` module on purpose: it's
 * imported by both the client provider and any server code that needs the
 * config (e.g. `cookieToInitialState`).
 */
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId: projectId || "missing-project-id",
  networks,
})

export const wagmiConfig = wagmiAdapter.wagmiConfig
