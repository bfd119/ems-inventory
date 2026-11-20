-- =====================================================
-- migration_v13_adjust_stock.sql
--
-- 目的: 「在庫調整」機能のための関数 adjust_stock を追加する。
--
-- 在庫調整とは
--   実際の在庫とシステム上の数が合わなくなったときに、
--   システムの在庫（使用期限・個数）を実際に合わせるための機能。
--   購入・使用・あげた・もらった の履歴（transactions）には一切記録しない。
--   → 実績の集計（購入数・消費数など）には影響しない。
--
-- 動作
--   指定した（署所, 用品）の在庫を、p_lots で渡した内容にそっくり入れ替える。
--     * 同じ使用期限が複数あれば数量を合算する
--     * 数量 0 の行は作らない（＝その期限の在庫がなくなる）
--     * 使用期限が null の行は「期限なし」の在庫になる
--   他の署所・他の用品には触れない。
--
-- 競合チェック（p_expected_lots）
--   画面を開いた時点の在庫を p_expected_lots で渡すと、保存時に DB の現在値と
--   突き合わせ、食い違っていれば何も変えずにエラーにする。
--   （調整画面を開いている間に、別の端末が入出庫した内容を
--     黙って上書きしてしまうのを防ぐため）
--   null を渡すとチェックしない。
--
-- 呼び出し例
--   select public.adjust_stock(
--       2, 370,
--       '[{"expiry_date":"2027-03-05","quantity":40},{"expiry_date":null,"quantity":1}]',
--       '[{"expiry_date":"2027-03-05","quantity":42}]'
--   );
--
-- 前提: migration_v6（stocks の UNIQUE 制約）, migration_v9（SECURITY DEFINER 方式）,
--       migration_v11（departments テーブル）が適用済みであること。
--
-- 切り戻し: DROP FUNCTION public.adjust_stock(INTEGER, INTEGER, JSONB, JSONB);
--           （関数を足すだけの変更なので、既存の動作には影響しない）
--
-- 適用順序: アプリ（app.js）を公開する「前」にこのファイルを実行すること。
--           逆だと、在庫調整の保存時に「関数が見つからない」エラーになる。
--
-- 実行方法: Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.adjust_stock(
    p_department_id INTEGER,
    p_item_id       INTEGER,
    p_lots          JSONB,
    p_expected_lots JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.departments WHERE id = p_department_id) THEN
        RAISE EXCEPTION '署所が見つかりません';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.items WHERE id = p_item_id) THEN
        RAISE EXCEPTION '用品が見つかりません';
    END IF;
    IF p_lots IS NULL OR jsonb_typeof(p_lots) <> 'array' THEN
        RAISE EXCEPTION '在庫の指定が正しくありません';
    END IF;
    IF p_expected_lots IS NOT NULL AND jsonb_typeof(p_expected_lots) <> 'array' THEN
        RAISE EXCEPTION '在庫の指定が正しくありません';
    END IF;

    -- 個数は 0 以上の整数のみ
    IF EXISTS (
        SELECT 1
          FROM jsonb_to_recordset(p_lots) AS x(expiry_date DATE, quantity INTEGER)
         WHERE x.quantity IS NULL OR x.quantity < 0 OR x.quantity > 1000000
    ) THEN
        RAISE EXCEPTION '個数は 0 以上の整数で指定してください';
    END IF;

    -- 対象の在庫行をロックする（同時に入出庫されても整合を保つ）
    PERFORM 1 FROM public.stocks
     WHERE department_id = p_department_id AND item_id = p_item_id
       FOR UPDATE;

    -- 画面を開いた時点から在庫が変わっていないか確認する
    IF p_expected_lots IS NOT NULL THEN
        IF EXISTS (
            (SELECT s.expiry_date, s.quantity
               FROM public.stocks s
              WHERE s.department_id = p_department_id AND s.item_id = p_item_id
             EXCEPT
             SELECT e.expiry_date, e.quantity
               FROM jsonb_to_recordset(p_expected_lots) AS e(expiry_date DATE, quantity INTEGER))
            UNION ALL
            (SELECT e.expiry_date, e.quantity
               FROM jsonb_to_recordset(p_expected_lots) AS e(expiry_date DATE, quantity INTEGER)
             EXCEPT
             SELECT s.expiry_date, s.quantity
               FROM public.stocks s
              WHERE s.department_id = p_department_id AND s.item_id = p_item_id)
        ) THEN
            RAISE EXCEPTION '他の端末で在庫が更新されました。画面を開き直してから、もう一度調整してください。';
        END IF;
    END IF;

    -- 入れ替え。履歴（transactions）には何も書かない。
    DELETE FROM public.stocks
     WHERE department_id = p_department_id AND item_id = p_item_id;

    INSERT INTO public.stocks (department_id, item_id, expiry_date, quantity)
    SELECT p_department_id, p_item_id, x.expiry_date, SUM(x.quantity)
      FROM jsonb_to_recordset(p_lots) AS x(expiry_date DATE, quantity INTEGER)
     GROUP BY x.expiry_date
    HAVING SUM(x.quantity) > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_stock(INTEGER, INTEGER, JSONB, JSONB)
TO anon, authenticated, service_role;

COMMIT;
