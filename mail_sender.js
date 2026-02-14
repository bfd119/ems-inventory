/**
 * 救急用品在庫管理システム - リマインドメール自動送信スクリプト
 * 
 * 概要:
 * Supabaseから在庫データを取得し、当月が使用期限の用品がある場合、
 * 各署所のメールアドレスにリマインドメールを送信します。
 * 毎月1日と末日にトリガー実行することを想定しています。
 */

// ==========================================
// 設定エリア
// ==========================================

// Supabase設定 (index.htmlから転記)
const SUPABASE_URL = 'https://aacntdoacjjssspoctul.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY250ZG9hY2pqc3NzcG9jdHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MDA5OTcsImV4cCI6MjA4MzQ3Njk5N30.oBliHP_Jd9NOSSK1XFcO9egQWPzVhxn_KM0OTgaR8TQ';

// ==========================================
// 機能設定
// ==========================================
// ==========================================
// 機能設定
// ==========================================
// 定数は廃止し、DB (system_settings) から取得するように変更します。
// const ENABLE_EXPIRY_REMINDER = true;
// const ENABLE_SHORTAGE_REMINDER = false;

// 送信元メールアドレス (Gmailのエイリアス機能などを確認してください)
// ※ GASでは実行アカウントのGmailアドレスが送信元になります。

// 署所IDとメールアドレスのマッピング
const EMAIL_LIST = {
    1: 'keibou@119-bihoku.jp',   // 警防課
    2: 'miyoshi@119-bihoku.jp',  // 三次
    3: 'sakugi@119-bihoku.jp',   // 作木
    4: 'kisa@119-bihoku.jp',     // 吉舎
    5: 'miwa@119-bihoku.jp',     // 三和
    6: 'kutiwa@119-bihoku.jp',   // 口和
    7: 'kounu@119-bihoku.jp',    // 甲奴
    8: 'shoubara@119-bihoku.jp', // 庄原
    9: 'saijou@119-bihoku.jp',   // 西城
    10: 'takano@119-bihoku.jp',  // 高野
    11: 'toujou@119-bihoku.jp'   // 東城
};

// 署所名マッピング
const DEPT_NAMES = {
    1: "警防課", 2: "三次署", 3: "作木出張所",
    4: "吉舎出張所", 5: "三和出張所", 6: "口和出張所",
    7: "甲奴出張所", 8: "庄原署", 9: "西城分署",
    10: "高野出張所", 11: "東城署"
};

// ==========================================
// メイン処理
// ==========================================

