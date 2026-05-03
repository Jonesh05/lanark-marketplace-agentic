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
 * We intentionally skip `cookieToInitialState` here. Wagmi's
 * `cookieStorage` reads the session on mount, which is more than enough
 * for a sign-in flow and avoids dragging wagmi into any server bundle.
 */
export function WalletShell({ children }: { children: ReactNode }) {
  return <ReownProvider>{children}</ReownProvider>
}
