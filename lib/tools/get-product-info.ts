/**
 * getProductInfo - Fetch product details from Supabase
 * 
 * No mocks. Returns actual database state or error.
 */

import { tool } from "ai"
import { z } from "zod"
import type { ToolContext } from "./types"

export function getProductInfo(ctx: ToolContext) {
  return tool({
    description: "Get detailed information about a specific product by ID or search by title. Returns real data from database.",
    parameters: z.object({
      productId: z.string().uuid().optional().describe("Product UUID to fetch directly"),
      search: z.string().optional().describe("Search term to find products by title"),
      limit: z.number().int().min(1).max(20).default(5).describe("Max results for search"),
    }),
    execute: async ({ productId, search, limit }) => {
      // Direct lookup by ID
      if (productId) {
        const { data, error } = await ctx.supabase
          .from("products")
          .select("id, title, description, price_cents, currency, stock, active, image_url, category, brand, rating, shopkeeper_id, created_at")
          .eq("id", productId)
          .single()
        
        if (error) {
          return { ok: false, error: `Product not found: ${error.message}` }
        }
        
        return {
          ok: true,
          product: {
            ...data,
            price: `${(data.price_cents / 100).toFixed(2)} ${data.currency}`,
          },
        }
      }
      
      // Search by title
      if (search && search.trim().length > 0) {
        const term = search.replace(/[%,]/g, " ").trim()
        const { data, error } = await ctx.supabase
          .from("products")
          .select("id, title, description, price_cents, currency, stock, active, category, brand, rating")
          .eq("active", true)
          .or(`title.ilike.%${term}%,description.ilike.%${term}%`)
          .order("rating", { ascending: false, nullsFirst: false })
          .limit(limit)
        
        if (error) {
          return { ok: false, error: `Search failed: ${error.message}` }
        }
        
        if (data.length === 0) {
          return { ok: false, error: `No products found matching "${search}"` }
        }
        
        return {
          ok: true,
          results: data.map((p) => ({
            ...p,
            price: `${(p.price_cents / 100).toFixed(2)} ${p.currency}`,
          })),
          count: data.length,
        }
      }
      
      return { ok: false, error: "Provide either productId or search term" }
    },
  })
}
