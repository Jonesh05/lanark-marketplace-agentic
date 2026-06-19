-- LANARK commerce model: pivot from offer-first monoproduct to direct-purchase
-- wholesale, multi-tenant, multi-item. ADDITIVE and IDEMPOTENT: existing
-- offer->order flow keeps working (orders.product_id stays populated for
-- single-item orders); multi-item orders also write order_items.
--
-- Money base unit: cUSD wei (numeric 78,0), consistent with amount_cusd_wei.
-- On-chain = sale settlement + value record (order_events.tx_hash). Off-chain =
-- cart, purchases, history. PII (shipping address) stays off-chain, minimized.

-- =====================================================================
-- 1. STORES / TENANT (additive; does not break products.shopkeeper_id)
-- =====================================================================
CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,                      -- profiles.id / auth.users.id
  name text NOT NULL,
  slug text UNIQUE,
  description text,
  logo_url text,
  country text DEFAULT 'CO',
  tax_id text,                                 -- NIT/RUT for invoicing (off-chain)
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stores_owner_idx ON stores (owner_id);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
-- Anyone can read an active store (public storefront); only the owner writes.
DROP POLICY IF EXISTS stores_public_read ON stores;
CREATE POLICY stores_public_read ON stores FOR SELECT USING (active = true OR owner_id = auth.uid());
DROP POLICY IF EXISTS stores_owner_write ON stores;
CREATE POLICY stores_owner_write ON stores FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Link products to a store without breaking the existing shopkeeper_id column.
ALTER TABLE products ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS products_store_idx ON products (store_id);

-- =====================================================================
-- 2. PERSISTENT CART (replaces the missing shopping_lists table)
-- =====================================================================
CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','ordered','abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- One open cart per user.
CREATE UNIQUE INDEX IF NOT EXISTS carts_one_open_per_user
  ON carts (user_id) WHERE status = 'open';

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS carts_owner ON carts;
CREATE POLICY carts_owner ON carts FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  shopkeeper_id uuid,                          -- denormalized for provider grouping
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  -- price snapshot at add-time (final price, no negotiation)
  unit_price_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  unit_price_cusd_wei numeric(78,0) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, product_id)
);
CREATE INDEX IF NOT EXISTS cart_items_cart_idx ON cart_items (cart_id);

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cart_items_owner ON cart_items;
CREATE POLICY cart_items_owner ON cart_items FOR ALL USING (
  cart_id IN (SELECT id FROM carts WHERE user_id = auth.uid())
) WITH CHECK (
  cart_id IN (SELECT id FROM carts WHERE user_id = auth.uid())
);

-- =====================================================================
-- 3. MULTI-ITEM ORDERS (order_items + order header extensions)
-- =====================================================================
-- Relax single-product NOT NULL so multi-item orders are representable.
-- Single-item (offer) orders keep product_id populated for back-compat.
ALTER TABLE orders ALTER COLUMN product_id DROP NOT NULL;

-- Order header extensions (all additive / nullable).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'offer'
  CHECK (source IN ('offer','direct','agent'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_cusd_wei numeric(78,0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_cost_cusd_wei numeric(78,0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address text;     -- off-chain PII, minimized
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address_hash text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS purchase_ref text;          -- human purchase ID

-- Add 'preinscribed' to the status state machine (agent-prepared, pre-payment).
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'preinscribed',        -- order prepared (seller+address+wallet), awaiting authorize
  'pending',             -- buyer authorized, signing
  'submitted',
  'awaiting_settlement', -- payment pending, NOT paid
  'settled',
  'confirmed',
  'failed',
  'disputed',
  'cancelled'
));

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  shopkeeper_id uuid,
  store_id uuid,
  title_snapshot text NOT NULL,                -- commercial snapshot at purchase time
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  unit_price_cusd_wei numeric(78,0) NOT NULL,
  line_total_cusd_wei numeric(78,0) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_idx ON order_items (product_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
-- Visible to the order's parties (buyer or seller of the parent order).
DROP POLICY IF EXISTS order_items_party_read ON order_items;
CREATE POLICY order_items_party_read ON order_items FOR SELECT USING (
  order_id IN (SELECT id FROM orders WHERE client_id = auth.uid() OR shopkeeper_id = auth.uid())
);
-- Inserts go through server actions under the buyer's session at checkout.
DROP POLICY IF EXISTS order_items_buyer_insert ON order_items;
CREATE POLICY order_items_buyer_insert ON order_items FOR INSERT WITH CHECK (
  order_id IN (SELECT id FROM orders WHERE client_id = auth.uid())
);

-- =====================================================================
-- 4. ATOMIC STOCK RESERVATION (prevents oversell on concurrent checkout)
-- =====================================================================
-- Decrement stock only if enough is available; returns true on success.
-- Used inside the checkout transaction so two concurrent buyers cannot
-- oversell the same unit (row lock via the conditional UPDATE).
CREATE OR REPLACE FUNCTION reserve_stock(p_product_id uuid, p_qty integer)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  updated integer;
BEGIN
  UPDATE products
    SET stock = stock - p_qty
    WHERE id = p_product_id AND active = true AND stock >= p_qty;
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated = 1;
END;
$$;
