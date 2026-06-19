/**
 * In-memory single-use nonce store for wallet sign-in (SEC-02).
 *
 * Nonces are server-issued, address-bound, TTL-limited (5 min), and burned on
 * first use — preventing replay of a captured signed message. This runs in the
 * shared Node.js process so all route handlers in the same instance share state.
 *
 * For multi-instance / serverless deployments, replace `pending` with an
 * Upstash Redis SET with TTL (same key contract: nonce → {address, expires}).
 */

const TTL_MS = 5 * 60_000

interface NonceEntry {
  address: string | null // checksummed EIP-55, or null if not bound
  expires: number // unix ms
}

const pending = new Map<string, NonceEntry>()

// Prune expired entries once per minute so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of pending) {
    if (v.expires < now) pending.delete(k)
  }
}, 60_000).unref?.() // unref so the interval doesn't keep the process alive in tests

/**
 * Issues a fresh nonce bound to the given address (or unbound if null).
 * Returns the raw hex nonce string that should be embedded in the sign message.
 */
export function issueNonce(address: string | null): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const nonce = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  pending.set(nonce, { address, expires: Date.now() + TTL_MS })
  return nonce
}

/**
 * Verifies and atomically burns the nonce.
 * Returns `{ ok: true }` on success, `{ ok: false, reason }` on any failure.
 * After a successful call the nonce is deleted and cannot be reused.
 */
export function consumeNonce(
  nonce: string,
  address: string,
): { ok: true } | { ok: false; reason: string } {
  const entry = pending.get(nonce)
  if (!entry) return { ok: false, reason: "Invalid or expired nonce" }

  if (entry.expires < Date.now()) {
    pending.delete(nonce)
    return { ok: false, reason: "Nonce expired" }
  }

  if (
    entry.address &&
    entry.address.toLowerCase() !== address.toLowerCase()
  ) {
    return { ok: false, reason: "Nonce does not match address" }
  }

  pending.delete(nonce) // burn — single use
  return { ok: true }
}
