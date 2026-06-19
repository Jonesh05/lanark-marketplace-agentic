-- Migration: on-chain escrow settlement tracking + event log + notifications.
--
-- Closes the settlement loop: an order now records the escrow clone address,
-- the buyer's deposit tx, and the worker's release tx. Status can finally reach
-- 'settled' once a real on-chain release is observed (tx_hash + finality), per
-- the honesty rule in 2026_05_30_create_orders.sql.

-- 1) Escrow / transaction tracking columns on orders. -----------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS escrow_address   text,
  ADD COLUMN IF NOT EXISTS deposit_tx_hash  text,
  ADD COLUMN IF NOT EXISTS release_tx_hash  text,
  ADD COLUMN IF NOT EXISTS settled_at       timestamptz;

COMMENT ON COLUMN orders.escrow_address  IS 'EIP-1167 escrow clone deployed for this order (orderRef = order id).';
COMMENT ON COLUMN orders.deposit_tx_hash IS 'Buyer deposit tx that funded the escrow (real on-chain hash).';
COMMENT ON COLUMN orders.release_tx_hash IS 'Worker/seller release tx that paid the seller (real on-chain hash).';

-- Keep the canonical status enum complete (idempotent re-assert).
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'preinscribed',
  'pending',
  'submitted',
  'awaiting_settlement', -- escrow created, awaiting buyer deposit
  'escrowed',            -- buyer deposit confirmed on-chain (funds in escrow)
  'settled',             -- released to seller on-chain (final)
  'confirmed',
  'failed',
  'disputed',
  'cancelled'
));

-- 2) order_events: the per-order audit timeline. Code already INSERTs here
--    (app/actions/orders.ts, checkout.ts) but the table was never defined in
--    the repo. Create it idempotently with party-scoped RLS.
CREATE TABLE IF NOT EXISTS order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  tx_hash text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_id, created_at);

ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_events_party_read ON order_events;
CREATE POLICY order_events_party_read ON order_events FOR SELECT USING (
  order_id IN (SELECT id FROM orders WHERE client_id = auth.uid() OR shopkeeper_id = auth.uid())
);

DROP POLICY IF EXISTS order_events_party_insert ON order_events;
CREATE POLICY order_events_party_insert ON order_events FOR INSERT WITH CHECK (
  order_id IN (SELECT id FROM orders WHERE client_id = auth.uid() OR shopkeeper_id = auth.uid())
);

-- 3) notifications: an append-only log of outbound user notifications (e.g. the
--    purchase-confirmation message sent to profiles.phone). Decouples "we
--    intended to notify" from "the provider accepted it" so the flow is
--    auditable even before an SMS/WhatsApp provider is wired.
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'sms',          -- sms | whatsapp | email | inapp
  kind text NOT NULL,                            -- order_paid | order_settled | ...
  destination text,                              -- masked phone/email at send time
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued'          -- queued | sent | failed | skipped
    CHECK (status IN ('queued','sent','failed','skipped')),
  provider text,                                 -- twilio | whatsapp | none | ...
  provider_ref text,                             -- provider message id
  error text,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_owner_read ON notifications;
CREATE POLICY notifications_owner_read ON notifications FOR SELECT USING (
  user_id = auth.uid()
);
-- Inserts are performed server-side by the settlement flow using the service
-- role (bypasses RLS); no client INSERT policy is granted on purpose.
