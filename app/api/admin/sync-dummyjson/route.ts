import { NextResponse } from "next/server"

import { syncDummyJsonCatalog } from "@/lib/dummyjson"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/admin/sync-dummyjson
 *
 * Re-ingests the entire DummyJSON product catalog into public.products.
 * Idempotent: rows are matched by (source, external_id).
 *
 * Auth: pass header `x-admin-secret: <SUPABASE_SERVICE_ROLE_KEY>`.
 * The service role key is already a server-only secret, so we reuse it
 * to gate this route without introducing yet another env var.
 */
export async function POST(req: Request) {
  const provided = req.headers.get("x-admin-secret") ?? ""
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  if (!expected || provided !== expected) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    )
  }

  try {
    const summary = await syncDummyJsonCatalog()
    return NextResponse.json({ ok: true, ...summary })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Sync failed" },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Use POST /api/admin/sync-dummyjson with header x-admin-secret to ingest.",
    },
    { status: 405 },
  )
}
