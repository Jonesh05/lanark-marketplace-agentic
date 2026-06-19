import { cookieStorage, createStorage } from "@wagmi/core"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { celo, celoAlfajores } from "@reown/appkit/networks"
import { defineChain } from "@reown/appkit/networks"
import type { AppKitNetwork } from "@reown/appkit/networks"

/**
 * Celo Sepolia testnet (OP-stack), the active settlement chain. Alfajores is
 * deprecated; the buyer's wallet must be able to switch here to fund escrows,
 * so it is registered alongside mainnet.
 */
export const celoSepolia = defineChain({
  id: 11142220,
  caipNetworkId: "eip155:11142220",
  chainNamespace: "eip155",
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://celo-sepolia.blockscout.com" },
  },
  testnet: true,
}) as AppKitNetwork

/**
 * Reown / WalletConnect project ID. Pulled from either
 * `NEXT_PUBLIC_REOWN_PROJECT_ID` or `NEXT_PUBLIC_WC_PROJECT_ID`. We do not
 * throw on missing — that would crash the whole app at import time. Instead
 * we surface the absence in the UI and let everything else still render.
 */
export const projectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ??
  process.env.NEXT_PUBLIC_WC_PROJECT_ID ??
  process.env.NEXT_PUBLIC_PROJECT_ID ??
  ""

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  celoSepolia,
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
