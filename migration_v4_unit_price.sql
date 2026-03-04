-- migration_v4_unit_price.sql
-- items テーブルに単価を保持するための unit_price カラムを NUMERIC 型（初期値0）で追加

ALTER TABLE items ADD COLUMN IF NOT EXISTS unit_price NUMERIC DEFAULT 0;
