/* ============================================
   EMS在庫管理システム - データ定義
   ============================================ */

// 部署マスターデータ
const DEPARTMENTS = [
    { id: 1, name: "警防課" },
    { id: 2, name: "三次" },
    { id: 3, name: "作木" },
    { id: 4, name: "吉舎" },
    { id: 5, name: "三和" },
    { id: 6, name: "口和" },
    { id: 7, name: "甲奴" },
    { id: 8, name: "庄原" },
    { id: 9, name: "西城" },
    { id: 10, name: "高野" },
    { id: 11, name: "東城" }
];

// カテゴリマスターデータ
const CATEGORIES = [
    { id: 1, name: "輸液", icon: "💉" },
    { id: 2, name: "薬剤", icon: "💊" },
    { id: 3, name: "気道管理", icon: "🫁" },
    { id: 4, name: "資機材", icon: "🩺" },
    { id: 5, name: "消耗品", icon: "🩹" },
    { id: 6, name: "その他", icon: "📦" }
];

// 用品マスターデータ（hasExpiry: 使用期限があるかどうか）
const ITEMS = [
    // 輸液（カテゴリID: 1）
    { id: 1, categoryId: 1, name: "生理食塩水 500ml", unit: "本", hasExpiry: true },
    { id: 2, categoryId: 1, name: "生理食塩水 100ml", unit: "本", hasExpiry: true },
    { id: 3, categoryId: 1, name: "乳酸リンゲル液 500ml", unit: "本", hasExpiry: true },
    { id: 4, categoryId: 1, name: "5%ブドウ糖液 500ml", unit: "本", hasExpiry: true },
    
    // 薬剤（カテゴリID: 2）
    { id: 10, categoryId: 2, name: "アドレナリン 1mg", unit: "アンプル", hasExpiry: true },
    { id: 11, categoryId: 2, name: "アトロピン 0.5mg", unit: "アンプル", hasExpiry: true },
    { id: 12, categoryId: 2, name: "リドカイン 2%", unit: "アンプル", hasExpiry: true },
    { id: 13, categoryId: 2, name: "50%ブドウ糖液 20ml", unit: "アンプル", hasExpiry: true },
    
    // 気道管理（カテゴリID: 3）
    { id: 20, categoryId: 3, name: "気管チューブ 7.0mm", unit: "本", hasExpiry: true },
    { id: 21, categoryId: 3, name: "気管チューブ 7.5mm", unit: "本", hasExpiry: true },
    { id: 22, categoryId: 3, name: "気管チューブ 8.0mm", unit: "本", hasExpiry: true },
    { id: 23, categoryId: 3, name: "ラリンゲアルマスク #3", unit: "個", hasExpiry: true },
    { id: 24, categoryId: 3, name: "ラリンゲアルマスク #4", unit: "個", hasExpiry: true },
    { id: 25, categoryId: 3, name: "吸引カテーテル 14Fr", unit: "本", hasExpiry: true },
    
    // 資機材（カテゴリID: 4）
    { id: 30, categoryId: 4, name: "留置針 18G", unit: "本", hasExpiry: true },
    { id: 31, categoryId: 4, name: "留置針 20G", unit: "本", hasExpiry: true },
    { id: 32, categoryId: 4, name: "留置針 22G", unit: "本", hasExpiry: true },
    { id: 33, categoryId: 4, name: "輸液セット", unit: "セット", hasExpiry: true },
    { id: 34, categoryId: 4, name: "三方活栓", unit: "個", hasExpiry: true },
    { id: 35, categoryId: 4, name: "延長チューブ", unit: "本", hasExpiry: true },
    
    // 消耗品（カテゴリID: 5）
    { id: 40, categoryId: 5, name: "サージカルテープ", unit: "巻", hasExpiry: false },
    { id: 41, categoryId: 5, name: "ガーゼ（滅菌）", unit: "枚", hasExpiry: true },
    { id: 42, categoryId: 5, name: "三角巾", unit: "枚", hasExpiry: false },
    { id: 43, categoryId: 5, name: "弾性包帯", unit: "巻", hasExpiry: false },
    { id: 44, categoryId: 5, name: "ディスポ手袋 M", unit: "箱", hasExpiry: true },
    { id: 45, categoryId: 5, name: "ディスポ手袋 L", unit: "箱", hasExpiry: true },
    { id: 46, categoryId: 5, name: "アルコール綿", unit: "包", hasExpiry: true },
    
    // その他（カテゴリID: 6）
    { id: 50, categoryId: 6, name: "電極パッド（成人）", unit: "セット", hasExpiry: true },
    { id: 51, categoryId: 6, name: "電極パッド（小児）", unit: "セット", hasExpiry: true },
    { id: 52, categoryId: 6, name: "SpO2センサー", unit: "個", hasExpiry: false },
    { id: 53, categoryId: 6, name: "血糖測定チップ", unit: "箱", hasExpiry: true },
    { id: 54, categoryId: 6, name: "体温計プローブカバー", unit: "箱", hasExpiry: false }
];

