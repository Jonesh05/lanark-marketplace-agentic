"use client"

import type { ReactNode } from "react"
import { ReownProvider } from "./reown-provider"

/**
 * Client wrapper that mounts ReownProvider. Marked "use client" so Next.js
 * treats this as a client boundary — the wagmi/Reown dependency tree
 * (200+ modules) is bundled ONLY into the client bundle for routes that
 * use it (/auth/login, /wallet). The server SSR for those routes does
 * NOT have to compile wagmi, so cold compiles drop from ~50s to a few
 * seconds and the page never appears blank.
 *
 * We read cookies from document.cookie on mount (client-side only) for
 * wagmi state hydration. This avoids passing cookies through SSR props
 * which would drag wagmi into the server bundle.
 */
export function WalletShell({ children }: { children: ReactNode }) {
  // Read cookies client-side; this is a client component so document is available
  const cookies = typeof document !== "undefined" ? document.cookie : null
  return <ReownProvider cookies={cookies}>{children}</ReownProvider>
}
