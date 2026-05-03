import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SiteHeader } from "@/components/site-header"
import { ShopkeeperDashboard } from "@/components/dashboard/shopkeeper"
import { ClientDashboard } from "@/components/dashboard/client"
import type { Product, Offer, Order, Profile } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { setRole } from "@/app/actions/auth"

export const dynamic = "force-dynamic"

// HARD CONSTRAINT: Dashboard must be a Server Component.
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/dashboard")

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()
  const profile = profileRow as Profile | null

  // First-time graduation prompt for guests
  if (profile?.is_guest) {
    return (
      <div className="min-h-svh">
        <SiteHeader />
        <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
          <h1 className="font-serif text-4xl tracking-tight">
            One last thing.
          </h1>
          <p className="text-sm text-muted-foreground">
            Tell us how you want to use Sablon. You can change it later.
          </p>
          <div className="flex flex-col gap-3">
            <form action={setRole.bind(null, "client")}>
              <Button type="submit" className="h-12 w-full justify-start text-left">
                I&apos;m here to buy
              </Button>
            </form>
            <form action={setRole.bind(null, "shopkeeper")}>
              <Button
                type="submit"
                variant="outline"
                className="h-12 w-full justify-start text-left"
              >
                I&apos;m here to sell
              </Button>
            </form>
          </div>
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to marketplace
          </Link>
        </main>
      </div>
    )
  }

  if (profile?.role === "shopkeeper") {
    const [{ data: products }, { data: offers }, { data: orders }] =
      await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("shopkeeper_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("offers")
          .select("*, products!inner(title, shopkeeper_id)")
          .eq("products.shopkeeper_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("orders")
          .select("*")
          .eq("shopkeeper_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ])

    return (
      <div className="min-h-svh">
        <SiteHeader />
        <ShopkeeperDashboard
          profile={profile}
          products={(products ?? []) as Product[]}
          offers={(offers ?? []) as Offer[]}
          orders={(orders ?? []) as Order[]}
        />
      </div>
    )
  }

  // client
  const [{ data: offers }, { data: orders }] = await Promise.all([
    supabase
      .from("offers")
      .select("*, products(title, image_url, currency, price_cents)")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("orders")
      .select("*, products(title, image_url)")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <ClientDashboard
        profile={profile!}
        offers={(offers ?? []) as Offer[]}
        orders={(orders ?? []) as Order[]}
      />
    </div>
  )
}
