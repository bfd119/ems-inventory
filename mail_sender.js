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
            // 期限日がない、または '9999-12-31' の場合はスキップ
            if (!stock.expiry_date || stock.expiry_date === '9999-12-31') return;

            // 期限日の月を取得 (YYYY-MM)
            const expiryMonth = stock.expiry_date.substring(0, 7);

            // 当月期限切れ、または既に過ぎているが在庫がある場合も対象とするか？
            // 要望は「期限当月の用品」なので、expiryMonth === currentMonthStr とする
            if (expiryMonth === currentMonthStr) {
                const deptId = stock.department_id;
                if (!deptStocks[deptId]) deptStocks[deptId] = [];

                const item = itemMap[stock.item_id];
                deptStocks[deptId].push({
                    itemName: item ? item.name : '不明な用品',
                    quantity: stock.quantity,
                    expiryDate: stock.expiry_date,
                    unit: item ? item.unit : '個'
                });
            }
        });

        // 3. 各署所へのメール送信
        Object.keys(deptStocks).forEach(deptId => {
            const targetStocks = deptStocks[deptId];
            if (targetStocks.length === 0) return;

            const email = EMAIL_LIST[deptId];
            const deptName = DEPT_NAMES[deptId];

            if (email) {
                const subject = `【在庫管理】期限切れ間近の用品があります（${currentMonthStr}）`;
                let body = `${deptName} 担当者様\n\n`;
                body += `お疲れ様です。\n救急用品在庫管理システムからの自動通知です。\n\n`;
                body += `今月（${currentMonthStr}）に使用期限を迎える在庫があります。\n`;
                body += `確認の上、交換・使用・廃棄等の対応をお願いします。\n\n`;
                body += `--------------------------------------------------\n`;

                targetStocks.forEach(stock => {
                    body += `・${stock.itemName}: ${stock.quantity}${stock.unit} （期限: ${stock.expiryDate}）\n`;
                });

                body += `--------------------------------------------------\n\n`;
                body += `本メールは自動送信されています。\n`;
                body += `アプリURL: https://bfd119.github.io/ems-inventory/`; // デプロイ後のURL（予定）

                // Gmailで送信
                GmailApp.sendEmail(email, subject, body);
                console.log(`送信完了: ${deptName} (${email}) - ${targetStocks.length}件`);
            }
        });

        console.log('全処理完了');

    } catch (e) {
        console.error('エラーが発生しました', e);
        // 管理者（警防課など）にエラー通知を送る場合はここに記述
    }
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
