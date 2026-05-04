/**
 * DummyJSON product ingestion.
 *
 * The marketplace catalog is seeded from https://dummyjson.com/products
 * (no API mocks, real HTTP). Records are upserted by `(source, external_id)`
 * so re-running the sync is idempotent.
 *
 * Field mapping:
 *   - external_id      <- DummyJSON `id`
 *   - title            <- `title`
 *   - description      <- `description`
 *   - price_cents      <- round(price * 100)         (USD)
 *   - currency         <- "USD"
 *   - settle_token     <- "cUSD"                     (settled on Celo)
 *   - stock            <- `stock`
 *   - thumbnail_url    <- `thumbnail`
 *   - image_url        <- `images[0]` ?? `thumbnail`
 *   - category         <- `category`
 *   - brand            <- `brand` ?? null
 *   - rating           <- `rating`
 *   - discount_percentage <- `discountPercentage`
 *   - tags             <- `tags` ?? []
 *   - active           <- true
 *   - shopkeeper_id    <- null   (no local owner; shopkeepers can claim later)
 */

import { createAdminClient } from "@/lib/supabase/admin"

export type DummyJsonProduct = {
  id: number
  title: string
  description: string
  price: number
  discountPercentage?: number
  rating?: number
  stock: number
  brand?: string
  category: string
  thumbnail: string
  images?: string[]
  tags?: string[]
}

type DummyJsonResponse = {
  products: DummyJsonProduct[]
  total: number
  skip: number
  limit: number
}

const PAGE_SIZE = 100

async function fetchPage(skip: number): Promise<DummyJsonResponse> {
  const url = `https://dummyjson.com/products?limit=${PAGE_SIZE}&skip=${skip}&select=id,title,description,price,discountPercentage,rating,stock,brand,category,thumbnail,images,tags`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`DummyJSON fetch failed (${res.status} ${res.statusText})`)
  }
  return (await res.json()) as DummyJsonResponse
}

function toRow(p: DummyJsonProduct) {
  return {
    source: "dummyjson" as const,
    external_id: String(p.id),
    shopkeeper_id: null as string | null,
    title: p.title,
    description: p.description,
    image_url: p.images?.[0] ?? p.thumbnail,
    thumbnail_url: p.thumbnail,
    price_cents: Math.round(p.price * 100),
    currency: "USD",
    settle_token: "cUSD",
    stock: p.stock,
    active: true,
    category: p.category ?? null,
    brand: p.brand ?? null,
    rating: typeof p.rating === "number" ? p.rating : null,
    discount_percentage:
      typeof p.discountPercentage === "number" ? p.discountPercentage : null,
    tags: p.tags ?? [],
  }
}

export async function syncDummyJsonCatalog(): Promise<{
  ingested: number
  pages: number
  total: number
}> {
  const admin = createAdminClient()
  let skip = 0
  let pages = 0
  let ingested = 0
  let total = Infinity

  while (skip < total) {
    const page = await fetchPage(skip)
    pages += 1
    total = page.total

    if (page.products.length === 0) break

    const rows = page.products.map(toRow)
    const { error } = await admin
      .from("products")
      .upsert(rows, { onConflict: "source,external_id" })

    if (error) {
      throw new Error(`Upsert failed at skip=${skip}: ${error.message}`)
    }

    ingested += rows.length
    skip += page.products.length

    if (page.products.length < PAGE_SIZE) break
  }

  return { ingested, pages, total }
}
