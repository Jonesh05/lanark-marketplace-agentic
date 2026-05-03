/**
 * Format an integer cents amount as a localized currency string.
 * Listings are stored in COP cents off-chain even though settlement is
 * in cUSD on-chain.
 */
export function formatPrice(cents: number, currency = "COP"): string {
  const value = (cents ?? 0) / 100
  try {
    return new Intl.NumberFormat("es-CO", {
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
