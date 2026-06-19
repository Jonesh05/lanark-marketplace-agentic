/**
 * x402 helpers for LANARK
 *
 * Small, safe helpers to detect, normalize, and expose an x402-style
 * payment request returned by a 402 response. This module does NOT
 * perform on-chain signing or send funds. Instead it normalizes the
 * payment spec so a caller (client or secure signing service) can
 * construct and sign the payment and then re-submit the original
 * request with proof.
 *
 * Use this as a starting point for integrating AgentCore/x402 flows.
 */

export type X402PaymentSpec = {
  amount: string; // human-friendly amount or smallest-unit numeric string
  currency: string; // token symbol or chain-currency (e.g., "cUSD", "USDC")
  payee: string; // recipient address
  facilitator?: string; // optional facilitator/payee agent
  memo?: string;
  raw?: Record<string, unknown>; // untrusted external payload - validate before use
}

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

/**
 * Validate a parsed spec before it is handed to a signer. Returns null when
 * the spec is unsafe to act on (missing/invalid payee or non-positive amount).
 * LANARK settles in cUSD, so callers must not default to another token.
 */
export function isPaymentSpecSignable(spec: X402PaymentSpec): boolean {
  if (!EVM_ADDRESS_RE.test(spec.payee)) return false
  const n = Number(spec.amount)
  return Number.isFinite(n) && n > 0
}

/**
 * Perform a fetch and detect a 402 payment challenge. If the server
 * returns 402, parse a payment spec (flexible parsing) and return it.
 * Otherwise return the original Response.
 *
 * Example usage:
 * const resOrSpec = await fetchWithX402(url, init)
 * if ('x402' in resOrSpec) { handle payment }
 */
export async function fetchWithX402(input: RequestInfo, init?: RequestInit): Promise<Response | { x402: X402PaymentSpec }> {
  const res = await fetch(input, init)
  if (res.status !== 402) return res

  let body: any = null
  try {
    body = await res.json()
  } catch (e) {
    // not JSON or empty body
    body = null
  }

  // Flexible mapping: many providers embed the spec under payment, payment_spec, or return it as root
  const spec = (body && (body.payment_spec ?? body.payment ?? body)) || {}

  const ps: X402PaymentSpec = {
    amount: String(spec.amount ?? spec.value ?? spec.price ?? '0'),
    currency: spec.currency ?? spec.token ?? 'cUSD',
    payee: spec.payee ?? spec.payee_address ?? spec.merchant ?? '',
    facilitator: spec.facilitator ?? spec.facilitator_address,
    memo: spec.memo ?? spec.note,
    raw: spec,
  }

  return { x402: ps }
}

/**
 * Normalize an arbitrary payment spec object into X402PaymentSpec.
 * Useful when you receive the spec from other places (e.g., webhook).
 */
export function normalizePaymentSpec(spec: any): X402PaymentSpec {
  return {
    amount: String(spec?.amount ?? spec?.value ?? '0'),
    currency: spec?.currency ?? spec?.token ?? 'cUSD',
    payee: spec?.payee ?? spec?.payee_address ?? spec?.merchant ?? '',
    facilitator: spec?.facilitator ?? spec?.facilitator_address,
    memo: spec?.memo ?? spec?.note,
    raw: spec,
  }
}
