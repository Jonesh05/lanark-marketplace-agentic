-- Authoritative checkout pricing.
--
-- Problem: checkout_cart trusted cart_items.unit_price_cusd_wei (a separately
-- cached value). When that cache was written wrong by an older/agent path, the
-- order inherited a mis-scaled total (e.g. 2.5e12 wei instead of 3e18) or a
-- silent 0. The cents+currency snapshot on the cart row is the real record of
-- what the buyer agreed to, so the cUSD wei must be DERIVED from it (or from the
-- live product's explicit price_cusd), never from the cached wei.
--
-- This mirrors lib/pricing.ts productUnitPriceWei exactly:
--   prefer price_cusd (decimal cUSD) * 1e18
--   else USD cents * 1e16            (cents/100 * 1e18)
--   else COP cents * 1e18 / 400000   (cents/100 / 4000 * 1e18)
-- and RAISES on an unpriced line instead of creating a 0-total order.

CREATE OR REPLACE FUNCTION public.checkout_cart(p_shipping_address text)
 RETURNS TABLE(order_id uuid, shopkeeper_id uuid, total_cusd_wei numeric, purchase_ref text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_cart_id   uuid;
  v_grp       RECORD;
  v_item      RECORD;
  v_order_id  uuid;
  v_total     numeric(78,0);
  v_qty       integer;
  v_ref       text;
  v_price_wei numeric(78,0);
  v_cents     numeric;
  v_curr      text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT id INTO v_cart_id FROM carts
    WHERE user_id = v_uid AND status = 'open'
    FOR UPDATE;
  IF v_cart_id IS NULL THEN
    RAISE EXCEPTION 'empty_cart';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cart_items WHERE cart_id = v_cart_id) THEN
    RAISE EXCEPTION 'empty_cart';
  END IF;

  FOR v_grp IN
    SELECT ci.shopkeeper_id AS sk
    FROM cart_items ci
    WHERE ci.cart_id = v_cart_id
    GROUP BY ci.shopkeeper_id
  LOOP
    v_total := 0;
    v_qty   := 0;

    FOR v_item IN
      SELECT ci.product_id, ci.quantity,
             ci.unit_price_cents, ci.currency,
             p.price_cusd          AS p_cusd,
             p.price_cents         AS p_price_cents,
             p.currency            AS p_currency
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.cart_id = v_cart_id
        AND ci.shopkeeper_id IS NOT DISTINCT FROM v_grp.sk
    LOOP
      UPDATE products
        SET stock = stock - v_item.quantity
        WHERE id = v_item.product_id
          AND active = true
          AND stock >= v_item.quantity;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'insufficient_stock:%', v_item.product_id;
      END IF;

      -- Derive wei from the snapshot/canonical price; never from a cached wei.
      IF v_item.p_cusd IS NOT NULL AND v_item.p_cusd > 0 THEN
        v_price_wei := (v_item.p_cusd * 1000000000000000000)::numeric(78,0);
      ELSE
        v_cents := COALESCE(NULLIF(v_item.unit_price_cents, 0), v_item.p_price_cents);
        v_curr  := COALESCE(NULLIF(v_item.currency, ''), v_item.p_currency);
        IF v_curr = 'USD' THEN
          v_price_wei := (v_cents * 10000000000000000)::numeric(78,0);
        ELSIF v_curr = 'COP' THEN
          v_price_wei := (v_cents * 1000000000000000000 / 400000)::numeric(78,0);
        ELSE
          v_price_wei := 0;
        END IF;
      END IF;

      IF v_price_wei IS NULL OR v_price_wei <= 0 THEN
        RAISE EXCEPTION 'unpriced_product:%', v_item.product_id;
      END IF;

      v_total := v_total + (v_price_wei * v_item.quantity);
      v_qty   := v_qty   + v_item.quantity;
    END LOOP;

    v_ref := 'LNK-' || to_char(now(), 'YYMMDD') || '-' ||
             upper(substr(md5(random()::text), 1, 6));

    INSERT INTO orders (
      client_id, shopkeeper_id, source, status, qty,
      amount_cusd_wei, total_cusd_wei, shipping_address, purchase_ref
    ) VALUES (
      v_uid, v_grp.sk, 'direct', 'preinscribed', v_qty,
      v_total, v_total, p_shipping_address, v_ref
    ) RETURNING id INTO v_order_id;

    INSERT INTO order_items (
      order_id, product_id, shopkeeper_id, title_snapshot, quantity,
      unit_price_cents, currency, unit_price_cusd_wei, line_total_cusd_wei
    )
    SELECT
      v_order_id,
      ci.product_id,
      ci.shopkeeper_id,
      p.title,
      ci.quantity,
      ci.unit_price_cents,
      ci.currency,
      CASE
        WHEN p.price_cusd IS NOT NULL AND p.price_cusd > 0
          THEN (p.price_cusd * 1000000000000000000)::numeric(78,0)
        WHEN COALESCE(NULLIF(ci.currency,''), p.currency) = 'USD'
          THEN (COALESCE(NULLIF(ci.unit_price_cents,0), p.price_cents)::numeric * 10000000000000000)::numeric(78,0)
        WHEN COALESCE(NULLIF(ci.currency,''), p.currency) = 'COP'
          THEN (COALESCE(NULLIF(ci.unit_price_cents,0), p.price_cents)::numeric * 1000000000000000000 / 400000)::numeric(78,0)
        ELSE 0
      END,
      CASE
        WHEN p.price_cusd IS NOT NULL AND p.price_cusd > 0
          THEN (p.price_cusd * 1000000000000000000 * ci.quantity)::numeric(78,0)
        WHEN COALESCE(NULLIF(ci.currency,''), p.currency) = 'USD'
          THEN (COALESCE(NULLIF(ci.unit_price_cents,0), p.price_cents)::numeric * 10000000000000000 * ci.quantity)::numeric(78,0)
        WHEN COALESCE(NULLIF(ci.currency,''), p.currency) = 'COP'
          THEN (COALESCE(NULLIF(ci.unit_price_cents,0), p.price_cents)::numeric * 1000000000000000000 / 400000 * ci.quantity)::numeric(78,0)
        ELSE 0
      END
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.cart_id = v_cart_id
      AND ci.shopkeeper_id IS NOT DISTINCT FROM v_grp.sk;

    INSERT INTO order_events (order_id, actor_id, event_type, payload)
    VALUES (v_order_id, v_uid, 'created',
            jsonb_build_object(
              'status', 'preinscribed',
              'source', 'direct',
              'total_cusd_wei', v_total::text
            ));

    order_id      := v_order_id;
    shopkeeper_id := v_grp.sk;
    total_cusd_wei := v_total;
    purchase_ref  := v_ref;
    RETURN NEXT;
  END LOOP;

  UPDATE carts SET status = 'ordered', updated_at = now()
    WHERE id = v_cart_id;
END;
$function$;

-- Backfill: recompute wei on order_items and orders for UNPAID orders only
-- (preinscribed/pending, no escrow). Paid/escrowed/settled orders are left
-- untouched so committed amounts never change under a buyer.
WITH canon AS (
  SELECT
    oi.id AS oi_id,
    oi.order_id,
    (CASE
       WHEN p.price_cusd IS NOT NULL AND p.price_cusd > 0
         THEN (p.price_cusd * 1000000000000000000)::numeric(78,0)
       WHEN COALESCE(NULLIF(oi.currency,''), p.currency) = 'USD'
         THEN (COALESCE(NULLIF(oi.unit_price_cents,0), p.price_cents)::numeric * 10000000000000000)::numeric(78,0)
       WHEN COALESCE(NULLIF(oi.currency,''), p.currency) = 'COP'
         THEN (COALESCE(NULLIF(oi.unit_price_cents,0), p.price_cents)::numeric * 1000000000000000000 / 400000)::numeric(78,0)
       ELSE 0
     END) AS unit_wei,
    oi.quantity
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  JOIN orders o ON o.id = oi.order_id
  WHERE o.status IN ('preinscribed','pending')
    AND o.escrow_address IS NULL
)
UPDATE order_items oi
   SET unit_price_cusd_wei = c.unit_wei,
       line_total_cusd_wei = c.unit_wei * c.quantity
  FROM canon c
 WHERE oi.id = c.oi_id
   AND c.unit_wei > 0;

UPDATE orders o
   SET total_cusd_wei = s.tot,
       amount_cusd_wei = s.tot
  FROM (
    SELECT order_id, SUM(line_total_cusd_wei)::numeric(78,0) AS tot
    FROM order_items
    GROUP BY order_id
  ) s
 WHERE o.id = s.order_id
   AND o.status IN ('preinscribed','pending')
   AND o.escrow_address IS NULL
   AND s.tot > 0
   AND o.total_cusd_wei IS DISTINCT FROM s.tot;
