/**
 * DummyJSON ingestion disabled.
 *
 * The DummyJSON sync has been deprecated. This function is a no-op kept
 * for backward compatibility so imports do not fail.
 */

export async function syncDummyJsonCatalog(): Promise<{
  ingested: number
  pages: number
  total: number
}> {
  console.warn(
    "[lib/dummyjson] syncDummyJsonCatalog is disabled: DummyJSON ingestion deprecated.",
  )
  return { ingested: 0, pages: 0, total: 0 }
}
