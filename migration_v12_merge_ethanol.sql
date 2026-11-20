-- =====================================================
-- migration_v12_merge_ethanol.sql
--
-- 目的: 品名が分かれていた消毒用エタノールを1つの用品に統合する。
--
--   統合前  id=370 消毒用エタノール（手指消毒用）
--           id=371 消毒用エタノール（資器材用）
--   統合後  id=370 消毒用エタノール（手指・資機材用）  ← 371 はここに吸収
--
-- やること（すべて1トランザクション。途中で失敗したら全部巻き戻る）
--   1. 在庫 stocks      : 371 の在庫を 370 に付け替える。
--                         同じ (署所, 使用期限) の在庫が両方にある場合は数量を合算する。
--                         （stocks には (署所, 用品, 期限) の UNIQUE があるため単純な付け替えは不可）
--   2. 履歴 transactions: 371 の履歴をすべて 370 に付け替える（履歴は1件も消さない）
--   3. カテゴリ紐付け    : 371 の紐付けを 370 に引き継ぎ、371 側を削除する
--   4. 用品 items       : 370 の品名を新名称に変更し、371 を削除する
--   5. 検証             : 在庫の合計数量と履歴件数が実行前と一致することを確認する
--
-- 安全策
--   * id と品名が想定どおりでなければ何もせず中断する（別環境での誤爆防止）。
--   * すでに統合済みなら何もせず正常終了する（再実行しても安全）。
--
-- 実行方法: Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- 実行後: backup/ は次回の日次バックアップで自動的に新しい状態になる（手動編集は不要）。
-- =====================================================

BEGIN;

DO $$
DECLARE
    v_keep       CONSTANT INTEGER := 370;  -- 残す用品
    v_drop       CONSTANT INTEGER := 371;  -- 吸収して削除する用品
    v_keep_name  CONSTANT TEXT    := '消毒用エタノール（手指消毒用）';
    v_drop_name  CONSTANT TEXT    := '消毒用エタノール（資器材用）';
    v_new_name   CONSTANT TEXT    := '消毒用エタノール（手指・資機材用）';

    v_qty_before BIGINT;
    v_qty_after  BIGINT;
    v_tx_before  BIGINT;
    v_tx_after   BIGINT;
    v_left       BIGINT;
BEGIN
    -- 統合済みなら何もしない
    IF EXISTS (SELECT 1 FROM public.items WHERE id = v_keep AND name = v_new_name)
       AND NOT EXISTS (SELECT 1 FROM public.items WHERE id = v_drop) THEN
        RAISE NOTICE '統合済みのため、何もせず終了します。';
        RETURN;
    END IF;

    -- 想定した2品目であることを確認する
    IF NOT EXISTS (SELECT 1 FROM public.items WHERE id = v_keep AND name = v_keep_name) THEN
        RAISE EXCEPTION 'id=% が「%」ではありません。実データを確認してください。', v_keep, v_keep_name;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.items WHERE id = v_drop AND name = v_drop_name) THEN
        RAISE EXCEPTION 'id=% が「%」ではありません。実データを確認してください。', v_drop, v_drop_name;
    END IF;

    -- 実行前の合計（検証用）
    SELECT COALESCE(SUM(quantity), 0) INTO v_qty_before
      FROM public.stocks       WHERE item_id IN (v_keep, v_drop);
    SELECT COUNT(*)                   INTO v_tx_before
      FROM public.transactions WHERE item_id IN (v_keep, v_drop);

    -- 1. 在庫: 同じ (署所, 期限) が両方にあれば 370 側へ合算し、371 側を消す
    UPDATE public.stocks k
       SET quantity = k.quantity + d.quantity
      FROM public.stocks d
     WHERE k.item_id = v_keep
       AND d.item_id = v_drop
       AND k.department_id = d.department_id
       AND k.expiry_date IS NOT DISTINCT FROM d.expiry_date;

    DELETE FROM public.stocks d
     WHERE d.item_id = v_drop
       AND EXISTS (
            SELECT 1 FROM public.stocks k
             WHERE k.item_id = v_keep
               AND k.department_id = d.department_id
               AND k.expiry_date IS NOT DISTINCT FROM d.expiry_date
       );

    --    残りは重複しないので、そのまま 370 に付け替える
    UPDATE public.stocks SET item_id = v_keep WHERE item_id = v_drop;

    -- 2. 履歴: すべて 370 に付け替える
    UPDATE public.transactions SET item_id = v_keep WHERE item_id = v_drop;

    -- 3. カテゴリ紐付け: 370 に無いカテゴリだけ引き継ぎ、371 側は削除
    --    （通常は両方とも「消毒」カテゴリなので引き継ぎは発生しない）
    INSERT INTO public.item_categories (item_id, category_id, sort_order)
    SELECT v_keep, category_id, sort_order
      FROM public.item_categories
     WHERE item_id = v_drop
    ON CONFLICT (item_id, category_id) DO NOTHING;

    DELETE FROM public.item_categories WHERE item_id = v_drop;

    -- 4. 用品: 品名を変更し、371 を削除する。
    --    371 側にだけ設定されていた最低在庫数は失わないよう、大きい方を採用する。
    UPDATE public.items k
       SET name      = v_new_name,
           min_stock = GREATEST(COALESCE(k.min_stock, 0), COALESCE(d.min_stock, 0))
      FROM public.items d
     WHERE k.id = v_keep
       AND d.id = v_drop;

    DELETE FROM public.items WHERE id = v_drop;

    -- 5. 検証: ずれていたら例外を投げて、ここまでの変更をすべて取り消す
    SELECT COALESCE(SUM(quantity), 0) INTO v_qty_after
      FROM public.stocks       WHERE item_id = v_keep;
    SELECT COUNT(*)                   INTO v_tx_after
      FROM public.transactions WHERE item_id = v_keep;

    IF v_qty_after <> v_qty_before THEN
        RAISE EXCEPTION '在庫の合計が一致しません（実行前 %, 実行後 %）。', v_qty_before, v_qty_after;
    END IF;
    IF v_tx_after <> v_tx_before THEN
        RAISE EXCEPTION '履歴の件数が一致しません（実行前 %, 実行後 %）。', v_tx_before, v_tx_after;
    END IF;

    SELECT (SELECT COUNT(*) FROM public.stocks          WHERE item_id = v_drop)
         + (SELECT COUNT(*) FROM public.transactions    WHERE item_id = v_drop)
         + (SELECT COUNT(*) FROM public.item_categories WHERE item_id = v_drop)
         + (SELECT COUNT(*) FROM public.items           WHERE id      = v_drop)
      INTO v_left;
    IF v_left <> 0 THEN
        RAISE EXCEPTION 'id=% を参照するデータが % 件残っています。', v_drop, v_left;
    END IF;

    RAISE NOTICE '統合しました: 在庫合計 %個 / 履歴 %件 → 「%」(id=%)',
        v_qty_after, v_tx_after, v_new_name, v_keep;
END
$$;

COMMIT;

-- 確認用: 統合後の用品と署所別の在庫（SQL Editor に結果が表示される）
SELECT i.id, i.name, s.department_id, s.expiry_date, s.quantity
  FROM public.items i
  LEFT JOIN public.stocks s ON s.item_id = i.id
 WHERE i.name LIKE '消毒用エタノール%'
 ORDER BY s.department_id, s.expiry_date;
