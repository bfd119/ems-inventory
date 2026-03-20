-- =====================================================
-- migration_v6_stock_dedup.sql
-- 目的: stocks テーブルの重複レコードを解消し、
--       再発を防ぐ UNIQUE 制約と upsert_stock 関数を追加する
-- 実行方法: Supabase ダッシュボード > SQL Editor で貼り付けて実行
-- =====================================================

BEGIN;

-- -------------------------------------------------------
-- STEP 1: 重複レコードのクリーンアップ
-- 同一 (department_id, item_id, expiry_date) を持つレコードが
-- 複数ある場合、最も古い id のレコードに数量を合算し、
-- 残りを削除する。
-- -------------------------------------------------------
WITH aggregated AS (
    SELECT
        MIN(id) AS keep_id,
        department_id,
        item_id,
        expiry_date,
        SUM(quantity) AS total_quantity
    FROM stocks
    GROUP BY department_id, item_id, expiry_date
    HAVING COUNT(*) > 1
),
deleted AS (
    DELETE FROM stocks
    WHERE id IN (
        SELECT s.id FROM stocks s
        JOIN aggregated a
          ON  s.department_id = a.department_id
          AND s.item_id       = a.item_id
          AND (s.expiry_date = a.expiry_date OR (s.expiry_date IS NULL AND a.expiry_date IS NULL))
          AND s.id <> a.keep_id
    )
    RETURNING id
)
UPDATE stocks s
SET quantity = a.total_quantity
FROM aggregated a
WHERE s.id = a.keep_id;

-- -------------------------------------------------------
-- STEP 2: UNIQUE 制約を追加
-- 以降は同じ組み合わせのレコードを2件以上 INSERT できなくなる。
-- expiry_date が NULL の場合でも正しく動作するよう
-- 部分インデックスで対応する。
-- -------------------------------------------------------

-- NULL 以外の期限に対する UNIQUE インデックス
CREATE UNIQUE INDEX IF NOT EXISTS uq_stocks_dept_item_expiry
    ON stocks (department_id, item_id, expiry_date)
    WHERE expiry_date IS NOT NULL;

-- 期限なし（NULL）に対する UNIQUE インデックス
CREATE UNIQUE INDEX IF NOT EXISTS uq_stocks_dept_item_noexpiry
    ON stocks (department_id, item_id)
    WHERE expiry_date IS NULL;

-- -------------------------------------------------------
-- STEP 3: アトミックな在庫加算関数 upsert_stock を作成
-- アプリから RPC で呼び出す。
-- 指定の (department_id, item_id, expiry_date) のレコードが
-- 存在すれば delta を加算し、なければ新規作成する。
-- quantity が 0 以下になった場合はレコードを削除する。
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_stock(
    p_department_id INTEGER,
    p_item_id       INTEGER,
    p_expiry_date   DATE,
    p_delta         INTEGER   -- 正数=入庫加算, 負数=出庫減算
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_existing_id  INTEGER;
    v_existing_qty INTEGER;
    v_new_qty      INTEGER;
BEGIN
    -- 既存レコードを排他ロック付きで検索
    IF p_expiry_date IS NULL THEN
        SELECT id, quantity INTO v_existing_id, v_existing_qty
        FROM stocks
        WHERE department_id = p_department_id
          AND item_id       = p_item_id
          AND expiry_date IS NULL
        FOR UPDATE;
    ELSE
        SELECT id, quantity INTO v_existing_id, v_existing_qty
        FROM stocks
        WHERE department_id = p_department_id
          AND item_id       = p_item_id
          AND expiry_date   = p_expiry_date
        FOR UPDATE;
    END IF;

    IF v_existing_id IS NOT NULL THEN
        v_new_qty := v_existing_qty + p_delta;
        IF v_new_qty <= 0 THEN
            DELETE FROM stocks WHERE id = v_existing_id;
        ELSE
            UPDATE stocks SET quantity = v_new_qty WHERE id = v_existing_id;
        END IF;
    ELSE
        -- レコードが存在しない場合は新規作成
        IF p_delta > 0 THEN
            INSERT INTO stocks (department_id, item_id, expiry_date, quantity)
            VALUES (p_department_id, p_item_id, p_expiry_date, p_delta);
        END IF;
        -- p_delta <= 0 (出庫なのに在庫なし) は何もしない
    END IF;
END;
$$;

-- RPC を匿名ユーザーから呼び出せるよう権限付与
GRANT EXECUTE ON FUNCTION upsert_stock TO anon, authenticated, service_role;

COMMIT;
