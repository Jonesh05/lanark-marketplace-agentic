import { tool } from "ai"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { erc20Abi } from "viem"
import { CUSD_ADDRESS, publicClient, cusdWeiToHuman } from "@/lib/celo"

/**
 * The agent is a writer. Every tool call lands in `agent_actions` so the
 * dashboard, not the chat transcript, is the source of truth. The receipt
 * shape mirrors x402: { kind, resource, payload, receipt, status }.
 */
export interface AgentDeps {
  supabase: SupabaseClient
  userId: string
  role: "client" | "shopkeeper"
  threadId: string
}

type LogInput = {
  step: "decide" | "execute" | "confirm" | "error"
  kind: string
  resource?: string | null
  payload?: Record<string, unknown>
  receipt?: Record<string, unknown> | null
  status?: "ok" | "failed" | "pending"
  message?: string | null
}

function makeLogger(deps: AgentDeps) {
  return async function log(input: LogInput) {
    try {
      await deps.supabase.from("agent_actions").insert({
        user_id: deps.userId,
        thread_id: deps.threadId,
        step: input.step,
        kind: input.kind,
        resource: input.resource ?? null,
        payload: input.payload ?? {},
        receipt: input.receipt ?? null,
        status: input.status ?? "ok",
        message: input.message ?? null,
      })
    } catch {
      // Tracing must never break a tool call.
    }
  }
}

