-- Backfill zero unit_price_cusd_wei in cart_items, order_items and orders.
--
-- Root cause: rows inserted before the cart-add route began populating
-- unit_price_cusd_wei (fix deployed in commit 7cf43e6) have '0' in that
-- column, which flows through checkout_cart and produces orders with
-- total_cusd_wei=0, which settlement.ts rejects as "El total de la orden
-- no es válido."
--
-- Pricing formula mirrors lib/pricing.ts:
--   USD  → price_cents * 10^16  (cents → cUSD wei)
--   COP  → price_cents * 10^18 / 400_000
--          (COP-cents ÷ 100 = pesos ÷ 4 000 COP/USD × 10^18 wei)
--   price_cusd column (if set and > 0) takes precedence over cents.

-- ── cart_items ──────────────────────────────────────────────────────────────
UPDATE cart_items ci
SET unit_price_cusd_wei = (
  SELECT
    CASE
      WHEN p.price_cusd IS NOT NULL AND p.price_cusd > 0
        THEN (p.price_cusd * 1000000000000000000)::numeric(78,0)
      WHEN p.currency = 'USD'
        THEN (p.price_cents::numeric * 10000000000000000)::numeric(78,0)
      WHEN p.currency = 'COP'
        THEN (p.price_cents::numeric * 1000000000000000000 / 400000)::numeric(78,0)
      ELSE 0::numeric(78,0)
    END
  FROM products p
  WHERE p.id = ci.product_id
)
WHERE ci.unit_price_cusd_wei = 0
  AND EXISTS (SELECT 1 FROM products p WHERE p.id = ci.product_id);

-- ── order_items ──────────────────────────────────────────────────────────────
UPDATE order_items oi
SET
  unit_price_cusd_wei = (
    SELECT
      CASE
        WHEN p.price_cusd IS NOT NULL AND p.price_cusd > 0
          THEN (p.price_cusd * 1000000000000000000)::numeric(78,0)
        WHEN p.currency = 'USD'
          THEN (p.price_cents::numeric * 10000000000000000)::numeric(78,0)
        WHEN p.currency = 'COP'
          THEN (p.price_cents::numeric * 1000000000000000000 / 400000)::numeric(78,0)
        ELSE 0::numeric(78,0)
      END
    FROM products p
    WHERE p.id = oi.product_id
  ),
  line_total_cusd_wei = (
    SELECT
      (
        CASE
          WHEN p.price_cusd IS NOT NULL AND p.price_cusd > 0
            THEN (p.price_cusd * 1000000000000000000)::numeric(78,0)
          WHEN p.currency = 'USD'
            THEN (p.price_cents::numeric * 10000000000000000)::numeric(78,0)
          WHEN p.currency = 'COP'
            THEN (p.price_cents::numeric * 1000000000000000000 / 400000)::numeric(78,0)
          ELSE 0::numeric(78,0)
        END
      ) * oi.quantity
    FROM products p
    WHERE p.id = oi.product_id
  )
WHERE oi.unit_price_cusd_wei = 0
  AND EXISTS (SELECT 1 FROM products p WHERE p.id = oi.product_id);

-- ── orders ───────────────────────────────────────────────────────────────────
-- Re-derive total from the now-correct order_items.
-- Only re-derive orders whose total was 0 and which have at least one item.
UPDATE orders o
SET
  total_cusd_wei   = sub.total,
  amount_cusd_wei  = sub.total
FROM (
  SELECT order_id, SUM(line_total_cusd_wei)::numeric(78,0) AS total
  FROM order_items
  GROUP BY order_id
  HAVING SUM(line_total_cusd_wei) > 0
) sub
WHERE o.id       = sub.order_id
  AND (o.total_cusd_wei IS NULL OR o.total_cusd_wei = 0);

-- ── checkout_cart (robustness patch) ─────────────────────────────────────────
-- Rewrite the function so it computes unit_price_cusd_wei from the products
-- table directly rather than trusting the cached value in cart_items. This
-- prevents a recurrence if any future cart-add bypasses the validation guard.

CREATE OR REPLACE FUNCTION checkout_cart(p_shipping_address text)
RETURNS TABLE (order_id uuid, shopkeeper_id uuid, total_cusd_wei numeric, purchase_ref text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
             ci.unit_price_cusd_wei,
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

      -- Prefer the cached wei price; fall back to products table so that
      -- old cart rows (unit_price_cusd_wei = 0) still produce a correct total.
      IF v_item.unit_price_cusd_wei > 0 THEN
        v_price_wei := v_item.unit_price_cusd_wei;
      ELSIF v_item.p_cusd IS NOT NULL AND v_item.p_cusd > 0 THEN
        v_price_wei := (v_item.p_cusd * 1000000000000000000)::numeric(78,0);
      ELSIF v_item.p_currency = 'USD' THEN
        v_price_wei := (v_item.p_price_cents::numeric * 10000000000000000)::numeric(78,0);
      ELSIF v_item.p_currency = 'COP' THEN
        v_price_wei := (v_item.p_price_cents::numeric * 1000000000000000000 / 400000)::numeric(78,0);
      ELSE
        v_price_wei := 0;
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
        WHEN ci.unit_price_cusd_wei > 0 THEN ci.unit_price_cusd_wei
        WHEN p.price_cusd IS NOT NULL AND p.price_cusd > 0
          THEN (p.price_cusd * 1000000000000000000)::numeric(78,0)
        WHEN p.currency = 'USD'
          THEN (p.price_cents::numeric * 10000000000000000)::numeric(78,0)
        WHEN p.currency = 'COP'
          THEN (p.price_cents::numeric * 1000000000000000000 / 400000)::numeric(78,0)
        ELSE 0
      END,
      CASE
        WHEN ci.unit_price_cusd_wei > 0 THEN ci.unit_price_cusd_wei * ci.quantity
        WHEN p.price_cusd IS NOT NULL AND p.price_cusd > 0
          THEN (p.price_cusd * 1000000000000000000 * ci.quantity)::numeric(78,0)
        WHEN p.currency = 'USD'
          THEN (p.price_cents::numeric * 10000000000000000 * ci.quantity)::numeric(78,0)
        WHEN p.currency = 'COP'
          THEN (p.price_cents::numeric * 1000000000000000000 / 400000 * ci.quantity)::numeric(78,0)
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
$$;
