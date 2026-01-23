/**
 * Firebase/Firestore 設定
 * 
 * 【セットアップ手順】
 * 1. https://console.firebase.google.com/ でプロジェクト作成
 * 2. 「ウェブアプリを追加」で設定情報を取得
 * 3. 下記の firebaseConfig の値を実際の値に置き換え
 * 4. Firestore Database を有効化（本番モード推奨）
 */

// TODO: 実際のFirebase設定に置き換えてください
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Firebase初期化
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// オフラインキャッシュを有効化（オプション）
db.enablePersistence().catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('複数タブで開いているため、オフラインキャッシュは無効です');
    } else if (err.code === 'unimplemented') {
        console.warn('このブラウザはオフラインキャッシュをサポートしていません');
    }
});

// 部署マスター（固定データ）
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

// ============================================
// Firestore API ラッパー
// ============================================

const FirestoreAPI = {
    // カテゴリ取得
    async getCategories() {
        const snapshot = await db.collection('categories').orderBy('id').get();
        return snapshot.docs.map(doc => ({ id: doc.data().id, ...doc.data() }));
    },

    // カテゴリ追加
    async addCategory(name, icon) {
        const snapshot = await db.collection('categories').orderBy('id', 'desc').limit(1).get();
        const newId = snapshot.empty ? 1 : snapshot.docs[0].data().id + 1;
        const data = { id: newId, name, icon: icon || 'inventory_2' };
        await db.collection('categories').doc(String(newId)).set(data);
        return data;
    },

    // カテゴリ更新
    async updateCategory(id, name, icon) {
        const data = { id, name, icon: icon || 'inventory_2' };
        await db.collection('categories').doc(String(id)).update(data);
        return data;
    },

    // カテゴリ削除
    async deleteCategory(id) {
        await db.collection('categories').doc(String(id)).delete();
        // 関連用品も削除
        const items = await db.collection('items').where('categoryId', '==', id).get();
        const batch = db.batch();
        items.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        return { success: true };
    },

    // 用品取得
    async getItems() {
        const snapshot = await db.collection('items').orderBy('id').get();
        return snapshot.docs.map(doc => doc.data());
    },

    // 用品追加
    async addItem(categoryId, name, unit, hasExpiry, minStock) {
        const snapshot = await db.collection('items').orderBy('id', 'desc').limit(1).get();
        const newId = snapshot.empty ? 1 : snapshot.docs[0].data().id + 1;
        const data = { id: newId, categoryId, name, unit: unit || '個', hasExpiry: !!hasExpiry, minStock: minStock || 0 };
        await db.collection('items').doc(String(newId)).set(data);
        return data;
    },

    // 用品更新
    async updateItem(id, categoryId, name, unit, hasExpiry, minStock) {
        const data = { id, categoryId, name, unit: unit || '個', hasExpiry: !!hasExpiry, minStock: minStock || 0 };
        await db.collection('items').doc(String(id)).update(data);
        return data;
    },

    // 用品削除
    async deleteItem(id) {
        await db.collection('items').doc(String(id)).delete();
        return { success: true };
    },

    // 在庫取得
    async getStocks() {
        const snapshot = await db.collection('stocks').get();
        return snapshot.docs.map(doc => doc.data());
    },

    // 在庫更新（入庫）
    async stockIn(deptId, itemId, expiryDate, quantity) {
        const docId = `${deptId}_${itemId}_${expiryDate || 'noexp'}`;
        const docRef = db.collection('stocks').doc(docId);
        const doc = await docRef.get();

        if (doc.exists) {
            await docRef.update({ quantity: firebase.firestore.FieldValue.increment(quantity) });
        } else {
            await docRef.set({
                departmentId: deptId,
                itemId: itemId,
                expiryDate: expiryDate || null,
                quantity: quantity
            });
        }

        // 取引履歴に追加
        return this.addTransaction(deptId, itemId, 'IN', quantity, expiryDate);
    },

    // 在庫更新（出庫）
    async stockOut(deptId, itemId, expiryDate, quantity) {
        const docId = `${deptId}_${itemId}_${expiryDate || 'noexp'}`;
        const docRef = db.collection('stocks').doc(docId);
        const doc = await docRef.get();

        if (!doc.exists || doc.data().quantity < quantity) {
            throw new Error('在庫不足');
        }

        const newQty = doc.data().quantity - quantity;
        if (newQty <= 0) {
            await docRef.delete();
        } else {
            await docRef.update({ quantity: newQty });
        }

        // 取引履歴に追加
        return this.addTransaction(deptId, itemId, 'OUT', quantity, expiryDate);
    },

    // 取引履歴取得
    async getTransactions(limit = 100) {
        const snapshot = await db.collection('transactions')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => doc.data());
    },

    // 取引履歴追加
    async addTransaction(deptId, itemId, type, quantity, expiryDate, remarks, transactionDate) {
        const id = Date.now();
        const timestamp = transactionDate ? new Date(transactionDate) : new Date();
        const data = {
            id,
            departmentId: deptId,
            itemId,
            type,
            quantity,
            expiryDate: expiryDate || null,
            remarks: remarks || '',
            timestamp: timestamp.toISOString()
        };
        await db.collection('transactions').doc(String(id)).set(data);
        return data;
    },

    // マスターデータ一括取得
    async getMasterData() {
        const [categories, items] = await Promise.all([
            this.getCategories(),
            this.getItems()
        ]);
        return { departments: DEPARTMENTS, categories, items };
    },

    // リアルタイムリスナー
    onStocksChange(callback) {
        return db.collection('stocks').onSnapshot(snapshot => {
            const stocks = snapshot.docs.map(doc => doc.data());
            callback(stocks);
        });
    },

    onTransactionsChange(callback, limit = 100) {
        return db.collection('transactions')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .onSnapshot(snapshot => {
                const txs = snapshot.docs.map(doc => doc.data());
                callback(txs);
            });
    }
};
