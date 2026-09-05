-- =====================================================
-- migration_v11_departments.sql
--
-- 目的: 署所マスターを DB に持つ。
--
-- これまで署所の一覧は app.js と scripts/send-reminders.mjs に
-- 別々にハードコードされており、署所の追加・改称のたびに
-- 複数ファイルの修正とデプロイが必要だった。
-- さらに集計表の色分けが署所名の文字列一致（'三次' 等）で
-- 判定されており、改称すると表示が壊れる状態だった。
--
-- id は既存の stocks.department_id / transactions.department_id と
-- 一致させる（1〜11。実データで使用中の値と確認済み）。
--
-- 実行方法: Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.departments (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL,              -- アプリ画面上の表示名（例: 三次）
    full_name       TEXT,                       -- メール等での正式名（例: 三次署）
    email           TEXT,                       -- リマインド通知の宛先
    is_headquarters BOOLEAN NOT NULL DEFAULT false, -- 警防課かどうか（集計表で別枠にする）
    color_key       TEXT,                       -- 集計表の色分け用キー
    sort_order      INTEGER NOT NULL DEFAULT 0
);

-- 既存の値を投入する。再実行しても重複しないよう ON CONFLICT を付ける。
-- email は公開リポジトリに載せないため、ここでは NULL のままにする
-- （GitHub Secrets の DEPARTMENT_EMAILS を使い続ける）。
INSERT INTO public.departments (id, name, full_name, is_headquarters, color_key, sort_order) VALUES
    ( 1, '警防課', '警防課',     true,  NULL,      1),
    ( 2, '三次',   '三次署',     false, 'miyoshi', 2),
    ( 3, '作木',   '作木出張所', false, NULL,      3),
    ( 4, '吉舎',   '吉舎出張所', false, NULL,      4),
    ( 5, '三和',   '三和出張所', false, NULL,      5),
    ( 6, '口和',   '口和出張所', false, NULL,      6),
    ( 7, '甲奴',   '甲奴出張所', false, NULL,      7),
    ( 8, '庄原',   '庄原署',     false, 'shobara', 8),
    ( 9, '西城',   '西城分署',   false, NULL,      9),
    (10, '高野',   '高野出張所', false, NULL,     10),
    (11, '東城',   '東城署',     false, 'tojo',   11)
ON CONFLICT (id) DO UPDATE SET
    name            = EXCLUDED.name,
    full_name       = EXCLUDED.full_name,
    is_headquarters = EXCLUDED.is_headquarters,
    color_key       = EXCLUDED.color_key,
    sort_order      = EXCLUDED.sort_order;

-- 読み取りは誰でも可（アプリの起動時に必要）
GRANT SELECT ON public.departments TO anon, authenticated;

-- migration_v10 を適用済みの場合に備え、RLS の設定もここで行っておく。
-- 未適用でも害はない。
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS departments_read ON public.departments;
CREATE POLICY departments_read ON public.departments
    FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.departments FROM anon, authenticated;

COMMIT;

-- 確認用:
--   SELECT id, name, full_name, is_headquarters, color_key FROM public.departments ORDER BY sort_order;
--   → 11行返れば成功
