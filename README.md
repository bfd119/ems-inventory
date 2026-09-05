# 救急用在庫管理表

消防救急資器材の在庫管理システム。

- **公開URL**: https://bfd119.github.io/ems-inventory/
- **構成**: 静的サイト（GitHub Pages）＋ Supabase（PostgreSQL）
- **費用**: 無料枠のみで運用

---

## 設計方針：メンテナンスフリー

サーバーの再起動・証明書更新・OSアップデートが不要な構成にしてある。
恒久的に手作業が必要になりうる箇所は、以下のとおり自動化で潰してある。

| リスク | 内容 | 対策 |
|---|---|---|
| Supabase の自動停止 | 無料プランは**7日間アクセスがないと停止**し、手動再開が必要 | `.github/workflows/daily.yml` が毎日アクセスしてタイマーをリセット |
| GitHub Actions の自動停止 | public リポジトリは**60日間活動がないと**スケジュール実行が止まる | 同ワークフローが毎日 `backup/` をコミットし活動を維持 |
| ライブラリの意図しない更新 | CDN のバージョン非固定指定 | `vendor/` に同梱。外部CDNへの依存なし |
| 外部API の消滅 | QRコード生成API | `images/app-qr.png` として静的化。依存なし |
| データ消失 | 無料プランはバックアップが限定的 | 毎日 `backup/` に全テーブルを JSON 保存 |

### 唯一、期限があるもの

**Supabase のレガシー API キー（`anon` / `service_role`）は 2026年末に廃止される。**
新方式（`sb_publishable_...` / `sb_secret_...`）への移行が必須。移行しないとアプリが停止する。

---

## ファイル構成

```
index.html          アプリ本体（画面）
app.js              アプリ本体（ロジック）
style.css           アプリ本体（スタイル）
manual.html         利用者向けの使い方ガイド
vendor/             同梱ライブラリ（supabase-js）
images/             スクリーンショット・QRコード
backup/             自動バックアップ（GitHub Actions が生成。手動編集しないこと）
scripts/            運用スクリプト（GitHub Actions から実行）
migration_v*.sql    DBスキーマの変更履歴（Supabase の SQL Editor で実行する）
check_data_integrity.mjs   在庫数の整合性チェック・修復
merge_duplicates.mjs       重複用品の統合（過去の移行用）
```

---

## 自動実行されているもの

`.github/workflows/daily.yml` が **毎日 07:00 JST** に以下を実行する。

1. Supabase の全テーブルを読み取る（＝スリープ防止）
2. 内容を `backup/` に JSON で保存してコミット
3. 使用期限が近い用品について、各署所へリマインドメールを送信

失敗すると GitHub から通知メールが届く。手動実行は Actions タブの
「日次メンテナンス」→「Run workflow」から可能。

### リマインドメールの通知タイミング

既定は **期限の30日前・10日前・期限切れ時**。アプリの「設定」画面から変更できる。

「通知済みの段階」を `backup/_reminder_state.json` に記録しているため、

- 実行が飛んでも取りこぼさない
- 同じ通知が毎日届くことはない

---

## 必要な GitHub Secrets

リポジトリの Settings → Secrets and variables → Actions に登録する。

| 名前 | 内容 |
|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SECRET_KEY` | Supabase の `sb_secret_...` キー |
| `SMTP_USER` | 送信元 Gmail アドレス |
| `SMTP_PASS` | Gmail の**アプリパスワード**（16桁）。2段階認証を有効にしてから発行する |
| `DEPARTMENT_EMAILS` | 署所IDと宛先の対応（JSON）。例: `{"1":"aaa@example.jp","2":"bbb@example.jp"}` |

> 宛先メールアドレスは**リポジトリに置かない**。public リポジトリのため Secrets で管理する。

---

## ローカルでの実行

```bash
cp .env.example .env    # 値を記入する（.env はコミットされない）
npm install

npm run check           # 在庫数の整合性チェック（読み取りのみ）
npm run check:fix       # 不整合を修復する
npm run backup          # バックアップを手動取得
npm run reminder:dry    # メールを送らずに内容だけ確認
```

---

## 既知の課題

以下は未対応。着手順に記載。

1. **「もらった」時に相手署所の使用期限が選べない** — 相手の在庫が見えないため入力に失敗する
2. **スマートフォンでのレイアウト崩れ** — メディアクエリがほぼ無く、表がはみ出す
3. `initBudget()` が未定義でキャッシュ機能が動作していない（`app.js`）
4. 関数の二重定義（`openAddItemModal` / `toggleCategoryTypeHelp`）
5. RLS 未整備 — 書き込みを RPC 経由に限定する対応が必要
6. 署所マスターがコードにハードコードされている（`departments` テーブル化が望ましい）
