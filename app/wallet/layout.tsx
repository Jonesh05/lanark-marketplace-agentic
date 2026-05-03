import { WalletShell } from "@/components/providers/wallet-shell"

export default function WalletLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <WalletShell>{children}</WalletShell>
}
