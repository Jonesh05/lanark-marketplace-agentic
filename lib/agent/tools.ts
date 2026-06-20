import { tool } from "ai"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { erc20Abi } from "viem"
import { CUSD_ADDRESS, publicClient, cusdWeiToHuman, cusdToWei } from "@/lib/celo"
import { productCusd, priceMajor, priceLabel, productUnitPriceWeiStr } from "@/lib/pricing"

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

  // Never leak raw DB/SQL/driver errors to a non-technical buyer. Map known
  // failure shapes to a calm, human message; everything else gets a generic
  // safe fallback. The real cause is still recorded in agent_actions.
  function safeMessage(raw?: string | null): string {
    const m = (raw ?? "").toLowerCase()
    if (!m) return "No pudimos completar la acción. Intenta de nuevo."
    if (m.includes("not-null") || m.includes("null value"))
      return "No pudimos registrar el dato porque faltó un valor. Ya lo estamos corrigiendo del lado del sistema."
    if (m.includes("duplicate") || m.includes("unique"))
      return "Esa acción ya estaba registrada."
    if (m.includes("permission") || m.includes("rls") || m.includes("policy"))
      return "No tienes permiso para esta acción."
    if (m.includes("foreign key") || m.includes("violates"))
      return "El producto u oferta referenciada no es válida."
    if (m.includes("network") || m.includes("timeout") || m.includes("fetch"))
      return "Hubo un problema de conexión. Vuelve a intentarlo en un momento."
    return "No pudimos completar la acción. Intenta de nuevo."
  }

  return {
    searchProducts: tool({
      description:
        "Search active marketplace listings. Supports free text, price ceiling (in the listing's native currency), category, and brand filters. Returns the highest-rated matches first.",
      inputSchema: z.object({
        query: z.string().nullable(),
        maxPrice: z.number().nullable().describe("Max price in the listing's native currency."),
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
          // Sanitize to a strict whitelist before interpolating into the
          // PostgREST .or() filter. Stripping only %/, leaves operator
          // characters ( . { } ( ) ) that can break or reshape the query.
          const t = query.replace(/[^\p{L}\p{N}\s\-_]/gu, " ").replace(/\s+/g, " ").trim()
          if (t.length > 0) {
            q = q.or(`title.ilike.%${t}%,description.ilike.%${t}%,tags.cs.{${t}}`)
          }
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
        if (error) return { error: safeMessage(error.message), items: [] }
        // Return human-facing prices, never raw cents. Exposing price_cents
        // caused a 100x misread (12,000 COP shown as 1,200,000 COP). The model
        // must quote priceLabel / priceCusd directly.
        const items = (data ?? []).map((p: any) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          currency: p.currency,
          price: priceMajor(p.price_cents),
          priceCusd: Number(productCusd(p.price_cents, p.currency).toFixed(2)),
          priceLabel: priceLabel(p.price_cents, p.currency),
          stock: p.stock,
          image_url: p.image_url,
          thumbnail_url: p.thumbnail_url,
          settle_token: p.settle_token,
          source: p.source,
          category: p.category,
          brand: p.brand,
          rating: p.rating,
          discount_percentage: p.discount_percentage,
          tags: p.tags,
        }))
        return { items }
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
        if (error) return { error: safeMessage(error.message), items: [] }
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
        if (error) return { error: safeMessage(error.message), items: [] }
        return { items: data ?? [] }
      },
    }),

    updateProduct: tool({
      description:
        "Update an existing product listing. Shopkeepers can update their own products. Records change in audit log for traceability.",
      inputSchema: z.object({
        productId: z.string().uuid(),
        title: z.string().min(2).max(200).nullable().describe("New title, or null to keep current."),
        description: z.string().max(2000).nullable().describe("New description, or null to keep current."),
        priceCents: z.number().int().positive().nullable().describe("New price in cents, or null to keep current."),
        currency: z.enum(["USD", "COP"]).nullable().describe("Currency code, or null to keep current."),
        stock: z.number().int().min(0).nullable().describe("New stock level, or null to keep current."),
        active: z.boolean().nullable().describe("Set active/inactive, or null to keep current."),
        imageUrl: z.string().url().nullable().describe("New image URL, or null to keep current."),
        category: z.string().nullable().describe("Product category, or null to keep current."),
        brand: z.string().nullable().describe("Product brand, or null to keep current."),
      }),
      execute: async ({ productId, title, description, priceCents, currency, stock, active, imageUrl, category, brand }) => {
        if (deps.role !== "shopkeeper") {
          await log({ step: "error", kind: "update_product", status: "failed", message: "Only shopkeepers can update products." })
          return { error: "Only shopkeepers can update products." }
        }
        // Fetch current product to verify ownership and get old values
        const { data: existing, error: fetchErr } = await deps.supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .single()
        if (fetchErr || !existing) {
          await log({ step: "error", kind: "update_product", resource: `product:${productId}`, status: "failed", message: "Product not found." })
          return { error: "Product not found." }
        }
        if (existing.shopkeeper_id !== deps.userId) {
          await log({ step: "error", kind: "update_product", resource: `product:${productId}`, status: "failed", message: "Not your product." })
          return { error: "You can only update your own products." }
        }
        // Build update object with only non-null fields
        const updates: Record<string, unknown> = {}
        const changes: Record<string, { from: unknown; to: unknown }> = {}
        if (title !== null && title !== undefined && title !== existing.title) {
          updates.title = title
          changes.title = { from: existing.title, to: title }
        }
        if (description !== null && description !== undefined && description !== existing.description) {
          updates.description = description
          changes.description = { from: existing.description, to: description }
        }
        if (priceCents !== null && priceCents !== undefined && priceCents !== existing.price_cents) {
          updates.price_cents = priceCents
          changes.price_cents = { from: existing.price_cents, to: priceCents }
        }
        if (currency !== null && currency !== undefined && currency !== existing.currency) {
          updates.currency = currency
          changes.currency = { from: existing.currency, to: currency }
        }
        if (stock !== null && stock !== undefined && stock !== existing.stock) {
          updates.stock = stock
          changes.stock = { from: existing.stock, to: stock }
        }
        if (active !== null && active !== undefined && active !== existing.active) {
          updates.active = active
          changes.active = { from: existing.active, to: active }
        }
        if (imageUrl !== null && imageUrl !== undefined && imageUrl !== existing.image_url) {
          updates.image_url = imageUrl
          changes.image_url = { from: existing.image_url, to: imageUrl }
        }
        if (category !== null && category !== undefined && category !== existing.category) {
          updates.category = category
          changes.category = { from: existing.category, to: category }
        }
        if (brand !== null && brand !== undefined && brand !== existing.brand) {
          updates.brand = brand
          changes.brand = { from: existing.brand, to: brand }
        }
        if (Object.keys(updates).length === 0) {
          return { ok: true, message: "No changes to apply.", productId }
        }
        // Apply update
        const { data: updated, error: updateErr } = await deps.supabase
          .from("products")
          .update(updates)
          .eq("id", productId)
          .select("id,title,price_cents,currency,stock,active")
          .single()
        if (updateErr) {
          await log({ step: "error", kind: "update_product", resource: `product:${productId}`, status: "failed", message: updateErr.message })
          return { error: safeMessage(updateErr.message) }
        }
        // Record in audit log
        await deps.supabase.from("audit_log").insert({
          entity_type: "product",
          entity_id: productId,
          action: "update",
          actor_id: deps.userId,
          actor_type: "agent",
          changes,
          old_values: existing,
          new_values: updated,
        })
        await log({
          step: "execute",
          kind: "update_product",
          resource: `product:${productId}`,
          payload: updates,
          receipt: { productId, changedFields: Object.keys(changes) },
        })
        return { ok: true, productId, updated, changedFields: Object.keys(changes) }
      },
    }),

    createProduct: tool({
      description:
        "Create a new product listing for the shopkeeper. Records creation in audit log.",
      inputSchema: z.object({
        title: z.string().min(2).max(200),
        description: z.string().max(2000).nullable(),
        priceCents: z.number().int().positive().describe("Price in cents (e.g. 1000 = $10.00)."),
        currency: z.enum(["USD", "COP"]).default("USD"),
        stock: z.number().int().min(0).default(1),
        imageUrl: z.string().url().nullable(),
        category: z.string().nullable(),
        brand: z.string().nullable(),
        settleToken: z.enum(["cUSD"]).default("cUSD"),
      }),
      execute: async ({ title, description, priceCents, currency, stock, imageUrl, category, brand, settleToken }) => {
        if (deps.role !== "shopkeeper") {
          await log({ step: "error", kind: "create_product", status: "failed", message: "Only shopkeepers can create products." })
          return { error: "Only shopkeepers can create products." }
        }
        const { data, error } = await deps.supabase
          .from("products")
          .insert({
            shopkeeper_id: deps.userId,
            title,
            description,
            price_cents: priceCents,
            currency,
            stock,
            image_url: imageUrl,
            category,
            brand,
            settle_token: settleToken,
            active: true,
            source: "native",
          })
          .select("id,title,price_cents,currency,stock,active")
          .single()
        if (error) {
          await log({ step: "error", kind: "create_product", status: "failed", message: error.message })
          return { error: safeMessage(error.message) }
        }
        // Record in audit log
        await deps.supabase.from("audit_log").insert({
          entity_type: "product",
          entity_id: data.id,
          action: "create",
          actor_id: deps.userId,
          actor_type: "agent",
          changes: { created: true },
          new_values: data,
        })
        await log({
          step: "execute",
          kind: "create_product",
          resource: `product:${data.id}`,
          receipt: { productId: data.id, title: data.title },
        })
        return { ok: true, product: data }
      },
    }),

    deleteProduct: tool({
      description:
        "Soft-delete a product by setting it inactive. Records deletion in audit log. Only the owning shopkeeper can delete.",
      inputSchema: z.object({
        productId: z.string().uuid(),
        hardDelete: z.boolean().default(false).describe("If true, permanently delete. Default is soft delete (set inactive)."),
      }),
      execute: async ({ productId, hardDelete }) => {
        if (deps.role !== "shopkeeper") {
          await log({ step: "error", kind: "delete_product", status: "failed", message: "Only shopkeepers can delete products." })
          return { error: "Only shopkeepers can delete products." }
        }
        // Verify ownership
        const { data: existing } = await deps.supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .single()
        if (!existing) {
          await log({ step: "error", kind: "delete_product", resource: `product:${productId}`, status: "failed", message: "Product not found." })
          return { error: "Product not found." }
        }
        if (existing.shopkeeper_id !== deps.userId) {
          await log({ step: "error", kind: "delete_product", resource: `product:${productId}`, status: "failed", message: "Not your product." })
          return { error: "You can only delete your own products." }
        }
        if (hardDelete) {
          const { error } = await deps.supabase.from("products").delete().eq("id", productId)
          if (error) {
            await log({ step: "error", kind: "delete_product", resource: `product:${productId}`, status: "failed", message: error.message })
            return { error: safeMessage(error.message) }
          }
        } else {
          const { error } = await deps.supabase.from("products").update({ active: false }).eq("id", productId)
          if (error) {
            await log({ step: "error", kind: "delete_product", resource: `product:${productId}`, status: "failed", message: error.message })
            return { error: safeMessage(error.message) }
          }
        }
        // Record in audit log
        await deps.supabase.from("audit_log").insert({
          entity_type: "product",
          entity_id: productId,
          action: "delete",
          actor_id: deps.userId,
          actor_type: "agent",
          changes: { hardDelete },
          old_values: existing,
        })
        await log({
          step: "execute",
          kind: "delete_product",
          resource: `product:${productId}`,
          receipt: { productId, hardDelete },
        })
        return { ok: true, productId, deleted: hardDelete ? "hard" : "soft" }
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
          .select("id,product_id,qty,amount_cusd_wei,tx_hash,status,created_at,products(title)")
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
        if (error) return { error: safeMessage(error.message), items: [] }
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
          .select("id,product_id,qty,amount_cusd_wei,status,created_at,products!inner(title,shopkeeper_id)")
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
        if (error) return { error: safeMessage(error.message), items: [] }
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
          .select("id,title,stock,active,price_cents,currency,price_cusd,shopkeeper_id")
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
        if (prod.shopkeeper_id && prod.shopkeeper_id === deps.userId) {
          return { error: "You cannot offer on your own listing." }
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
        const amountWei = cusdToWei(amountCusd)
        // Negotiation band: a client may offer between 82% and 100% of the
        // listed cUSD price. Above list price is rejected (usually a units
        // mistake); below 82% is too low to be actionable.
        const listCusd = productCusd(prod.price_cents, prod.currency, (prod as any).price_cusd)
        const listWei = cusdToWei(listCusd)
        const floorWei = (listWei * BigInt(82)) / BigInt(100)
        if (amountWei > listWei) {
          await log({
            step: "error",
            kind: "place_offer",
            resource: `product:${productId}`,
            status: "failed",
            message: "Offer above list price.",
          })
          return {
            error: `Tu oferta no puede superar el precio de lista (${listCusd.toFixed(2)} cUSD).`,
          }
        }
        if (amountWei < floorWei) {
          await log({
            step: "error",
            kind: "place_offer",
            resource: `product:${productId}`,
            status: "failed",
            message: "Offer below acceptable minimum.",
          })
          return {
            error: `La oferta mínima para este producto es ${(listCusd * 0.82).toFixed(2)} cUSD (82% del precio de lista).`,
          }
        }
        const { data, error } = await deps.supabase
          .from("offers")
          .insert({
            product_id: productId,
            client_id: deps.userId,
            qty,
            amount_cusd_wei: amountWei.toString(),
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
          return { error: safeMessage(error.message) }
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
          .select("id, product_id, client_id, qty, amount_cusd_wei, products!inner(shopkeeper_id)")
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
          return { error: "Could not update offer." }
        }
        // Promote accepted offers to a pending order. Idempotent via the
        // unique index on orders.offer_id (ignore 23505 duplicate-key).
        if (decision === "accepted") {
          const oo = o as any
          const { error: ierr } = await deps.supabase.from("orders").insert({
            offer_id: oo.id,
            product_id: oo.product_id,
            client_id: oo.client_id,
            shopkeeper_id: deps.userId,
            qty: oo.qty,
            amount_cusd_wei: oo.amount_cusd_wei,
            status: "pending",
          })
          if (ierr && (ierr as any).code !== "23505") {
            await log({
              step: "error",
              kind: "decide_offer",
              resource: `offer:${offerId}`,
              status: "failed",
              message: "Order creation failed.",
            })
            return { error: "Offer accepted but order could not be created." }
          }
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
        // Verify the order belongs to this user before opening a dispute.
        const { data: order } = await deps.supabase
          .from("orders")
          .select("client_id, shopkeeper_id")
          .eq("id", orderId)
          .single()
        if (
          !order ||
          ((order as any).client_id !== deps.userId &&
            (order as any).shopkeeper_id !== deps.userId)
        ) {
          await log({
            step: "error",
            kind: "open_dispute",
            resource: `order:${orderId}`,
            status: "failed",
            message: "Order not found or not yours.",
          })
          return { error: "Order not found or not yours." }
        }
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
          return { error: safeMessage(error.message) }
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
        if (error) return { error: safeMessage(error.message) }
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
        if (error) return { error: safeMessage(error.message) }
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

    addToCart: tool({
      description:
        "Add a product to the signed-in client's persistent cart at its final price (no negotiation). Snapshots the price and validates stock. Use this for direct purchases.",
      inputSchema: z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(100000).default(1),
      }),
      execute: async ({ productId, quantity }) => {
        if (deps.role !== "client") {
          await log({ step: "error", kind: "add_to_cart", resource: `product:${productId}`, status: "failed", message: "Role is not client." })
          return { error: "Solo los clientes pueden comprar." }
        }
        const { data: prod, error: pErr } = await deps.supabase
          .from("products")
          .select("id,title,price_cents,currency,price_cusd,stock,active,shopkeeper_id")
          .eq("id", productId)
          .maybeSingle()
        if (pErr) return { error: safeMessage(pErr.message) }
        if (!prod || !prod.active) return { error: "Este producto no está disponible." }
        if (prod.stock < quantity) return { error: "No hay suficiente stock." }

        // Get or create the client's open cart.
        let cartId: string | null = null
        const { data: openCart } = await deps.supabase
          .from("carts").select("id").eq("user_id", deps.userId).eq("status", "open").maybeSingle()
        if (openCart?.id) cartId = openCart.id
        else {
          const { data: created, error: cErr } = await deps.supabase
            .from("carts").insert({ user_id: deps.userId, status: "open" }).select("id").single()
          if (cErr) return { error: safeMessage(cErr.message) }
          cartId = created.id
        }

        // Snapshot the cUSD unit price. Fall back to a currency conversion when
        // price_cusd is null so the order total is never silently 0.
        const unitWei = productUnitPriceWeiStr(
          prod.price_cents,
          prod.currency,
          prod.price_cusd,
        )
        if (unitWei === "0") {
          return { error: "Este producto no tiene un precio de liquidación válido." }
        }
        const { data: existing } = await deps.supabase
          .from("cart_items").select("id,quantity").eq("cart_id", cartId).eq("product_id", productId).maybeSingle()

        if (existing?.id) {
          const nextQty = Math.min(existing.quantity + quantity, prod.stock)
          const { error } = await deps.supabase
            .from("cart_items").update({
              quantity: nextQty,
              unit_price_cusd_wei: unitWei,
              updated_at: new Date().toISOString(),
            }).eq("id", existing.id)
          if (error) return { error: safeMessage(error.message) }
          await log({ step: "execute", kind: "add_to_cart", resource: `product:${productId}`, receipt: { cartId, quantity: nextQty } })
          return { ok: true, cartId, productId, quantity: nextQty, summary: `Actualizado: ${nextQty} × ${prod.title} en tu carrito.` }
        }

        const { error } = await deps.supabase.from("cart_items").insert({
          cart_id: cartId, product_id: productId, shopkeeper_id: prod.shopkeeper_id,
          quantity, unit_price_cents: prod.price_cents, currency: prod.currency, unit_price_cusd_wei: unitWei,
        })
        if (error) return { error: safeMessage(error.message) }
        await log({ step: "execute", kind: "add_to_cart", resource: `product:${productId}`, receipt: { cartId, quantity } })
        return { ok: true, cartId, productId, quantity, summary: `Agregado: ${quantity} × ${prod.title} a tu carrito.` }
      },
    }),

    viewCart: tool({
      description: "Show the signed-in client's current cart: items, quantities and the cUSD total.",
      inputSchema: z.object({}),
      execute: async () => {
        if (deps.role !== "client") return { error: "Solo los clientes tienen carrito.", items: [] }
        const { data: cart } = await deps.supabase
          .from("carts").select("id").eq("user_id", deps.userId).eq("status", "open").maybeSingle()
        if (!cart?.id) return { items: [], total_cusd: 0, summary: "Tu carrito está vacío." }
        const { data, error } = await deps.supabase
          .from("cart_items")
          .select("id,product_id,quantity,unit_price_cents,currency,unit_price_cusd_wei,products(title)")
          .eq("cart_id", cart.id)
        if (error) return { error: safeMessage(error.message), items: [] }
        const items = data ?? []
        const toWei = (v: any) => {
          const r = String(v ?? "0").split(".")[0]
          try { return /^-?\d+$/.test(r) ? BigInt(r) : BigInt(0) } catch { return BigInt(0) }
        }
        const totalWei = items.reduce((acc, it: any) => acc + toWei(it.unit_price_cusd_wei) * BigInt(Number(it.quantity) || 0), BigInt(0))
        await log({ step: "execute", kind: "view_cart", receipt: { count: items.length } })
        return { items, total_cusd: Number(cusdWeiToHuman(totalWei)), count: items.length }
      },
    }),

    checkoutCart: tool({
      description:
        "Turn the client's cart into a preinscribed order per shopkeeper, reserving stock atomically. No payment happens yet: the order awaits the buyer's authorization. Requires a delivery address.",
      inputSchema: z.object({
        shippingAddress: z.string().min(4).max(500).describe("Physical delivery address."),
      }),
      execute: async ({ shippingAddress }) => {
        if (deps.role !== "client") return { error: "Solo los clientes pueden comprar." }
        await log({ step: "decide", kind: "checkout_cart", payload: { hasAddress: Boolean(shippingAddress) } })
        const { data, error } = await deps.supabase.rpc("checkout_cart", { p_shipping_address: shippingAddress })
        if (error) {
          const m = error.message.toLowerCase()
          await log({ step: "error", kind: "checkout_cart", status: "failed", message: error.message })
          if (m.includes("empty_cart")) return { error: "Tu carrito está vacío." }
          if (m.includes("insufficient_stock")) return { error: "Un producto se quedó sin stock. Revisa tu carrito." }
          return { error: "No pudimos crear tu orden. Intenta de nuevo." }
        }
        const orders = (data ?? []) as Array<{ order_id: string; purchase_ref: string; total_cusd_wei: string }>
        await log({ step: "execute", kind: "checkout_cart", receipt: { orders: orders.length } })
        return {
          ok: true,
          orders: orders.map((o) => ({ orderId: o.order_id, purchaseRef: o.purchase_ref, total_cusd: Number(cusdWeiToHuman(BigInt(o.total_cusd_wei ?? "0"))) })),
          summary: orders.length === 1
            ? `Orden ${orders[0].purchase_ref} creada. Falta autorizar el pago.`
            : `${orders.length} órdenes creadas (una por vendedor). Falta autorizar el pago.`,
          nextStep: "Pide al cliente autorizar el pago para continuar.",
        }
      },
    }),

    authorizeOrder: tool({
      description:
        "Authorize payment on a preinscribed order (the 'Autorizar Pago' step). Moves it to pending so the buyer can sign and settlement can run.",
      inputSchema: z.object({ orderId: z.string().uuid() }),
      execute: async ({ orderId }) => {
        if (deps.role !== "client") return { error: "Solo el comprador puede autorizar el pago." }
        const { data: order } = await deps.supabase
          .from("orders").select("id,client_id,status,total_cusd_wei,amount_cusd_wei").eq("id", orderId).maybeSingle()
        if (!order || order.client_id !== deps.userId) return { error: "No encontramos esa orden." }
        if (order.status !== "preinscribed") return { error: "Esta orden ya no está pendiente de autorización." }
        // Real funds gate: read on-chain cUSD and refuse authorization when the
        // buyer cannot cover the order. This reads balance only; it does NOT
        // move funds or settle (no escrow is connected yet).
        const needWei = BigInt(String(order.total_cusd_wei ?? order.amount_cusd_wei ?? "0"))
        if (needWei > BigInt(0)) {
          const { data: prof } = await deps.supabase
            .from("profiles").select("primary_address").eq("id", deps.userId).maybeSingle()
          const addr = prof?.primary_address as `0x${string}` | undefined
          if (addr) {
            try {
              const haveWei = await publicClient().readContract({
                address: CUSD_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [addr],
              })
              if (haveWei < needWei) {
                await log({ step: "error", kind: "authorize_order", resource: `order:${orderId}`, status: "failed", message: "insufficient_funds" })
                return {
                  error: `No tienes fondos suficientes. Necesitas ${cusdWeiToHuman(needWei)} cUSD y tienes ${cusdWeiToHuman(haveWei)} cUSD.`,
                  insufficientFunds: true,
                  need_cusd: Number(cusdWeiToHuman(needWei)),
                  have_cusd: Number(cusdWeiToHuman(haveWei)),
                }
              }
            } catch {
              // RPC failure must not block authorization on an infra problem.
            }
          }
        }
        const { error } = await deps.supabase.from("orders").update({ status: "pending" }).eq("id", orderId).eq("client_id", deps.userId)
        if (error) return { error: safeMessage(error.message) }
        await deps.supabase.from("order_events").insert({ order_id: orderId, actor_id: deps.userId, event_type: "created", payload: { status: "authorized" } })
        await log({ step: "execute", kind: "authorize_order", resource: `order:${orderId}`, receipt: { status: "pending" } })
        return { ok: true, orderId, status: "pending", summary: "Pago autorizado. La orden queda pendiente de firma y liquidación." }
      },
    }),

    confirmOrder: tool({
      description:
        "Move an authorized order to awaiting_settlement. Settlement happens off-chain until an escrow contract is deployed: this NEVER means funds have moved or the order is paid.",
      inputSchema: z.object({ orderId: z.string().uuid() }),
      execute: async ({ orderId }) => {
        if (deps.role !== "client") return { error: "Solo el comprador puede confirmar la orden." }
        const { data: order } = await deps.supabase
          .from("orders").select("id,client_id,status").eq("id", orderId).maybeSingle()
        if (!order || order.client_id !== deps.userId) return { error: "No encontramos esa orden." }
        if (order.status !== "pending" && order.status !== "preinscribed")
          return { error: "Esta orden ya no se puede confirmar." }
        const { error } = await deps.supabase.from("orders").update({ status: "awaiting_settlement" }).eq("id", orderId).eq("client_id", deps.userId)
        if (error) return { error: safeMessage(error.message) }
        await deps.supabase.from("order_events").insert({ order_id: orderId, actor_id: deps.userId, event_type: "created", payload: { status: "awaiting_settlement" } })
        await log({ step: "execute", kind: "confirm_order", resource: `order:${orderId}`, receipt: { status: "awaiting_settlement" } })
        return { ok: true, orderId, status: "awaiting_settlement", summary: "La orden quedó en liquidación. Aún no se ha movido dinero; te avisaremos al confirmarse." }
      },
    }),
  } as const
}

export type AgentTools = ReturnType<typeof buildTools>
