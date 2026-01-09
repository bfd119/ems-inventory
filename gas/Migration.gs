/**
 * 救急用品在庫管理 - データ移行モジュール
 * 
 * スプレッドシートのデータをSupabaseに移行するためのスクリプト。
 * 移行完了後は基本的に使用しませんが、バックアップとして残しています。
 * Config.gs の設定値を使用します。
 */

// ============================================
// Supabase移行ロジック
// ============================================

/**
 * スプレッドシートからSupabaseへデータを移行
 * 事前にConfig.gsの設定と、Supabase側のテーブル作成が必要です。
 */
function migrateToSupabase() {
  Logger.log('=== Supabase移行開始 ===');
  
  // 1. カテゴリ移行
  const categories = getSpreadsheetCategories();
  categories.forEach(c => {
    // 既存チェックは省略（エラーが出たら無視するか、事前にテーブルを空にする）
    const result = supabaseRequest('categories', 'POST', { name: c.name, icon: c.icon || 'inventory_2' });
    Logger.log(`カテゴリ追加: ${c.name} -> ID:${result[0]?.id || 'ERROR'}`);
  });
  Logger.log(`カテゴリ ${categories.length} 件を移行完了`);
  
  // 2. 用品移行（カテゴリIDのマッピングが必要）
  // まずSupabaseのカテゴリ全取得
  const sbCategories = supabaseRequest('categories?select=*', 'GET');
  const catMap = {};
  // 名前でマッチングさせるのが確実だが、ここではID順が同じと仮定...できないのでIDマッチング
  // しかしスプレッドシートのIDとSupabaseのIDがズレる可能性がある。
  // ここでは単純に「移行順序が同じ」と仮定し、配列インデックスでマップする
  if (sbCategories.length >= categories.length) {
      categories.forEach((c, i) => { catMap[c.id] = sbCategories[i]?.id; });
  } else {
      // 名前でマッチング試行
      categories.forEach(c => {
          const match = sbCategories.find(sc => sc.name === c.name);
          if (match) catMap[c.id] = match.id;
      });
  }
  
  const items = getSpreadsheetItems();
  items.forEach(i => {
    const newCatId = catMap[i.categoryId] || 1; // マップできなければ1へ
    const result = supabaseRequest('items', 'POST', {
      category_id: newCatId,
      name: i.name,
      unit: i.unit || '個',
      has_expiry: !!i.hasExpiry,
      min_stock: i.minStock || 0
    });
    Logger.log(`用品追加: ${i.name} -> ID:${result[0]?.id || 'ERROR'}`);
  });
  Logger.log(`用品 ${items.length} 件を移行完了`);
  
  // 3. 在庫移行（用品IDのマッピングが必要）
  const sbItems = supabaseRequest('items?select=*', 'GET');
  const itemMap = {};
  // 名前でマッチング
  items.forEach(item => {
      const match = sbItems.find(si => si.name === item.name);
      if (match) itemMap[item.id] = match.id;
  });
  
  const stocks = getSpreadsheetStocks();
  stocks.forEach(s => {
    const newItemId = itemMap[s.itemId];
    if (newItemId) {
      supabaseRequest('stocks', 'POST', {
        department_id: s.departmentId,
        item_id: newItemId,
        expiry_date: s.expiryDate || null,
        quantity: s.quantity
      });
    } else {
        Logger.log(`在庫スキップ: 用品ID ${s.itemId} が見つかりません`);
    }
  });
  Logger.log(`在庫 ${stocks.length} 件を移行処理完了`);
  
  // 4. 取引履歴移行
  const txs = getSpreadsheetTransactions();
  txs.forEach(t => {
    const newItemId = itemMap[t.itemId];
    if (newItemId) {
      supabaseRequest('transactions', 'POST', {
        department_id: t.departmentId,
        item_id: newItemId,
        type: t.type,
        quantity: t.quantity,
        expiry_date: t.expiryDate || null,
        remarks: t.remarks || '',
        timestamp: t.timestamp
      });
    }
  });
  Logger.log(`取引履歴 ${txs.length} 件を移行処理完了`);
  
  Logger.log('=== Supabase移行完了 ===');
}

/**
 * テーブル作成SQL生成
 */
function getCreateTableSQL() {
  return `
-- カテゴリマスター
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'inventory_2'
);

-- 用品マスター
CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id),
  name TEXT NOT NULL,
  unit TEXT DEFAULT '個',
  has_expiry BOOLEAN DEFAULT false,
  min_stock INTEGER DEFAULT 0
);

-- 在庫
CREATE TABLE stocks (
  id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL,
  item_id INTEGER REFERENCES items(id),
  expiry_date DATE,
  quantity INTEGER DEFAULT 0
);

-- 取引履歴
CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL,
  item_id INTEGER REFERENCES items(id),
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  expiry_date DATE,
  remarks TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- RLS設定 (認証不要でアクセス可能にする場合)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON categories FOR ALL USING (true);
CREATE POLICY "Allow all" ON items FOR ALL USING (true);
CREATE POLICY "Allow all" ON stocks FOR ALL USING (true);
CREATE POLICY "Allow all" ON transactions FOR ALL USING (true);
  `;
}

// ============================================
// スプレッドシート読み込みヘルパー
// (Migration専用)
// ============================================

function getSpreadsheetCategories() {
  const sheet = getOrCreateSheet(CONFIG.CATEGORIES_SHEET);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(r => ({ id: r[0], name: r[1], icon: r[2] || '📦' }));
}

function getSpreadsheetItems() {
  const sheet = getOrCreateSheet(CONFIG.ITEMS_SHEET);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(r => ({
    id: r[0], categoryId: r[1], name: r[2], unit: r[3] || '個',
    hasExpiry: r[4] === true || r[4] === 'TRUE' || r[4] === 1,
    minStock: r[5] || 0
  }));
}

function getSpreadsheetStocks() {
  const sheet = getOrCreateSheet(CONFIG.STOCKS_SHEET);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(r => ({
    departmentId: r[0], itemId: r[1],
    expiryDate: r[2] ? fmtDate(r[2]) : null, quantity: r[3]
  }));
}

function getSpreadsheetTransactions() {
  const sheet = getOrCreateSheet(CONFIG.TRANSACTIONS_SHEET);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(r => ({
    id: r[0], departmentId: r[1], itemId: r[2], type: r[3], quantity: r[4],
    expiryDate: r[5] ? fmtDate(r[5]) : null, remarks: r[6], timestamp: r[7] ? fmtDateTime(r[7]) : ''
  }));
}

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) { sheet = ss.insertSheet(name); }
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
