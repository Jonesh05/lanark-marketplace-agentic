-- Tenant separation: public marketplace vs private shopkeeper dashboard.
-- Enforced at the DATA layer (views + RLS), not by ad-hoc query filters.
--
--  * public_catalog   -> what CLIENTS browse: active products across ALL stores,
--                        joined with the store brand name (Rappi/Amazon style).
--  * my_store_products -> what a SHOPKEEPER sees: ONLY their own products,
--                        scoped to auth.uid() inside the view (security_invoker),
--                        so a dashboard query can never pull the global catalog.

-- ---------------------------------------------------------------------
-- 1. Backfill: every shopkeeper that owns products gets a store, and
--    their products are linked to it. Idempotent.
-- ---------------------------------------------------------------------
INSERT INTO stores (owner_id, name, slug, active)
SELECT DISTINCT
  p.shopkeeper_id,
  COALESCE(NULLIF(pr.display_name, ''), 'Tienda ' || left(p.shopkeeper_id::text, 8)),
  'store-' || left(p.shopkeeper_id::text, 8),
  true
FROM products p
LEFT JOIN profiles pr ON pr.id = p.shopkeeper_id
WHERE p.shopkeeper_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM stores s WHERE s.owner_id = p.shopkeeper_id);

UPDATE products p
  SET store_id = s.id
FROM stores s
WHERE s.owner_id = p.shopkeeper_id AND p.store_id IS NULL;

-- ---------------------------------------------------------------------
-- 2. PUBLIC marketplace surface. security_invoker => caller RLS applies;
--    products RLS already exposes active rows to everyone (incl. anon).
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public_catalog;
CREATE VIEW public_catalog WITH (security_invoker = true) AS
SELECT
  p.id, p.title, p.description, p.image_url, p.thumbnail_url,
  p.price_cents, p.currency, p.settle_token, p.stock,
  p.category, p.brand, p.rating, p.discount_percentage, p.tags,
  p.price_cop, p.price_cusd, p.created_at,
  p.store_id, p.shopkeeper_id,
  s.name AS store_name, s.slug AS store_slug
FROM products p
LEFT JOIN stores s ON s.id = p.store_id
WHERE p.active = true;

GRANT SELECT ON public_catalog TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. PRIVATE dashboard surface. security_invoker => products RLS applies,
--    and the WHERE auth.uid() guarantees a shopkeeper only ever sees their
--    own rows (active OR paused). No global catalog can leak through here.
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS my_store_products;
CREATE VIEW my_store_products WITH (security_invoker = true) AS
SELECT p.*
FROM products p
WHERE p.shopkeeper_id = auth.uid();

GRANT SELECT ON my_store_products TO authenticated;
