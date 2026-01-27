/**
 * EMS在庫管理システム - メールリマインドスクリプト
 * Google Apps Script用
 * 
 * 【設定方法】
 * 1. Google Apps Script (script.google.com) に新規プロジェクトを作成
 * 2. このコードを貼り付け
 * 3. CONFIG の値を編集（メールアドレス、スプレッドシートID）
 * 4. setupTriggers() を一度実行してトリガーを設定
 */

// ============================================
// 設定
// ============================================
const CONFIG = {
  // 送信先メールアドレス（カンマ区切りで複数指定可能）
  RECIPIENT_EMAILS: 'example@city.shobara.lg.jp',
  
  // スプレッドシートID（在庫データを保存するシートのID）
  // ※ウェブアプリから在庫データをエクスポートして使用
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
  
  // シート名
  SHEET_NAME: '在庫データ',
  
  // メール件名のプレフィックス
  EMAIL_SUBJECT_PREFIX: '【EMS在庫管理】'
};

// ============================================
// メイン関数
// ============================================

/**
 * 今月期限切れの用品をチェックしてメール送信
 */
function sendExpiryReminder() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  
  // 在庫データを取得
  const expiringItems = getExpiringItemsThisMonth();
  
  if (expiringItems.length === 0) {
    console.log('今月期限切れの用品はありません');
    return;
  }
  
  // メール本文を作成
  const subject = `${CONFIG.EMAIL_SUBJECT_PREFIX}期限切れ間近の用品があります（${currentYear}年${currentMonth}月）`;
  const body = createEmailBody(expiringItems, currentYear, currentMonth);
  
  // メール送信（無効化中）
  /*
  MailApp.sendEmail({
    to: CONFIG.RECIPIENT_EMAILS,
    subject: subject,
    body: body
  });
  */
  
  console.log(`リマインドメールを送信しました: ${expiringItems.length}件`);
}

/**
 * 今月期限切れの用品を取得
 */
function getExpiringItemsThisMonth() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    console.error('シートが見つかりません: ' + CONFIG.SHEET_NAME);
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // ヘッダーからインデックスを取得
  const deptIdx = headers.indexOf('部署');
  const itemIdx = headers.indexOf('用品名');
  const qtyIdx = headers.indexOf('数量');
  const unitIdx = headers.indexOf('単位');
  const expiryIdx = headers.indexOf('使用期限');
  
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  
  const expiringItems = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const expiryDate = row[expiryIdx];
    const quantity = row[qtyIdx];
    
    // 数量が0以下または期限なしはスキップ
    if (!expiryDate || quantity <= 0) continue;
    
    const expiry = new Date(expiryDate);
    
    // 今月の期限切れかチェック
    if (expiry.getFullYear() === currentYear && expiry.getMonth() === currentMonth) {
      expiringItems.push({
        department: row[deptIdx],
        itemName: row[itemIdx],
        quantity: quantity,
        unit: row[unitIdx],
        expiryDate: Utilities.formatDate(expiry, 'Asia/Tokyo', 'yyyy-MM-dd')
      });
    }
  }
  
  // 部署順、期限順にソート
  expiringItems.sort((a, b) => {
    if (a.department !== b.department) {
      return a.department.localeCompare(b.department, 'ja');
    }
    return new Date(a.expiryDate) - new Date(b.expiryDate);
  });
  
  return expiringItems;
}

/**
 * メール本文を作成
 */
function createEmailBody(items, year, month) {
  let body = `以下の用品が${year}年${month}月中に使用期限を迎えます：\n\n`;
  
  // 部署ごとにグループ化
  const byDepartment = {};
  items.forEach(item => {
    if (!byDepartment[item.department]) {
      byDepartment[item.department] = [];
    }
    byDepartment[item.department].push(item);
  });
  
  // 部署ごとに出力
  Object.keys(byDepartment).forEach(dept => {
    body += `■ ${dept}\n`;
    byDepartment[dept].forEach(item => {
      body += `  - ${item.itemName} × ${item.quantity}${item.unit}（期限: ${item.expiryDate}）\n`;
    });
    body += '\n';
  });
  
  body += '---\n';
  body += 'このメールはEMS在庫管理システムから自動送信されています。\n';
  
  return body;
}

// ============================================
// トリガー設定
// ============================================

/**
 * トリガーを設定（月初と月末）
 * ※この関数を一度手動で実行してトリガーを設定
 */
function setupTriggers() {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  // 月初（毎月1日 9:00）
  ScriptApp.newTrigger('sendExpiryReminder')
    .timeBased()
    .onMonthDay(1)
    .atHour(9)
    .create();
  
  // 月末チェック用の日次トリガー（毎日チェックして月末のみ実行）
  ScriptApp.newTrigger('checkAndSendMonthEndReminder')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
  
  console.log('トリガーを設定しました');
}

/**
 * 月末チェックとリマインド送信
 */
function checkAndSendMonthEndReminder() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // 明日が翌月1日の場合 = 今日が月末
  if (tomorrow.getDate() === 1) {
    sendExpiryReminder();
  }
}

// ============================================
// テスト用関数
// ============================================

/**
 * テスト用：メール送信をテスト
 */
function testSendReminder() {
  console.log('テスト実行開始');
  sendExpiryReminder();
  console.log('テスト実行完了');
}

/**
 * スプレッドシートのサンプルデータを作成
 * ※テスト用
 */
function createSampleData() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  }
  
  // ヘッダー
  sheet.getRange(1, 1, 1, 5).setValues([['部署', '用品名', '数量', '単位', '使用期限']]);
  
  // サンプルデータ
  const today = new Date();
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 15);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 15);
  
  const sampleData = [
    ['三次', '生理食塩水 500ml', 5, '本', thisMonth],
    ['三次', 'アドレナリン 1mg', 2, 'アンプル', thisMonth],
    ['庄原', '乳酸リンゲル液 500ml', 3, '本', thisMonth],
    ['東城', '気管チューブ 7.5mm', 4, '本', nextMonth]
  ];
  
  sheet.getRange(2, 1, sampleData.length, 5).setValues(sampleData);
  
  console.log('サンプルデータを作成しました');
}
