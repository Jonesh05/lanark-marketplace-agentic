import type { SettlementProvider } from "./types"
import { offchainSettlement } from "./offchain"
import { onchainSettlement, isOnchainConfigured } from "./onchain"

export * from "./types"
export { offchainSettlement } from "./offchain"
export { onchainSettlement, isOnchainConfigured } from "./onchain"

/**
 * Active settlement provider.
 *
 * On-chain when an escrow factory is configured (LANARK_ESCROW_FACTORY),
 * otherwise the honest off-chain stub. There is no mock that fakes a paid
 * order: the off-chain provider parks orders as `awaiting_settlement`, and the
 * on-chain provider only reports settlement once it is observable on-chain.
 */
export const settlement: SettlementProvider = isOnchainConfigured()
  ? onchainSettlement
  : offchainSettlement
