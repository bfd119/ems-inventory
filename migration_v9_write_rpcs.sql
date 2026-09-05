-- =====================================================
-- migration_v9_write_rpcs.sql
--
-- 目的: すべての書き込み処理を SECURITY DEFINER 関数（RPC）に集約する。
--
-- 背景:
--   このアプリはログイン機能を持たず、配信される app.js から
--   publishable キーを誰でも取得できる。テーブルに直接 INSERT/UPDATE/
--   DELETE を許したままだと、1リクエストで全在庫を消すことも可能。
--   書き込みを決まった手続きだけに限定することで、被害の範囲を絞る。
--
-- このファイルは「関数を追加するだけ」で、既存の権限やデータは変更しない。
-- 適用してもアプリの動作は変わらないため、安全に先行適用できる。
-- 実際に直接書き込みを禁止するのは migration_v10。
--
-- 実行方法: Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- =====================================================

BEGIN;

-- -------------------------------------------------------
-- upsert_stock を SECURITY DEFINER で作り直す
-- migration_v6 で作成したものは呼び出し元の権限で動くため、
-- migration_v10 で RLS を有効にすると動作しなくなる。
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_stock(
    p_department_id INTEGER,
    p_item_id       INTEGER,
    p_expiry_date   DATE,
    p_delta         INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_id  INTEGER;
    v_qty INTEGER;
BEGIN
    IF p_expiry_date IS NULL THEN
        SELECT id, quantity INTO v_id, v_qty FROM public.stocks
        WHERE department_id = p_department_id AND item_id = p_item_id
          AND expiry_date IS NULL FOR UPDATE;
    ELSE
        SELECT id, quantity INTO v_id, v_qty FROM public.stocks
        WHERE department_id = p_department_id AND item_id = p_item_id
          AND expiry_date = p_expiry_date FOR UPDATE;
    END IF;

    IF v_id IS NOT NULL THEN
        IF v_qty + p_delta <= 0 THEN
            DELETE FROM public.stocks WHERE id = v_id;
        ELSE
            UPDATE public.stocks SET quantity = v_qty + p_delta WHERE id = v_id;
        END IF;
    ELSIF p_delta > 0 THEN
        INSERT INTO public.stocks (department_id, item_id, expiry_date, quantity)
        VALUES (p_department_id, p_item_id, p_expiry_date, p_delta);
    END IF;
END;
$$;

-- transfer_stock（migration_v8）も SECURITY DEFINER 済みだが、
-- search_path 設定を明示するため定義を維持する（v8 のまま変更なし）

-- -------------------------------------------------------
-- 在庫の入出庫
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_stock_in(
    p_department_id INTEGER,
    p_item_id       INTEGER,
    p_expiry_date   DATE,
    p_quantity      INTEGER,
    p_remarks       TEXT,
    p_timestamp     TIMESTAMPTZ,
    p_type          TEXT DEFAULT 'IN_BUY'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION '数量は1以上で指定してください';
    END IF;

    PERFORM public.upsert_stock(p_department_id, p_item_id, p_expiry_date, p_quantity);

    INSERT INTO public.transactions
        (department_id, item_id, type, quantity, expiry_date, remarks, timestamp)
    VALUES
        (p_department_id, p_item_id, p_type, p_quantity, p_expiry_date,
         COALESCE(p_remarks, ''), p_timestamp);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_stock_out(
    p_department_id INTEGER,
    p_item_id       INTEGER,
    p_expiry_date   DATE,
    p_quantity      INTEGER,
    p_remarks       TEXT,
    p_timestamp     TIMESTAMPTZ,
    p_type          TEXT DEFAULT 'OUT_USE'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_total  INTEGER;
    v_remain INTEGER;
    r        RECORD;
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION '数量は1以上で指定してください';
    END IF;

    -- 対象ロットを先に排他ロックしてから合計を取る。
    -- PostgreSQL は集計関数と FOR UPDATE を同一の SELECT で併用できないため
    -- （0A000: FOR UPDATE is not allowed with aggregate functions）、2文に分ける。
    PERFORM 1 FROM public.stocks
    WHERE department_id = p_department_id AND item_id = p_item_id
      AND (expiry_date = p_expiry_date OR (expiry_date IS NULL AND p_expiry_date IS NULL))
    FOR UPDATE;

    SELECT COALESCE(SUM(quantity), 0) INTO v_total FROM public.stocks
    WHERE department_id = p_department_id AND item_id = p_item_id
      AND (expiry_date = p_expiry_date OR (expiry_date IS NULL AND p_expiry_date IS NULL));

    IF v_total < p_quantity THEN
        RAISE EXCEPTION '在庫不足';
    END IF;

    -- 古いレコードから順に減算する
    v_remain := p_quantity;
    FOR r IN
        SELECT id, quantity FROM public.stocks
        WHERE department_id = p_department_id AND item_id = p_item_id
          AND (expiry_date = p_expiry_date OR (expiry_date IS NULL AND p_expiry_date IS NULL))
        ORDER BY id
    LOOP
        EXIT WHEN v_remain <= 0;
        IF r.quantity <= v_remain THEN
            DELETE FROM public.stocks WHERE id = r.id;
            v_remain := v_remain - r.quantity;
        ELSE
            UPDATE public.stocks SET quantity = r.quantity - v_remain WHERE id = r.id;
            v_remain := 0;
        END IF;
    END LOOP;

    INSERT INTO public.transactions
        (department_id, item_id, type, quantity, expiry_date, remarks, timestamp)
    VALUES
        (p_department_id, p_item_id, p_type, p_quantity, p_expiry_date,
         COALESCE(p_remarks, ''), p_timestamp);
END;
$$;

-- -------------------------------------------------------
-- 取引履歴の取り消し（在庫のロールバック＋授受ペアの連動削除）
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_transaction(p_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_tx   RECORD;
    v_pair UUID;
    v_id   INTEGER;
    v_qty  INTEGER;
BEGIN
    SELECT * INTO v_tx FROM public.transactions WHERE id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '該当する履歴が見つかりません';
    END IF;
    v_pair := v_tx.transfer_pair_id;

    -- ペアがあれば両方を、無ければ自分だけをロールバックする
    FOR v_tx IN
        SELECT * FROM public.transactions
        WHERE (v_pair IS NOT NULL AND transfer_pair_id = v_pair)
           OR (v_pair IS NULL AND id = p_id)
    LOOP
        IF v_tx.type = 'OUT' OR v_tx.type LIKE 'OUT\_%' THEN
            -- 出庫の取り消し → 在庫を戻す
            PERFORM public.upsert_stock(v_tx.department_id, v_tx.item_id,
                                        v_tx.expiry_date, v_tx.quantity);
        ELSE
            -- 入庫の取り消し → 在庫を減らす
            IF v_tx.expiry_date IS NULL THEN
                SELECT id, quantity INTO v_id, v_qty FROM public.stocks
                WHERE department_id = v_tx.department_id AND item_id = v_tx.item_id
                  AND expiry_date IS NULL FOR UPDATE;
            ELSE
                SELECT id, quantity INTO v_id, v_qty FROM public.stocks
                WHERE department_id = v_tx.department_id AND item_id = v_tx.item_id
                  AND expiry_date = v_tx.expiry_date FOR UPDATE;
            END IF;
            IF v_id IS NOT NULL THEN
                IF v_qty - v_tx.quantity <= 0 THEN
                    DELETE FROM public.stocks WHERE id = v_id;
                ELSE
                    UPDATE public.stocks SET quantity = v_qty - v_tx.quantity WHERE id = v_id;
                END IF;
            END IF;
        END IF;
    END LOOP;

    IF v_pair IS NOT NULL THEN
        DELETE FROM public.transactions WHERE transfer_pair_id = v_pair;
    ELSE
        DELETE FROM public.transactions WHERE id = p_id;
    END IF;
END;
$$;

-- -------------------------------------------------------
-- 在庫ロットの使用期限を変更する
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_stock_expiry(
    p_department_id INTEGER,
    p_item_id       INTEGER,
    p_old_expiry    DATE,
    p_new_expiry    DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_id      INTEGER;
    v_qty     INTEGER;
    v_dest_id INTEGER;
BEGIN
    SELECT id, quantity INTO v_id, v_qty FROM public.stocks
    WHERE department_id = p_department_id AND item_id = p_item_id
      AND (expiry_date = p_old_expiry OR (expiry_date IS NULL AND p_old_expiry IS NULL))
    FOR UPDATE;

    IF v_id IS NULL THEN
        RAISE EXCEPTION '該当する在庫ロットが見つかりません';
    END IF;

    -- 変更先の期限に既存ロットがある場合は数量を合算する
    -- （UNIQUE 制約があるため、そのまま UPDATE すると失敗する）
    SELECT id INTO v_dest_id FROM public.stocks
    WHERE department_id = p_department_id AND item_id = p_item_id
      AND (expiry_date = p_new_expiry OR (expiry_date IS NULL AND p_new_expiry IS NULL))
      AND id <> v_id
    FOR UPDATE;

    IF v_dest_id IS NOT NULL THEN
        UPDATE public.stocks SET quantity = quantity + v_qty WHERE id = v_dest_id;
        DELETE FROM public.stocks WHERE id = v_id;
    ELSE
        UPDATE public.stocks SET expiry_date = p_new_expiry WHERE id = v_id;
    END IF;
END;
$$;

-- -------------------------------------------------------
-- カテゴリ
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_category(
    p_name TEXT, p_icon TEXT, p_type TEXT, p_department_id INTEGER
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r RECORD;
BEGIN
    INSERT INTO public.categories (name, icon, type, department_id)
    VALUES (p_name, COALESCE(NULLIF(p_icon, ''), 'inventory_2'),
            COALESCE(p_type, 'system'), p_department_id)
    RETURNING * INTO r;
    RETURN row_to_json(r);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_category(
    p_id INTEGER, p_name TEXT, p_icon TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r RECORD;
BEGIN
    UPDATE public.categories
    SET name = p_name, icon = COALESCE(NULLIF(p_icon, ''), 'inventory_2')
    WHERE id = p_id
    RETURNING * INTO r;
    IF NOT FOUND THEN RAISE EXCEPTION 'カテゴリが見つかりません'; END IF;
    RETURN row_to_json(r);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_category(p_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- 用品(items)自体は消さない。他カテゴリと共有されている可能性があるため
    DELETE FROM public.item_categories WHERE category_id = p_id;
    UPDATE public.items SET category_id = NULL WHERE category_id = p_id;
    DELETE FROM public.categories WHERE id = p_id;
END;
$$;

-- -------------------------------------------------------
-- 用品
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_item(
    p_category_id     INTEGER,
    p_name            TEXT,
    p_unit            TEXT,
    p_has_expiry      BOOLEAN,
    p_min_stock       INTEGER,
    p_existing_item_id INTEGER DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_item_id INTEGER;
BEGIN
    v_item_id := p_existing_item_id;

    IF v_item_id IS NULL THEN
        INSERT INTO public.items (category_id, name, unit, has_expiry, min_stock)
        VALUES (p_category_id, p_name, COALESCE(NULLIF(p_unit, ''), '個'),
                COALESCE(p_has_expiry, false), COALESCE(p_min_stock, 0))
        RETURNING id INTO v_item_id;
    END IF;

    -- リンクは既にあってもエラーにしない
    INSERT INTO public.item_categories (item_id, category_id)
    VALUES (v_item_id, p_category_id)
    ON CONFLICT DO NOTHING;

    RETURN json_build_object('id', v_item_id, 'category_id', p_category_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_item(
    p_id              INTEGER,
    p_old_category_id INTEGER,
    p_new_category_id INTEGER,
    p_name            TEXT,
    p_unit            TEXT,
    p_has_expiry      BOOLEAN,
    p_min_stock       INTEGER
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    r        RECORD;
    v_exists INTEGER;
BEGIN
    UPDATE public.items
    SET name = p_name, unit = COALESCE(NULLIF(p_unit, ''), '個'),
        has_expiry = COALESCE(p_has_expiry, false), min_stock = COALESCE(p_min_stock, 0)
    WHERE id = p_id
    RETURNING * INTO r;
    IF NOT FOUND THEN RAISE EXCEPTION '用品が見つかりません'; END IF;

    IF p_old_category_id IS NOT NULL AND p_new_category_id IS NOT NULL
       AND p_old_category_id <> p_new_category_id THEN

        SELECT id INTO v_exists FROM public.item_categories
        WHERE item_id = p_id AND category_id = p_new_category_id;

        IF v_exists IS NOT NULL THEN
            -- 移動先に既にある → 旧リンクを消して合流させる
            DELETE FROM public.item_categories
            WHERE item_id = p_id AND category_id = p_old_category_id;
        ELSE
            UPDATE public.item_categories SET category_id = p_new_category_id
            WHERE item_id = p_id AND category_id = p_old_category_id;
        END IF;

        UPDATE public.items SET category_id = p_new_category_id WHERE id = p_id;
    END IF;

    RETURN row_to_json(r);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_item(p_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    DELETE FROM public.transactions WHERE item_id = p_id;
    DELETE FROM public.stocks WHERE item_id = p_id;
    DELETE FROM public.item_categories WHERE item_id = p_id;
    DELETE FROM public.items WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_item_unit_price(
    p_item_id INTEGER, p_price NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.items SET unit_price = COALESCE(p_price, 0) WHERE id = p_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.swap_item_sort_order(
    p_category_id INTEGER,
    p_item_id1 INTEGER, p_sort_order1 INTEGER,
    p_item_id2 INTEGER, p_sort_order2 INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.item_categories SET sort_order = p_sort_order1
    WHERE category_id = p_category_id AND item_id = p_item_id1;
    UPDATE public.item_categories SET sort_order = p_sort_order2
    WHERE category_id = p_category_id AND item_id = p_item_id2;
END;
$$;

-- -------------------------------------------------------
-- 通知設定
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_settings(
    p_key TEXT, p_value JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.system_settings (key, value)
    VALUES (p_key, p_value)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$$;

-- -------------------------------------------------------
-- 実行権限の付与
-- -------------------------------------------------------
GRANT EXECUTE ON FUNCTION
    public.upsert_stock, public.record_stock_in, public.record_stock_out,
    public.delete_transaction, public.update_stock_expiry,
    public.add_category, public.update_category, public.delete_category,
    public.add_item, public.update_item, public.delete_item,
    public.set_item_unit_price, public.swap_item_sort_order,
    public.update_settings
TO anon, authenticated, service_role;

COMMIT;
