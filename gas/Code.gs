/**
 * EMS在庫管理システム - GAS API バックエンド
 * 
 * GitHub Pages からfetch APIで呼び出すためのJSON API
 * スプレッドシートをデータベースとして使用
 * 
 * 【デプロイ設定】
 * - 種類: ウェブアプリ
 * - 実行ユーザー: 自分
 * - アクセス権: 全員
 */

// ============================================
// 設定
// ============================================
const CONFIG = {
  CATEGORIES_SHEET: 'カテゴリマスター',
  ITEMS_SHEET: '用品マスター',
  STOCKS_SHEET: '在庫',
  TRANSACTIONS_SHEET: '取引履歴',
  REMINDER_EMAILS: 'example@city.shobara.lg.jp',
  CACHE_TTL: 300  // キャッシュ有効期間（秒）5分
};

// キャッシュキー
const CACHE_KEYS = {
  MASTER_DATA: 'ems_master_data',
  STOCKS: 'ems_stocks',
  TRANSACTIONS: 'ems_transactions'
};

const DEPARTMENTS = [
  { id: 1, name: "警防課", email: "keibou@119-bihoku.jp" },
  { id: 2, name: "三次", email: "miyoshi@119-bihoku.jp" },
  { id: 3, name: "作木", email: "sakugi@119-bihoku.jp" },
  { id: 4, name: "吉舎", email: "kisa@119-bihoku.jp" },
  { id: 5, name: "三和", email: "miwa@119-bihoku.jp" },
  { id: 6, name: "口和", email: "kutiwa@119-bihoku.jp" },
  { id: 7, name: "甲奴", email: "kounu@119-bihoku.jp" },
  { id: 8, name: "庄原", email: "shoubara@119-bihoku.jp" },
  { id: 9, name: "西城", email: "saijou@119-bihoku.jp" },
  { id: 10, name: "高野", email: "takano@119-bihoku.jp" },
  { id: 11, name: "東城", email: "toujou@119-bihoku.jp" }
];

// ============================================
// API エンドポイント
// ============================================

/**
 * GET リクエスト処理
 */
function doGet(e) {
  const action = e.parameter.action;
  let result;
  
  try {
    switch (action) {
      case 'getMasterData':
        result = getCachedMasterData();
        break;
      case 'getStocks':
        result = getCachedStocks();
        break;
      case 'getTransactions':
        result = getCachedTransactions(parseInt(e.parameter.limit) || 100);
        break;
      case 'getStockLots':
        result = getStockLots(parseInt(e.parameter.deptId), parseInt(e.parameter.itemId));
        break;
      default:
        result = { error: 'Unknown action' };
    }
  } catch (err) {
    result = { error: err.message };
  }
  
  return jsonResponse(result);
}

// ============================================
// キャッシュ付きデータ取得
// ============================================

function getCachedMasterData() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEYS.MASTER_DATA);
  if (cached) {
    return JSON.parse(cached);
  }
  const data = { departments: DEPARTMENTS, categories: getCategories(), items: getItems() };
  cache.put(CACHE_KEYS.MASTER_DATA, JSON.stringify(data), CONFIG.CACHE_TTL);
  return data;
}

function getCachedStocks() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEYS.STOCKS);
  if (cached) {
    return JSON.parse(cached);
  }
  const data = getStocks();
  cache.put(CACHE_KEYS.STOCKS, JSON.stringify(data), CONFIG.CACHE_TTL);
  return data;
}

function getCachedTransactions(limit) {
  // 取引履歴はlimit付きなのでキャッシュキーにlimitを含める
  const cacheKey = CACHE_KEYS.TRANSACTIONS + '_' + limit;
  const cache = CacheService.getScriptCache();
  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  const data = getTransactions(limit);
  cache.put(cacheKey, JSON.stringify(data), CONFIG.CACHE_TTL);
  return data;
}

// キャッシュをクリア
function clearAllCache() {
  const cache = CacheService.getScriptCache();
  cache.removeAll([CACHE_KEYS.MASTER_DATA, CACHE_KEYS.STOCKS, CACHE_KEYS.TRANSACTIONS + '_100']);
}

