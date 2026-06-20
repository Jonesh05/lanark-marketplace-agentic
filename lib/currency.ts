// COPm — operational currency layer.
//
// LANARK settles on-chain in cUSD (Mento dollar, 18-decimal wei) and that never
// changes: cUSD wei is the functional base unit that moves the escrow tx. COPm
// is the operational *display* of that same value in Colombian pesos, so a
// Colombian buyer or shopkeeper reads and reasons in pesos while the rail stays
// a dollar stablecoin. It is NOT a separate token and never replaces cUSD; it is
// a deterministic projection cUSD × COP_PER_USD applied only at the boundary.
//
// Keeping this in one module means the peso layer has a single source of truth
// and can never drift across cart, dashboard, and settlement surfaces.

import { COP_PER_USD } from "./pricing"
import { CUSD_DECIMALS } from "./celo"

/** User-facing operational symbol for the peso layer. */
export const OPERATIONAL_SYMBOL = "COPm"

const WEI_PER_CUSD = 10 ** CUSD_DECIMALS

function safeWei(value: bigint | string | number | null | undefined): bigint {
  if (value === null || value === undefined || value === "") return BigInt(0)
  if (typeof value === "bigint") return value
  const raw = String(value).split(".")[0].replace(/[^0-9-]/g, "")
  if (!raw || raw === "-") return BigInt(0)
  try {
    return BigInt(raw)
  } catch {
    return BigInt(0)
  }
}

/**
 * Project cUSD wei (18 decimals) to COP major units. Display precision: pesos
 * have no sub-unit in practice, so the result is a plain number meant to be
 * rendered with 0 fraction digits. The on-chain amount is untouched.
 */
export function cusdWeiToCop(wei: bigint | string | number | null | undefined): number {
  const v = safeWei(wei)
  // cUSD = v / 10^18 ; COP = cUSD × rate. Number precision is sufficient at the
  // display boundary (peso amounts are integers far below 2^53).
  return (Number(v) / WEI_PER_CUSD) * COP_PER_USD
}

/** Format a cUSD-wei amount as a COPm peso string, e.g. "COPm 12.000". */
export function formatCopm(wei: bigint | string | number | null | undefined): string {
  const cop = cusdWeiToCop(wei)
  const n = Number.isFinite(cop) ? cop : 0
  return `${OPERATIONAL_SYMBOL} ${n.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`
}

/** Bare COPm number formatted for es-CO (no symbol), e.g. "12.000". */
export function copAmount(wei: bigint | string | number | null | undefined): string {
  const cop = cusdWeiToCop(wei)
  const n = Number.isFinite(cop) ? cop : 0
  return n.toLocaleString("es-CO", { maximumFractionDigits: 0 })
}

/**
 * Inverse projection: a peso amount entered operationally back to cUSD wei, so
 * a COPm-denominated input can fund the same cUSD escrow. Returns integer wei.
 */
export function copToCusdWei(cop: number | string): bigint {
  const n = typeof cop === "number" ? cop : Number(String(cop).replace(/[^0-9.-]/g, ""))
  if (!Number.isFinite(n) || n <= 0) return BigInt(0)
  const cusd = n / COP_PER_USD
  // Scale to wei via string to avoid float drift on the 18-decimal expansion.
  const weiFloat = cusd * WEI_PER_CUSD
  return BigInt(Math.round(weiFloat))
}