// ローカルストレージキー
const STORAGE_KEYS = {
    STOCKS: 'ems_stocks',
    TRANSACTIONS: 'ems_transactions'
};

/**
 * 初期在庫データを生成（各部署にサンプルデータを設定）
 */
function generateInitialStocks() {
    const stocks = [];
    const today = new Date();
    
    DEPARTMENTS.forEach(dept => {
        ITEMS.forEach(item => {
            // ランダムな初期在庫（0〜20）
            const quantity = Math.floor(Math.random() * 21);
            
            // 使用期限がある用品の場合、ランダムな期限を設定（-30日〜+365日）
            let expiryDate = null;
            if (item.hasExpiry) {
                const daysOffset = Math.floor(Math.random() * 395) - 30;
                const expiry = new Date(today);
                expiry.setDate(expiry.getDate() + daysOffset);
                expiryDate = expiry.toISOString().split('T')[0];
            }
            
            stocks.push({
                departmentId: dept.id,
                itemId: item.id,
                quantity: quantity,
                expiryDate: expiryDate
            });
        });
    });
    
    return stocks;
}

/**
 * ローカルストレージから在庫データを取得
 */
function getStocks() {
    const data = localStorage.getItem(STORAGE_KEYS.STOCKS);
    if (data) {
        return JSON.parse(data);
    }
    // 初期データを生成して保存
    const initialStocks = generateInitialStocks();
    localStorage.setItem(STORAGE_KEYS.STOCKS, JSON.stringify(initialStocks));
    return initialStocks;
}

/**
 * 在庫データを保存
 */
function saveStocks(stocks) {
    localStorage.setItem(STORAGE_KEYS.STOCKS, JSON.stringify(stocks));
}

/**
 * ローカルストレージから取引履歴を取得
 */
function getTransactions() {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (data) {
        return JSON.parse(data);
    }
    return [];
}

/**
 * 取引履歴を保存
 */
function saveTransactions(transactions) {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
}

/**
 * 新しい取引を追加
 */
function addTransaction(transaction) {
    const transactions = getTransactions();
    const newTransaction = {
        id: Date.now(),
        ...transaction,
        timestamp: new Date().toISOString()
    };
    transactions.unshift(newTransaction);
    saveTransactions(transactions);
    return newTransaction;
}

/**
 * 特定の部署・用品の在庫を取得
 */
function getStock(departmentId, itemId) {
    const stocks = getStocks();
    return stocks.find(s => s.departmentId === departmentId && s.itemId === itemId);
}

/**
 * 在庫を更新
 */
function updateStock(departmentId, itemId, quantity, expiryDate = null) {
    const stocks = getStocks();
    const index = stocks.findIndex(s => s.departmentId === departmentId && s.itemId === itemId);
    
    if (index >= 0) {
        stocks[index].quantity = quantity;
        if (expiryDate !== null) {
            stocks[index].expiryDate = expiryDate;
        }
    } else {
        stocks.push({
            departmentId,
            itemId,
            quantity,
            expiryDate
        });
    }
    
    saveStocks(stocks);
}

/**
 * 用品情報を取得
 */
function getItem(itemId) {
    return ITEMS.find(i => i.id === itemId);
}

/**
 * 部署情報を取得
 */
function getDepartment(departmentId) {
    return DEPARTMENTS.find(d => d.id === departmentId);
}

/**
 * カテゴリ情報を取得
 */
function getCategory(categoryId) {
    return CATEGORIES.find(c => c.id === categoryId);
}

/**
 * カテゴリに属する用品一覧を取得
 */
function getItemsByCategory(categoryId) {
    return ITEMS.filter(i => i.categoryId === categoryId);
}

/**
 * 期限切れ状態を判定
 * @returns {string} 'expired' | 'warning' | 'ok' | 'none'
 */
function getExpiryStatus(expiryDate) {
    if (!expiryDate) return 'none';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'warning';
    return 'ok';
}

/**
 * 今月期限切れの在庫を取得（メールリマインド用）
 */
function getExpiringThisMonth() {
    const stocks = getStocks();
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    const expiringItems = [];
    
    stocks.forEach(stock => {
        if (stock.expiryDate && stock.quantity > 0) {
            const expiry = new Date(stock.expiryDate);
            if (expiry.getFullYear() === currentYear && expiry.getMonth() === currentMonth) {
                const item = getItem(stock.itemId);
                const dept = getDepartment(stock.departmentId);
                expiringItems.push({
                    departmentName: dept.name,
                    itemName: item.name,
                    quantity: stock.quantity,
                    unit: item.unit,
                    expiryDate: stock.expiryDate
                });
            }
        }
    });
    
    // 部署順にソート
    expiringItems.sort((a, b) => {
        const deptOrder = DEPARTMENTS.findIndex(d => d.name === a.departmentName) 
                        - DEPARTMENTS.findIndex(d => d.name === b.departmentName);
        if (deptOrder !== 0) return deptOrder;
        return new Date(a.expiryDate) - new Date(b.expiryDate);
    });
    
    return expiringItems;
}
