-- item_categories テーブルに sort_order カラムを追加
-- 用品の並び順をカテゴリ内で管理するために使用
ALTER TABLE item_categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 既存データに連番を付与（各カテゴリ内でID順に0, 1, 2...）
WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY item_id) - 1 AS rn
    FROM item_categories
)
UPDATE item_categories
SET sort_order = numbered.rn
FROM numbered
WHERE item_categories.id = numbered.id;
