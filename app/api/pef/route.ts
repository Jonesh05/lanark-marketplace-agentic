import { NextResponse } from "next/server"
import { z } from "zod"
import { createRouteHandlerClient } from "@/lib/supabase/route"
import { keccak256, stringToBytes } from "viem"

export const runtime = 'nodejs'

const Body = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(10000).default(1),
  // Price in cUSD wei (18 decimals) as a decimal string — wei can exceed the
  // JS safe-integer range, so it is never a number on the wire.
  unit_price_cusd_wei: z.string().regex(/^\d{1,30}$/),
  intent_text: z.string().min(1).max(2000),
  address_hash: z.string().min(1).max(200),
  // TTL for the purchase-execution flash; default 15 minutes.
  ttl_seconds: z.coerce.number().int().min(60).max(3600).default(900),
})

export async function POST(req: Request) {
  try {
    let parsed
    try {
      parsed = Body.parse(await req.json())
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid request payload" }, { status: 400 })
    }
    const { product_id, quantity, unit_price_cusd_wei, intent_text, address_hash, ttl_seconds } = parsed

    const { supabase, createResponse } = await createRouteHandlerClient()

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr) {
      console.error("[pef] auth error:", userErr)
      return createResponse({ ok: false, error: "Authentication error" }, { status: 500 })
    }
    const user = userData?.user
    if (!user) return createResponse({ ok: false, error: 'Unauthorized' }, { status: 401 })

    // Verify the product exists, is active, and has enough stock before
    // capturing a purchase intent. Prevents PEFs for missing/inactive listings.
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('id, active, stock')
      .eq('id', product_id)
      .single()
    if (prodErr || !product) {
      return createResponse({ ok: false, error: 'Product not found' }, { status: 404 })
    }
    if (!product.active || product.stock < quantity) {
      return createResponse({ ok: false, error: 'Product not available' }, { status: 409 })
    }

    // Idempotency: an Idempotency-Key maps to a still-pending, unexpired PEF
    // for the same buyer+product. The table has no dedicated key column, so we
    // dedupe on a recent pending intent for the same product within its TTL.
    const idempotencyKey = req.headers.get('Idempotency-Key')
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from('purchase_execution_flash')
        .select('id, status, product_id, quantity, unit_price_cusd_wei, expires_at')
        .eq('client_id', user.id)
        .eq('product_id', product_id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .maybeSingle()
      if (existing) {
        return createResponse({ ok: true, pef: existing, idempotent: true }, { status: 200 })
      }
    }

    // Never store the client-supplied value verbatim. Re-derive a salted,
    // user-bound, non-reversible digest server-side so a client cannot forge a
    // hash that collides with another user's record (SEC-03).
    const addressHash = keccak256(
      stringToBytes(`${process.env.PEF_ADDRESS_SALT ?? ""}:${user.id}:${address_hash}`),
    )

    const now = Date.now()
    const payload = {
      client_id: user.id,
      product_id,
      quantity,
      unit_price_cusd_wei,
      address_hash: addressHash,
      intent_text,
      status: 'pending',
      expires_at: new Date(now + ttl_seconds * 1000).toISOString(),
    }

    const { data, error } = await supabase
      .from('purchase_execution_flash')
      .insert([payload])
      .select('id, status, product_id, quantity, unit_price_cusd_wei, expires_at, created_at')
      .single()
    if (error) {
      console.error("[pef] insert error:", error)
      return createResponse({ ok: false, error: "Could not create purchase intent" }, { status: 500 })
    }

    return createResponse({ ok: true, pef: data }, { status: 201 })
  } catch (err) {
    console.error("[pef] unexpected error:", err)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
