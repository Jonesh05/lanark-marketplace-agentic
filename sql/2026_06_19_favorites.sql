-- Client-side "favorite products" — a durable save signal, distinct from
-- cart_items (purchase intent, quantity > 0 constraint) and from
-- purchase_execution_flash (time-boxed purchase intent with expiry).
-- Modeled as its own table (not an array column on profiles) so a hard
-- product delete cascades and cleans up automatically, with no orphaned ids
-- to filter defensively at read time.
--
-- Same RLS shape as `carts`: a single owner-scoped FOR ALL policy.

CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_idx ON favorites (user_id);
CREATE INDEX IF NOT EXISTS favorites_product_idx ON favorites (product_id);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS favorites_owner ON favorites;
CREATE POLICY favorites_owner ON favorites
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
