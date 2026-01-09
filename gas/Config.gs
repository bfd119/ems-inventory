/**
 * 救急用品在庫管理 - 共通設定
 * 
 * すべてのGASスクリプトで共有される設定値
 */

// ============================================
// Supabase 設定
// ============================================
const SUPABASE_URL = 'https://aacntdoacjjssspoctul.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY250ZG9hY2pqc3NzcG9jdHVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzkwMDk5NywiZXhwIjoyMDgzNDc2OTk3fQ.knTlspYRILXuyA9NVTc58iMeM6OEcsJwH-J21FGddRs';

// ============================================
// 部署情報
// ============================================
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
// システム設定
// ============================================
const CONFIG = {
  CATEGORIES_SHEET: 'カテゴリマスター',
  ITEMS_SHEET: '用品マスター',
  STOCKS_SHEET: '在庫',
  TRANSACTIONS_SHEET: '取引履歴',
  REMINDER_EMAILS: 'example@city.shobara.lg.jp', // 全体管理者への通知先
  CACHE_TTL: 300
};

// ============================================
// Supabase API ヘルパー
// ============================================

/**
 * Supabase REST API リクエストを実行
 * @param {string} table テーブル名 (e.g., 'stocks?select=*')
 * @param {string} method HTTPメソッド (GET, POST, PATCH, DELETE)
 * @param {Object} data 送信データ (POST/PATCHの場合)
 * @return {Object} レスポンスデータ (JSON)
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
  try {
    return JSON.parse(response.getContentText());
  } catch (e) {
    Logger.log('Error parsing response: ' + response.getContentText());
    return { error: 'Failed to parse response', raw: response.getContentText() };
  }
}
