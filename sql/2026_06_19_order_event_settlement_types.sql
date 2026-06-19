-- Settlement writes these order_events from app/actions/settlement.ts.
-- The previous CHECK constraint did not include them, so escrow/deposit/release
-- traces were rejected by the database and the payment flow lost observability.

alter table public.order_events
  drop constraint if exists order_events_event_type_check;

alter table public.order_events
  add constraint order_events_event_type_check
  check (event_type = any (array[
    'created',
    'accepted',
    'rejected',
    'paid',
    'shipped',
    'delivered',
    'disputed',
    'resolved',
    'cancelled',
    'refunded',
    'escrow_created',
    'deposit_submitted',
    'deposited',
    'settled'
  ]));
