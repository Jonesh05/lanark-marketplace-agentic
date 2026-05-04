/**
 * Format an integer-cents amount as a localized currency string.
 * Listings are stored as `price_cents` in their native currency (USD for
 * the DummyJSON catalog, COP for native shops). Settlement happens in
 * cUSD on-chain.
 */
export function formatPrice(cents: number, currency = "USD"): string {
  const value = (cents ?? 0) / 100
  const locale = currency === "COP" ? "es-CO" : "en-US"
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "COP" ? 0 : 2,
    }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

export function shortAddress(addr: string | null | undefined): string {
  if (!addr) return ""
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** Backwards-compat alias - existing callers passed COP-priced rows. */
export function formatCop(cents: number, currency = "USD"): string {
  return formatPrice(cents, currency)
}

/** cUSD has 6 decimals on-chain. */
export function formatCusdMicro(micro: number | bigint): string {
  const n = typeof micro === "bigint" ? Number(micro) : micro
  return ((n ?? 0) / 1_000_000).toFixed(2)
}
