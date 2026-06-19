-- PostgREST resource embedding (e.g. `cart_items -> products(...)`) only works
-- when a real foreign key exists between the two tables. `cart_items.product_id`
-- and `order_items.product_id` were created WITHOUT that foreign key, so any
-- embedded read raised a relationship error (PGRST200). The cart page swallowed
-- that error, leaving `groups = []`, so the cart rendered EMPTY even though the
-- buyer had items (the header badge, which does not embed, still showed a count).
--
-- This adds the missing foreign keys so the embed resolves. Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.cart_items'::regclass
      AND contype = 'f'
      AND confrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.order_items'::regclass
      AND contype = 'f'
      AND confrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make PostgREST pick up the new relationships immediately.
NOTIFY pgrst, 'reload schema';
