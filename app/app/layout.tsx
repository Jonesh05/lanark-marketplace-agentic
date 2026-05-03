import { WalletShell } from "@/components/providers/wallet-shell"

export default async function SurfaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <WalletShell>{children}</WalletShell>
}
