import { celo } from "viem/chains"
import { createPublicClient, http, formatUnits, parseUnits } from "viem"

/**
 * Celo mainnet — settlement chain. Reads use a public client so we never
 * need a private key on the server. Writes are produced as user operations
 * the client signs (or sponsored via paymaster).
 */
export const CELO_CHAIN = celo
export const CELO_CHAIN_ID = celo.id // 42220

// Canonical cUSD on Celo mainnet
export const CUSD_ADDRESS =
  "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const

export const CUSD_DECIMALS = 18

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

export function publicClient() {
  return createPublicClient({
    chain: celo,
    transport: http(process.env.CELO_RPC_URL || "https://forno.celo.org"),
  })
}

export function cusdToMicro(amount: number): bigint {
  // cUSD has 18 decimals, but we store offers as "6-decimal micros" in DB
  // for compact integer math. This converts a human float to cUSD wei.
  return parseUnits(amount.toFixed(6), CUSD_DECIMALS)
}

export function microToCusd(micro: bigint | number): string {
  const v = typeof micro === "number" ? BigInt(micro) : micro
  // micros are 6-decimal fixed point — display nicely
  const whole = Number(v) / 1_000_000
  return whole.toFixed(2)
}

export function cusdWeiToHuman(wei: bigint): string {
  return Number(formatUnits(wei, CUSD_DECIMALS)).toFixed(2)
}
