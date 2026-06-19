import { NextResponse, type NextRequest } from "next/server"
import { verifyMessage, isAddress, getAddress } from "viem"
import { z } from "zod"

import { createRouteHandlerClient } from "@/lib/supabase/route"
import { createAdminClient } from "@/lib/supabase/admin"
import { consumeNonce } from "@/lib/auth/nonce-store"
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
    console.error("[wallet] sign-in error:", err)
    return NextResponse.json(
      { ok: false, error: "Server error during sign-in" },
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

  // Single-use nonce gate: consumeNonce verifies the nonce was issued by this
  // server, is bound to this address, is within TTL, and atomically burns it
  // so it cannot be replayed (SEC-02). No DB required; the store lives in the
  // shared Node process (lib/auth/nonce-store.ts).
  const admin = createAdminClient()
  const nonceCheck = consumeNonce(nonce, address)
  if (!nonceCheck.ok) {
    return NextResponse.json(
      { ok: false, error: nonceCheck.reason },
      { status: 401 },
    )
  }

  // Verify the signature for EVERY account type — no kind is trusted blindly
  // (SEC-01). EOAs verify via ECDSA; smart accounts verify on-chain through
  // ERC-1271 / ERC-6492 (viem resolves 6492 wrappers and counterfactual
  // deployments). A smart account whose signature cannot be proven is rejected.
  let valid = false
  try {
    valid = await verifyMessage({
      address,
      message,
      signature: signature as `0x${string}`,
    })
  } catch {
    // Not a valid EOA signature; fall through to on-chain verification.
  }
  if (!valid) {
    try {
      const client = publicClient()
      valid = await client.verifyMessage({
        address,
        message,
        signature: signature as `0x${string}`,
      })
    } catch {
      // On-chain (ERC-1271/6492) verification failed.
    }
  }

  if (!valid) {
    return NextResponse.json(
      { ok: false, error: "Invalid signature" },
      { status: 401 },
    )
  }

  const syntheticEmail = `${address.toLowerCase()}@wallet.lanark.local`

  let userId: string | null = null
  let isNewUser = false
  // Email used to mint the session. For a RETURNING wallet we must use the auth
  // user's REAL email, which may carry a legacy domain from an older deploy
  // (e.g. @wallet.sablon.local). Minting with the new synthetic email would
  // otherwise provision a SECOND auth user for the same wallet — the exact
  // duplication that orphaned a seller's products from their dashboard.
  let sessionEmail = syntheticEmail

  // 1) Resolve identity by ADDRESS first — the wallet, not the email, is the
  //    stable key. smart_wallets is unique on (address, chain_id), so this is
  //    the authoritative lookup and is immune to email-domain changes.
  const { data: walletRow } = await admin
    .from("smart_wallets")
    .select("user_id")
    .eq("address", address)
    .maybeSingle()
  if (walletRow?.user_id) userId = walletRow.user_id as string

  // 2) Fall back to a profile already bound to this address.
  if (!userId) {
    const { data: profRows } = await admin
      .from("profiles")
      .select("id")
      .eq("primary_address", address)
      .limit(1)
    if (profRows && profRows.length > 0) userId = profRows[0].id as string
  }

  if (userId) {
    // Returning wallet: mint the session against the user's real email so we
    // never branch to a different auth user.
    const { data: existingUser } = await admin.auth.admin.getUserById(userId)
    if (existingUser?.user?.email) sessionEmail = existingUser.user.email
  } else {
    // 3) Genuinely new wallet: create the user with the synthetic email.
    const created = await admin.auth.admin.createUser({
      email: syntheticEmail,
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
      sessionEmail = syntheticEmail
    } else {
      // Race: another request created the user concurrently. Re-resolve by the
      // synthetic email we just attempted.
      let page = 1
      while (page < 20 && !userId) {
        const { data } = await admin.auth.admin.listUsers({
          page,
          perPage: 200,
        })
        const hit = data?.users.find((u) => u.email === syntheticEmail)
        if (hit) {
          userId = hit.id
          sessionEmail = hit.email ?? syntheticEmail
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

  // Enforce vendor-lock: if an existing profile has a role set that differs
  // from the requested role, disallow changing it here. This prevents clients
  // from overwriting a seller/shopkeeper role after initial registration.
  try {
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (existingProfile?.role && existingProfile.role !== role) {
      return NextResponse.json({ ok: false, error: 'Role change forbidden' }, { status: 403 })
    }
  } catch (e) {
    // If the check fails for any reason, continue - the upsert later is the
    // authoritative operation. We intentionally avoid blocking sign-in on
    // transient admin errors, but surface explicit role conflicts above.
  }

  // Create route handler client that properly captures cookies
  const { supabase, createResponse } = await createRouteHandlerClient()

  // Mint the session using generateLink + verifyOtp
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: sessionEmail,
  })
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
