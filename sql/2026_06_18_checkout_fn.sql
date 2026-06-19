-- Direct-purchase checkout: atomic cart -> order(s) conversion.
-- Wholesale rule: a purchase is single-shopkeeper, so a cart with items from
-- multiple shopkeepers produces one order per shopkeeper. Stock is reserved
-- atomically inside the transaction; if any item is short, the whole checkout
-- rolls back (no oversell, no partial orders).

-- Allow the BUYER to create their own direct/agent orders. The offer flow
-- (source='offer') still inserts via the seller policy; permissive policies OR.
DROP POLICY IF EXISTS orders_buyer_insert ON orders;
CREATE POLICY orders_buyer_insert ON orders FOR INSERT WITH CHECK (
  client_id = auth.uid() AND source IN ('direct','agent')
);

CREATE OR REPLACE FUNCTION checkout_cart(p_shipping_address text)
RETURNS TABLE (order_id uuid, shopkeeper_id uuid, total_cusd_wei numeric, purchase_ref text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cart_id uuid;
  v_grp RECORD;
  v_item RECORD;
  v_order_id uuid;
  v_total numeric(78,0);
  v_qty integer;
  v_ref text;
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

  -- One order per shopkeeper (single-shopkeeper purchase rule).
  FOR v_grp IN
    SELECT ci.shopkeeper_id AS sk
    FROM cart_items ci
    WHERE ci.cart_id = v_cart_id
    GROUP BY ci.shopkeeper_id
  LOOP
    v_total := 0;
    v_qty := 0;

    -- Reserve stock for every line of this shopkeeper before creating the order.
    FOR v_item IN
      SELECT ci.product_id, ci.quantity, ci.unit_price_cents, ci.currency,
             ci.unit_price_cusd_wei
      FROM cart_items ci
      WHERE ci.cart_id = v_cart_id
        AND ci.shopkeeper_id IS NOT DISTINCT FROM v_grp.sk
    LOOP
      UPDATE products
        SET stock = stock - v_item.quantity
        WHERE id = v_item.product_id AND active = true AND stock >= v_item.quantity;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'insufficient_stock:%', v_item.product_id;
      END IF;
      v_total := v_total + (v_item.unit_price_cusd_wei * v_item.quantity);
      v_qty := v_qty + v_item.quantity;
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
    SELECT v_order_id, ci.product_id, ci.shopkeeper_id, p.title, ci.quantity,
           ci.unit_price_cents, ci.currency, ci.unit_price_cusd_wei,
           ci.unit_price_cusd_wei * ci.quantity
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.cart_id = v_cart_id
      AND ci.shopkeeper_id IS NOT DISTINCT FROM v_grp.sk;

    INSERT INTO order_events (order_id, actor_id, event_type, payload)
    VALUES (v_order_id, v_uid, 'created',
            jsonb_build_object('status', 'preinscribed', 'source', 'direct', 'total_cusd_wei', v_total::text));

    order_id := v_order_id;
    shopkeeper_id := v_grp.sk;
    total_cusd_wei := v_total;
    purchase_ref := v_ref;
    RETURN NEXT;
  END LOOP;

  -- Close the cart so a fresh one opens on the next add.
  UPDATE carts SET status = 'ordered', updated_at = now() WHERE id = v_cart_id;
END;
$$;
