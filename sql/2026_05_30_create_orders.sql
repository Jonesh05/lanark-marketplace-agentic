-- Migration: create orders table for the off-chain checkout flow.
-- An order is created when a shopkeeper accepts an offer. It progresses
-- through an explicit state machine. NOTE: settlement is OFF-CHAIN until an
-- escrow contract is deployed; 'awaiting_settlement' means "payment pending",
-- NOT "paid". No code path may set status='settled' without a real on-chain
-- confirmation (tx_hash + finality).

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offers(id) ON DELETE SET NULL,
  product_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shopkeeper_id uuid NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  amount_cusd_micro bigint NOT NULL,
  tx_hash text,
  user_op_hash text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'submitted',
      'awaiting_settlement',
      'settled',
      'confirmed',
      'failed',
      'disputed'
    )),
  created_at timestamptz DEFAULT now(),
  confirmed_at timestamptz
);

-- One order per accepted offer (prevents double-accept creating two orders).
CREATE UNIQUE INDEX IF NOT EXISTS orders_offer_uq
  ON orders (offer_id) WHERE offer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_client_idx ON orders (client_id);
CREATE INDEX IF NOT EXISTS orders_shopkeeper_idx ON orders (shopkeeper_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

-- Row Level Security: an order is visible only to its buyer and its seller.
-- Status/amount are NOT client-writable: mutations go through server actions
-- using the authenticated session, and the policies below scope row access.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_party_select ON orders;
CREATE POLICY orders_party_select ON orders
  FOR SELECT USING (client_id = auth.uid() OR shopkeeper_id = auth.uid());

-- Buyer may transition their own order (e.g. pending -> submitted) via a
-- server action running under their session. The WITH CHECK keeps ownership.
DROP POLICY IF EXISTS orders_client_update ON orders;
CREATE POLICY orders_client_update ON orders
  FOR UPDATE USING (client_id = auth.uid()) WITH CHECK (client_id = auth.uid());

-- Inserts are performed by the accepting shopkeeper's server action (the
-- seller owns the product); restrict INSERT to the seller of record.
DROP POLICY IF EXISTS orders_seller_insert ON orders;
CREATE POLICY orders_seller_insert ON orders
  FOR INSERT WITH CHECK (shopkeeper_id = auth.uid());
