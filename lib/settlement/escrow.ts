/**
 * Escrow ABIs + server-side settlement worker.
 *
 * The factory's `createEscrow` and the escrow `release` are owner/arbiter-gated,
 * so they run from the settlement worker key on the SERVER (never the client).
 * The buyer's `deposit` runs from the buyer's own wallet on the client. This
 * file is server-only: it reads LANARK_WORKER_PRIVATE_KEY and must never be
 * imported into a client component.
 */
import "server-only"
import {
  createWalletClient,
  http,
  getAddress,
  parseEventLogs,
  type Hex,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { celo } from "viem/chains"
import {
  celoSepolia,
  CELO_SEPOLIA_CHAIN_ID,
  settlementChainId,
  publicClient,
} from "@/lib/celo"
import {
  ESCROW_ABI,
  ESCROW_FACTORY_ABI as ESCROW_FACTORY_ABI_BASE,
  orderRefToBytes32,
} from "./abi"

export { ESCROW_ABI, orderRefToBytes32 }

// Extend the client-safe factory ABI with the EscrowCreated event so the worker
// can parse the deployed clone address from the tx receipt.
export const ESCROW_FACTORY_ABI = [
  ...ESCROW_FACTORY_ABI_BASE,
  {
    type: "event",
    name: "EscrowCreated",
    inputs: [
      { name: "orderRef", type: "bytes32", indexed: true },
      { name: "escrow", type: "address", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "seller", type: "address", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "deadline", type: "uint256", indexed: false },
    ],
  },
] as const

function activeChain() {
  return settlementChainId() === CELO_SEPOLIA_CHAIN_ID ? celoSepolia : celo
}

export function escrowFactoryAddress(): `0x${string}` | null {
  const raw = process.env.LANARK_ESCROW_FACTORY
  return raw ? getAddress(raw) : null
}

export const isWorkerConfigured = () =>
  Boolean(process.env.LANARK_WORKER_PRIVATE_KEY && process.env.LANARK_ESCROW_FACTORY)

function workerClient() {
  const pk = process.env.LANARK_WORKER_PRIVATE_KEY
  if (!pk) throw new Error("LANARK_WORKER_PRIVATE_KEY is not configured")
  const account = privateKeyToAccount(
    (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex,
  )
  return createWalletClient({
    account,
    chain: activeChain(),
    transport: http(process.env.CELO_RPC_URL),
  })
}

/**
 * Settlement worker: create (or fetch) the escrow clone for an order.
 * Returns the escrow address. Idempotent — if the clone already exists for this
 * orderRef the factory reverts with EscrowExists, so we read it back instead.
 */
export async function createEscrowForOrder(input: {
  orderId: string
  buyer: `0x${string}`
  seller: `0x${string}`
  amountWei: bigint
  deadlineSeconds?: number
}): Promise<{ escrow: `0x${string}`; txHash: `0x${string}` | null }> {
  const factory = escrowFactoryAddress()
  if (!factory) throw new Error("LANARK_ESCROW_FACTORY is not configured")
  const pub = publicClient()
  const orderRef = orderRefToBytes32(input.orderId)

  // Already created? Return it (idempotent across retries).
  const existing = (await pub.readContract({
    address: factory,
    abi: ESCROW_FACTORY_ABI,
    functionName: "escrowOf",
    args: [orderRef],
  })) as `0x${string}`
  if (existing && !/^0x0+$/.test(existing)) {
    return { escrow: getAddress(existing), txHash: null }
  }

  const deadline = BigInt(
    Math.floor(Date.now() / 1000) + (input.deadlineSeconds ?? 60 * 60 * 24 * 14),
  )
  const wallet = workerClient()
  const txHash = await wallet.writeContract({
    address: factory,
    abi: ESCROW_FACTORY_ABI,
    functionName: "createEscrow",
    args: [input.buyer, input.seller, input.amountWei, deadline, orderRef],
  })
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash })

  // Prefer the address from the EscrowCreated event; fall back to escrowOf.
  let escrow: `0x${string}` | null = null
  try {
    const logs = parseEventLogs({
      abi: ESCROW_FACTORY_ABI,
      eventName: "EscrowCreated",
      logs: receipt.logs,
    })
    const ev = logs.find((l) => l.args.orderRef === orderRef)
    if (ev) escrow = getAddress(ev.args.escrow as `0x${string}`)
  } catch {
    /* fall through to escrowOf */
  }
  if (!escrow) {
    const addr = (await pub.readContract({
      address: factory,
      abi: ESCROW_FACTORY_ABI,
      functionName: "escrowOf",
      args: [orderRef],
    })) as `0x${string}`
    escrow = getAddress(addr)
  }
  return { escrow, txHash }
}

/**
 * Settlement worker: release a funded escrow to the seller (worker is the
 * arbiter, so `release()` is authorized). Returns the release tx hash.
 */
export async function releaseEscrow(
  orderId: string,
): Promise<{ txHash: `0x${string}`; escrow: `0x${string}` }> {
  const factory = escrowFactoryAddress()
  if (!factory) throw new Error("LANARK_ESCROW_FACTORY is not configured")
  const pub = publicClient()
  const orderRef = orderRefToBytes32(orderId)
  const escrow = (await pub.readContract({
    address: factory,
    abi: ESCROW_FACTORY_ABI,
    functionName: "escrowOf",
    args: [orderRef],
  })) as `0x${string}`
  if (!escrow || /^0x0+$/.test(escrow)) {
    throw new Error("No escrow exists for this order")
  }
  const wallet = workerClient()
  const txHash = await wallet.writeContract({
    address: getAddress(escrow),
    abi: ESCROW_ABI,
    functionName: "release",
    args: [],
  })
  await pub.waitForTransactionReceipt({ hash: txHash })
  return { txHash, escrow: getAddress(escrow) }
}

/** Read the on-chain escrow State enum (0 Created,1 Funded,2 Released,...). */
export async function readEscrowState(
  escrow: `0x${string}`,
): Promise<number | null> {
  try {
    const s = (await publicClient().readContract({
      address: getAddress(escrow),
      abi: ESCROW_ABI,
      functionName: "state",
    })) as number
    return Number(s)
  } catch {
    return null
  }
}
