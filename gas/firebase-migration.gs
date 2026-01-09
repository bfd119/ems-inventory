/**
 * Firebase Firestore データ移行スクリプト
 * 
 * 既存のスプレッドシートからFirestoreにデータをエクスポートします。
 * 
 * 【使用手順】
 * 1. Firebase Admin SDK のサービスアカウントキーを取得
 * 2. このスクリプトをGASに追加
 * 3. migrateToFirestore() を実行
 */

// TODO: Firebase Admin SDK のサービスアカウントキー情報を設定
const FIREBASE_PROJECT_ID = 'YOUR_PROJECT_ID';
const FIREBASE_SERVICE_ACCOUNT_EMAIL = 'firebase-adminsdk-xxxx@YOUR_PROJECT_ID.iam.gserviceaccount.com';
const FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n';

/**
 * Firestoreにリクエストを送信
 */
function firestoreRequest(path, method, data) {
  const token = getFirebaseAccessToken();
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  
  const options = {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
  
  if (data) {
    options.payload = JSON.stringify(data);
  }
  
  const response = UrlFetchApp.fetch(baseUrl + path, options);
  return JSON.parse(response.getContentText());
}

/**
 * Firebase Access Token を取得
 */
function getFirebaseAccessToken() {
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  
  const jwtHeader = Utilities.base64EncodeWebSafe(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const jwtClaim = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss: FIREBASE_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: tokenUrl,
    iat: now,
    exp: now + 3600
  }));
  
  const signatureInput = jwtHeader + '.' + jwtClaim;
  const signature = Utilities.computeRsaSha256Signature(signatureInput, FIREBASE_PRIVATE_KEY);
  const jwt = signatureInput + '.' + Utilities.base64EncodeWebSafe(signature);
  
  const response = UrlFetchApp.fetch(tokenUrl, {
    method: 'post',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    }
  });
  
  return JSON.parse(response.getContentText()).access_token;
}

/**
 * Firestoreにドキュメントを作成
 */
function createDocument(collection, docId, data) {
  const fields = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === 'number') {
      fields[key] = Number.isInteger(value) ? { integerValue: value } : { doubleValue: value };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  });
  
  return firestoreRequest(`/${collection}?documentId=${docId}`, 'POST', { fields });
}

/**
 * スプレッドシートからFirestoreへデータを移行
 */
function migrateToFirestore() {
  Logger.log('=== Firestore移行開始 ===');
  
  // カテゴリ移行
  const categories = getCategories();
  categories.forEach(c => {
    createDocument('categories', String(c.id), c);
    Logger.log(`カテゴリ追加: ${c.name}`);
  });
  Logger.log(`カテゴリ ${categories.length} 件を移行完了`);
  
  // 用品移行
  const items = getItems();
  items.forEach(i => {
    createDocument('items', String(i.id), i);
    Logger.log(`用品追加: ${i.name}`);
  });
  Logger.log(`用品 ${items.length} 件を移行完了`);
  
  // 在庫移行
  const stocks = getStocks();
  stocks.forEach(s => {
    const docId = `${s.departmentId}_${s.itemId}_${s.expiryDate || 'noexp'}`;
    createDocument('stocks', docId, s);
  });
  Logger.log(`在庫 ${stocks.length} 件を移行完了`);
  
  // 取引履歴移行
  const txs = getTransactions();
  txs.forEach(t => {
    createDocument('transactions', String(t.id), t);
  });
  Logger.log(`取引履歴 ${txs.length} 件を移行完了`);
  
  Logger.log('=== Firestore移行完了 ===');
}

/**
 * 移行テスト（カテゴリのみ）
 */
function testMigration() {
  Logger.log('=== 移行テスト ===');
  const categories = getCategories();
  if (categories.length > 0) {
    const result = createDocument('categories', String(categories[0].id), categories[0]);
    Logger.log('テスト結果: ' + JSON.stringify(result));
  }
}