export function buildTools(deps: AgentDeps) {
  const log = makeLogger(deps)

  return {
    searchProducts: tool({
      description:
        "Search active marketplace listings. Supports free text, price ceiling (in the catalog currency, USD for DummyJSON imports), category, and brand filters. Returns the highest-rated matches first.",
      inputSchema: z.object({
        query: z.string().nullable(),
        maxPrice: z.number().nullable().describe("Max price in the catalog currency (USD for DummyJSON)."),
        category: z.string().nullable(),
        brand: z.string().nullable(),
        limit: z.number().int().min(1).max(20).default(8),
      }),
      execute: async ({ query, maxPrice, category, brand, limit }) => {
        await log({
          step: "decide",
          kind: "search_products",
          payload: { query, maxPrice, category, brand, limit },
        })
        let q = deps.supabase
          .from("products")
          .select(
            "id,title,description,price_cents,currency,stock,image_url,thumbnail_url,settle_token,source,category,brand,rating,discount_percentage,tags",
          )
          .eq("active", true)
          .gt("stock", 0)
          .order("rating", { ascending: false, nullsFirst: false })
          .limit(limit)
        if (query && query.trim().length > 0) {
          const t = query.replace(/[%,]/g, " ").trim()
          q = q.or(`title.ilike.%${t}%,description.ilike.%${t}%,tags.cs.{${t}}`)
        }
        if (typeof maxPrice === "number") {
          q = q.lte("price_cents", Math.round(maxPrice * 100))
        }
        if (category && category.trim().length > 0) {
          q = q.eq("category", category.trim().toLowerCase())
        }
        if (brand && brand.trim().length > 0) {
          q = q.ilike("brand", brand.trim())
        }
        const { data, error } = await q
        await log({
          step: "execute",
          kind: "search_products",
          payload: { query, maxPrice, category, brand, limit },
          receipt: { count: data?.length ?? 0 },
          status: error ? "failed" : "ok",
          message: error?.message,
        })
        if (error) return { error: error.message, items: [] }
        return { items: data ?? [] }
      },
    }),

    listCategories: tool({
      description:
        "List the distinct product categories currently in the catalog, ordered by listing count.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ limit }) => {
        const { data, error } = await deps.supabase
          .from("products")
          .select("category")
          .eq("active", true)
          .not("category", "is", null)
        await log({
          step: "execute",
          kind: "list_categories",
          payload: { limit },
          status: error ? "failed" : "ok",
          message: error?.message,
        })
        if (error) return { error: error.message, items: [] }
        const counts = new Map<string, number>()
        for (const row of data ?? []) {
          const c = (row as any).category as string | null
          if (!c) continue
          counts.set(c, (counts.get(c) ?? 0) + 1)
        }
        const items = Array.from(counts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit)
        return { items }
      },
    }),

    listMyInventory: tool({
      description:
        "List the shopkeeper's own product listings (active and inactive). Only available to shopkeepers.",
      inputSchema: z.object({
        activeOnly: z.boolean().default(true).describe("If true, only return active listings."),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ activeOnly, limit }) => {
        if (deps.role !== "shopkeeper") {
          await log({
            step: "error",
            kind: "list_my_inventory",
            status: "failed",
            message: "Role is not shopkeeper.",
          })
          return { error: "Only shopkeepers can list their inventory." }
        }
        let q = deps.supabase
          .from("products")
          .select("id,title,description,price_cents,currency,stock,active,category,brand,created_at")
          .eq("shopkeeper_id", deps.userId)
          .order("created_at", { ascending: false })
          .limit(limit)
        if (activeOnly) {
          q = q.eq("active", true)
        }
        const { data, error } = await q
        await log({
          step: "execute",
          kind: "list_my_inventory",
          payload: { activeOnly, limit },
          receipt: { count: data?.length ?? 0 },
          status: error ? "failed" : "ok",
          message: error?.message,
        })
        if (error) return { error: error.message, items: [] }
        return { items: data ?? [] }
      },
    }),

    getMyOrders: tool({
      description: "List the signed-in user's orders.",
      inputSchema: z.object({
        status: z.enum(["pending", "submitted", "confirmed", "failed", "any"]).default("any"),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ status, limit }) => {
        const col = deps.role === "shopkeeper" ? "shopkeeper_id" : "client_id"
        let q = deps.supabase
          .from("orders")
          .select("id,product_id,qty,amount_cusd_micro,tx_hash,status,created_at,products(title)")
          .eq(col, deps.userId)
          .order("created_at", { ascending: false })
          .limit(limit)
        if (status !== "any") q = q.eq("status", status)
        const { data, error } = await q
        await log({
          step: "execute",
          kind: "get_my_orders",
          payload: { status, limit },
          receipt: { count: data?.length ?? 0 },
          status: error ? "failed" : "ok",
          message: error?.message,
        })
        if (error) return { error: error.message, items: [] }
        return { items: data ?? [] }
      },
    }),

    getMyOffers: tool({
      description: "List offers visible to the signed-in user.",
      inputSchema: z.object({
        status: z.enum(["pending", "accepted", "rejected", "expired", "settled", "any"]).default("any"),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ status, limit }) => {
        let query = deps.supabase
          .from("offers")
          .select("id,product_id,qty,amount_cusd_micro,status,created_at,products!inner(title,shopkeeper_id)")
          .order("created_at", { ascending: false })
          .limit(limit)
        if (deps.role === "shopkeeper") {
          query = query.eq("products.shopkeeper_id", deps.userId)
        } else {
          query = query.eq("client_id", deps.userId)
        }
        if (status !== "any") query = query.eq("status", status)
        const { data, error } = await query
        await log({
          step: "execute",
          kind: "get_my_offers",
          payload: { status, limit },
          receipt: { count: data?.length ?? 0 },
          status: error ? "failed" : "ok",
          message: error?.message,
        })
        if (error) return { error: error.message, items: [] }
        return { items: data ?? [] }
      },
    }),

    placeOffer: tool({
      description:
        "Place an offer on a listing on behalf of the signed-in client. Pending until shopkeeper accepts.",
      inputSchema: z.object({
        productId: z.string().uuid(),
        qty: z.number().int().min(1).max(100),
        amountCusd: z.number().positive(),
      }),
      execute: async ({ productId, qty, amountCusd }) => {
        await log({
          step: "decide",
          kind: "place_offer",
          resource: `product:${productId}`,
          payload: { productId, qty, amountCusd },
        })
        if (deps.role !== "client") {
          await log({
            step: "error",
            kind: "place_offer",
            resource: `product:${productId}`,
            status: "failed",
            message: "Role is not client.",
          })
          return { error: "Only clients can place offers." }
        }
        const { data: prod } = await deps.supabase
          .from("products")
          .select("id,title,stock,active")
          .eq("id", productId)
          .single()
        if (!prod || !prod.active) {
          await log({
            step: "error",
            kind: "place_offer",
            resource: `product:${productId}`,
            status: "failed",
            message: "Product not available.",
          })
          return { error: "Product not available." }
        }
        if (prod.stock < qty) {
          await log({
            step: "error",
            kind: "place_offer",
            resource: `product:${productId}`,
            status: "failed",
            message: "Not enough stock.",
          })
          return { error: "Not enough stock." }
        }
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
        if (error) {
          await log({
            step: "error",
            kind: "place_offer",
            resource: `product:${productId}`,
            status: "failed",
            message: error.message,
          })
          return { error: error.message }
        }
        await log({
          step: "execute",
          kind: "place_offer",
          resource: `offer:${data.id}`,
          payload: { productId, qty, amountCusd },
          receipt: { offerId: data.id, status: data.status },
        })
        return {
          ok: true,
          offerId: data.id,
          status: data.status,
          summary: `Offered ${amountCusd} cUSD for ${qty} × ${prod.title}.`,
        }
      },
    }),

    decideOffer: tool({
      description: "Accept or reject an open offer on one of the shopkeeper's products.",
      inputSchema: z.object({
        offerId: z.string().uuid(),
        decision: z.enum(["accepted", "rejected"]),
      }),
      execute: async ({ offerId, decision }) => {
        await log({
          step: "decide",
          kind: "decide_offer",
          resource: `offer:${offerId}`,
          payload: { offerId, decision },
        })
        if (deps.role !== "shopkeeper") {
          await log({
            step: "error",
            kind: "decide_offer",
            resource: `offer:${offerId}`,
            status: "failed",
            message: "Role is not shopkeeper.",
          })
          return { error: "Only shopkeepers can decide offers." }
        }
        const { data: o } = await deps.supabase
          .from("offers")
          .select("id, products!inner(shopkeeper_id)")
          .eq("id", offerId)
          .single()
        if (!o || (o as any).products.shopkeeper_id !== deps.userId) {
          await log({
            step: "error",
            kind: "decide_offer",
            resource: `offer:${offerId}`,
            status: "failed",
            message: "Offer not found or not yours.",
          })
          return { error: "Offer not found or not yours." }
        }
        const { error } = await deps.supabase
          .from("offers")
          .update({ status: decision, decided_at: new Date().toISOString() })
          .eq("id", offerId)
        if (error) {
          await log({
            step: "error",
            kind: "decide_offer",
            resource: `offer:${offerId}`,
            status: "failed",
            message: error.message,
          })
          return { error: error.message }
        }
        await log({
          step: "execute",
          kind: "decide_offer",
          resource: `offer:${offerId}`,
          receipt: { offerId, decision },
        })
        return { ok: true, offerId, status: decision }
      },
    }),

    openDispute: tool({
      description: "Open a dispute on one of the user's orders. The agent reviews it.",
      inputSchema: z.object({
        orderId: z.string().uuid(),
        reason: z.string().min(8).max(500),
      }),
      execute: async ({ orderId, reason }) => {
        await log({
          step: "decide",
          kind: "open_dispute",
          resource: `order:${orderId}`,
          payload: { orderId },
        })
        const { data, error } = await deps.supabase
          .from("disputes")
          .insert({ order_id: orderId, opened_by: deps.userId, reason, status: "agent_review" })
          .select("id,status")
          .single()
        if (error) {
          await log({
            step: "error",
            kind: "open_dispute",
            resource: `order:${orderId}`,
            status: "failed",
            message: error.message,
          })
          return { error: error.message }
        }
        await log({
          step: "execute",
          kind: "open_dispute",
          resource: `dispute:${data.id}`,
          receipt: { disputeId: data.id, status: data.status },
        })
        return { ok: true, disputeId: data.id, status: data.status }
      },
    }),

    setReminder: tool({
      description: "Schedule a follow-up reminder for the signed-in user.",
      inputSchema: z.object({
        kind: z.string().min(2).max(64),
        dueAt: z.string().describe("ISO 8601 timestamp."),
        note: z.string().nullable(),
      }),
      execute: async ({ kind, dueAt, note }) => {
        const { data, error } = await deps.supabase
          .from("reminders")
          .insert({
            user_id: deps.userId,
            kind,
            due_at: dueAt,
            payload: note ? { note } : {},
          })
          .select("id,due_at,kind")
          .single()
        await log({
          step: "execute",
          kind: "set_reminder",
          resource: data ? `reminder:${data.id}` : null,
          payload: { kind, dueAt },
          status: error ? "failed" : "ok",
          message: error?.message,
        })
        if (error) return { error: error.message }
        return { ok: true, reminderId: data.id, dueAt: data.due_at, kind: data.kind }
      },
    }),

    getReputation: tool({
      description: "Read the public reputation score for any user id (defaults to self).",
      inputSchema: z.object({
        subjectId: z.string().uuid().nullable(),
      }),
      execute: async ({ subjectId }) => {
        const id = subjectId ?? deps.userId
        const { data, error } = await deps.supabase
          .from("reputation_score")
          .select("score,events")
          .eq("subject_id", id)
          .maybeSingle()
        await log({
          step: "execute",
          kind: "get_reputation",
          resource: `user:${id}`,
          status: error ? "failed" : "ok",
        })
        if (error) return { error: error.message }
        return { subjectId: id, score: data?.score ?? 0, events: data?.events ?? 0 }
      },
    }),

    getCusdBalance: tool({
      description:
        "Read the cUSD balance of any address on Celo. Defaults to the user's primary address.",
      inputSchema: z.object({
        address: z.string().nullable(),
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
          await log({
            step: "error",
            kind: "get_cusd_balance",
            status: "failed",
            message: "No wallet on file.",
          })
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
          const result = {
            address: target,
            balance: cusdWeiToHuman(wei),
            token: "cUSD",
            chain: "Celo",
          }
          await log({
            step: "execute",
            kind: "get_cusd_balance",
            resource: `address:${target}`,
            receipt: result,
          })
          return result
        } catch (err: any) {
          const message = err?.shortMessage ?? err?.message ?? "RPC error"
          await log({
            step: "error",
            kind: "get_cusd_balance",
            resource: `address:${target}`,
            status: "failed",
            message,
          })
          return { error: message }
        }
      },
    }),
  } as const
}

export type AgentTools = ReturnType<typeof buildTools>
