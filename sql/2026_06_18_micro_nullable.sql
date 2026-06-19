-- LANARK money model: amount_cusd_wei (numeric 78,0) is the functional base.
-- amount_cusd_micro (bigint) is legacy, kept only for rollback. New writes
-- only populate _wei, so the legacy NOT NULL constraint must be dropped.
-- This is reversible: re-add NOT NULL only after backfilling _micro from _wei.

ALTER TABLE offers ALTER COLUMN amount_cusd_micro DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN amount_cusd_micro DROP NOT NULL;

-- Keep the legacy column consistent for any rollback path: backfill micros
-- from wei where wei exists and micro is null (wei = micro * 10^12).
UPDATE offers
  SET amount_cusd_micro = (amount_cusd_wei / 1000000000000)::bigint
  WHERE amount_cusd_micro IS NULL AND amount_cusd_wei IS NOT NULL;
UPDATE orders
  SET amount_cusd_micro = (amount_cusd_wei / 1000000000000)::bigint
  WHERE amount_cusd_micro IS NULL AND amount_cusd_wei IS NOT NULL;
