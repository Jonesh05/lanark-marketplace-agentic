-- Order fulfillment lifecycle for the shopkeeper side.
--
-- Rationale: `orders.status` tracks the PAYMENT/chain lifecycle
-- (preinscribed -> pending -> awaiting_settlement -> settled/confirmed).
-- It must NOT be overloaded with seller fulfillment. We add a separate
-- `fulfillment_status` column so the shopkeeper can run the operational
-- cycle (review -> accept -> prepare -> dispatch -> deliver) without
-- colliding with settlement state. This keeps chain logic and product
-- logic separated, as required.

alter table public.orders
  add column if not exists fulfillment_status text not null default 'pending_review';

-- Drop a prior version of the constraint if this migration is re-run.
alter table public.orders
  drop constraint if exists orders_fulfillment_status_check;

alter table public.orders
  add constraint orders_fulfillment_status_check
  check (fulfillment_status = any (array[
    'pending_review',
    'accepted',
    'preparing',
    'dispatched',
    'delivered',
    'rejected',
    'cancelled'
  ]));

-- Existing rows predate the column; normalize them to the review queue so
-- the shopkeeper sees them as actionable rather than in a null/unknown state.
update public.orders
  set fulfillment_status = 'pending_review'
  where fulfillment_status is null;

-- Seller dashboard reads orders by shopkeeper, grouped by fulfillment and by
-- payment status, newest first. Two covering indexes keep those hot.
create index if not exists orders_shopkeeper_fulfillment_idx
  on public.orders (shopkeeper_id, fulfillment_status, created_at desc);

create index if not exists orders_shopkeeper_status_idx
  on public.orders (shopkeeper_id, status, created_at desc);

-- Top-products / no-movement metrics scan order_items by shopkeeper.
create index if not exists order_items_shopkeeper_idx
  on public.order_items (shopkeeper_id, created_at desc);
