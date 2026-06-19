// Settlement provider contract for LANARK.
//
// The functional money unit across the domain is on-chain cUSD wei (18
// decimals). The provider quotes, gates funds, and initiates settlement in
// wei. No escrow contract is deployed yet, so the default provider is an
// OFF-CHAIN stub that reads real balances but never reports a fake payment.

export type SettlementStatus =
  | "awaiting_settlement" // recorded off-chain, no on-chain action yet
  | "submitted" // tx broadcast, not confirmed
  | "confirmed" // tx finalized on-chain
  | "failed"

export interface SettlementQuote {
  amountWei: bigint
  feesWei: bigint
  expiresAt: number // unix seconds; quote is stale afterwards
  currency: "cUSD"
  chainId: number
}

export interface FundsCheck {
  sufficient: boolean
  balanceWei: bigint
  requiredWei: bigint
}

export interface SettlementReceipt {
  status: SettlementStatus
  ref: string // order id, or tx hash once available
  txHash?: `0x${string}`
  confirmedAt?: number
}

export interface SettlementProvider {
  /** Exact wei required for an order, plus protocol fee. */
  quote(amountWei: bigint): Promise<SettlementQuote>
  /** On-chain balanceOf gate. Never trust a client-supplied balance. */
  checkFunds(address: `0x${string}`, requiredWei: bigint): Promise<FundsCheck>
  /** Record/begin settlement. Off-chain stub returns awaiting_settlement. */
  initiate(input: {
    orderId: string
    buyerAddress: `0x${string}`
    amountWei: bigint
  }): Promise<SettlementReceipt>
}
