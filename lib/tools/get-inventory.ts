/**
 * getInventory - Fetch inventory from Supabase
 * 
 * For shopkeepers: their own listings
 * For clients: browse public catalog
 */

import { tool } from "ai"
import { z } from "zod"
import type { ToolContext } from "./types"

export function getInventory(ctx: ToolContext) {
  return tool({
    description: "List products. Shopkeepers see their own inventory. Clients browse the public catalog. Fails if database is empty.",
    parameters: z.object({
      category: z.string().optional().describe("Filter by category"),
      activeOnly: z.boolean().default(true).describe("Only show active listings"),
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0),
    }),
    execute: async ({ category, activeOnly, limit, offset }) => {
      let query = ctx.supabase
        .from("products")
        .select("id, title, description, price_cents, currency, stock, active, category, brand, rating, shopkeeper_id", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)
      
      // Shopkeepers see their own products
      if (ctx.role === "shopkeeper") {
        query = query.eq("shopkeeper_id", ctx.userId)
      } else {
        // Clients only see active products
        query = query.eq("active", true)
      }
      
      if (activeOnly && ctx.role === "shopkeeper") {
        query = query.eq("active", true)
      }
      
      if (category) {
        query = query.eq("category", category.toLowerCase())
      }
      
      const { data, error, count } = await query
      
      if (error) {
        return { ok: false, error: `Failed to fetch inventory: ${error.message}` }
      }
      
      if (!data || data.length === 0) {
        if (ctx.role === "shopkeeper") {
          return { ok: false, error: "You have no products in your inventory. Create a listing first." }
        }
        return { ok: false, error: "The catalog is empty. No products available." }
      }
      
      return {
        ok: true,
        inventory: data.map((p) => ({
          ...p,
          price: `${(p.price_cents / 100).toFixed(2)} ${p.currency}`,
        })),
        total: count ?? data.length,
        showing: data.length,
        offset,
      }
    },
  })
}
