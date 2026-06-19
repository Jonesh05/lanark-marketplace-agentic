import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SiteHeader } from "@/components/site-header"
import { ShopkeeperDashboard } from "@/components/dashboard/shopkeeper"
import { ClientDashboard } from "@/components/dashboard/client"
import { DashboardAutoPay } from "@/components/dashboard/auto-pay"
import { computeSellerMetrics } from "@/lib/metrics/seller"
import type { Product, Offer, Order, OrderItem, Profile, Store } from "@/lib/types"

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
    const [
      { data: products },
      { data: offers },
      { data: orders },
      { data: orderItems },
      { data: store },
    ] = await Promise.all([
        // Private dashboard scope: my_store_products is a security_invoker view
        // that filters to auth.uid() in the database, so the shopkeeper can
        // never pull the global catalog here (enforced in SQL, not by a filter).
        supabase
          .from("my_store_products")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("offers")
          .select("*, products!inner(title, shopkeeper_id)")
          .eq("products.shopkeeper_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        // Wider window than the old limit-20 so metrics (revenue, conversion,
        // recurring customers) reflect real history, not just the latest page.
        supabase
          .from("orders")
          .select("*")
          .eq("shopkeeper_id", user.id)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("order_items")
          .select("*")
          .eq("shopkeeper_id", user.id)
          .order("created_at", { ascending: false })
          .limit(500),
        // The shopkeeper's own storefront (renameable brand identity).
        supabase
          .from("stores")
          .select("*")
          .eq("owner_id", user.id)
          .maybeSingle(),
      ])

    const productList = (products ?? []) as Product[]
    const orderList = (orders ?? []) as Order[]
    const itemList = (orderItems ?? []) as OrderItem[]
    const metrics = computeSellerMetrics(orderList, itemList, productList)

    return (
      <div className="min-h-svh">
        <SiteHeader />
        <ShopkeeperDashboard
          profile={profile!}
          store={(store ?? null) as Store | null}
          products={productList}
          offers={(offers ?? []) as Offer[]}
          orders={orderList}
          orderItems={itemList}
          metrics={metrics}
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
      <DashboardAutoPay />
      <ClientDashboard
        profile={profile!}
        offers={(offers ?? []) as Offer[]}
        orders={(orders ?? []) as Order[]}
      />
    </div>
  )
}
