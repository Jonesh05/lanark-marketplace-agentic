import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SiteHeader } from "@/components/site-header"
import CartView from "@/components/cart/cart-view"
import copy from "@/lib/copy/en"

export const dynamic = "force-dynamic"

type Line = {
  id: string
  title: string
  image_url: string | null
  quantity: number
  unit_price_cents: number
  currency: string
}

type Group = {
  shopkeeper_id: string
  store_name: string
  store_slug: string | null
  lines: Line[]
}

export default async function CartPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Reusable default delivery address (persisted on checkout). Pre-fills the
  // shipping field so the buyer never re-types it; falls back to empty.
  const { data: profile } = await supabase
    .from("profiles")
    .select("delivery_address")
    .eq("id", user.id)
    .maybeSingle()

  // The buyer's persistent cart is the single open cart (one per user).
  const { data: openCart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "open")
    .maybeSingle()

  let groups: Group[] = []

  if (openCart?.id) {
    const { data: items, error: itemsError } = await supabase
      .from("cart_items")
      .select(
        "id, product_id, quantity, unit_price_cents, currency, shopkeeper_id, products(title, image_url, thumbnail_url)",
      )
      .eq("cart_id", openCart.id)
      .order("created_at", { ascending: false })

    if (itemsError) {
      // Surface read failures instead of silently rendering an empty cart
      // (a missing products relationship once made a full cart look empty).
      console.error("[cart] cart_items read failed:", itemsError.message)
    }

    const rows = (items ?? []) as any[]

    // Resolve each seller's store brand so the cart is grouped by store, the
    // same way the buyer browses the marketplace (single-vendor settlement).
    const shopIds = Array.from(
      new Set(rows.map((r) => r.shopkeeper_id).filter(Boolean)),
    ) as string[]

    const storeMap = new Map<string, { name: string; slug: string | null }>()
    if (shopIds.length > 0) {
      const { data: stores } = await supabase
        .from("stores")
        .select("owner_id, name, slug")
        .in("owner_id", shopIds)
        .eq("active", true)
      for (const s of (stores ?? []) as any[]) {
        storeMap.set(s.owner_id, { name: s.name, slug: s.slug ?? null })
      }
    }

    const byShop = new Map<string, Group>()
    for (const r of rows) {
      const key = (r.shopkeeper_id as string) ?? "unknown"
      if (!byShop.has(key)) {
        const st = storeMap.get(key)
        byShop.set(key, {
          shopkeeper_id: key,
          store_name: st?.name ?? "Tienda",
          store_slug: st?.slug ?? null,
          lines: [],
        })
      }
      const p = Array.isArray(r.products) ? r.products[0] : r.products
      byShop.get(key)!.lines.push({
        id: r.id,
        title: p?.title ?? "Producto",
        image_url: p?.image_url ?? p?.thumbnail_url ?? null,
        quantity: r.quantity,
        unit_price_cents: r.unit_price_cents,
        currency: r.currency,
      })
    }

    groups = Array.from(byShop.values())
  }

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8 flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {copy.cart.navLabel}
          </span>
          <h1 className="font-serif text-3xl tracking-tight">
            {copy.cart.title}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            {copy.cart.subtitle}
          </p>
        </header>

        <CartView groups={groups} defaultAddress={profile?.delivery_address ?? ""} />
      </section>
    </div>
  )
}
