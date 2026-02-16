-- カテゴリテーブルに department_id カラムを追加
-- これにより、特定部署専用のカテゴリ（お気に入りセット）を作成可能にする

-- Departmentsテーブルは存在せずJS側で固定定義されているため、外部キー制約は付けずにカラムのみ追加する
ALTER TABLE categories ADD COLUMN IF NOT EXISTS department_id BIGINT;

-- 既存のカテゴリはすべてNULL（全署所共通）として扱う
