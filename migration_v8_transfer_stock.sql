-- =====================================================
-- migration_v8_transfer_stock.sql
-- 目的:
--   1. 署所間の「あげた／もらった」を DB 側の単一トランザクションで処理する
--      transfer_stock 関数を追加する。
--      従来はアプリ側で「出庫」→「入庫」を2回に分けて実行しており、
--      片方が失敗すると在庫が消える（または増える）状態だった。
--   2. transactions.type に細分値（IN_BUY / IN_GET / OUT_USE / OUT_GIVE）を
--      保存できるようにする。従来は 'IN' / 'OUT' しか記録されておらず、
--      「購入」と「もらった」を集計で区別できなかった。
--
-- 実行方法: Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- 注意: このSQLを先に実行してから、アプリ側の更新を反映すること。
-- =====================================================

BEGIN;

-- -------------------------------------------------------
-- STEP 1: type に細分値を許可する
-- 既存の 'IN' / 'OUT' もそのまま残すため、両方を許可リストに含める。
-- -------------------------------------------------------
ALTER TABLE public.transactions
    DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_type_check
    CHECK (type IN (
        'IN', 'OUT',                                  -- 旧データ（移行せずそのまま残す）
        'IN_BUY', 'IN_GET', 'IN_RETURN',              -- 入庫の細分
        'OUT_USE', 'OUT_GIVE', 'OUT_ADJUST'           -- 出庫の細分
    ));

-- -------------------------------------------------------
-- STEP 2: 署所間移動をアトミックに行う関数
--
-- 移動元の減算・移動先の加算・取引履歴2件の記録を1つの
-- トランザクションで行う。途中で失敗した場合は全て巻き戻る。
--
-- 在庫は (department_id, item_id, expiry_date) で一意
-- （migration_v6 の UNIQUE インデックスによる）
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_stock(
    p_from_department_id INTEGER,
    p_to_department_id   INTEGER,
    p_item_id            INTEGER,
    p_expiry_date        DATE,
    p_quantity           INTEGER,
    p_from_remarks       TEXT,
    p_to_remarks         TEXT,
    p_timestamp          TIMESTAMPTZ,
    p_transfer_pair_id   UUID
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
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION '数量は1以上で指定してください';
    END IF;
    IF p_from_department_id = p_to_department_id THEN
        RAISE EXCEPTION '同じ署所へは移動できません';
    END IF;

    -- ---- 移動元の在庫を排他ロックして確認 ----
    IF p_expiry_date IS NULL THEN
        SELECT id, quantity INTO v_id, v_qty FROM public.stocks
        WHERE department_id = p_from_department_id
          AND item_id       = p_item_id
          AND expiry_date IS NULL
        FOR UPDATE;
    ELSE
        SELECT id, quantity INTO v_id, v_qty FROM public.stocks
        WHERE department_id = p_from_department_id
          AND item_id       = p_item_id
          AND expiry_date   = p_expiry_date
        FOR UPDATE;
    END IF;

    IF v_id IS NULL OR v_qty < p_quantity THEN
        RAISE EXCEPTION '移動元の在庫が不足しています（残り %）', COALESCE(v_qty, 0);
    END IF;

    -- ---- 移動元から減算（0になったらレコードを削除）----
    IF v_qty = p_quantity THEN
        DELETE FROM public.stocks WHERE id = v_id;
    ELSE
        UPDATE public.stocks SET quantity = v_qty - p_quantity WHERE id = v_id;
    END IF;

    -- ---- 移動先に加算（無ければ新規作成）----
    IF p_expiry_date IS NULL THEN
        SELECT id, quantity INTO v_id, v_qty FROM public.stocks
        WHERE department_id = p_to_department_id
          AND item_id       = p_item_id
          AND expiry_date IS NULL
        FOR UPDATE;
    ELSE
        SELECT id, quantity INTO v_id, v_qty FROM public.stocks
        WHERE department_id = p_to_department_id
          AND item_id       = p_item_id
          AND expiry_date   = p_expiry_date
        FOR UPDATE;
    END IF;

    IF v_id IS NULL THEN
        INSERT INTO public.stocks (department_id, item_id, expiry_date, quantity)
        VALUES (p_to_department_id, p_item_id, p_expiry_date, p_quantity);
    ELSE
        UPDATE public.stocks SET quantity = v_qty + p_quantity WHERE id = v_id;
    END IF;

    -- ---- 取引履歴を2件、同じ transfer_pair_id で記録 ----
    INSERT INTO public.transactions
        (department_id, item_id, type, quantity, expiry_date, remarks, timestamp, transfer_pair_id)
    VALUES
        (p_from_department_id, p_item_id, 'OUT_GIVE', p_quantity, p_expiry_date,
         COALESCE(p_from_remarks, ''), p_timestamp, p_transfer_pair_id),
        (p_to_department_id,   p_item_id, 'IN_GET',   p_quantity, p_expiry_date,
         COALESCE(p_to_remarks, ''),   p_timestamp, p_transfer_pair_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_stock TO anon, authenticated, service_role;

COMMIT;
