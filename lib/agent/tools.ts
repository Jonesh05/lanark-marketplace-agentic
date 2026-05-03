import { tool } from "ai"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { erc20Abi } from "viem"
import { CUSD_ADDRESS, publicClient, cusdWeiToHuman } from "@/lib/celo"

/**
 * Tools are factories so they're independently testable: pass in a Supabase
 * client and the current user id; no global state. This satisfies the
 * "dependency-inject clients" hard constraint.
 */
export interface AgentDeps {
  supabase: SupabaseClient
  userId: string
  role: "client" | "shopkeeper"
}

export function buildTools(deps: AgentDeps) {
  return {
    searchProducts: tool({
      description:
        "Search the marketplace for active product listings. Use when the user is browsing or asking about availability.",
      inputSchema: z.object({
        query: z
          .string()
          .nullable()
          .describe(
            "Free text. Match against title and description. Use null for no filter.",
          ),
        maxPriceCop: z
          .number()
          .nullable()
          .describe("Optional COP price ceiling in whole pesos."),
        limit: z.number().int().min(1).max(20).default(8),
      }),
      execute: async ({ query, maxPriceCop, limit }) => {
        let q = deps.supabase
          .from("products")
          .select(
            "id,title,description,price_cents,currency,stock,image_url,settle_token",
          )
          .eq("active", true)
          .gt("stock", 0)
          .order("created_at", { ascending: false })
          .limit(limit)
        if (query && query.trim().length > 0) {
          const t = query.replace(/[%,]/g, " ").trim()
          q = q.or(`title.ilike.%${t}%,description.ilike.%${t}%`)
        }
        if (typeof maxPriceCop === "number") {
          q = q.lte("price_cents", Math.round(maxPriceCop * 100))
        }
        const { data, error } = await q
        if (error) return { error: error.message, items: [] }
        return { items: data ?? [] }
      },
    }),

    getMyOrders: tool({
      description:
        "Get the signed-in user's orders (purchases as client, or sales as shopkeeper).",
      inputSchema: z.object({
        status: z
          .enum(["pending", "submitted", "confirmed", "failed", "any"])
          .default("any"),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ status, limit }) => {
        const col = deps.role === "shopkeeper" ? "shopkeeper_id" : "client_id"
        let q = deps.supabase
          .from("orders")
          .select(
            "id,product_id,qty,amount_cusd_micro,tx_hash,status,created_at,products(title)",
          )
          .eq(col, deps.userId)
          .order("created_at", { ascending: false })
          .limit(limit)
        if (status !== "any") q = q.eq("status", status)
        const { data, error } = await q
        if (error) return { error: error.message, items: [] }
        return { items: data ?? [] }
      },
    }),

    getMyOffers: tool({
      description:
        "Get the signed-in user's offers. As a client these are bids you've made. As a shopkeeper these are bids on your products.",
      inputSchema: z.object({
        status: z
          .enum(["pending", "accepted", "rejected", "expired", "settled", "any"])
          .default("any"),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ status, limit }) => {
        let query = deps.supabase
          .from("offers")
          .select(
            "id,product_id,qty,amount_cusd_micro,status,created_at,products!inner(title,shopkeeper_id)",
          )
          .order("created_at", { ascending: false })
          .limit(limit)
        if (deps.role === "shopkeeper") {
          query = query.eq("products.shopkeeper_id", deps.userId)
        } else {
          query = query.eq("client_id", deps.userId)
        }
        if (status !== "any") query = query.eq("status", status)
        const { data, error } = await query
        if (error) return { error: error.message, items: [] }
        return { items: data ?? [] }
      },
    }),

    placeOffer: tool({
      description:
        "Place an offer on a marketplace listing on behalf of the signed-in client. Only available for clients. Returns the offer id and pending status. The shopkeeper still has to accept; settlement happens after that.",
      inputSchema: z.object({
        productId: z.string().uuid(),
        qty: z.number().int().min(1).max(100),
        amountCusd: z
          .number()
          .positive()
          .describe(
            "Offer amount in cUSD (human units, e.g. 25.50 means 25.50 cUSD).",
          ),
      }),
      execute: async ({ productId, qty, amountCusd }) => {
        if (deps.role !== "client") {
          return { error: "Only clients can place offers." }
        }
        const { data: prod } = await deps.supabase
          .from("products")
          .select("id,title,stock,active")
          .eq("id", productId)
          .single()
        if (!prod || !prod.active) return { error: "Product not available." }
        if (prod.stock < qty) return { error: "Not enough stock." }

        const amount_cusd_micro = Math.round(amountCusd * 1_000_000)
        const { data, error } = await deps.supabase
          .from("offers")
          .insert({
            product_id: productId,
            client_id: deps.userId,
            qty,
            amount_cusd_micro,
            status: "pending",
          })
          .select("id,status")
          .single()
        if (error) return { error: error.message }
        return {
          ok: true,
          offerId: data.id,
          status: data.status,
          summary: `Offered ${amountCusd} cUSD for ${qty} × ${prod.title}.`,
        }
      },
    }),

    decideOffer: tool({
      description:
        "Accept or reject an open offer. Only the shopkeeper of the underlying product can call this.",
      inputSchema: z.object({
        offerId: z.string().uuid(),
        decision: z.enum(["accepted", "rejected"]),
      }),
      execute: async ({ offerId, decision }) => {
        if (deps.role !== "shopkeeper") {
          return { error: "Only shopkeepers can decide offers." }
        }
        const { data: o } = await deps.supabase
          .from("offers")
          .select("id, products!inner(shopkeeper_id)")
          .eq("id", offerId)
          .single()
        if (!o || (o as any).products.shopkeeper_id !== deps.userId) {
          return { error: "Offer not found or not yours." }
        }
        const { error } = await deps.supabase
          .from("offers")
          .update({ status: decision, decided_at: new Date().toISOString() })
          .eq("id", offerId)
        if (error) return { error: error.message }
        return { ok: true, offerId, status: decision }
      },
    }),

    // ───── on-chain reads ─────
    getCusdBalance: tool({
      description:
        "Read the cUSD balance of any address on Celo mainnet. If no address is given, uses the user's primary smart-account address.",
      inputSchema: z.object({
        address: z
          .string()
          .nullable()
          .describe("EVM address. Pass null to use the user's primary address."),
      }),
      execute: async ({ address }) => {
        let target = address as `0x${string}` | null
        if (!target) {
          const { data: profile } = await deps.supabase
            .from("profiles")
            .select("primary_address")
            .eq("id", deps.userId)
            .single()
          target = (profile?.primary_address ?? null) as `0x${string}` | null
        }
        if (!target) {
          return { error: "No wallet address on file." }
        }
        try {
          const client = publicClient()
          const wei = await client.readContract({
            address: CUSD_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [target],
          })
          return {
            address: target,
            balance: cusdWeiToHuman(wei),
            token: "cUSD",
            chain: "Celo",
          }
        } catch (err: any) {
          return { error: err?.shortMessage ?? err?.message ?? "RPC error" }
        }
      },
    }),
  } as const
}

export type AgentTools = ReturnType<typeof buildTools>
