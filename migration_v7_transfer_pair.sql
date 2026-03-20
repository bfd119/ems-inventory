-- =====================================================
-- migration_v7_transfer_pair.sql
-- 目的: transactions テーブルに transfer_pair_id を追加し
--       署所間の「あげた」「もらった」ペアを紐付けられるようにする
-- 実行方法: Supabase ダッシュボード > SQL Editor で貼り付けて実行
-- =====================================================

-- transfer_pair_id カラムを追加（UUID型、NULL許容）
-- 値がある場合、同じUUIDを持つ2件がペアを表す
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS transfer_pair_id UUID DEFAULT NULL;

-- 検索高速化のためのインデックス
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_pair_id
    ON transactions (transfer_pair_id)
    WHERE transfer_pair_id IS NOT NULL;
