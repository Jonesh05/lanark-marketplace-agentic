import { headers } from "next/headers"
import { cookieToInitialState } from "wagmi"
import { wagmiConfig } from "@/lib/reown/config"
import { ReownProvider } from "@/components/providers/reown-provider"

/**
 * Server wrapper that hydrates wagmi from request cookies and mounts
 * ReownProvider. Used by every route that needs wallet awareness:
 * /auth/login, /dashboard, /app, /chat. Keeping it out of the root
 * layout means the marketing/marketplace pages compile without the
 * wagmi/Reown dependency tree.
 */
export async function WalletShell({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieHeader = (await headers()).get("cookie")
  const initialState = cookieToInitialState(wagmiConfig, cookieHeader)
  return <ReownProvider initialState={initialState}>{children}</ReownProvider>
}