function clearStocksCache() {
  const cache = CacheService.getScriptCache();
  cache.remove(CACHE_KEYS.STOCKS);
  cache.remove(CACHE_KEYS.TRANSACTIONS + '_100');
}

function clearMasterCache() {
  const cache = CacheService.getScriptCache();
  cache.remove(CACHE_KEYS.MASTER_DATA);
}

/**
 * POST リクエスト処理
 */
function doPost(e) {
  let result;
  
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    switch (action) {
      case 'addCategory':
        result = addCategory(data.name, data.icon);
        clearMasterCache();  // マスターデータのキャッシュをクリア
        break;
      case 'updateCategory':
        result = updateCategory(data.id, data.name, data.icon);
        clearMasterCache();
        break;
      case 'deleteCategory':
        result = deleteCategory(data.id);
        clearMasterCache();
        break;
      case 'addItem':
        result = addItem(data.categoryId, data.name, data.unit, data.hasExpiry, data.minStock);
        clearMasterCache();
        break;
      case 'updateItem':
        result = updateItem(data.id, data.categoryId, data.name, data.unit, data.hasExpiry, data.minStock);
        clearMasterCache();
        break;
      case 'deleteItem':
        result = deleteItem(data.id);
        clearMasterCache();
        break;
      case 'stockIn':
        stockIn(data.deptId, data.itemId, data.expiryDate, data.quantity);
        result = addTransaction(data.deptId, data.itemId, 'IN', data.quantity, data.expiryDate, data.remarks, data.transactionDate);
        clearStocksCache();  // 在庫キャッシュをクリア
        break;
      case 'stockOut':
        stockOut(data.deptId, data.itemId, data.expiryDate, data.quantity);
        result = addTransaction(data.deptId, data.itemId, 'OUT', data.quantity, data.expiryDate, data.remarks, data.transactionDate);
        clearStocksCache();
        break;
      case 'updateStockExpiry':
        result = updateStockExpiry(data.deptId, data.itemId, data.oldExpiry, data.newExpiry);
        clearStocksCache();
        break;
      default:
        result = { error: 'Unknown action' };
    }
  } catch (err) {
    result = { error: err.message };
  }
  
  return jsonResponse(result);
}