function sendReminderEmails() {
    const today = new Date();
    const currentMonthStr = Utilities.formatDate(today, 'JST', 'yyyy-MM'); // 例: 2026-05
    console.log(`処理開始: ${currentMonthStr}`);

    try {
        // ==========================================
        // 0. 設定とスケジュールの確認
        // ==========================================
        let config = { enabled: true, schedule_days: [1, 25] }; // デフォルト
        try {
            const settings = fetchSupabase('system_settings');
            // settingsは配列で返ってくる想定
            if (Array.isArray(settings)) {
                const row = settings.find(r => r.key === 'reminder_config');
                if (row && row.value) {
                    config = row.value;
                }
            }
        } catch (e) {
            console.warn('設定取得失敗。デフォルトを使用します。', e);
        }

        // 機能が無効なら終了
        if (!config.enabled) {
            console.log('リマインド通知機能は無効に設定されています。');
            return;
        }

        // スケジュールチェック
        // WebApp(doGet)からの手動実行の場合は、引数等で強制送信判定を入れることも可能だが、
        // 現状はスケジュール通りかチェックする。
        const day = today.getDate();
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const isEndOfMonth = day === lastDayOfMonth;
        const isScheduled = (config.schedule_days || []).includes(day) || ((config.schedule_days || []).includes(99) && isEndOfMonth);

        // ※デバッグ実行時などはここをコメントアウトして強制実行すると良い
        if (!isScheduled) {
            console.log(`送信予定日ではないためスキップします。今日: ${day}日 (設定: ${config.schedule_days.join(', ')}${config.schedule_days.includes(99) ? ', 月末' : ''})`);
            return;
        }

        // 設定定数（旧グローバル定数）
        const ENABLE_EXPIRY_REMINDER = true;
        const ENABLE_SHORTAGE_REMINDER = false;

        // 1. データの取得
        const stocks = fetchSupabase('stocks');
        const items = fetchSupabase('items');
        const categories = fetchSupabase('categories');

        // 2. データの結合と整理
        // 用品IDをキーにしたマップ作成
        const itemMap = {};
        items.forEach(item => {
            itemMap[item.id] = item;
        });

        // 署所ごとに在庫をグルーピング
        const deptStocks = {};

        stocks.forEach(stock => {
            // 全データを署所ごとに振り分け (フィルタリングは後で行う)
            const deptId = stock.department_id;
            if (!deptStocks[deptId]) deptStocks[deptId] = [];
            deptStocks[deptId].push(stock);
        });

        // 3. 各署所へのメール送信
        Object.keys(deptStocks).forEach(deptId => {
            const stocks = deptStocks[deptId];
            if (!stocks) return;

            // 期限切れと在庫不足をフィルタリング
            const expiryItems = ENABLE_EXPIRY_REMINDER ? stocks.filter(s => {
                if (!s.expiry_date || s.expiry_date === '9999-12-31') return false;
                const expiryMonth = s.expiry_date.substring(0, 7);
                return expiryMonth === currentMonthStr;
            }) : [];

            // 在庫不足アイテムの抽出 (min_stock > 0 かつ quantity < min_stock)
            // ※ items配列からmin_stock情報を取得する必要があるため、stockオブジェクト構築ロジックを見直すか、ここで結合する
            // 効率のため、先にdeptStocks構築時に情報を含めておくのが良いが、既存ロジックを大きく変えないようここで処理
            // ただし、stock単位ではなく「アイテム単位」で集計しないとmin_stockと比較できない。
            // 既存の deptStocks は stockレコード単位（期限日別）になっている。

            // 署所ごとのアイテム集計
            const itemTotals = {}; // itemId -> { quantity, minStock, name, unit }
            stocks.forEach(s => {
                const item = itemMap[s.item_id];
                if (!item) return;
                if (!itemTotals[s.item_id]) {
                    itemTotals[s.item_id] = {
                        quantity: 0,
                        minStock: item.min_stock || 0,
                        name: item.name,
                        unit: item.unit
                    };
                }
                itemTotals[s.item_id].quantity += s.quantity;
            });

            const shortageItems = ENABLE_SHORTAGE_REMINDER ? Object.values(itemTotals).filter(i => {
                return i.minStock > 0 && i.quantity < i.minStock;
            }) : [];


            if (expiryItems.length === 0 && shortageItems.length === 0) return;

            const email = EMAIL_LIST[deptId];
            const deptName = DEPT_NAMES[deptId];

            if (email) {
                const subject = `【在庫管理】在庫確認のお知らせ（${currentMonthStr}）`;
                let body = `${deptName} 担当者様\n\n`;
                body += `お疲れ様です。\n救急用品在庫管理システムからの自動通知です。\n\n`;

                if (expiryItems.length > 0) {
                    body += `■ 今月（${currentMonthStr}）に使用期限を迎える在庫\n`;
                    body += `期限を確認し、交換・廃棄等の対応をお願いします。\n`;
                    body += `--------------------------------------------------\n`;
                    expiryItems.sort((a, b) => a.expiry_date.localeCompare(b.expiry_date)).forEach(s => {
                        const item = itemMap[s.item_id];
                        const name = item ? item.name : '不明';
                        body += `・${name}: ${s.quantity}${item ? item.unit : ''} （期限: ${s.expiry_date}）\n`;
                    });
                    body += `--------------------------------------------------\n\n`;
                }

                if (shortageItems.length > 0) {
                    body += `■ 在庫不足の用品（基準数割れ）\n`;
                    body += `補充等の対応をお願いします。\n`;
                    body += `--------------------------------------------------\n`;
                    shortageItems.forEach(i => {
                        body += `・${i.name}: 現在 ${i.quantity}${i.unit} （基準 ${i.minStock}）\n`;
                    });
                    body += `--------------------------------------------------\n\n`;
                }

                body += `本メールは自動送信されています。\n`;
                body += `アプリURL: https://bfd119.github.io/ems-inventory/`;

                // Gmailで送信
                GmailApp.sendEmail(email, subject, body);
                console.log(`送信完了: ${deptName} (${email}) - 期限:${expiryItems.length}件, 不足:${shortageItems.length}件`);
            }
        });

        console.log('全処理完了');

    } catch (e) {
        console.error('エラーが発生しました', e);
        // 管理者（警防課など）にエラー通知を送る場合はここに記述
    }
}

/**
 * Web Appとしてアクセスされた場合の処理 (doGet)
 */
function doGet(e) {
    console.log('Web App経由での実行開始');

    // メール送信実行
    sendReminderEmails();

    // ブラウザへのレスポンス
    return HtmlService.createHtmlOutput(`
        <html>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1 style="color: #4CAF50;">✅ メール送信完了</h1>
                <p>各署所へのリマインドメール送信処理を実行しました。</p>
                <p style="color: #666; font-size: 0.9em;">(ログはGASエディタで確認できます)</p>
            </body>
        </html>
    `);
}

// ==========================================
// ヘルパー関数
// ==========================================

/**
 * Supabaseからデータを取得する
 */
function fetchSupabase(tableName) {
    const url = `${SUPABASE_URL}/rest/v1/${tableName}?select=*`;
    const options = {
        method: 'get',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();

    if (code !== 200) {
        throw new Error(`Supabase API Error: ${code} - ${response.getContentText()}`);
    }

    return JSON.parse(response.getContentText());
}
