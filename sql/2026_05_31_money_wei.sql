-- Migration: move the functional money base unit from 6-decimal "micros" to
-- on-chain cUSD wei (18 decimals). cUSD on Celo has 18 decimals; storing micros
-- as the base forced a 10^12 bridge on every settlement comparison and risked
-- moving 10^12-times-wrong amounts. numeric(78,0) holds a full uint256.
--
-- Backfill rule: wei = micro * 10^12. Run AFTER the offers/orders/pef tables
-- exist. Idempotent: only fills rows where the wei column is still null.

-- offers (DDL not tracked in this repo; column added defensively)
ALTER TABLE offers ADD COLUMN IF NOT EXISTS amount_cusd_wei numeric(78,0);
UPDATE offers
  SET amount_cusd_wei = (amount_cusd_micro::numeric * 1000000000000)
  WHERE amount_cusd_wei IS NULL AND amount_cusd_micro IS NOT NULL;

-- orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_cusd_wei numeric(78,0);
UPDATE orders
  SET amount_cusd_wei = (amount_cusd_micro::numeric * 1000000000000)
  WHERE amount_cusd_wei IS NULL AND amount_cusd_micro IS NOT NULL;

-- purchase_execution_flash: the real table stores a human cUSD price in
-- `unit_price_cusd` (numeric). Derive wei = price * 10^18.
ALTER TABLE purchase_execution_flash
  ADD COLUMN IF NOT EXISTS unit_price_cusd_wei numeric(78,0);
UPDATE purchase_execution_flash
  SET unit_price_cusd_wei = round(unit_price_cusd * 1000000000000000000)
  WHERE unit_price_cusd_wei IS NULL AND unit_price_cusd IS NOT NULL;

-- New writes target the wei columns. The legacy *_micro columns are kept for
-- one release for rollback safety; drop them in a later migration once all
-- code paths read/write wei (this migration is the cutover point).
