// Single source of truth for listing price math.
//
// Storage convention: `products.price_cents` holds MAJOR units × 100 in the
// listing's native currency (e.g. 1_200_000 = 12,000.00 COP, 999 = $9.99 USD).
// cUSD is a USD stablecoin (1 USD ≈ 1 cUSD); COP is converted by COP_PER_USD.
//
// These helpers exist because the agent once returned raw `price_cents` to the
// model, which read 1_200_000 as "1,200,000 COP" — a 100x error. Always derive
// human/cUSD amounts here instead of formatting cents ad hoc.

import { cusdToWei } from "./celo"

export const COP_PER_USD = 4000

/** Major-unit amount in the listing currency (price_cents / 100). */
export function priceMajor(priceCents: number): number {
  return (Number(priceCents) || 0) / 100
}

/**
 * cUSD value of a listing. Prefers an explicit `price_cusd`; otherwise derives
 * it from the native price (USD ≈ 1:1, COP ÷ COP_PER_USD).
 */
export function productCusd(
  priceCents: number,
  currency: string,
  priceCusd?: number | string | null,
): number {
  if (priceCusd !== null && priceCusd !== undefined && priceCusd !== "") {
    const n = Number(priceCusd)
    if (Number.isFinite(n) && n > 0) return n
  }
  const major = priceMajor(priceCents)
  const rate = currency === "COP" ? COP_PER_USD : 1
  return major / rate
}

/** Display-ready label, e.g. "12,000 COP (~3.00 cUSD)". */
export function priceLabel(
  priceCents: number,
  currency: string,
  priceCusd?: number | string | null,
): string {
  const major = priceMajor(priceCents)
  const cusd = productCusd(priceCents, currency, priceCusd)
  const majorStr = major.toLocaleString("es-CO", { maximumFractionDigits: 2 })
  return `${majorStr} ${currency} (~${cusd.toFixed(2)} cUSD)`
}

/**
 * Canonical cUSD wei for a product line. Prefers explicit `price_cusd` (full
 * decimal string, up to 18 places) and falls back to cents/currency conversion.
 * Never returns 0 for a product with a positive configured price.
 */
export function productUnitPriceWei(
  priceCents: number,
  currency: string,
  priceCusd?: number | string | null,
): bigint {
  if (priceCusd !== null && priceCusd !== undefined && String(priceCusd).trim() !== "") {
    const raw = String(priceCusd).trim()
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) {
      return cusdToWei(raw)
    }
  }
  const human = productCusd(priceCents, currency, null)
  if (!Number.isFinite(human) || human <= 0) return BigInt(0)
  return cusdToWei(human)
}

export function productUnitPriceWeiStr(
  priceCents: number,
  currency: string,
  priceCusd?: number | string | null,
): string {
  return productUnitPriceWei(priceCents, currency, priceCusd).toString()
}
