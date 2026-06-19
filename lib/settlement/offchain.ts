import { erc20Abi } from "viem"
import { settlementToken, settlementChainId, publicClient } from "@/lib/celo"
import type {
  SettlementProvider,
  SettlementQuote,
  FundsCheck,
  SettlementReceipt,
} from "./types"

/**
 * Off-chain settlement provider.
 *
 * Honest by construction:
 *  - `checkFunds` performs a real ERC-20 balanceOf against cUSD on Celo.
 *  - `initiate` records intent and returns `awaiting_settlement`. It does NOT
 *    broadcast a transaction and never returns `confirmed`. No fake tx hash.
 *
 * This is the active provider until an escrow factory address is configured,
 * at which point `lib/settlement/index.ts` switches to the on-chain adapter.
 */
export const offchainSettlement: SettlementProvider = {
  async quote(amountWei: bigint): Promise<SettlementQuote> {
    return {
      amountWei,
      feesWei: BigInt(0),
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      currency: "cUSD",
      chainId: settlementChainId(),
    }
  },

  async checkFunds(
    address: `0x${string}`,
    requiredWei: bigint,
  ): Promise<FundsCheck> {
    const client = publicClient()
    const balanceWei = (await client.readContract({
      address: settlementToken(),
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    })) as bigint
    return {
      sufficient: balanceWei >= requiredWei,
      balanceWei,
      requiredWei,
    }
  },

  async initiate(input: {
    orderId: string
    buyerAddress: `0x${string}`
    amountWei: bigint
  }): Promise<SettlementReceipt> {
    // No escrow contract deployed. The order is parked as payment-pending.
    return {
      status: "awaiting_settlement",
      ref: input.orderId,
    }
  },
}
