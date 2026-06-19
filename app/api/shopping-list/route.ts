import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createRouteHandlerClient } from '@/lib/supabase/route'
import { productUnitPriceWeiStr } from '@/lib/pricing'

export const runtime = 'nodejs'

// Persistent wholesale cart backed by carts + cart_items (price snapshot at
// add-time; prices are final, no negotiation). The response shape stays
// {ok, items|item} so existing UI (AddToListButton, shopping-list.tsx) works.

const BodyAdd = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(100000),
})
const BodyUpdate = z.object({
  id: z.string().uuid(),
  quantity: z.number().int().min(1).max(100000),
})
const BodyDelete = z.object({ id: z.string().uuid() })

const GENERIC = 'No pudimos actualizar tu carrito. Intenta de nuevo.'

async function openCartId(
  supabase: any,
  userId: string,
): Promise<{ id?: string; error?: string }> {
  const { data: existing, error: selErr } = await supabase
    .from('carts')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'open')
    .maybeSingle()
  if (selErr) return { error: selErr.message }
  if (existing?.id) return { id: existing.id }

  const { data: created, error: insErr } = await supabase
    .from('carts')
    .insert({ user_id: userId, status: 'open' })
    .select('id')
    .single()
  if (insErr) return { error: insErr.message }
  return { id: created.id }
}

export async function GET() {
  try {
    const { supabase } = await createRouteHandlerClient()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes.user
    if (!user)
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const cart = await openCartId(supabase, user.id)
    if (cart.error) return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
    if (!cart.id) return NextResponse.json({ ok: true, items: [] })

    const { data, error } = await supabase
      .from('cart_items')
      .select(
        'id, product_id, quantity, unit_price_cents, currency, unit_price_cusd_wei, products(title, image_url, thumbnail_url, price_cop)',
      )
      .eq('cart_id', cart.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
    return NextResponse.json({ ok: true, items: data ?? [] })
  } catch {
    return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = BodyAdd.safeParse(await req.json())
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: 'Producto no válido.' }, { status: 400 })
    const { product_id, quantity } = parsed.data

    const { supabase } = await createRouteHandlerClient()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes.user
    if (!user)
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    // Read the product to snapshot its final price and validate availability.
    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('id, price_cents, currency, price_cusd, stock, active, shopkeeper_id')
      .eq('id', product_id)
      .maybeSingle()
    if (pErr) return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
    if (!product || !product.active)
      return NextResponse.json({ ok: false, error: 'Este producto no está disponible.' }, { status: 404 })
    if (product.stock < quantity)
      return NextResponse.json({ ok: false, error: 'No hay suficiente stock.' }, { status: 409 })

    const cart = await openCartId(supabase, user.id)
    if (cart.error || !cart.id)
      return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })

    const unitWei = productUnitPriceWeiStr(
      product.price_cents,
      product.currency,
      product.price_cusd,
    )
    if (unitWei === '0') {
      return NextResponse.json(
        { ok: false, error: 'Este producto no tiene un precio de liquidación válido.' },
        { status: 409 },
      )
    }

    // If the item is already in the cart, increase the quantity; otherwise add.
    const { data: existing } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('cart_id', cart.id)
      .eq('product_id', product_id)
      .maybeSingle()

    if (existing?.id) {
      const nextQty = Math.min(existing.quantity + quantity, product.stock)
      const { data, error } = await supabase
        .from('cart_items')
        .update({
          quantity: nextQty,
          unit_price_cusd_wei: unitWei,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()
      if (error) return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
      return NextResponse.json({ ok: true, item: data })
    }

    const { data, error } = await supabase
      .from('cart_items')
      .insert({
        cart_id: cart.id,
        product_id,
        shopkeeper_id: product.shopkeeper_id,
        quantity,
        unit_price_cents: product.price_cents,
        currency: product.currency,
        unit_price_cusd_wei: unitWei,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
    return NextResponse.json({ ok: true, item: data })
  } catch {
    return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const parsed = BodyUpdate.safeParse(await req.json())
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: 'Cantidad no válida.' }, { status: 400 })
    const { id, quantity } = parsed.data

    const { supabase } = await createRouteHandlerClient()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes.user
    if (!user)
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    // RLS already scopes cart_items to the owner's carts.
    const { data, error } = await supabase
      .from('cart_items')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
    return NextResponse.json({ ok: true, item: data })
  } catch {
    return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const parsed = BodyDelete.safeParse(await req.json())
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: 'Solicitud no válida.' }, { status: 400 })
    const { id } = parsed.data

    const { supabase } = await createRouteHandlerClient()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes.user
    if (!user)
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('cart_items').delete().eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
  }
}
