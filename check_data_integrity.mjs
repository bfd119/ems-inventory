// データ整合性チェック・修復スクリプト
// 実行方法: node check_data_integrity.mjs [--fix]
// --fix オプションを付けると、stocksテーブルをtransactionsから再計算して修復する

const SUPABASE_URL = 'https://aacntdoacjjssspoctul.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY250ZG9hY2pqc3NzcG9jdHVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzkwMDk5NywiZXhwIjoyMDgzNDc2OTk3fQ.knTlspYRILXuyA9NVTc58iMeM6OEcsJwH-J21FGddRs';

const FIX_MODE = process.argv.includes('--fix');

const DEPARTMENTS = [
    { id: 1, name: "警防課" }, { id: 2, name: "三次" }, { id: 3, name: "作木" },
    { id: 4, name: "吉舎" }, { id: 5, name: "三和" }, { id: 6, name: "口和" },
    { id: 7, name: "甲奴" }, { id: 8, name: "庄原" }, { id: 9, name: "西城" },
    { id: 10, name: "高野" }, { id: 11, name: "東城" }
];

async function supabaseRequest(table, method, data = null, filter = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}${filter}`;
    const options = {
        method,
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    };
    if (data) options.body = JSON.stringify(data);
    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase API エラー: ${res.status} ${text}`);
    }
    return res.json();
}

async function main() {
    console.log('=== データ整合性チェック開始 ===\n');
    if (FIX_MODE) {
        console.log('⚠️  修復モードで実行しています\n');
    }

    // 1. 全データ取得
    console.log('データ取得中...');
    const items = await supabaseRequest('items', 'GET', null, '?select=*');
    const stocks = await supabaseRequest('stocks', 'GET', null, '?select=*');
    const transactions = await supabaseRequest('transactions', 'GET', null, '?select=*&order=timestamp.asc');

    console.log(`  用品: ${items.length}件`);
    console.log(`  在庫レコード: ${stocks.length}件`);
    console.log(`  トランザクション: ${transactions.length}件\n`);

    // 2. transactionsから期待される在庫を計算
    //    キー: `${department_id}-${item_id}-${expiry_date || 'null'}`
    const expectedStocks = {};

    transactions.forEach(tx => {
        const key = `${tx.department_id}-${tx.item_id}-${tx.expiry_date || 'null'}`;
        if (!expectedStocks[key]) {
            expectedStocks[key] = {
                department_id: tx.department_id,
                item_id: tx.item_id,
                expiry_date: tx.expiry_date || null,
                quantity: 0
            };
        }

        const isOut = tx.type === 'OUT' || tx.type.startsWith('OUT_');
        if (isOut) {
            expectedStocks[key].quantity -= tx.quantity;
        } else {
            expectedStocks[key].quantity += tx.quantity;
        }
    });

    // 3. 現在のstocksテーブルをマップ化
    const actualStocks = {};
    stocks.forEach(s => {
        const key = `${s.department_id}-${s.item_id}-${s.expiry_date || 'null'}`;
        actualStocks[key] = {
            id: s.id,
            department_id: s.department_id,
            item_id: s.item_id,
            expiry_date: s.expiry_date || null,
            quantity: s.quantity
        };
    });

    // 4. 差分を比較
    const allKeys = new Set([...Object.keys(expectedStocks), ...Object.keys(actualStocks)]);
    const mismatches = [];

    const itemMap = new Map(items.map(i => [i.id, i]));
    const deptMap = new Map(DEPARTMENTS.map(d => [d.id, d]));

    allKeys.forEach(key => {
        const expected = expectedStocks[key] || { quantity: 0 };
        const actual = actualStocks[key] || { quantity: 0 };
        const expectedQty = Math.max(0, expected.quantity); // 負の在庫はありえないので0にクランプ

        if (expectedQty !== actual.quantity) {
            const parts = key.split('-');
            const deptId = +parts[0];
            const itemId = +parts[1];
            const expiry = parts.slice(2).join('-');

            const dept = deptMap.get(deptId);
            const item = itemMap.get(itemId);

            mismatches.push({
                key,
                deptId,
                deptName: dept?.name || `不明(${deptId})`,
                itemId,
                itemName: item?.name || `不明(${itemId})`,
                expiry: expiry === 'null' ? '期限なし' : expiry,
                actual: actual.quantity,
                expected: expectedQty,
                diff: expectedQty - actual.quantity,
                actualRecord: actualStocks[key],
                expectedRecord: expected
            });
        }
    });

    // 5. 結果出力
    if (mismatches.length === 0) {
        console.log('✅ 整合性チェック完了: 不整合はありません！\n');
    } else {
        console.log(`❌ ${mismatches.length}件の不整合が見つかりました:\n`);
        console.log('─'.repeat(100));
        console.log(
            '署所'.padEnd(10) +
            '用品名'.padEnd(25) +
            '期限'.padEnd(15) +
            '現在庫(stocks)'.padEnd(18) +
            '期待値(transactions)'.padEnd(22) +
            '差分'
        );
        console.log('─'.repeat(100));

        mismatches.sort((a, b) => {
            if (a.deptName !== b.deptName) return a.deptName.localeCompare(b.deptName, 'ja');
            return a.itemName.localeCompare(b.itemName, 'ja');
        });

        mismatches.forEach(m => {
            console.log(
                m.deptName.padEnd(10) +
                m.itemName.padEnd(25) +
                m.expiry.padEnd(15) +
                String(m.actual).padEnd(18) +
                String(m.expected).padEnd(22) +
                (m.diff > 0 ? `+${m.diff}` : `${m.diff}`)
            );
        });
        console.log('─'.repeat(100));
        console.log();

        // 6. 修復モード
        if (FIX_MODE) {
            console.log('🔧 修復を開始します...\n');

            for (const m of mismatches) {
                const deptId = m.deptId;
                const itemId = m.itemId;
                const expiryDate = m.expiry === '期限なし' ? null : m.expiry;

                if (m.expected === 0) {
                    // 在庫が0になるべき → レコードを削除
                    if (m.actualRecord) {
                        await supabaseRequest('stocks', 'DELETE', null, `?id=eq.${m.actualRecord.id}`);
                        console.log(`  削除: ${m.deptName} / ${m.itemName} (旧: ${m.actual} → 削除)`);
                    }
                } else if (m.actualRecord) {
                    // 既存レコードを更新
                    await supabaseRequest('stocks', 'PATCH', { quantity: m.expected }, `?id=eq.${m.actualRecord.id}`);
                    console.log(`  更新: ${m.deptName} / ${m.itemName} (${m.actual} → ${m.expected})`);
                } else {
                    // 新規レコードを作成
                    await supabaseRequest('stocks', 'POST', {
                        department_id: deptId,
                        item_id: itemId,
                        expiry_date: expiryDate,
                        quantity: m.expected
                    });
                    console.log(`  新規: ${m.deptName} / ${m.itemName} = ${m.expected}`);
                }
            }

            console.log('\n✅ 修復完了！\n');
        } else {
            console.log('修復するには --fix オプションを付けて再実行してください:');
            console.log('  node check_data_integrity.mjs --fix\n');
        }
    }

    console.log('=== チェック完了 ===');
}

main().catch(err => {
    console.error('エラーが発生しました:', err);
    process.exit(1);
});
