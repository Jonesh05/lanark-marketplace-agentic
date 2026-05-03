import { WalletShell } from "@/components/providers/wallet-shell"

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <WalletShell>{children}</WalletShell>
}
