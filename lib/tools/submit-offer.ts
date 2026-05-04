/**
 * submitOffer - Place an offer on a product
 * 
 * Clients only. Creates real offer record in Supabase.
 */

import { tool } from "ai"
import { z } from "zod"
import type { ToolContext } from "./types"

export function submitOffer(ctx: ToolContext) {
  return tool({
    description: "Place an offer on a product. Clients only. Creates a real offer that the shopkeeper will review.",
    parameters: z.object({
      productId: z.string().uuid().describe("Product UUID to make offer on"),
      offerAmountCusd: z.number().positive().describe("Offer amount in cUSD (e.g. 10.50)"),
      message: z.string().max(500).optional().describe("Optional message to shopkeeper"),
    }),
    execute: async ({ productId, offerAmountCusd, message }) => {
      if (ctx.role !== "client") {
        return { ok: false, error: "Only clients can submit offers. Shopkeepers receive offers." }
      }
      
      // Fetch the product
      const { data: product, error: productError } = await ctx.supabase
        .from("products")
        .select("id, title, price_cents, currency, stock, active, shopkeeper_id")
        .eq("id", productId)
        .single()
      
      if (productError || !product) {
        return { ok: false, error: `Product not found: ${productError?.message ?? "Unknown"}` }
      }
      
      if (!product.active) {
        return { ok: false, error: "This product is no longer available." }
      }
      
      if (product.stock < 1) {
        return { ok: false, error: "This product is out of stock." }
      }
      
      if (!product.shopkeeper_id) {
        return { ok: false, error: "This product has no assigned shopkeeper to receive offers." }
      }
      
      // Convert offer to micro units (6 decimals for cUSD)
      const offerMicro = Math.round(offerAmountCusd * 1_000_000)
      
      // Create the offer
      const { data: offer, error: offerError } = await ctx.supabase
        .from("offers")
        .insert({
          product_id: productId,
          client_id: ctx.userId,
          shopkeeper_id: product.shopkeeper_id,
          offer_micro: offerMicro,
          status: "pending",
          message: message ?? null,
        })
        .select("id, offer_micro, status, created_at")
        .single()
      
      if (offerError) {
        return { ok: false, error: `Failed to create offer: ${offerError.message}` }
      }
      
      // Record in audit log
      await ctx.supabase.from("audit_log").insert({
        entity_type: "offer",
        entity_id: offer.id,
        action: "create",
        actor_id: ctx.userId,
        actor_type: "agent",
        changes: { submitted: true },
        new_values: offer,
      })
      
      return {
        ok: true,
        offer: {
          id: offer.id,
          productTitle: product.title,
          offerAmount: `${offerAmountCusd.toFixed(2)} cUSD`,
          status: offer.status,
          createdAt: offer.created_at,
        },
        message: `Offer of ${offerAmountCusd.toFixed(2)} cUSD submitted for "${product.title}". Awaiting shopkeeper review.`,
      }
    },
  })
}
