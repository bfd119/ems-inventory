/**
 * Supabase データ移行スクリプト
 * 
 * 既存のスプレッドシートからSupabaseにデータをエクスポートします。
 * 
 * 【使用手順】
 * 1. Supabaseプロジェクトを作成
 * 2. 下記のSQLでテーブルを作成
 * 3. SUPABASE_URL と SUPABASE_SERVICE_KEY を設定
 * 4. migrateToSupabase() を実行
 */

// Supabase設定
const SUPABASE_URL = 'https://aacntdoacjjssspoctul.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY250ZG9hY2pqc3NzcG9jdHVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzkwMDk5NywiZXhwIjoyMDgzNDc2OTk3fQ.knTlspYRILXuyA9NVTc58iMeM6OEcsJwH-J21FGddRs';

/**
 * Supabase REST API リクエスト
 */
function supabaseRequest(table, method, data) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  
  const options = {
    method: method,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    muteHttpExceptions: true
  };
  
  if (data) {
    options.payload = JSON.stringify(data);
  }
  
  const response = UrlFetchApp.fetch(url, options);
  return JSON.parse(response.getContentText());
}

/**
 * スプレッドシートからSupabaseへデータを移行
 */
function migrateToSupabase() {
  Logger.log('=== Supabase移行開始 ===');
  
  // カテゴリ移行
  const categories = getCategories();
  categories.forEach(c => {
    const result = supabaseRequest('categories', 'POST', { name: c.name, icon: c.icon || 'inventory_2' });
    Logger.log(`カテゴリ追加: ${c.name} -> ID:${result[0]?.id || 'ERROR'}`);
  });
  Logger.log(`カテゴリ ${categories.length} 件を移行完了`);
  
  // 用品移行（カテゴリIDのマッピングが必要）
  // まずSupabaseのカテゴリを取得
  const sbCategories = supabaseRequest('categories?select=*', 'GET');
  const catMap = {};
  categories.forEach((c, i) => { catMap[c.id] = sbCategories[i]?.id; });
  
  const items = getItems();
  items.forEach(i => {
    const newCatId = catMap[i.categoryId] || 1;
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
  
  // 用品IDのマッピング
  const sbItems = supabaseRequest('items?select=*', 'GET');
  const itemMap = {};
  items.forEach((item, i) => { itemMap[item.id] = sbItems[i]?.id; });
  
  // 在庫移行
  const stocks = getStocks();
  stocks.forEach(s => {
    const newItemId = itemMap[s.itemId];
    if (newItemId) {
      supabaseRequest('stocks', 'POST', {
        department_id: s.departmentId,
        item_id: newItemId,
        expiry_date: s.expiryDate || null,
        quantity: s.quantity
      });
    }
  });
  Logger.log(`在庫 ${stocks.length} 件を移行完了`);
  
  // 取引履歴移行
  const txs = getTransactions();
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
  Logger.log(`取引履歴 ${txs.length} 件を移行完了`);
  
  Logger.log('=== Supabase移行完了 ===');
}

/**
 * テーブル作成SQL（Supabase SQL Editorで実行）
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

-- 全テーブルにRLSを無効化（認証不要の場合）
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
