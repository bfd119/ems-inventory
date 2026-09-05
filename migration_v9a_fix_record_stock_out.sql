-- =====================================================
-- migration_v9a_fix_record_stock_out.sql
--
-- migration_v9 の record_stock_out に不具合があったため差し替える。
--
-- 症状: 「使った（廃棄した）」「あげた」の保存時に必ず次のエラーになる
--       0A000: FOR UPDATE is not allowed with aggregate functions
--
-- 原因: PostgreSQL は集計関数(SUM)と行ロック(FOR UPDATE)を
--       同一の SELECT 文で併用できない。
--       ロックと集計を2文に分けて解決する。
--
-- migration_v9 を適用済みの場合は、このファイルだけ実行すれば良い。
-- （CREATE OR REPLACE なので既存の関数を上書きする）
--
-- 実行方法: Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- =====================================================

BEGIN;

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

GRANT EXECUTE ON FUNCTION public.record_stock_out TO anon, authenticated, service_role;

COMMIT;
