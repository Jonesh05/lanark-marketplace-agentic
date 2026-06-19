import { WalletProvider } from "@/components/providers/wallet-provider"

/**
 * Dashboard layout.
 *
 * The buyer settlement flow (SettleOrderButton) and seller release controls use
 * wagmi/Reown hooks to open the wallet and sign the on-chain deposit, so the
 * dashboard must sit inside the WagmiProvider. WalletProvider lazy-loads the
 * heavy wagmi/AppKit bundle (ssr:false) exactly like the /wallet route, so the
 * dashboard only pays for it on the client.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <WalletProvider>{children}</WalletProvider>
}
