import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SiteHeader } from "@/components/site-header"
import { ShopkeeperDashboard } from "@/components/dashboard/shopkeeper"
import { ClientDashboard } from "@/components/dashboard/client"
import type { Product, Offer, Order, Profile } from "@/lib/types"

export const dynamic = "force-dynamic"

// Dashboard is a Server Component. The role is set at sign-in and is the
// source of truth here - no graduation prompts, no client-side branching.
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

  // Defensive default: if a row is missing for any reason, treat as client.
  const role: "client" | "shopkeeper" =
    profile?.role === "shopkeeper" ? "shopkeeper" : "client"

  if (role === "shopkeeper") {
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
          profile={profile!}
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
