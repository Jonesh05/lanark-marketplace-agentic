import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SiteHeader } from "@/components/site-header"
import { WalletManage } from "@/components/wallet/manage"
import { SETTLEMENT_SYMBOL } from "@/lib/celo"

export const dynamic = "force-dynamic"

export default async function WalletPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/wallet")

  const { data: profile } = await supabase
    .from("profiles")
    .select("primary_address, role, is_guest")
    .eq("id", user.id)
    .single()

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
        <header className="flex flex-col gap-2 border-b border-border/60 pb-6">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Wallet
          </span>
          <h1 className="font-serif text-4xl tracking-tight">
            Your Celo wallet
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {SETTLEMENT_SYMBOL} balance, network, and account management. The
            agent settles here on every accepted offer.
          </p>
        </header>

        <WalletManage
          boundAddress={profile?.primary_address ?? null}
          role={(profile?.role ?? "client") as "client" | "shopkeeper"}
          isGuest={Boolean(profile?.is_guest)}
        />
      </main>
    </div>
  )
}
