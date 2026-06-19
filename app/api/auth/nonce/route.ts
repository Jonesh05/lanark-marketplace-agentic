import { NextResponse, type NextRequest } from "next/server"
import { isAddress, getAddress } from "viem"
import { issueNonce } from "@/lib/auth/nonce-store"

export const runtime = "nodejs"

/**
 * Issues a single-use server-stored nonce for wallet sign-in.
 * The nonce is bound to the requesting address, lives 5 minutes, and is burned
 * by the matching POST to /api/auth/wallet — preventing replay (SEC-02).
 *
 * No DB required: the nonce is held in the Node process memory store
 * (lib/auth/nonce-store.ts). Apply sql/2026_06_18_auth_nonces.sql and
 * migrate to a Redis-backed store for multi-instance deployments.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("address")
  const address = raw && isAddress(raw) ? getAddress(raw) : null
  const nonce = issueNonce(address)
  return NextResponse.json({ ok: true, nonce, ttlSeconds: 300 })
}
