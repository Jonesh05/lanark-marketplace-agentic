import { WalletProvider } from "@/components/providers/wallet-provider"

/**
 * Wallet route layout.
 *
 * The heavy wagmi/Reown AppKit bundle is lazy-loaded via WalletProvider
 * (dynamic import, ssr:false) so a chunk-load failure is caught by the route
 * error boundary instead of crashing the RSC payload.
 */
export default function WalletLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <WalletProvider>{children}</WalletProvider>
}
