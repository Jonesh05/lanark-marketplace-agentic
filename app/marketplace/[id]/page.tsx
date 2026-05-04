import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SiteHeader } from "@/components/site-header"
import { formatPrice } from "@/lib/format"
import { OfferForm } from "@/components/offer-form"
import type { Product } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single()
  if (!product) notFound()

  const p = product as Product

  // Catalog products imported from DummyJSON have no shopkeeper. The
  // agent itself acts as the autonomous mediator for those listings;
  // local shops can claim them later. So make this lookup optional.
  const { data: shop } = p.shopkeeper_id
    ? await supabase
        .from("profiles")
        .select("display_name,role,wallet_address")
        .eq("id", p.shopkeeper_id)
        .maybeSingle()
    : { data: null }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border/60 bg-muted">
          {p.image_url ? (
            <Image
              src={p.image_url}
              alt={p.title}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-grid">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                no image
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className="self-start font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              ← Back to marketplace
            </Link>
            <h1 className="font-serif text-4xl leading-tight tracking-tight text-balance">
              {p.title}
            </h1>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-2xl tabular-nums">
                {formatPrice(p.price_cents, p.currency)}
              </span>
              <span className="rounded border border-border/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                settles in {p.settle_token}
              </span>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {p.description || "No description provided."}
          </p>

          <dl className="grid grid-cols-3 gap-4 border-t border-border/60 pt-4 text-xs">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Stock
              </dt>
              <dd className="mt-1 font-mono tabular-nums">{p.stock}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Shop
              </dt>
              <dd className="mt-1 line-clamp-1">
                {shop?.display_name ??
                  (p.brand
                    ? p.brand
                    : p.source === "dummyjson"
                      ? "Sablon agent (auto)"
                      : "Anonymous shop")}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Status
              </dt>
              <dd className="mt-1 text-accent">{p.active ? "Live" : "Paused"}</dd>
            </div>
          </dl>

          {!user ? (
            <Link
              href={`/auth/login?next=/marketplace/${p.id}`}
              className="rounded-lg border border-accent bg-accent/10 px-4 py-3 text-center text-sm text-accent hover:bg-accent/20"
            >
              Sign in to place an offer
            </Link>
          ) : user.id === p.shopkeeper_id ? (
            <div className="rounded-lg border border-border/60 bg-card/40 px-4 py-3 text-center text-sm text-muted-foreground">
              You own this listing. Manage it from your dashboard.
            </div>
          ) : (
            <OfferForm product={p} />
          )}
        </div>
      </div>
    </div>
  )
}
