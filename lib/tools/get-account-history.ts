/**
 * getAccountHistory - Fetch user's offers and orders
 * 
 * Returns real transaction history from Supabase.
 */

import { tool } from "ai"
import { z } from "zod"
import type { ToolContext } from "./types"

export function getAccountHistory(ctx: ToolContext) {
  return tool({
    description: "Get the user's offer and order history. Shows real transactions from the database.",
    parameters: z.object({
      type: z.enum(["offers", "orders", "all"]).default("all"),
      status: z.string().optional().describe("Filter by status (pending, accepted, rejected, etc.)"),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    execute: async ({ type, status, limit }) => {
      const results: { offers?: unknown[]; orders?: unknown[] } = {}
      
      // Determine which field to filter by based on role
      const userField = ctx.role === "shopkeeper" ? "shopkeeper_id" : "client_id"
      
      // Fetch offers
      if (type === "offers" || type === "all") {
        let offerQuery = ctx.supabase
          .from("offers")
          .select(`
            id,
            offer_micro,
            status,
            message,
            created_at,
            products:product_id (id, title, price_cents, currency)
          `)
          .eq(userField, ctx.userId)
          .order("created_at", { ascending: false })
          .limit(limit)
        
        if (status) {
          offerQuery = offerQuery.eq("status", status)
        }
        
        const { data: offers, error: offerError } = await offerQuery
        
        if (offerError) {
          return { ok: false, error: `Failed to fetch offers: ${offerError.message}` }
        }
        
        results.offers = (offers ?? []).map((o: any) => ({
          id: o.id,
          amount: `${(o.offer_micro / 1_000_000).toFixed(2)} cUSD`,
          status: o.status,
          product: o.products?.title ?? "Unknown",
          productId: o.products?.id,
          message: o.message,
          createdAt: o.created_at,
        }))
      }
      
      // Fetch orders
      if (type === "orders" || type === "all") {
        let orderQuery = ctx.supabase
          .from("orders")
          .select(`
            id,
            amount_micro,
            status,
            tx_hash,
            created_at,
            products:product_id (id, title)
          `)
          .eq(userField, ctx.userId)
          .order("created_at", { ascending: false })
          .limit(limit)
        
        if (status) {
          orderQuery = orderQuery.eq("status", status)
        }
        
        const { data: orders, error: orderError } = await orderQuery
        
        if (orderError) {
          return { ok: false, error: `Failed to fetch orders: ${orderError.message}` }
        }
        
        results.orders = (orders ?? []).map((o: any) => ({
          id: o.id,
          amount: `${(o.amount_micro / 1_000_000).toFixed(2)} cUSD`,
          status: o.status,
          product: o.products?.title ?? "Unknown",
          productId: o.products?.id,
          txHash: o.tx_hash,
          createdAt: o.created_at,
        }))
      }
      
      const totalOffers = results.offers?.length ?? 0
      const totalOrders = results.orders?.length ?? 0
      
      if (totalOffers === 0 && totalOrders === 0) {
        return {
          ok: true,
          message: "No transaction history found.",
          offers: [],
          orders: [],
        }
      }
      
      return {
        ok: true,
        ...results,
        summary: {
          totalOffers,
          totalOrders,
          role: ctx.role,
        },
      }
    },
  })
}
