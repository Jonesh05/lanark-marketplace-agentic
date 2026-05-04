/**
 * createOrder - Create an order from an accepted offer
 * 
 * Called after shopkeeper accepts an offer. Creates order record
 * and updates product stock.
 */

import { tool } from "ai"
import { z } from "zod"
import type { ToolContext } from "./types"

export function createOrder(ctx: ToolContext) {
  return tool({
    description: "Create an order from an accepted offer. Used after shopkeeper accepts. Updates stock and creates order record.",
    parameters: z.object({
      offerId: z.string().uuid().describe("The accepted offer ID"),
    }),
    execute: async ({ offerId }) => {
      // Fetch the offer
      const { data: offer, error: offerError } = await ctx.supabase
        .from("offers")
        .select("id, product_id, client_id, shopkeeper_id, offer_micro, status")
        .eq("id", offerId)
        .single()
      
      if (offerError || !offer) {
        return { ok: false, error: `Offer not found: ${offerError?.message ?? "Unknown"}` }
      }
      
      if (offer.status !== "accepted") {
        return { ok: false, error: `Offer must be accepted first. Current status: ${offer.status}` }
      }
      
      // Verify user is either the client or shopkeeper of this offer
      if (ctx.userId !== offer.client_id && ctx.userId !== offer.shopkeeper_id) {
        return { ok: false, error: "You are not authorized to create an order for this offer." }
      }
      
      // Fetch product details
      const { data: product, error: productError } = await ctx.supabase
        .from("products")
        .select("id, title, stock, price_cents, currency")
        .eq("id", offer.product_id)
        .single()
      
      if (productError || !product) {
        return { ok: false, error: `Product not found: ${productError?.message ?? "Unknown"}` }
      }
      
      if (product.stock < 1) {
        return { ok: false, error: "Product is out of stock. Cannot create order." }
      }
      
      // Create order
      const { data: order, error: orderError } = await ctx.supabase
        .from("orders")
        .insert({
          offer_id: offerId,
          product_id: offer.product_id,
          client_id: offer.client_id,
          shopkeeper_id: offer.shopkeeper_id,
          amount_micro: offer.offer_micro,
          status: "pending_payment",
        })
        .select("id, amount_micro, status, created_at")
        .single()
      
      if (orderError) {
        return { ok: false, error: `Failed to create order: ${orderError.message}` }
      }
      
      // Decrement stock
      const { error: stockError } = await ctx.supabase
        .from("products")
        .update({ stock: product.stock - 1 })
        .eq("id", product.id)
      
      if (stockError) {
        // Log but don't fail - order is created
        console.error("Stock update failed:", stockError)
      }
      
      // Update offer status
      await ctx.supabase
        .from("offers")
        .update({ status: "ordered" })
        .eq("id", offerId)
      
      // Audit log
      await ctx.supabase.from("audit_log").insert({
        entity_type: "order",
        entity_id: order.id,
        action: "create",
        actor_id: ctx.userId,
        actor_type: "agent",
        changes: { created: true, fromOffer: offerId },
        new_values: order,
      })
      
      const amountCusd = (offer.offer_micro / 1_000_000).toFixed(2)
      
      return {
        ok: true,
        order: {
          id: order.id,
          productTitle: product.title,
          amount: `${amountCusd} cUSD`,
          status: order.status,
          createdAt: order.created_at,
        },
        message: `Order created for "${product.title}" at ${amountCusd} cUSD. Awaiting payment.`,
      }
    },
  })
}
