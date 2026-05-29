import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createRouteHandlerClient } from '@/lib/supabase/route'

export const runtime = 'nodejs'

const BodyAdd = z.object({ product_id: z.string().min(1), quantity: z.number().int().min(1) })
const BodyUpdate = z.object({ id: z.string().min(1), quantity: z.number().int().min(1) })
const BodyDelete = z.object({ id: z.string().min(1) })

export async function GET(req: NextRequest) {
  try {
    const { supabase } = await createRouteHandlerClient()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes.user
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, items: data })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? 'error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = BodyAdd.safeParse(body)
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Bad body' }, { status: 400 })
    const { product_id, quantity } = parsed.data

    const { supabase } = await createRouteHandlerClient()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes.user
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase.from('shopping_lists').insert([{ user_id: user.id, product_id, quantity }]).select().single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, item: data })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? 'error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = BodyUpdate.safeParse(body)
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Bad body' }, { status: 400 })
    const { id, quantity } = parsed.data

    const { supabase } = await createRouteHandlerClient()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes.user
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('shopping_lists')
      .update({ quantity })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, item: data })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? 'error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = BodyDelete.safeParse(body)
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Bad body' }, { status: 400 })
    const { id } = parsed.data

    const { supabase } = await createRouteHandlerClient()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes.user
    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('shopping_lists').delete().eq('id', id).eq('user_id', user.id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? 'error' }, { status: 500 })
  }
}
