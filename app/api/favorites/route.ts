import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createRouteHandlerClient } from "@/lib/supabase/route"

export const runtime = "nodejs"

// Durable client-side favorites, backed by the `favorites` table (RLS scopes
// every row to its owner). Distinct from the cart (purchase intent): saving a
// favorite never reserves stock or snapshots a price.

const Body = z.object({ product_id: z.string().uuid() })
const GENERIC = "No pudimos actualizar tus favoritos."

export async function GET() {
  try {
    const { supabase } = await createRouteHandlerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: true, ids: [] })

    const { data, error } = await supabase.from("favorites").select("product_id")
    if (error)
      return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
    return NextResponse.json({
      ok: true,
      ids: (data ?? []).map((r: { product_id: string }) => r.product_id),
    })
  } catch {
    return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = Body.safeParse(await req.json())
    if (!parsed.success)
      return NextResponse.json(
        { ok: false, error: "Producto no válido." },
        { status: 400 },
      )

    const { supabase } = await createRouteHandlerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user)
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    // Idempotent: UNIQUE (user_id, product_id) turns a repeat into a no-op.
    const { error } = await supabase
      .from("favorites")
      .upsert(
        { user_id: user.id, product_id: parsed.data.product_id },
        { onConflict: "user_id,product_id", ignoreDuplicates: true },
      )
    if (error)
      return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const parsed = Body.safeParse(await req.json())
    if (!parsed.success)
      return NextResponse.json(
        { ok: false, error: "Producto no válido." },
        { status: 400 },
      )

    const { supabase } = await createRouteHandlerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user)
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("product_id", parsed.data.product_id)
    if (error)
      return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: GENERIC }, { status: 500 })
  }
}
