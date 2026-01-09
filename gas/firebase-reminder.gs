/**
 * Firebase Firestore からデータを取得するリマインダーモジュール
 * 
 * 既存のリマインダー関数をFirestore対応に変更します。
 * firebase-migration.gs の FIREBASE_* 定数を設定してから使用してください。
 */

/**
 * Firestoreから全ドキュメントを取得
 */
function getFirestoreCollection(collection) {
  const response = firestoreRequest(`/${collection}`, 'GET', null);
  if (!response.documents) return [];
  
  return response.documents.map(doc => {
    const data = {};
    Object.entries(doc.fields || {}).forEach(([key, valueObj]) => {
      if (valueObj.integerValue !== undefined) data[key] = parseInt(valueObj.integerValue);
      else if (valueObj.doubleValue !== undefined) data[key] = parseFloat(valueObj.doubleValue);
      else if (valueObj.booleanValue !== undefined) data[key] = valueObj.booleanValue;
      else if (valueObj.stringValue !== undefined) data[key] = valueObj.stringValue;
      else if (valueObj.nullValue !== undefined) data[key] = null;
      else data[key] = null;
    });
    return data;
  });
}

/**
 * Firestoreからカテゴリを取得
 */
function getFirestoreCategories() {
  return getFirestoreCollection('categories');
}

/**
 * Firestoreから用品を取得
 */
function getFirestoreItems() {
  return getFirestoreCollection('items');
}

/**
 * Firestoreから在庫を取得
 */
function getFirestoreStocks() {
  return getFirestoreCollection('stocks');
}

/**
 * Firestoreベースの期限リマインダー送信
 */
function sendExpiryReminderFirestore() {
  // Firestoreからデータを取得
  const stocks = getFirestoreStocks();
  const items = getFirestoreItems();
  const today = new Date();
  const yr = today.getFullYear();
  const mo = today.getMonth();
  
  // 部署ごとに期限切れ間近の用品を集計
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
  
  // 部署ごとにメールを送信
  Object.values(byDept).forEach(({ dept, items }) => {
    if (!dept.email) {
      Logger.log(`${dept.name} のメールアドレスが設定されていません`);
      return;
    }
    
    let body = `【${dept.name}】 以下の救急用品が${yr}年${mo + 1}月中に期限を迎えます。\n\n`;
    items.forEach(e => {
      body += `  • ${e.item} × ${e.qty}${e.unit} (期限: ${e.exp})\n`;
    });
    body += `\n早めに使用または入れ替えをお願いします。`;
    
    try {
      MailApp.sendEmail({
        to: dept.email,
        subject: `【救急用品在庫管理】${dept.name} 期限切れ間近 (${yr}年${mo + 1}月)`,
        body
      });
      Logger.log(`${dept.name} へリマインド送信完了: ${dept.email}`);
    } catch (e) {
      Logger.log(`${dept.name} へのメール送信失敗: ${e.message}`);
    }
  });
  
  // 全体管理者にもサマリーを送信
  if (CONFIG.REMINDER_EMAILS && Object.keys(byDept).length > 0) {
    let summary = `【全部署サマリー】 ${yr}年${mo + 1}月に期限を迎える用品:\n\n`;
    Object.values(byDept).forEach(({ dept, items }) => {
      summary += `■ ${dept.name}\n`;
      items.forEach(e => { summary += `  - ${e.item} × ${e.qty}${e.unit} (${e.exp})\n`; });
      summary += '\n';
    });
    
    try {
      MailApp.sendEmail({
        to: CONFIG.REMINDER_EMAILS,
        subject: `【救急用品在庫管理】全部署 期限切れサマリー (${yr}年${mo + 1}月)`,
        body: summary
      });
      Logger.log('全体サマリーメール送信完了');
    } catch (e) {
      Logger.log(`サマリーメール送信失敗: ${e.message}`);
    }
  }
}

/**
 * Firestoreベースの低在庫リマインダー
 */
function checkLowStockFirestore() {
  const stocks = getFirestoreStocks();
  const items = getFirestoreItems();
  
  // 部署ごとに低在庫アイテムを集計
  const byDept = {};
  
  DEPARTMENTS.forEach(dept => {
    const deptStocks = stocks.filter(s => s.departmentId === dept.id);
    
    items.forEach(item => {
      if (item.minStock && item.minStock > 0) {
        const totalQty = deptStocks
          .filter(s => s.itemId === item.id)
          .reduce((sum, s) => sum + s.quantity, 0);
        
        if (totalQty < item.minStock) {
          if (!byDept[dept.id]) byDept[dept.id] = { dept, items: [] };
          byDept[dept.id].items.push({
            name: item.name,
            current: totalQty,
            min: item.minStock,
            unit: item.unit
          });
        }
      }
    });
  });
  
  // 部署ごとにメール送信
  Object.values(byDept).forEach(({ dept, items }) => {
    if (!dept.email) return;
    
    let body = `【${dept.name}】 以下の用品が最低在庫数を下回っています。\n\n`;
    items.forEach(e => {
      body += `  • ${e.name}: 現在 ${e.current}${e.unit} / 最低 ${e.min}${e.unit}\n`;
    });
    body += `\n早めに補充をお願いします。`;
    
    try {
      MailApp.sendEmail({ to: dept.email, subject: `【救急用品在庫管理】${dept.name} 在庫不足アラート`, body });
      Logger.log(`${dept.name} へ低在庫アラート送信完了`);
    } catch (e) {
      Logger.log(`${dept.name} へのメール送信失敗: ${e.message}`);
    }
  });
}

/**
 * Firestoreリマインダー用のトリガー設定
 */
function setupFirestoreReminderTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendExpiryReminderFirestore').timeBased().onMonthDay(1).atHour(9).create();
  ScriptApp.newTrigger('checkMonthEndFirestore').timeBased().everyDays(1).atHour(9).create();
  ScriptApp.newTrigger('checkLowStockFirestore').timeBased().everyDays(1).atHour(8).create();
  Logger.log('Firestoreリマインドトリガーを設定しました');
}

function checkMonthEndFirestore() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.getDate() === 1) {
    sendExpiryReminderFirestore();
  }
}
