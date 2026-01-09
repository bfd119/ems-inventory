/**
 * Supabase からデータを取得するリマインダーモジュール
 * 
 * supabase-migration.gs の SUPABASE_* 定数を設定してから使用してください。
 */

/**
 * Supabaseから在庫を取得
 */
function getSupabaseStocks() {
  const data = supabaseRequest('stocks?select=*', 'GET');
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
  return data.map(r => ({
    id: r.id, categoryId: r.category_id, name: r.name, unit: r.unit,
    hasExpiry: r.has_expiry, minStock: r.min_stock
  }));
}

/**
 * Supabaseベースの期限リマインダー送信
 */
function sendExpiryReminderSupabase() {
  const stocks = getSupabaseStocks();
  const items = getSupabaseItems();
  const today = new Date();
  const yr = today.getFullYear();
  const mo = today.getMonth();
  
  const byDept = {};
  
  stocks.forEach(s => {
    if (s.expiryDate && s.quantity > 0) {
      const exp = new Date(s.expiryDate);
      if (exp.getFullYear() === yr && exp.getMonth() === mo) {
        const item = items.find(i => i.id === s.itemId);
        const dept = DEPARTMENTS.find(d => d.id === s.departmentId);
        if (item && dept) {
          if (!byDept[dept.id]) byDept[dept.id] = { dept, items: [] };
          byDept[dept.id].items.push({ item: item.name, qty: s.quantity, unit: item.unit, exp: s.expiryDate });
        }
      }
    }
  });
  
  // メール送信
  Object.values(byDept).forEach(({ dept, items }) => {
    if (!dept.email) return;
    
    let body = `【${dept.name}】 以下の救急用品が${yr}年${mo + 1}月中に期限を迎えます。\n\n`;
    items.forEach(e => { body += `  • ${e.item} × ${e.qty}${e.unit} (期限: ${e.exp})\n`; });
    body += `\n早めに使用または入れ替えをお願いします。`;
    
    try {
      MailApp.sendEmail({ to: dept.email, subject: `【救急用品在庫管理】${dept.name} 期限切れ間近 (${yr}年${mo + 1}月)`, body });
      Logger.log(`${dept.name} へリマインド送信完了`);
    } catch (e) { Logger.log(`${dept.name} へのメール送信失敗: ${e.message}`); }
  });
  
  // 全体サマリー
  if (CONFIG.REMINDER_EMAILS && Object.keys(byDept).length > 0) {
    let summary = `【全部署サマリー】 ${yr}年${mo + 1}月に期限を迎える用品:\n\n`;
    Object.values(byDept).forEach(({ dept, items }) => {
      summary += `■ ${dept.name}\n`;
      items.forEach(e => { summary += `  - ${e.item} × ${e.qty}${e.unit} (${e.exp})\n`; });
      summary += '\n';
    });
    try {
      MailApp.sendEmail({ to: CONFIG.REMINDER_EMAILS, subject: `【救急用品在庫管理】全部署 期限切れサマリー (${yr}年${mo + 1}月)`, body: summary });
    } catch (e) { Logger.log(`サマリーメール送信失敗: ${e.message}`); }
  }
}

/**
 * Supabaseベースの低在庫リマインダー
 */
function checkLowStockSupabase() {
  const stocks = getSupabaseStocks();
  const items = getSupabaseItems();
  
  const byDept = {};
  
  DEPARTMENTS.forEach(dept => {
    items.forEach(item => {
      if (item.minStock && item.minStock > 0) {
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
  
  Object.values(byDept).forEach(({ dept, items }) => {
    if (!dept.email) return;
    let body = `【${dept.name}】 以下の用品が最低在庫数を下回っています。\n\n`;
    items.forEach(e => { body += `  • ${e.name}: 現在 ${e.current}${e.unit} / 最低 ${e.min}${e.unit}\n`; });
    body += `\n早めに補充をお願いします。`;
    try {
      MailApp.sendEmail({ to: dept.email, subject: `【救急用品在庫管理】${dept.name} 在庫不足アラート`, body });
    } catch (e) { Logger.log(`${dept.name} へのメール送信失敗: ${e.message}`); }
  });
}

/**
 * Supabaseリマインダー用のトリガー設定
 */
function setupSupabaseReminderTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendExpiryReminderSupabase').timeBased().onMonthDay(1).atHour(9).create();
  ScriptApp.newTrigger('checkMonthEndSupabase').timeBased().everyDays(1).atHour(9).create();
  ScriptApp.newTrigger('checkLowStockSupabase').timeBased().everyDays(1).atHour(8).create();
  Logger.log('Supabaseリマインドトリガーを設定しました');
}

function checkMonthEndSupabase() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.getDate() === 1) sendExpiryReminderSupabase();
}
