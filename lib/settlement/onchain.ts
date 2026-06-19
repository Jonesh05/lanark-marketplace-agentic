import { erc20Abi, getAddress } from "viem"
import { settlementToken, settlementChainId, publicClient } from "@/lib/celo"
import type {
  SettlementProvider,
  SettlementQuote,
  FundsCheck,
  SettlementReceipt,
} from "./types"

// Minimal ABI surface the frontend reads. The factory deploys per-order
// EIP-1167 clones and exposes the predicted/created escrow address. Funding,
// release and dispute are driven by the buyer's wallet / settlement worker;
// the server only reads and records, it does not custody funds.
export const ESCROW_FACTORY_ABI = [
  {
    type: "function",
    name: "computeEscrowAddress",
    stateMutability: "view",
    inputs: [
      { name: "buyer", type: "address" },
      { name: "seller", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "orderRef", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "escrowOf",
    stateMutability: "view",
    inputs: [{ name: "orderRef", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const

const PROTOCOL_FEE_BPS = BigInt(process.env.LANARK_FEE_BPS ?? "100") // 1% default

function factoryAddress(): `0x${string}` {
  const raw = process.env.LANARK_ESCROW_FACTORY
  if (!raw) {
    // No mock. If the contract isn't configured, the on-chain provider must
    // not pretend. The selector in index.ts falls back to the off-chain stub.
    throw new Error("LANARK_ESCROW_FACTORY is not configured")
  }
  return getAddress(raw)
}

/**
 * On-chain settlement provider backed by the EIP-1167 escrow factory.
 * Active only when LANARK_ESCROW_FACTORY is set. Reads are real; it never
 * fabricates a confirmation.
 */
export const onchainSettlement: SettlementProvider = {
  async quote(amountWei: bigint): Promise<SettlementQuote> {
    const feesWei = (amountWei * PROTOCOL_FEE_BPS) / BigInt(10000)
    return {
      amountWei,
      feesWei,
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
    return { sufficient: balanceWei >= requiredWei, balanceWei, requiredWei }
  },

  async initiate(input: {
    orderId: string
    buyerAddress: `0x${string}`
    amountWei: bigint
  }): Promise<SettlementReceipt> {
    // Reads the (already-deployed or counterfactual) escrow address for this
    // order. Actual funding happens from the buyer's wallet on the client and
    // is reconciled by the settlement worker via on-chain events. Until a
    // deposit event is observed, the order is awaiting_settlement — honest.
    const factory = factoryAddress()
    const client = publicClient()
    const escrow = (await client.readContract({
      address: factory,
      abi: ESCROW_FACTORY_ABI,
      functionName: "escrowOf",
      args: [orderRefToBytes32(input.orderId)],
    })) as `0x${string}`

    return {
      status: "awaiting_settlement",
      ref: escrow && !/^0x0+$/.test(escrow) ? escrow : input.orderId,
    }
  },
}

// Order id (uuid) -> bytes32 ref. Deterministic, no PII on-chain.
function orderRefToBytes32(orderId: string): `0x${string}` {
  const hex = orderId.replace(/-/g, "")
  return `0x${hex.padEnd(64, "0").slice(0, 64)}`
}

export const isOnchainConfigured = () =>
  Boolean(process.env.LANARK_ESCROW_FACTORY)
