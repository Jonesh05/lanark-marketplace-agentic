import { celo } from "viem/chains"
import { defineChain } from "viem"
import { createPublicClient, http, formatUnits, parseUnits, getAddress } from "viem"

/**
 * Settlement chain. cUSD is the settlement asset (18 decimals). The active
 * chain and settlement-token address are parameterized by environment so the
 * same code runs against Celo mainnet and Celo Sepolia testnet (Alfajores is
 * deprecated; Celo Sepolia is the current official testnet, chainId 11142220).
 * Reads use a public client so no private key is needed on the server.
 */
export const CELO_CHAIN = celo
export const CELO_CHAIN_ID = celo.id // 42220

// Celo Sepolia testnet (OP-stack). Official testnet replacing Alfajores.
export const CELO_SEPOLIA_CHAIN_ID = 11142220
export const celoSepolia = defineChain({
  id: CELO_SEPOLIA_CHAIN_ID,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://celo-sepolia.blockscout.com" },
  },
  testnet: true,
})

// Canonical cUSD on Celo mainnet (fallback / mainnet default).
export const CUSD_ADDRESS =
  "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const

export const CUSD_DECIMALS = 18

/**
 * User-facing settlement-token symbol. The on-chain asset is Mento's dollar
 * stablecoin; the product displays it as "USDm". Centralized so the label is
 * changed in exactly one place and never drifts across surfaces.
 */
export const SETTLEMENT_SYMBOL = "USDm"

/**
 * Active settlement-token address, parameterized by env. On testnet this is
 * the deployed test asset (USDm / Mento Dollar, or a MockERC20 deployed for
 * testnet) supplied via LANARK_SETTLEMENT_TOKEN. Falls back to mainnet cUSD.
 */
export function settlementToken(): `0x${string}` {
  const raw = process.env.LANARK_SETTLEMENT_TOKEN
  return raw ? getAddress(raw) : CUSD_ADDRESS
}

/** Active settlement chain id, parameterized by env (defaults to mainnet). */
export function settlementChainId(): number {
  const raw = process.env.LANARK_CHAIN_ID
  return raw ? Number(raw) : CELO_CHAIN_ID
}

function activeChain() {
  return settlementChainId() === CELO_SEPOLIA_CHAIN_ID ? celoSepolia : celo
}

/** Base block-explorer URL for the active settlement chain. */
export function explorerBaseUrl(): string {
  return settlementChainId() === CELO_SEPOLIA_CHAIN_ID
    ? "https://celo-sepolia.blockscout.com"
    : "https://celoscan.io"
}

/** Explorer link for a settlement transaction hash. */
export function explorerTxUrl(txHash: string): string {
  return `${explorerBaseUrl()}/tx/${txHash}`
}

/** Explorer link for an address. */
export function explorerAddressUrl(address: string): string {
  return `${explorerBaseUrl()}/address/${address}`
}

function activeRpcUrl(): string {
  return (
    process.env.CELO_RPC_URL ||
    (settlementChainId() === CELO_SEPOLIA_CHAIN_ID
      ? "https://forno.celo-sepolia.celo-testnet.org"
      : "https://forno.celo.org")
  )
}

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
    chain: activeChain(),
    transport: http(activeRpcUrl()),
  })
}

// cUSD is the functional base unit of the domain. All amounts are stored and
// passed as on-chain wei (18 decimals). Never reintroduce "micros" as a
// functional base — only format at the display boundary.
export function cusdToWei(amount: number | string): bigint {
  const s = typeof amount === "number" ? amount.toFixed(18) : amount
  return parseUnits(s, CUSD_DECIMALS)
}

export function cusdWeiToHuman(wei: bigint | string | number | null | undefined): string {
  // Defensive at the display boundary: a missing/legacy amount must never crash
  // a server component render. Unparseable input formats as 0.00.
  if (wei === null || wei === undefined || wei === "") return "0.00"
  try {
    const v = typeof wei === "bigint" ? wei : BigInt(typeof wei === "number" ? Math.trunc(wei) : wei)
    return Number(formatUnits(v, CUSD_DECIMALS)).toFixed(2)
  } catch {
    return "0.00"
  }
}

/**
 * Bridge for legacy rows still stored as 6-decimal "micros".
 * Used only by the wei backfill migration path; do not use for new writes.
 */
export const MICRO_TO_WEI = BigInt("1000000000000") // 10^12
export function microToWei(micro: bigint | number): bigint {
  const v = typeof micro === "number" ? BigInt(Math.round(micro)) : micro
  return v * MICRO_TO_WEI
}
