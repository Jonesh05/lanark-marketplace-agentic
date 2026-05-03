import { cookieStorage, createStorage } from "wagmi"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { celo } from "@reown/appkit/networks"
import type { AppKitNetwork } from "@reown/appkit/networks"

// Public project ID - safe to ship to the client.
export const reownProjectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ??
  "81a3cb53bb4adf0286c6e1e243d3f293"

if (!reownProjectId) {
  throw new Error("NEXT_PUBLIC_REOWN_PROJECT_ID is required")
}

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [celo]

export const wagmiAdapter = new WagmiAdapter({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storage: createStorage({ storage: cookieStorage as any }) as any,
  ssr: true,
  projectId: reownProjectId,
  networks,
})

export const wagmiConfig = wagmiAdapter.wagmiConfig
