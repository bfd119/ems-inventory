// 重複用品統合＆M2M移行スクリプト
// 実行方法: node merge_duplicates.mjs

const SUPABASE_URL = 'https://aacntdoacjjssspoctul.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY250ZG9hY2pqc3NzcG9jdHVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzkwMDk5NywiZXhwIjoyMDgzNDc2OTk3fQ.knTlspYRILXuyA9NVTc58iMeM6OEcsJwH-J21FGddRs';

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
        const txt = await res.text();
        throw new Error(`API Error: ${res.status} ${txt}`);
    }
    return res.json();
}

// 文字列正規化（全角→半角、スペース削除）
function normalizeName(name) {
    return name
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
            return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
        })
        .replace(/[\s\u3000]/g, '') // Remove all spaces
        .toLowerCase();
}

async function main() {
    console.log('=== 重複用品統合スクリプト開始 ===');

    // 1. 全データ取得
    console.log('データを取得中...');
    const items = await supabaseRequest('items', 'GET', null, '?select=*');
    console.log(`取得アイテム数: ${items.length}`);

    // item_categoriesの準備状態確認（テーブルがないとエラーになるので、まずはマイグレーションが必要だが、
    // ここではテーブルがあると仮定して進める。もし404ならユーザーに通知必要）
    try {
        await supabaseRequest('item_categories', 'GET', null, '?select=id&limit=1');
    } catch (e) {
        console.error('CRITICAL: item_categoriesテーブルが見つかりません。まずmigration_v1_m2m.sqlを適用してください。');
        process.exit(1);
    }

    // 2. 正規化名でグルーピング
    const grouped = {};
    items.forEach(item => {
        const key = normalizeName(item.name);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
    });

    for (const key of Object.keys(grouped)) {
        const group = grouped[key];
        
        // 既存のリンク作成（全アイテムに対して）
        // 移行がまだの場合、items.category_id を元にリンクを作る必要がある
        for (const item of group) {
            if (item.category_id) {
                try {
                    await supabaseRequest('item_categories', 'POST', {
                        item_id: item.id,
                        category_id: item.category_id
                    });
                } catch (e) {
                    // 既に存在する場合は無視 (Unique violation)
                }
            }
        }

        if (group.length < 2) continue; // 重複なし

        console.log(`\n重複検出: "${group[0].name}" (正規化: ${key}) - ${group.length}件`);
        
        // IDが一番小さいものをマスターとする
        group.sort((a, b) => a.id - b.id);
        const master = group[0];
        const slaves = group.slice(1);

        console.log(`  マスター: ID=${master.id} (${master.name})`);
        
        for (const slave of slaves) {
            console.log(`  統合対象: ID=${slave.id} (${slave.name}, CatID=${slave.category_id})`);

            // 1. リンク情報の引継ぎ
            if (slave.category_id) {
                try {
                    await supabaseRequest('item_categories', 'POST', {
                        item_id: master.id,
                        category_id: slave.category_id
                    });
                    console.log(`    リンク追加: Master(${master.id}) -> Category(${slave.category_id})`);
                } catch (e) {
                    // 既にマスターがこのカテゴリに属している場合はOK
                    console.log(`    リンク済: Category(${slave.category_id})`);
                }
            }

            // M2Mテーブル上のSlaveのリンクがあればMasterに付け替え（今回は上記でcategory_idから復元しているので不要かもしれないが、念のため）
            // 既存のitem_categoriesにslave.idがあるか確認してあればmaster.idにする更新処理...はUnique制約に引っかかる可能性あるので、
            // 「Slaveの所属カテゴリ」を「Master」に追加するアプローチが良い（上記で実施済み）。
            
            // 2. 在庫データの付け替え
            const slaveStocks = await supabaseRequest('stocks', 'GET', null, `?item_id=eq.${slave.id}`);
            for (const stock of slaveStocks) {
                console.log(`    在庫移動: ${stock.quantity}個 (Dept:${stock.department_id})`);
                
                // マスターの同じ条件（部署・期限）の在庫を探す
                let filter = `?item_id=eq.${master.id}&department_id=eq.${stock.department_id}`;
                if (stock.expiry_date) filter += `&expiry_date=eq.${stock.expiry_date}`;
                else filter += `&expiry_date=is.null`;

                const masterStocks = await supabaseRequest('stocks', 'GET', null, filter);
                
                if (masterStocks.length > 0) {
                    // 合算
                    const ms = masterStocks[0];
                    await supabaseRequest('stocks', 'PATCH', { quantity: ms.quantity + stock.quantity }, `?id=eq.${ms.id}`);
                    await supabaseRequest('stocks', 'DELETE', null, `?id=eq.${stock.id}`); // 移動元削除
                } else {
                    // ID書き換え
                    await supabaseRequest('stocks', 'PATCH', { item_id: master.id }, `?id=eq.${stock.id}`);
                }
            }

            // 3. 履歴データの付け替え
            const slaveTx = await supabaseRequest('transactions', 'GET', null, `?item_id=eq.${slave.id}`);
            if (slaveTx.length > 0) {
                console.log(`    履歴移動: ${slaveTx.length}件`);
                await supabaseRequest('transactions', 'PATCH', { item_id: master.id }, `?item_id=eq.${slave.id}`);
            }

            // 4. スレーブ削除
            console.log(`    アイテム削除: ID=${slave.id}`);
            // 外部キー制約がある場合item_categories等のリンクも消す必要があるが、
            // ON DELETE CASCADE設定がDBにあれば自動。なければ手動削除。
            // migration_v1_m2m.sqlでは CASCADE 設定しているが、現状のDBに適用されているか不明。
            // 安全のため手動でリンク削除を試みる
            await supabaseRequest('item_categories', 'DELETE', null, `?item_id=eq.${slave.id}`);
            await supabaseRequest('items', 'DELETE', null, `?id=eq.${slave.id}`);
        }
    }

    console.log('\n=== 処理完了 ===');
}

main().catch(console.error);
