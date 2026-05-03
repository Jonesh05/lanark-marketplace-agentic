import { NextResponse, type NextRequest } from "next/server"
import { verifyMessage, isAddress, getAddress } from "viem"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { CELO_CHAIN_ID } from "@/lib/celo"

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
 *   1. Verify the SIWE-ish signature with viem
 *   2. Find-or-create a Supabase user keyed by a deterministic email
 *      derived from the wallet address (the user never sees this email)
 *   3. Generate a magic-link token via the admin API and immediately
 *      verify it server-side - that sets the Supabase session cookies
 *   4. Upsert the smart_wallet row + update profile primary_address/role
 */
export async function POST(req: NextRequest) {
  let parsed
  try {
    parsed = Body.parse(await req.json())
  } catch (err: any) {
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

  // Defence-in-depth: ensure the message includes the nonce we got and the
  // claimed address. This prevents replay across users.
  if (!message.includes(nonce) || !message.toLowerCase().includes(address.toLowerCase())) {
    return NextResponse.json(
      { ok: false, error: "Message does not bind to address+nonce" },
      { status: 400 },
    )
  }

  // viem's verifyMessage handles both EOA and ERC-1271 (smart-account) sigs.
  const valid = await verifyMessage({
    address,
    message,
    signature: signature as `0x${string}`,
  }).catch(() => false)

  if (!valid) {
    return NextResponse.json(
      { ok: false, error: "Invalid signature" },
      { status: 401 },
    )
  }

  const admin = createAdminClient()
  const email = `${address.toLowerCase()}@wallet.sablon.local`

  // Find-or-create the auth user. listUsers + filter is reliable across
  // SDK versions; createUser idempotently fails on duplicate which we swallow.
  let userId: string | null = null
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1 })
  // No direct "find by email" in admin v2, but createUser returns existing
  // user error code we can recover from.
  void list

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
  } else if (created.error) {
    // 422 / "already registered" — look up via the SQL view
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("primary_address", address)
      .maybeSingle()
    if (existing?.id) {
      userId = existing.id
    } else {
      // Fallback: search by email via admin via paginated listUsers
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

  // Generate a one-time magiclink token, then verify it server-side to
  // mint a session on the cookied server client.
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  })
  if (link.error || !link.data.properties?.hashed_token) {
    return NextResponse.json(
      { ok: false, error: "Could not start session" },
      { status: 500 },
    )
  }

  const supabase = await createClient()
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

  // Upsert wallet + sync profile (RLS allows: we're now signed in).
  await supabase.from("smart_wallets").upsert(
    {
      user_id: userId,
      address,
      kind,
      chain_id: CELO_CHAIN_ID,
    },
    { onConflict: "address,chain_id" },
  )

  await supabase
    .from("profiles")
    .update({
      role,
      is_guest: kind === "guest",
      primary_address: address,
    })
    .eq("id", userId)

  return NextResponse.json({ ok: true, userId, address, role, kind })
}
