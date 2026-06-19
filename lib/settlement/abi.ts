/**
 * Client-safe escrow ABIs + on-chain config read from NEXT_PUBLIC_* env.
 * No secrets, no server-only imports — safe to use in client components for the
 * buyer deposit flow.
 */
import type { Hex } from "viem"

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
  {
    type: "function",
    name: "defaultToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "createEscrow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "buyer", type: "address" },
      { name: "seller", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "orderRef", type: "bytes32" },
    ],
    outputs: [{ name: "escrow", type: "address" }],
  },
] as const

export const ESCROW_ABI = [
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "release", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "state", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "amount", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "token", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
] as const

/** ERC-20 surface the deposit flow needs (approve/allowance/balanceOf + mint
 * for the testnet MockERC20 faucet). */
export const ERC20_FAUCET_ABI = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
] as const

/** Order id (uuid) -> bytes32 orderRef. MUST match the server worker. */
export function orderRefToBytes32(orderId: string): Hex {
  const hex = orderId.replace(/-/g, "")
  return `0x${hex.padEnd(64, "0").slice(0, 64)}` as Hex
}

export const PUBLIC_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_LANARK_CHAIN_ID ?? "11142220",
)

export const PUBLIC_RPC_URL =
  process.env.NEXT_PUBLIC_CELO_RPC_URL ??
  "https://forno.celo-sepolia.celo-testnet.org"

export function publicFactoryAddress(): `0x${string}` | null {
  const raw = process.env.NEXT_PUBLIC_LANARK_ESCROW_FACTORY
  return raw ? (raw as `0x${string}`) : null
}

export function publicSettlementToken(): `0x${string}` | null {
  const raw = process.env.NEXT_PUBLIC_LANARK_SETTLEMENT_TOKEN
  return raw ? (raw as `0x${string}`) : null
}
