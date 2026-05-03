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

export async function SiteHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let displayName: string | null = null
  let role: string | null = null
  let primaryAddress: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, role, is_guest, primary_address")
      .eq("id", user.id)
      .single()
    displayName = profile?.display_name ?? user.email ?? "User"
    role = profile?.role ?? "client"
    primaryAddress = profile?.primary_address ?? null
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="block h-2 w-2 bg-accent" />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
            Sablon
          </span>
        </Link>
        <nav className="hidden items-center gap-5 text-xs text-muted-foreground sm:flex">
          <Link href="/" className="transition-colors hover:text-foreground">
            Marketplace
          </Link>
          {user && (
            <>
              <Link
                href="/dashboard"
                className="transition-colors hover:text-foreground"
              >
                Dashboard
              </Link>
              <Link
                href="/chat"
                className="transition-colors hover:text-foreground"
              >
                Agent
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
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/chat">Agent</Link>
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
          )}
        </div>
      </div>
    </header>
  )
}
