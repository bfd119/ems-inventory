# EMS在庫管理システム - GitHub Pages + GAS API 方式

警告メッセージなしでWebアプリを公開する方法です。

---

## アーキテクチャ

```
[ブラウザ] → [GitHub Pages] → [GAS API] → [スプレッドシート]
              (HTML/CSS/JS)     (JSON)        (データベース)
```

---

## デプロイ手順

### ステップ1: GAS API をデプロイ

1. **スプレッドシート作成**
   - Google スプレッドシートを新規作成
   - 名前を「EMS在庫管理」に変更

2. **Apps Script プロジェクト作成**
   - 拡張機能 → Apps Script
   - `gas/Code.gs` の内容を貼り付け

3. **初期化**
   - `initializeSpreadsheet` を実行（シート作成）
   - `insertDefaultCategories` を実行（任意、デフォルトカテゴリ追加）

4. **デプロイ**
   - デプロイ → 新しいデプロイ
   - 種類: **ウェブアプリ**
   - 実行ユーザー: **自分**
   - アクセス権: **全員**
   - デプロイをクリック
   - **表示されたURLをコピー**（`https://script.google.com/macros/s/.../exec`）

### ステップ2: GitHub Pages をデプロイ

1. **GitHubリポジトリ作成**
   - GitHub.com で新規リポジトリ作成（例: `ems-inventory`）
   - Public に設定

2. **ファイルをアップロード**
   - `docs/index.html` をリポジトリにアップロード
   - または `docs` フォルダごとプッシュ

3. **GitHub Pages 有効化**
   - Settings → Pages
   - Source: `Deploy from a branch`
   - Branch: `main`、フォルダ: `/docs`
   - Save

4. **URLを確認**
   - 数分後、`https://[ユーザー名].github.io/[リポジトリ名]/` でアクセス可能

### ステップ3: APIを設定

1. GitHub Pages のURLにアクセス
2. 画面下部の「API URL」欄に、ステップ1でコピーしたGAS URLを貼り付け
3. 部署を選択して動作確認

---

## ファイル構成

```
在庫管理/
├── docs/               # GitHub Pages 用
│   └── index.html     # フロントエンド（fetch API使用）
└── gas/
    └── Code.gs        # APIバックエンド
```

---

## リマインドメール設定

1. `Code.gs` の `CONFIG.REMINDER_EMAILS` を送信先に変更
2. `setupReminderTriggers` を実行

---

## 注意事項

- GAS側のコードを変更した場合は、**新しいバージョンで再デプロイ**が必要
- API URLはブラウザのローカルストレージに保存されます
