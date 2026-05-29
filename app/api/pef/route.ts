import { NextResponse } from "next/server"
import { createRouteHandlerClient } from "@/lib/supabase/route"

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { product_id, qty = 1, unit_price_cusd_micro, intent_text, address_hash, metadata } = body

    const { supabase, createResponse } = await createRouteHandlerClient()

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr) return createResponse({ ok: false, error: userErr.message }, { status: 500 })
    const user = userData?.user
    if (!user) return createResponse({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const payload = {
      product_id,
      qty,
      unit_price_cusd_micro,
      address_hash,
      intent_text,
      status: 'pending',
      metadata: { ...(metadata ?? {}), created_by: user.id },
    }

    const { data, error } = await supabase.from('purchase_execution_flash').insert([payload]).select().single()
    if (error) return createResponse({ ok: false, error: error.message }, { status: 500 })

    return createResponse({ ok: true, pef: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 })
  }
}
