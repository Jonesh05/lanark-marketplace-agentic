import { NextResponse, type NextRequest } from "next/server"
import { verifyMessage, isAddress, getAddress } from "viem"
import { z } from "zod"

import { createRouteHandlerClient } from "@/lib/supabase/route"
import { createAdminClient } from "@/lib/supabase/admin"
import { CELO_CHAIN_ID, publicClient } from "@/lib/celo"

export const runtime = "nodejs"

const Body = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  message: z.string().min(1),
  nonce: z.string().min(8),
  role: z.enum(["client", "shopkeeper"]).default("client"),
  kind: z.enum(["guest", "sca", "eoa"]).default("eoa"),
})

/**
 * Wallet sign-in:
 *   1. Verify the SIWE-ish signature with viem (handles ERC-1271 too).
 *   2. Find-or-create a Supabase user keyed by a deterministic email.
 *   3. Mint a session via admin.generateLink + verifyOtp.
 *   4. Upsert smart_wallets and update profile - but PRESERVE the
 *      existing role for returning users; only set role on first sign-in.
 */
export async function POST(req: NextRequest) {
  try {
    return await handle(req)
  } catch (err: any) {
    // Final safety net: return valid JSON so the client never sees empty body
    return NextResponse.json(
      {
        ok: false,
        error:
          typeof err?.message === "string"
            ? err.message
            : "Unexpected server error during sign-in",
      },
      { status: 500 },
    )
  }
}

async function handle(req: NextRequest) {
  let parsed
  try {
    parsed = Body.parse(await req.json())
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request payload" },
      { status: 400 },
    )
  }

  const { signature, message, nonce, role, kind } = parsed

  if (!isAddress(parsed.address)) {
    return NextResponse.json(
      { ok: false, error: "Bad address" },
      { status: 400 },
    )
  }
  const address = getAddress(parsed.address)

  if (
    !message.includes(nonce) ||
    !message.toLowerCase().includes(address.toLowerCase())
  ) {
    return NextResponse.json(
      { ok: false, error: "Message does not bind to address+nonce" },
      { status: 400 },
    )
  }

  // Try standard ECDSA verification first. If it fails, the address might
  // be a smart contract wallet (EIP-1271) so we fall back to on-chain check.
  let valid = false
  try {
    valid = await verifyMessage({
      address,
      message,
      signature: signature as `0x${string}`,
    })
  } catch {
    // ECDSA failed, might be a smart contract wallet
  }

  // EIP-1271 fallback for smart contract wallets (social login, etc.)
  if (!valid) {
    try {
      const client = publicClient()
      const bytecode = await client.getCode({ address })
      if (bytecode && bytecode !== "0x") {
        // It's a contract - use EIP-1271 verification
        const result = await client.verifyMessage({
          address,
          message,
          signature: signature as `0x${string}`,
        })
        valid = result
      }
    } catch {
      // On-chain verification failed
    }
  }

  if (!valid) {
    return NextResponse.json(
      { ok: false, error: "Invalid signature" },
      { status: 401 },
    )
  }

  const admin = createAdminClient()
  const email = `${address.toLowerCase()}@wallet.sablon.local`

  let userId: string | null = null
  let isNewUser = false

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      role,
      is_guest: kind === "guest",
      primary_address: address,
      wallet_kind: kind,
      display_name: `${address.slice(0, 6)}…${address.slice(-4)}`,
    },
  })

  if (created.data?.user) {
    userId = created.data.user.id
    isNewUser = true
  } else if (created.error) {
    // Existing user - find them.
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("primary_address", address)
      .maybeSingle()
    if (existing?.id) {
      userId = existing.id
    } else {
      let page = 1
      while (page < 20 && !userId) {
        const { data } = await admin.auth.admin.listUsers({
          page,
          perPage: 200,
        })
        const hit = data?.users.find((u) => u.email === email)
        if (hit) {
          userId = hit.id
          break
        }
        if (!data?.users || data.users.length < 200) break
        page += 1
      }
    }
  }

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Could not provision user" },
      { status: 500 },
    )
  }

  // Create route handler client that properly captures cookies
  const { supabase, createResponse } = await createRouteHandlerClient()

  // Mint the session using generateLink + verifyOtp
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email })
  if (link.error || !link.data.properties?.hashed_token) {
    return NextResponse.json(
      { ok: false, error: "Could not start session" },
      { status: 500 },
    )
  }

  const verify = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.data.properties.hashed_token,
  })
  if (verify.error || !verify.data.user) {
    return NextResponse.json(
      { ok: false, error: verify.error?.message ?? "Session failed" },
      { status: 500 },
    )
  }

  // Upsert wallet record (RLS allows: we are now signed in).
  await supabase.from("smart_wallets").upsert(
    {
      user_id: userId,
      address,
      kind,
      chain_id: CELO_CHAIN_ID,
    },
    { onConflict: "address,chain_id" },
  )

  // Resolve the effective role:
  //   - new user: trust the picked role
  //   - returning user: use the role already on file
  let effectiveRole = role
  let effectiveIsGuest = kind === "guest"
  if (!isNewUser) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("role, is_guest")
      .eq("id", userId)
      .single()
    if (existing?.role) effectiveRole = existing.role as typeof role
    if (typeof existing?.is_guest === "boolean") {
      effectiveIsGuest = existing.is_guest
    }
  }

  // Upsert (not update) so users created before the on_auth_user_created
  // trigger existed still get a profile row. Without this, every
  // downstream `.from("profiles").select(...).single()` returns 406.
  await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        role: effectiveRole,
        is_guest: effectiveIsGuest,
        primary_address: address,
        display_name: `${address.slice(0, 6)}…${address.slice(-4)}`,
      },
      { onConflict: "id" },
    )

  // Use createResponse to ensure session cookies are attached
  return createResponse({
    ok: true,
    userId,
    address,
    role: effectiveRole,
    kind,
    isNewUser,
  })
}
