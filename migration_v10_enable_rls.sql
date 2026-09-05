-- =====================================================
-- migration_v10_enable_rls.sql
--
-- 目的: テーブルへの直接の書き込みを禁止し、書き込みは
--       migration_v9 で作った RPC 経由のみに限定する。
--
-- ★ 適用の順序 ★
--   1. migration_v9 を適用（関数の追加のみ。動作は変わらない）
--   2. アプリ側の更新を反映し、各署所で動作確認
--   3. 問題がなければ、このファイルを適用
--
--   この順序を守らないと、旧バージョンの app.js を開いている端末が
--   書き込みできなくなる。
--
-- ★ 切り戻し方法 ★
--   このファイル末尾のコメントにある ROLLBACK 用 SQL を実行すれば
--   元の状態（直接書き込み可）に戻せる。アプリの再デプロイは不要。
--
-- 前提: このアプリはログインを持たないため、RLS だけでは
--       正規利用者と第三者を区別できない。ここでの目的は
--       「1リクエストで全在庫を消せる」状態をなくすこと。
--
-- 実行方法: Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- =====================================================

BEGIN;

-- -------------------------------------------------------
-- STEP 1: RLS を有効化する
-- -------------------------------------------------------
ALTER TABLE public.categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings  ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- STEP 2: 読み取りのみ許可するポリシーを作る
--
-- 書き込み用のポリシーは意図的に作らない。
-- RLS 有効かつポリシー無しの操作は拒否されるため、
-- INSERT / UPDATE / DELETE は自動的に禁止される。
-- SECURITY DEFINER 関数は RLS を迂回するので RPC 経由なら書ける。
-- -------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['categories','items','item_categories',
                             'stocks','transactions','system_settings']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
            t || '_read', t);
    END LOOP;
END;
$$;

-- migration_v2 で system_settings に作られた authenticated 向けの
-- 書き込みポリシーは、RPC 経由に統一するため削除する
DROP POLICY IF EXISTS "Enable read access for authenticated users"   ON public.system_settings;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.system_settings;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.system_settings;

-- -------------------------------------------------------
-- STEP 3: テーブルへの直接の書き込み権限を剥奪する
-- RLS に加えて権限側でも塞ぐ（二重の防御）
-- -------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['categories','items','item_categories',
                             'stocks','transactions','system_settings']
    LOOP
        EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon, authenticated', t);
        EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    END LOOP;
END;
$$;

COMMIT;

-- =====================================================
-- 動作確認
-- =====================================================
-- 以下を実行して、読み取りが1件以上返り、書き込みが失敗すればOK。
--
--   -- 読み取りは通る
--   SET ROLE anon; SELECT count(*) FROM public.stocks; RESET ROLE;
--
--   -- 直接の書き込みは拒否される
--   SET ROLE anon; DELETE FROM public.stocks WHERE false; RESET ROLE;
--   → ERROR:  permission denied for table stocks
--
-- =====================================================
-- 切り戻し用 SQL（問題が起きた場合のみ実行）
-- アプリの再デプロイは不要で、即座に元の状態に戻る
-- =====================================================
-- BEGIN;
-- DO $$
-- DECLARE t TEXT;
-- BEGIN
--     FOREACH t IN ARRAY ARRAY['categories','items','item_categories',
--                              'stocks','transactions','system_settings']
--     LOOP
--         EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
--         EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
--     END LOOP;
-- END;
-- $$;
-- COMMIT;
