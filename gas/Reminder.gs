/**
 * 救急用品在庫管理 - リマインダーモジュール
 * 
 * Supabaseから最新の在庫データを取得し、期限切れや在庫不足の通知メールを送信します。
 * Config.gs の設定値を使用します。
 */

// ============================================
// Supabaseデータ取得
// ============================================

/**
 * Supabaseから在庫を取得
 */
function getSupabaseStocks() {
  const data = supabaseRequest('stocks?select=*', 'GET');
  if (data.error) {
    throw new Error('Supabase Error (Stocks): ' + JSON.stringify(data));
  }
  return data.map(r => ({
    departmentId: r.department_id, itemId: r.item_id,
    expiryDate: r.expiry_date, quantity: r.quantity
  }));
}

/**
 * Supabaseから用品を取得
 */
function getSupabaseItems() {
  const data = supabaseRequest('items?select=*', 'GET');
  if (data.error) {
    throw new Error('Supabase Error (Items): ' + JSON.stringify(data));
  }
  return data.map(r => ({
    id: r.id, categoryId: r.category_id, name: r.name, unit: r.unit,
    hasExpiry: r.has_expiry, minStock: r.min_stock
  }));
}

// ============================================
// 期限切れリマインダー
// ============================================

/**
 * 期限切れリマインダー送信 (月次)
 */
function sendExpiryReminderSupabase() {
  Logger.log('期限切れチェック開始...');
  const stocks = getSupabaseStocks();
  const items = getSupabaseItems();
  const today = new Date();
  const yr = today.getFullYear();
  const mo = today.getMonth(); // 0-based month
  
  const byDept = {};
  
  stocks.forEach(s => {
    if (s.expiryDate && s.quantity > 0) {
      const exp = new Date(s.expiryDate);
      // 今月期限が切れるものを抽出
      if (exp.getFullYear() === yr && exp.getMonth() === mo) {
        const item = items.find(i => i.id === s.itemId);
        // DEPARTMENTS は Config.gs で定義
        const dept = DEPARTMENTS.find(d => d.id === s.departmentId);
        if (item && dept) {
          if (!byDept[dept.id]) byDept[dept.id] = { dept, items: [] };
          byDept[dept.id].items.push({ item: item.name, qty: s.quantity, unit: item.unit, exp: s.expiryDate });
        }
      }
    }
  });

  if (Object.keys(byDept).length === 0) {
    Logger.log('今月期限切れになる在庫はありません。');
    return;
  }
  
  // 各部署へメール送信
  Object.values(byDept).forEach(({ dept, items }) => {
    if (!dept.email) return;
    
    let body = `【${dept.name}】 以下の救急用品が${yr}年${mo + 1}月中に期限を迎えます。\n\n`;
    items.forEach(e => { body += `  • ${e.item} × ${e.qty}${e.unit} (期限: ${e.exp})\n`; });
    body += `\n早めに使用または入れ替えをお願いします。\n\n--\n救急用品在庫管理`;
    
    try {
      MailApp.sendEmail({ to: dept.email, subject: `【救急用品在庫管理】${dept.name} 期限切れ間近 (${yr}年${mo + 1}月)`, body });
      Logger.log(`${dept.name} へリマインド送信完了: ${dept.email}`);
    } catch (e) { Logger.log(`${dept.name} へのメール送信失敗: ${e.message}`); }
  });
  
  // 全体サマリー (CONFIG.REMINDER_EMAILS へ)
  if (CONFIG.REMINDER_EMAILS) {
    let summary = `【全部署サマリー】 ${yr}年${mo + 1}月に期限を迎える用品:\n\n`;
    Object.values(byDept).forEach(({ dept, items }) => {
      summary += `■ ${dept.name}\n`;
      items.forEach(e => { summary += `  - ${e.item} × ${e.qty}${e.unit} (${e.exp})\n`; });
      summary += '\n';
    });
    
    try {
      MailApp.sendEmail({ to: CONFIG.REMINDER_EMAILS, subject: `【救急用品在庫管理】全部署 期限切れサマリー (${yr}年${mo + 1}月)`, body: summary });
      Logger.log('全体サマリーメール送信完了');
    } catch (e) { Logger.log(`サマリーメール送信失敗: ${e.message}`); }
  }
}

// ============================================
// 低在庫アラート
// ============================================

/**
 * 低在庫リマインダー送信 (日次)
 */
function checkLowStockSupabase() {
  Logger.log('低在庫チェック開始...');
  const stocks = getSupabaseStocks();
  const items = getSupabaseItems();
  
  const byDept = {};
  
  DEPARTMENTS.forEach(dept => {
    items.forEach(item => {
      if (item.minStock && item.minStock > 0) {
        // 部署ごとの在庫合計を計算（ロット合算）
        const totalQty = stocks
          .filter(s => s.departmentId === dept.id && s.itemId === item.id)
          .reduce((sum, s) => sum + s.quantity, 0);
        
        if (totalQty < item.minStock) {
          if (!byDept[dept.id]) byDept[dept.id] = { dept, items: [] };
          byDept[dept.id].items.push({ name: item.name, current: totalQty, min: item.minStock, unit: item.unit });
        }
      }
    });
  });
  
  if (Object.keys(byDept).length === 0) {
    Logger.log('在庫不足の用品はありません。');
    return;
  }

  // メール送信
  Object.values(byDept).forEach(({ dept, items }) => {
    if (!dept.email) return;
    let body = `【${dept.name}】 以下の用品が最低在庫数を下回っています。\n\n`;
    items.forEach(e => { body += `  • ${e.name}: 現在 ${e.current}${e.unit} / 最低 ${e.min}${e.unit}\n`; });
    body += `\n早めに補充をお願いします。\n\n--\n救急用品在庫管理`;
    
    try {
      MailApp.sendEmail({ to: dept.email, subject: `【救急用品在庫管理】${dept.name} 在庫不足アラート`, body });
      Logger.log(`${dept.name} へアラート送信完了`);
    } catch (e) { Logger.log(`${dept.name} へのメール送信失敗: ${e.message}`); }
  });
}

// ============================================
// トリガー設定
// ============================================

/**
 * リマインダートリガーをセットアップ
 * 一度だけ手動実行してください。
 */
function setupReminderTriggers() {
  // 既存のトリガーを全削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  
  // 1. 毎月1日 朝9時：期限切れチェック
  ScriptApp.newTrigger('sendExpiryReminderSupabase')
    .timeBased().onMonthDay(1).atHour(9).create();
    
  // 2. 毎日 朝9時：月末チェック（月末なら期限切れチェック実行）
  ScriptApp.newTrigger('checkMonthEndSupabase')
    .timeBased().everyDays(1).atHour(9).create();
    
  // 3. 毎日 朝8時：低在庫チェック
  ScriptApp.newTrigger('checkLowStockSupabase')
    .timeBased().everyDays(1).atHour(8).create();
    
  Logger.log('すべてのトリガーを再設定しました。');
}

/**
 * 月末判定用
 */
function checkMonthEndSupabase() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  // 明日が1日なら今日は月末
  if (tomorrow.getDate() === 1) sendExpiryReminderSupabase();
}
