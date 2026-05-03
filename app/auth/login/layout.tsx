import { headers } from "next/headers"
import { cookieToInitialState } from "wagmi"
import { wagmiConfig } from "@/lib/reown/config"
import { ReownProvider } from "@/components/providers/reown-provider"

// Wallet provider is scoped to the only route that needs it.
// The home page, marketplace, dashboard and agent surface compile
// without dragging in the wagmi/Reown dependency tree.
export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieHeader = (await headers()).get("cookie")
  const initialState = cookieToInitialState(wagmiConfig, cookieHeader)
  return <ReownProvider initialState={initialState}>{children}</ReownProvider>
}
