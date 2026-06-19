import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Role-aware live state for the main surface. The chat refreshes this
 * after every tool call. The DB is the canonical source.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, primary_address")
    .eq("id", user.id)
    .single()
  const role = (profile?.role ?? "client") as "client" | "shopkeeper"

  const isShop = role === "shopkeeper"

  const offersQuery = isShop
    ? supabase
        .from("offers")
        .select(
          "id,qty,amount_cusd_wei,status,created_at,products!inner(id,title,shopkeeper_id)",
        )
        .eq("products.shopkeeper_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8)
    : supabase
        .from("offers")
        .select("id,qty,amount_cusd_wei,status,created_at,products(id,title)")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8)

  const ordersQuery = supabase
    .from("orders")
    .select("id,qty,amount_cusd_wei,status,tx_hash,created_at,products(title)")
    .eq(isShop ? "shopkeeper_id" : "client_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8)

  const repQuery = supabase
    .from("reputation_score")
    .select("score,events")
    .eq("subject_id", user.id)
    .maybeSingle()

  const productsQuery = isShop
    ? supabase
        .from("products")
        .select("id,title,price_cents,currency,stock,active,created_at")
        .eq("shopkeeper_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8)
    : supabase
        .from("products")
        .select("id,title,price_cents,currency,stock,active,category,rating,created_at")
        .eq("active", true)
        .gt("stock", 0)
        .order("rating", { ascending: false, nullsFirst: false })
        .limit(6)

  const [offers, orders, rep, products] = await Promise.all([
    offersQuery,
    ordersQuery,
    repQuery,
    productsQuery,
  ])

  return NextResponse.json({
    role,
    primaryAddress: profile?.primary_address ?? null,
    offers: offers.data ?? [],
    orders: orders.data ?? [],
    products: products.data ?? [],
    reputation: rep.data ?? { score: 0, events: 0 },
  })
}