/**
 * JSONレスポンスを返す
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// カテゴリ・用品マスター
// ============================================

function getCategories() {
  const sheet = getOrCreateSheet(CONFIG.CATEGORIES_SHEET, ['ID', '名前', 'アイコン']);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(r => ({ id: r[0], name: r[1], icon: r[2] || '📦' }));
}

function addCategory(name, icon) {
  const sheet = getOrCreateSheet(CONFIG.CATEGORIES_SHEET, ['ID', '名前', 'アイコン']);
  const data = sheet.getDataRange().getValues();
  const newId = data.length > 1 ? Math.max(...data.slice(1).map(r => r[0])) + 1 : 1;
  sheet.appendRow([newId, name, icon || 'inventory_2']);
  return { id: newId, name, icon: icon || 'inventory_2' };
}

function updateCategory(id, name, icon) {
  const sheet = getOrCreateSheet(CONFIG.CATEGORIES_SHEET, ['ID', '名前', 'アイコン']);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 2, 1, 2).setValues([[name, icon || 'inventory_2']]);
      return { id, name, icon: icon || 'inventory_2' };
    }
  }
  return { error: 'Category not found' };
}

function deleteCategory(id) {
  const sheet = getOrCreateSheet(CONFIG.CATEGORIES_SHEET, ['ID', '名前', 'アイコン']);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) { sheet.deleteRow(i + 1); break; }
  }
  deleteItemsByCategory(id);
  return { success: true };
}

function getItems() {
  const sheet = getOrCreateSheet(CONFIG.ITEMS_SHEET, ['ID', 'カテゴリID', '名前', '単位', '期限あり', '最低在庫数']);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(r => ({
    id: r[0], categoryId: r[1], name: r[2], unit: r[3] || '個',
    hasExpiry: r[4] === true || r[4] === 'TRUE' || r[4] === 1,
    minStock: r[5] || 0
  }));
}

function addItem(categoryId, name, unit, hasExpiry, minStock) {
  const sheet = getOrCreateSheet(CONFIG.ITEMS_SHEET, ['ID', 'カテゴリID', '名前', '単位', '期限あり', '最低在庫数']);
  const data = sheet.getDataRange().getValues();
  const newId = data.length > 1 ? Math.max(...data.slice(1).map(r => r[0])) + 1 : 1;
  sheet.appendRow([newId, categoryId, name, unit || '個', hasExpiry, minStock || 0]);
  return { id: newId, categoryId, name, unit: unit || '個', hasExpiry, minStock: minStock || 0 };
}

function updateItem(id, categoryId, name, unit, hasExpiry, minStock) {
  const sheet = getOrCreateSheet(CONFIG.ITEMS_SHEET, ['ID', 'カテゴリID', '名前', '単位', '期限あり', '最低在庫数']);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.getRange(i + 1, 2, 1, 5).setValues([[categoryId, name, unit || '個', hasExpiry, minStock || 0]]);
      return { id, categoryId, name, unit: unit || '個', hasExpiry, minStock: minStock || 0 };
    }
  }
  return { error: 'Item not found' };
}

function deleteItem(id) {
  const sheet = getOrCreateSheet(CONFIG.ITEMS_SHEET, ['ID', 'カテゴリID', '名前', '単位', '期限あり']);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) { sheet.deleteRow(i + 1); break; }
  }
  return { success: true };
}

function deleteItemsByCategory(categoryId) {
  const sheet = getOrCreateSheet(CONFIG.ITEMS_SHEET, ['ID', 'カテゴリID', '名前', '単位', '期限あり']);
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][1] === categoryId) sheet.deleteRow(i + 1);
  }
}

// ============================================
// 在庫（期限ロット別）
// ============================================

function getStocks() {
  const sheet = getOrCreateSheet(CONFIG.STOCKS_SHEET, ['部署ID', '用品ID', '使用期限', '数量']);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(r => ({
    departmentId: r[0], itemId: r[1],
    expiryDate: r[2] ? fmtDate(r[2]) : null, quantity: r[3]
  }));
}

function getStockLots(deptId, itemId) {
  return getStocks().filter(s => s.departmentId === deptId && s.itemId === itemId && s.quantity > 0);
}

function updateStockLot(deptId, itemId, expiryDate, quantity) {
  const sheet = getOrCreateSheet(CONFIG.STOCKS_SHEET, ['部署ID', '用品ID', '使用期限', '数量']);
  const data = sheet.getDataRange().getValues();
  const expKey = expiryDate || '';
  let rowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    const rowExp = data[i][2] ? fmtDate(data[i][2]) : '';
    if (data[i][0] === deptId && data[i][1] === itemId && rowExp === expKey) { rowIdx = i + 1; break; }
  }
  const expDate = expiryDate ? new Date(expiryDate) : '';
  if (rowIdx > 0) {
    if (quantity <= 0) sheet.deleteRow(rowIdx);
    else sheet.getRange(rowIdx, 4).setValue(quantity);
  } else if (quantity > 0) {
    sheet.appendRow([deptId, itemId, expDate, quantity]);
  }
}

function stockIn(deptId, itemId, expiryDate, quantity) {
  const lots = getStockLots(deptId, itemId);
  const expKey = expiryDate || '';
  const existing = lots.find(l => (l.expiryDate || '') === expKey);
  updateStockLot(deptId, itemId, expiryDate, (existing ? existing.quantity : 0) + quantity);
}

function stockOut(deptId, itemId, expiryDate, quantity) {
  const lots = getStockLots(deptId, itemId);
  const expKey = expiryDate || '';
  const existing = lots.find(l => (l.expiryDate || '') === expKey);
  if (!existing || existing.quantity < quantity) throw new Error('在庫不足');
  updateStockLot(deptId, itemId, expiryDate, existing.quantity - quantity);
}

function updateStockExpiry(deptId, itemId, oldExpiry, newExpiry) {
  const sheet = getOrCreateSheet(CONFIG.STOCKS_SHEET, ['部署ID', '用品ID', '使用期限', '数量']);
  const data = sheet.getDataRange().getValues();
  const oldKey = oldExpiry || '';
  for (let i = 1; i < data.length; i++) {
    const rowExp = data[i][2] ? fmtDate(data[i][2]) : '';
    if (data[i][0] === deptId && data[i][1] === itemId && rowExp === oldKey) {
      const newDate = newExpiry ? new Date(newExpiry) : '';
      sheet.getRange(i + 1, 3).setValue(newDate);
      return { success: true, deptId, itemId, oldExpiry, newExpiry };
    }
  }
  return { error: '該当する在庫ロットが見つかりません' };
}

// ============================================
// 取引履歴
// ============================================

function getTransactions(limit) {
  const sheet = getOrCreateSheet(CONFIG.TRANSACTIONS_SHEET, ['ID', '部署ID', '用品ID', '種別', '数量', '使用期限', '備考', '日時']);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const txs = data.slice(1).map(r => ({
    id: r[0], departmentId: r[1], itemId: r[2], type: r[3], quantity: r[4],
    expiryDate: r[5] ? fmtDate(r[5]) : null, remarks: r[6], timestamp: r[7] ? fmtDateTime(r[7]) : ''
  }));
  txs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return limit ? txs.slice(0, limit) : txs;
}

function addTransaction(deptId, itemId, type, quantity, expiryDate, remarks, transactionDate) {
  const sheet = getOrCreateSheet(CONFIG.TRANSACTIONS_SHEET, ['ID', '部署ID', '用品ID', '種別', '数量', '使用期限', '備考', '日時']);
  const id = Date.now();
  const ts = transactionDate ? new Date(transactionDate) : new Date();
  sheet.appendRow([id, deptId, itemId, type, quantity, expiryDate ? new Date(expiryDate) : '', remarks || '', ts]);
  return { id, departmentId: deptId, itemId, type, quantity, expiryDate, remarks, timestamp: fmtDateTime(ts) };
}

// ============================================
// ヘルパー
// ============================================

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) { sheet = ss.insertSheet(name); if (headers) sheet.appendRow(headers); }
  return sheet;
}

function fmtDate(d) {
  if (!d) return null;
  return Utilities.formatDate(new Date(d), 'Asia/Tokyo', 'yyyy-MM-dd');
}

function fmtDateTime(d) {
  if (!d) return '';
  return Utilities.formatDate(new Date(d), 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ss");
}

// ============================================
// 初期化
// ============================================

function initializeSpreadsheet() {
  getOrCreateSheet(CONFIG.CATEGORIES_SHEET, ['ID', '名前', 'アイコン']);
  getOrCreateSheet(CONFIG.ITEMS_SHEET, ['ID', 'カテゴリID', '名前', '単位', '期限あり']);
  getOrCreateSheet(CONFIG.STOCKS_SHEET, ['部署ID', '用品ID', '使用期限', '数量']);
  getOrCreateSheet(CONFIG.TRANSACTIONS_SHEET, ['ID', '部署ID', '用品ID', '種別', '数量', '使用期限', '備考', '日時']);
  Logger.log('初期化完了');
}

function insertDefaultCategories() {
  [{ name: '輸液', icon: 'vaccines' }, { name: '薬剤', icon: 'medication' }, { name: '気道管理', icon: 'medical_services' },
   { name: '資機材', icon: 'stethoscope' }, { name: '消耗品', icon: 'healing' }, { name: 'その他', icon: 'inventory_2' }]
    .forEach(c => addCategory(c.name, c.icon));
  Logger.log('デフォルトカテゴリ追加完了');
}

// ============================================
// リマインド
// ============================================

function sendExpiryReminder() {
  const stocks = getStocks(), items = getItems();
  const today = new Date(), yr = today.getFullYear(), mo = today.getMonth();
  
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
  
  // 全体管理者にもサマリーを送信（CONFIG.REMINDER_EMAILSが設定されている場合）
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

function setupReminderTriggers() {
  // 既存のトリガーを削除
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  // 毎月1日の朝9時に実行（月初リマインド）
  ScriptApp.newTrigger('sendExpiryReminder').timeBased().onMonthDay(1).atHour(9).create();
  // 毎日チェックし、月末なら期限リマインド送信
  ScriptApp.newTrigger('checkMonthEnd').timeBased().everyDays(1).atHour(9).create();
  // 毎日チェックし、低在庫ならリマインド送信
  ScriptApp.newTrigger('checkLowStock').timeBased().everyDays(1).atHour(8).create();
  Logger.log('リマインドトリガーを設定しました（月初1日 + 月末 + 低在庫毎日）');
}

function checkMonthEnd() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  // 明日が1日 = 今日が月末
  if (tomorrow.getDate() === 1) {
    sendExpiryReminder();
  }
}

function checkLowStock() {
  const stocks = getStocks();
  const items = getItems();
  
  // 部署ごとに低在庫アイテムを集計
  const byDept = {};
  
  DEPARTMENTS.forEach(dept => {
    const deptStocks = stocks.filter(s => s.departmentId === dept.id);
    
    items.forEach(item => {
      if (item.minStock && item.minStock > 0) {
        // その部署のこの用品の在庫合計を計算
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
    if (!dept.email) {
      Logger.log(`${dept.name} のメールアドレスが設定されていません`);
      return;
    }
    
    let body = `【${dept.name}】 以下の用品が最低在庫数を下回っています。\n\n`;
    items.forEach(e => {
      body += `  • ${e.name}: 現在 ${e.current}${e.unit} / 最低 ${e.min}${e.unit}\n`;
    });
    body += `\n早めに補充をお願いします。`;
    
    try {
      MailApp.sendEmail({
        to: dept.email,
        subject: `【救急用品在庫管理】${dept.name} 在庫不足アラート`,
        body
      });
      Logger.log(`${dept.name} へ低在庫アラート送信完了: ${dept.email}`);
    } catch (e) {
      Logger.log(`${dept.name} へのメール送信失敗: ${e.message}`);
    }
  });
  
  // 全体管理者にもサマリーを送信
  if (CONFIG.REMINDER_EMAILS && Object.keys(byDept).length > 0) {
    let summary = `【低在庫アラート全部署サマリー】\n\n`;
    Object.values(byDept).forEach(({ dept, items }) => {
      summary += `■ ${dept.name}\n`;
      items.forEach(e => { summary += `  - ${e.name}: ${e.current}${e.unit} / 最低${e.min}${e.unit}\n`; });
      summary += '\n';
    });
    
    try {
      MailApp.sendEmail({
        to: CONFIG.REMINDER_EMAILS,
        subject: `【救急用品在庫管理】低在庫アラートサマリー`,
        body: summary
      });
      Logger.log('全体低在庫サマリーメール送信完了');
    } catch (e) {
      Logger.log(`サマリーメール送信失敗: ${e.message}`);
    }
  }
}

// ============================================
// データ初期化 (一括登録用)
// ============================================

const MASTER_DATA = {
    '医薬品': { icon: 'medication', items: ['アドレナリン', 'ブドウ糖', 'ソルラクト'] },
    '静脈路確保': { icon: 'vaccines', items: ['針18G', '針20G', '針22G', '針24G', '輸液セット', 'カテーリープ', 'キープポア（サイズ1.2㎝）', 'キープポア（サイズ2.5㎝）', '酒精綿', '針ポイ', '穿刺絆創膏（インジェクション）'] },
    '気管挿管': { icon: 'medical_services', items: ['チューブ6.0mm', 'チューブ6.5mm', 'チューブ7.0mm', 'チューブ7.5mm', 'チューブ8.0mm', 'イントロック', 'イントロック薄型', 'イージーキャップⅡ', 'AWチェッカー', 'トーマスホルダー', 'スタイレット', 'ETCO2センサー'] },
    '血糖測定': { icon: 'bloodtype', items: ['血糖チップ', '血糖針'] },
    '気道管理': { icon: 'sick', items: ['LT#５', 'LT#４', 'LT#３', 'LT#2.5', 'LT#２', 'LT#１', 'LT#０', '酸素マスク成人高', '酸素マスク成人中', '酸素マスク小児高', '酸素マスク小児中', '鼻カニューレ', '吸引チューブ18Fr', '吸引チューブ16Fr', '吸引チューブ14Fr', '吸引チューブ12Fr', '吸引チューブ10Fr', 'サクション10Fr', 'サクション12Fr', 'サクション14Fr', 'サクション16Fr', 'サクション18Fr', '経鼻AW 6', '経鼻AW 7', '経鼻AW 8', '経口AW6.0', '経口AW7.0', '経口AW8.0', '人工鼻', 'セレスパック', '潤滑剤(チューブ塗布）', '羊水カテーテル', 'ヤンカーサクション', 'i-GEL #5', 'フローキャップ', 'i-GEL #4', 'i-GEL #3'] },
    '感染防止衣': { icon: 'checkroom', items: ['上衣S', '上衣M', '上衣L', '上衣LL', '下衣S', '下衣M', '下衣L', '下衣LL', 'タイベックLL', 'タイベックL', 'タイベックM', 'エアクールM', 'エアクールL', 'エアクールLL', 'エアクール（ファン）', 'エアクール（バッテリー）', 'エアクール（フィルター）'] },
    '感染防止': { icon: 'clean_hands', items: ['サージカルマスク（箱）', 'N95マスク（枚）', 'プラ手LL（箱）', 'プラ手L（箱）', 'プラ手M（箱）', 'プラ手S（箱）', 'アームカバー', 'ロング手袋L', 'ロング手袋M', 'ストレッチャーカバー', 'シューズカバー（枚）', 'シューズカバー（ブーツ）', 'ゴーグル', 'ソンタラシート'] },
    '外傷': { icon: 'healing', items: ['三角巾', 'サージカルパッド', '伸縮包帯', 'アルミックシート', 'ケーパイン', 'ネックカラー(成人）', 'ネックカラー(小児）', 'トランスーム'] },
    '消毒': { icon: 'sanitizer', items: ['アルガーゼ詰替', 'アルガーゼ本体', '消毒用エタノール（手指消毒用）', '消毒用エタノール（資器材用）', '次亜塩素酸Na', 'マスキン液'] },
    'その他': { icon: 'inventory_2', items: ['搬送表', 'ZOLL記録紙', 'DASH記録紙', '冷却剤', 'トリアージタグ', '救命講習テキスト', '応急手当テキスト', '入門テキスト', '養生テープ', 'マスカー（大）', 'マスカー（小）', 'フェイスシールド', 'お産セット'] },
    '心電図': { icon: 'monitor_heart', items: ['AEDパッド(FR3)', 'AEDパッド(ZOLL）', 'ECGパッド'] }
};

function initMasterData() {
    const cSheet = getOrCreateSheet(CONFIG.CATEGORIES_SHEET, ['ID', '名前', 'アイコン']);
    const iSheet = getOrCreateSheet(CONFIG.ITEMS_SHEET, ['ID', 'カテゴリID', '名前', '単位', '期限あり']);

    if (cSheet.getLastRow() > 1) cSheet.deleteRows(2, cSheet.getLastRow() - 1);
    if (iSheet.getLastRow() > 1) iSheet.deleteRows(2, iSheet.getLastRow() - 1);

    let cId = 1, iId = 1;
    const cRows = [], iRows = [];

    Object.entries(MASTER_DATA).forEach(([catName, data]) => {
        cRows.push([cId, catName, data.icon]);
        data.items.forEach(itemName => {
            iRows.push([iId, cId, itemName, '個', false]);
            iId++;
        });
        cId++;
    });

    if (cRows.length) cSheet.getRange(2, 1, cRows.length, 3).setValues(cRows);
    if (iRows.length) iSheet.getRange(2, 1, iRows.length, 5).setValues(iRows);
    
    Logger.log('マスターデータ初期化完了: カテゴリ=' + cRows.length + ', 用品=' + iRows.length);
}
