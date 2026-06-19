import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { signOut } from "@/app/actions/auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { shortAddress } from "@/lib/format"
import { WalletPill } from "@/components/wallet-pill"
import { AgentPulse } from "@/components/agent-pulse"
import { ShoppingCart } from "lucide-react"
import copy from "@/lib/copy/en"

export async function SiteHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let displayName: string | null = null
  let role: string | null = null
  let primaryAddress: string | null = null
  let cartCount = 0
  if (user) {
    // maybeSingle so a missing profile row does not throw and force
    // the server to render a different tree than the client. With
    // .single(), a missing row returns 406 which can render fewer
    // elements server-side and trigger a hydration mismatch on
    // the dropdown trigger button.
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, role, is_guest, primary_address")
      .eq("id", user.id)
      .maybeSingle()
    displayName = profile?.display_name ?? user.email ?? "User"
    role = profile?.role ?? "client"
    primaryAddress = profile?.primary_address ?? null

    // Persistent-cart signal: count items in the buyer's single open cart so
    // the header badge survives navigation and reloads. Shopkeepers run a
    // store console and never carry a buyer cart, so it is skipped for them.
    if (role !== "shopkeeper") {
      const { data: openCart } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "open")
        .maybeSingle()
      if (openCart?.id) {
        // Sum quantities (not row count) so the badge matches the units the
        // buyer actually added and what the cart view totals.
        const { data: qtyRows } = await supabase
          .from("cart_items")
          .select("quantity")
          .eq("cart_id", openCart.id)
        cartCount = (qtyRows ?? []).reduce(
          (s, r) => s + (Number((r as { quantity?: number }).quantity) || 0),
          0,
        )
      }
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="block h-2 w-2 bg-accent" />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
            Lanark
          </span>
        </Link>
        <nav className="hidden items-center gap-5 text-xs text-muted-foreground sm:flex">
          <Link href="/" className="transition-colors hover:text-foreground">
            Marketplace
          </Link>
          {user && (
            <>
              <Link
                href="/app"
                className="transition-colors hover:text-foreground"
              >
                Surface
              </Link>
              <Link
                href="/dashboard"
                className="transition-colors hover:text-foreground"
              >
                Dashboard
              </Link>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {!user ? (
            <Button asChild size="sm" className="h-8">
              <Link href="/auth/login">Sign in</Link>
            </Button>
          ) : (
            <>
              {role !== "shopkeeper" && (
                <Link
                  href="/cart"
                  aria-label={
                    cartCount > 0
                      ? `${copy.cart.navLabel} (${cartCount})`
                      : copy.cart.navLabel
                  }
                  className="relative inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-[11px] transition-colors hover:bg-accent/10"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{copy.cart.navLabel}</span>
                  {cartCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold tabular-nums text-accent-foreground">
                      {cartCount}
                    </span>
                  )}
                </Link>
              )}
              <AgentPulse />
              <WalletPill address={primaryAddress} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-border/60 px-2 py-1 text-[11px] hover:bg-accent/10">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-accent text-[10px] text-accent-foreground">
                      {(displayName ?? "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden font-mono sm:inline">
                    {primaryAddress
                      ? shortAddress(primaryAddress)
                      : (displayName ?? "")}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                    {role}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {primaryAddress ? shortAddress(primaryAddress) : "Signed in"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/app">Surface</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                {role !== "shopkeeper" && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/cart">{copy.cart.navLabel}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/favorites">{copy.favorites.navLabel}</Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/wallet">Wallet</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile">Profile settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action={signOut}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full text-left">
                      Sign out
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
