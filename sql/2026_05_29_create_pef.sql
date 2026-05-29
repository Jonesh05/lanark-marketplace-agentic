-- Migration: create purchase_execution_flash table
-- Run on dev/staging first. This creates a minimal PEF table to capture purchase intents.

CREATE TABLE IF NOT EXISTS purchase_execution_flash (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  unit_price_cusd_micro bigint NOT NULL,
  address_hash text NOT NULL,
  intent_text text,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pef_status_idx ON purchase_execution_flash (status);
CREATE INDEX IF NOT EXISTS pef_product_idx ON purchase_execution_flash (product_id);
