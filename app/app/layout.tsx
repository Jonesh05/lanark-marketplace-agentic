import { WalletProvider } from "@/components/providers/wallet-provider"

/**
 * Surface (/app) needs wagmi so the agent checkout flow can open the wallet
 * for on-chain deposit after authorizeOrder.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>
}
