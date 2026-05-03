import { WalletShell } from "@/components/providers/wallet-shell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <WalletShell>{children}</WalletShell>
}
