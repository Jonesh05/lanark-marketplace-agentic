import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  return NextResponse.json(
    { ok: false, error: "DummyJSON ingestion is disabled by configuration." },
    { status: 410 },
  )
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "DummyJSON ingestion endpoint is disabled." },
    { status: 410 },
  )
}
