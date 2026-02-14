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

        // スケジュールチェック (新ロジック: 期限のX日前か？)
        // 毎日実行し、該当するアイテムがある場合のみ送信する
        const reminderDays = config.schedule_days || [30, 10]; // デフォルト: 30日前と10日前

        // 1. データの取得
        const stocks = fetchSupabase('stocks');
        const items = fetchSupabase('items');
        // const categories = fetchSupabase('categories'); // 使わないかも

        // 2. データの結合と整理
        // 用品IDをキーにしたマップ作成
        const itemMap = {};
        items.forEach(item => {
            itemMap[item.id] = item;
        });

        // 署所ごとに「送信対象となる」在庫をグルーピング
        const deptNotificationTargets = {}; // deptId -> { day30: [], day10: [] }

        // 今日の日付 (時間無視)
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        stocks.forEach(stock => {
            if (!stock.expiry_date || stock.expiry_date === '9999-12-31') return;

            // 期限日
            const expParts = stock.expiry_date.split('-');
            const expDate = new Date(expParts[0], expParts[1] - 1, expParts[2]);

            // 差分日数計算 (期限 - 今日)
            const diffTime = expDate - todayDate;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // 設定された日数と一致するかチェック
            if (reminderDays.includes(diffDays)) {
                const deptId = stock.department_id;
                if (!deptNotificationTargets[deptId]) deptNotificationTargets[deptId] = [];

                deptNotificationTargets[deptId].push({
                    stock: stock,
                    daysRemaining: diffDays,
                    item: itemMap[stock.item_id]
                });
            }
        });

        // 送信対象がなければ終了
        if (Object.keys(deptNotificationTargets).length === 0) {
            console.log('本日は送信対象となる期限切れ間近の用品はありません。');
            return;
        }

        // 3. 各署所へのメール送信
        Object.keys(deptNotificationTargets).forEach(deptId => {
            const targets = deptNotificationTargets[deptId];
            if (!targets || targets.length === 0) return;

            // 署所名取得
            const deptName = DEPT_NAMES[deptId] || "不明な署所";
            const email = EMAIL_LIST[deptId];

            if (!email) {
                console.warn(`メールアドレス未登録: DeptID ${deptId}`);
                return;
            }

            // 本文作成
            let body = `${deptName} 救急用品在庫管理担当者 様\n\n` +
                `在庫管理システムより、使用期限が近づいている用品のお知らせです。\n\n`;

            // 日数ごとにグループ化して表示
            reminderDays.sort((a, b) => a - b).forEach(d => {
                const group = targets.filter(t => t.daysRemaining === d);
                if (group.length > 0) {
                    body += `■ 【期限まであと${d}日】 (${Utilities.formatDate(new Date(today.getTime() + d * 86400000), 'JST', 'yyyy/MM/dd')} 期限)\n`;
                    group.forEach(t => {
                        const i = t.item;
                        const s = t.stock;
                        body += `・${i ? i.name : '不明な用品'} : ${s.quantity}${i ? i.unit : ''}\n`;
                    });
                    body += '\n';
                }
            });

            body += `--------------------------------------------------\n` +
                `Webアプリで確認・更新: https://script.google.com/macros/s/AKfycbzxxxx/exec\n` +
                `--------------------------------------------------\n`;

            const subject = `【在庫管理】使用期限通知 (${today.toLocaleDateString()})`;

            // Gmailで送信
            GmailApp.sendEmail(email, subject, body);
            console.log(`送信完了: ${deptName} (${email}) - 対象:${targets.length}件`);
        });

        console.log('全処理完了');
        return; // 書き換えたのでここで関数を抜ける（下の既存コードは実行しない）



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
