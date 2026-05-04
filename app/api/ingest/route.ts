/**
 * Data Ingestion API
 * 
 * POST /api/ingest
 * 
 * Normalizes external data sources (DummyJSON, CSV, custom JSON) 
 * into the products, orders, and offers tables.
 * 
 * Requires admin authentication or a valid API key.
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

// Ingest source types
const IngestSourceSchema = z.enum(["dummyjson", "custom"])

// Custom product schema for direct ingestion
const CustomProductSchema = z.object({
  external_id: z.string().min(1),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).nullable().optional(),
  price_cents: z.number().int().positive(),
  currency: z.enum(["USD", "COP"]).default("USD"),
  stock: z.number().int().min(0).default(1),
  image_url: z.string().url().nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  category: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
})

const IngestRequestSchema = z.object({
  source: IngestSourceSchema,
  products: z.array(CustomProductSchema).optional(), // For custom source
  limit: z.number().int().min(1).max(500).optional(), // For dummyjson
})

// DummyJSON types
type DummyJsonProduct = {
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

async function ingestFromDummyJson(limit: number = 100) {
  const url = `https://dummyjson.com/products?limit=${limit}&select=id,title,description,price,discountPercentage,rating,stock,brand,category,thumbnail,images,tags`
  const res = await fetch(url, { cache: "no-store" })
  
  if (!res.ok) {
    throw new Error(`DummyJSON fetch failed: ${res.status} ${res.statusText}`)
  }
  
  const data: DummyJsonResponse = await res.json()
  const admin = createAdminClient()
  
  const rows = data.products.map((p) => ({
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
    discount_percentage: typeof p.discountPercentage === "number" ? p.discountPercentage : null,
    tags: p.tags ?? [],
  }))
  
  const { error, data: inserted } = await admin
    .from("products")
    .upsert(rows, { onConflict: "source,external_id" })
    .select("id")
  
  if (error) {
    throw new Error(`Upsert failed: ${error.message}`)
  }
  
  return {
    source: "dummyjson",
    ingested: rows.length,
    total: data.total,
  }
}

async function ingestCustomProducts(
  products: z.infer<typeof CustomProductSchema>[],
  userId: string
) {
  const admin = createAdminClient()
  
  const rows = products.map((p) => ({
    source: "custom" as const,
    external_id: p.external_id,
    shopkeeper_id: userId,
    title: p.title,
    description: p.description ?? null,
    image_url: p.image_url ?? null,
    thumbnail_url: p.thumbnail_url ?? p.image_url ?? null,
    price_cents: p.price_cents,
    currency: p.currency,
    settle_token: "cUSD",
    stock: p.stock,
    active: true,
    category: p.category ?? null,
    brand: p.brand ?? null,
    tags: p.tags ?? [],
  }))
  
  const { error } = await admin
    .from("products")
    .upsert(rows, { onConflict: "source,external_id" })
  
  if (error) {
    throw new Error(`Upsert failed: ${error.message}`)
  }
  
  return {
    source: "custom",
    ingested: rows.length,
  }
}

export async function POST(req: NextRequest) {
  // Check authentication
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Allow admin key or authenticated shopkeeper
  const apiKey = req.headers.get("x-api-key")
  const isAdmin = apiKey === process.env.INGEST_API_KEY
  
  if (!user && !isAdmin) {
    return NextResponse.json(
      { error: "Unauthorized. Sign in or provide valid API key." },
      { status: 401 }
    )
  }
  
  // If user is authenticated, check if they're a shopkeeper (for custom ingestion)
  let profile = null
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    profile = data
  }
  
  try {
    const body = await req.json()
    const parsed = IngestRequestSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      )
    }
    
    const { source, products, limit } = parsed.data
    
    if (source === "dummyjson") {
      // Only admin can ingest from DummyJSON
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Admin access required for DummyJSON ingestion" },
          { status: 403 }
        )
      }
      
      const result = await ingestFromDummyJson(limit)
      return NextResponse.json({ ok: true, ...result })
    }
    
    if (source === "custom") {
      if (!products || products.length === 0) {
        return NextResponse.json(
          { error: "No products provided for custom ingestion" },
          { status: 400 }
        )
      }
      
      if (!user) {
        return NextResponse.json(
          { error: "Authentication required for custom ingestion" },
          { status: 401 }
        )
      }
      
      if (profile?.role !== "shopkeeper" && !isAdmin) {
        return NextResponse.json(
          { error: "Only shopkeepers can ingest custom products" },
          { status: 403 }
        )
      }
      
      const result = await ingestCustomProducts(products, user.id)
      return NextResponse.json({ ok: true, ...result })
    }
    
    return NextResponse.json({ error: "Unknown source" }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// GET endpoint to check catalog status
export async function GET() {
  const supabase = await createClient()
  
  const { count: productCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("active", true)
  
  const { count: orderCount } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
  
  const { count: offerCount } = await supabase
    .from("offers")
    .select("*", { count: "exact", head: true })
  
  return NextResponse.json({
    products: productCount ?? 0,
    orders: orderCount ?? 0,
    offers: offerCount ?? 0,
    empty: (productCount ?? 0) === 0,
  })
}
