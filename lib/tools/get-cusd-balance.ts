/**
 * getCusdBalance - Read on-chain cUSD balance
 * 
 * Real Celo Mainnet query. Returns actual balance or error.
 */

import { tool } from "ai"
import { z } from "zod"
import { formatUnits } from "viem"
import { publicClient, CUSD_ADDRESS } from "@/lib/celo"
import type { ToolContext } from "./types"

// ERC-20 balanceOf ABI fragment
const balanceOfAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const

export function getCusdBalance(ctx: ToolContext) {
  return tool({
    description: "Check cUSD balance on Celo Mainnet for a wallet address. Returns real on-chain balance.",
    parameters: z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address").optional()
        .describe("Wallet address. If omitted, uses user's linked wallet."),
    }),
    execute: async ({ address }) => {
      // Get address from user profile if not provided
      let walletAddress = address
      
      if (!walletAddress) {
        const { data: profile } = await ctx.supabase
          .from("profiles")
          .select("primary_address")
          .eq("id", ctx.userId)
          .single()
        
        if (!profile?.primary_address) {
          return { ok: false, error: "No wallet address linked to your account. Connect a wallet first." }
        }
        walletAddress = profile.primary_address
      }
      
      try {
        const client = publicClient()
        const balance = await client.readContract({
          address: CUSD_ADDRESS,
          abi: balanceOfAbi,
          functionName: "balanceOf",
          args: [walletAddress as `0x${string}`],
        })
        
        const formatted = formatUnits(balance, 18)
        const display = parseFloat(formatted).toFixed(2)
        
        return {
          ok: true,
          balance: {
            raw: balance.toString(),
            formatted: display,
            currency: "cUSD",
            address: walletAddress,
            chain: "Celo Mainnet (42220)",
          },
          message: `Balance: ${display} cUSD`,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to read balance"
        return { ok: false, error: `On-chain query failed: ${message}` }
      }
    },
  })
}
