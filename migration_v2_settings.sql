-- システム設定保存用テーブル
create table system_settings (
  key text primary key,
  value jsonb,
  updated_at timestamp with time zone default now()
);

-- リマインド設定の初期値
-- enabled: 機能の有効/無効
-- schedule_days: 送信する日（1日、25日など）
-- target_emails: { "dept_id": "email" } 形式で上書き可能にする（将来用）
insert into system_settings (key, value) values
('reminder_config', '{"enabled": true, "schedule_days": [1, 25], "target_emails": {}}');

-- RLSポリシー（必要であれば）
alter table system_settings enable row level security;

-- 認証済みユーザーは読み取り可能
create policy "Enable read access for authenticated users" on system_settings
  for select using (auth.role() = 'anon');

-- 認証済みユーザーは更新可能（簡易的にanon許可、本来は管理者のみにすべき）
create policy "Enable update access for authenticated users" on system_settings
  for update using (auth.role() = 'anon');

-- 挿入も許可（初期化用）
create policy "Enable insert access for authenticated users" on system_settings
  for insert with check (auth.role() = 'anon');
