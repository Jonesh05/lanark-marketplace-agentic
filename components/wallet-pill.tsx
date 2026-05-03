import Link from "next/link"
import { Wallet } from "lucide-react"
import { shortAddress } from "@/lib/format"

/**
 * Header pill — pure server component. Reads the address that was bound
 * to the Supabase session at sign-in. Click goes to /wallet, the only
 * route that hydrates wagmi for actual wallet management.
 *
 * Keeping wagmi out of the dashboard/surface/chat means those routes
 * compile in seconds instead of 50+s on a cold sandbox.
 */
export function WalletPill({ address }: { address: string | null }) {
  if (!address) {
    return (
      <Link
        href="/wallet"
        className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-accent/40 hover:text-foreground sm:inline-flex"
      >
        <Wallet className="h-3 w-3" />
        No wallet
      </Link>
    )
  }
  return (
    <Link
      href="/wallet"
      className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-[10px] transition hover:border-accent/40 sm:inline-flex"
      title="Manage wallet"
    >
      <span className="block h-1.5 w-1.5 rounded-full bg-accent" />
      <span className="font-mono text-foreground">
        {shortAddress(address)}
      </span>
      <span className="font-mono uppercase tracking-widest text-muted-foreground">
        Celo
      </span>
    </Link>
  )
}
