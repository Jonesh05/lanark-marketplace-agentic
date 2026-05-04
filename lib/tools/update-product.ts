/**
 * updateProduct - Update product details
 * 
 * Shopkeepers only. Records changes in audit log.
 */

import { tool } from "ai"
import { z } from "zod"
import type { ToolContext } from "./types"

export function updateProduct(ctx: ToolContext) {
  return tool({
    description: "Update a product's details (title, price, stock, status). Shopkeepers only. All changes are audited.",
    parameters: z.object({
      productId: z.string().uuid(),
      title: z.string().min(2).max(200).optional(),
      description: z.string().max(2000).optional(),
      priceCents: z.number().int().positive().optional().describe("Price in cents (e.g. 999 = $9.99)"),
      currency: z.enum(["USD", "COP"]).optional(),
      stock: z.number().int().min(0).optional(),
      active: z.boolean().optional(),
      imageUrl: z.string().url().optional(),
      category: z.string().optional(),
      brand: z.string().optional(),
    }),
    execute: async ({ productId, title, description, priceCents, currency, stock, active, imageUrl, category, brand }) => {
      if (ctx.role !== "shopkeeper") {
        return { ok: false, error: "Only shopkeepers can update products." }
      }
      
      // Fetch existing product
      const { data: existing, error: fetchError } = await ctx.supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single()
      
      if (fetchError || !existing) {
        return { ok: false, error: `Product not found: ${fetchError?.message ?? "Unknown"}` }
      }
      
      if (existing.shopkeeper_id !== ctx.userId) {
        return { ok: false, error: "You can only update your own products." }
      }
      
      // Build updates
      const updates: Record<string, unknown> = {}
      const changes: Record<string, { from: unknown; to: unknown }> = {}
      
      if (title !== undefined && title !== existing.title) {
        updates.title = title
        changes.title = { from: existing.title, to: title }
      }
      if (description !== undefined && description !== existing.description) {
        updates.description = description
        changes.description = { from: existing.description, to: description }
      }
      if (priceCents !== undefined && priceCents !== existing.price_cents) {
        updates.price_cents = priceCents
        changes.price_cents = { from: existing.price_cents, to: priceCents }
      }
      if (currency !== undefined && currency !== existing.currency) {
        updates.currency = currency
        changes.currency = { from: existing.currency, to: currency }
      }
      if (stock !== undefined && stock !== existing.stock) {
        updates.stock = stock
        changes.stock = { from: existing.stock, to: stock }
      }
      if (active !== undefined && active !== existing.active) {
        updates.active = active
        changes.active = { from: existing.active, to: active }
      }
      if (imageUrl !== undefined && imageUrl !== existing.image_url) {
        updates.image_url = imageUrl
        changes.image_url = { from: existing.image_url, to: imageUrl }
      }
      if (category !== undefined && category !== existing.category) {
        updates.category = category
        changes.category = { from: existing.category, to: category }
      }
      if (brand !== undefined && brand !== existing.brand) {
        updates.brand = brand
        changes.brand = { from: existing.brand, to: brand }
      }
      
      if (Object.keys(updates).length === 0) {
        return { ok: true, message: "No changes to apply.", productId }
      }
      
      // Apply update
      const { data: updated, error: updateError } = await ctx.supabase
        .from("products")
        .update(updates)
        .eq("id", productId)
        .select("id, title, price_cents, currency, stock, active")
        .single()
      
      if (updateError) {
        return { ok: false, error: `Update failed: ${updateError.message}` }
      }
      
      // Audit log
      await ctx.supabase.from("audit_log").insert({
        entity_type: "product",
        entity_id: productId,
        action: "update",
        actor_id: ctx.userId,
        actor_type: "agent",
        changes,
        old_values: existing,
        new_values: updated,
      })
      
      return {
        ok: true,
        product: {
          ...updated,
          price: `${(updated.price_cents / 100).toFixed(2)} ${updated.currency}`,
        },
        changedFields: Object.keys(changes),
        message: `Updated ${Object.keys(changes).join(", ")} for "${updated.title}"`,
      }
    },
  })
}
