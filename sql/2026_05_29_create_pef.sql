-- Migration: create purchase_execution_flash table
-- Run on dev/staging first. This creates a minimal PEF table to capture purchase intents.

CREATE TABLE IF NOT EXISTS purchase_execution_flash (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  unit_price_cusd_micro bigint NOT NULL,
  address_hash text NOT NULL,
  intent_text text,
  status text NOT NULL DEFAULT 'pending',
  idempotency_key text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Backfill for tables created before user_id existed.
ALTER TABLE purchase_execution_flash ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE purchase_execution_flash ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE INDEX IF NOT EXISTS pef_status_idx ON purchase_execution_flash (status);
CREATE INDEX IF NOT EXISTS pef_product_idx ON purchase_execution_flash (product_id);
CREATE INDEX IF NOT EXISTS pef_user_idx ON purchase_execution_flash (user_id);

-- Idempotency uniqueness scoped per user.
CREATE UNIQUE INDEX IF NOT EXISTS pef_user_idem_uq
  ON purchase_execution_flash (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Row Level Security: a PEF holds the buyer's wallet hash and purchase
-- intent (PII under Ley 1581 / GDPR). Each user may only read/write their own.
ALTER TABLE purchase_execution_flash ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pef_owner_select ON purchase_execution_flash;
CREATE POLICY pef_owner_select ON purchase_execution_flash
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS pef_owner_insert ON purchase_execution_flash;
CREATE POLICY pef_owner_insert ON purchase_execution_flash
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS pef_owner_update ON purchase_execution_flash;
CREATE POLICY pef_owner_update ON purchase_execution_flash
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
