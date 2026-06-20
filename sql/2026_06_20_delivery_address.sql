-- Persist the buyer's delivery address on their profile so it becomes the
-- reusable default at checkout and can be reused by the agent ("my usual
-- address"). The per-order shipping address (orders.shipping_address) stays the
-- immutable record of where each order shipped; this column is only the
-- reusable default and is never settlement- or chain-relevant.
alter table public.profiles
  add column if not exists delivery_address text;
