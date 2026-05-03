import { WalletShell } from "@/components/providers/wallet-shell"

// WalletShell is a client component, so this server layout simply
// emits a client boundary. The wagmi/Reown bundle stays out of the
// server compile path for /auth/login.
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <WalletShell>{children}</WalletShell>
}
