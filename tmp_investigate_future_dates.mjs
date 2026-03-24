// 未来日付レコード調査スクリプト
// 現在時刻: 2026-03-24T11:03:00+09:00

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aacntdoacjjssspoctul.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY250ZG9hY2pqc3NzcG9jdHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MDA5OTcsImV4cCI6MjA4MzQ3Njk5N30.oBliHP_Jd9NOSSK1XFcO9egQWPzVhxn_KM0OTgaR8TQ';

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEPARTMENTS = {
    1: '警防課', 2: '三次', 3: '作木', 4: '吉舎', 5: '三和',
    6: '口和', 7: '甲奴', 8: '庄原', 9: '西城', 10: '高野', 11: '東城'
};

async function main() {
    console.log('=================================================');
    console.log('【未来日付レコード調査レポート】');
    console.log('調査実行日時:', new Date().toISOString());
    console.log('=================================================\n');

    // 全トランザクションを取得
    let allData = [];
    let offset = 0;
    while (true) {
        const { data, error } = await db.from('transactions')
            .select('*')
            .order('timestamp', { ascending: false })
            .range(offset, offset + 999);
        if (error) { console.error('データ取得エラー:', error); break; }
        allData = allData.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }
    console.log(`総トランザクション数: ${allData.length}件\n`);

    // 全アイテムを取得（名前解決のため）
    const { data: items } = await db.from('items').select('id, name');
    const itemMap = new Map((items || []).map(i => [i.id, i.name]));

    // 現在時刻 (2026-03-24T11:03:00+09:00 → UTC 2026-03-24T02:03:00)
    const now = new Date('2026-03-24T02:03:00Z');
    const todayStr = '2026-03-24';

    // 未来日付（timestampが今日より後）のレコード抽出
    const futureTx = allData.filter(tx => {
        const ts = new Date(tx.timestamp);
        return ts > now;
    });

    console.log(`【集計】未来日付 (${todayStr} 以降) のレコード: ${futureTx.length}件`);

    if (futureTx.length === 0) {
        console.log('未来日付のレコードはありませんでした。');
    } else {
        // タイプ別集計
        const byType = {};
        futureTx.forEach(tx => {
            byType[tx.type] = (byType[tx.type] || 0) + 1;
        });
        console.log('\n【タイプ別集計】');
        Object.entries(byType).forEach(([type, count]) => {
            const label = type === 'IN' ? '入庫(購入/受取)' : type === 'OUT' ? '出庫(使用/あげた)' : type;
            console.log(`  ${label} (${type}): ${count}件`);
        });

        // 日付別集計
        const byDate = {};
        futureTx.forEach(tx => {
            const dateStr = tx.timestamp.substring(0, 10);
            byDate[dateStr] = (byDate[dateStr] || 0) + 1;
        });
        console.log('\n【日付別集計（上位10件）】');
        Object.entries(byDate)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 10)
            .forEach(([date, count]) => {
                console.log(`  ${date}: ${count}件`);
            });

        // 署所別集計
        const byDept = {};
        futureTx.forEach(tx => {
            const deptName = DEPARTMENTS[tx.department_id] || `不明(${tx.department_id})`;
            byDept[deptName] = (byDept[deptName] || 0) + 1;
        });
        console.log('\n【署所別集計】');
        Object.entries(byDept)
            .sort((a, b) => b[1] - a[1])
            .forEach(([dept, count]) => {
                console.log(`  ${dept}: ${count}件`);
            });

        // 詳細リスト（最大20件）
        console.log('\n【詳細リスト（最大20件）】');
        console.log('ID | 署所 | タイプ | 用品 | 数量 | タイムスタンプ | 備考 | transfer_pair_id');
        console.log('-'.repeat(100));
        futureTx.slice(0, 20).forEach(tx => {
            const deptName = DEPARTMENTS[tx.department_id] || `不明(${tx.department_id})`;
            const itemName = itemMap.get(tx.item_id) || `用品ID:${tx.item_id}`;
            const typeLabel = tx.type === 'IN' ? '入庫' : tx.type === 'OUT' ? '出庫' : tx.type;
            const hasPair = tx.transfer_pair_id ? '★ペアあり' : '';
            console.log(`${tx.id} | ${deptName} | ${typeLabel} | ${itemName} | ${tx.quantity} | ${tx.timestamp} | ${tx.remarks || ''} | ${hasPair}`);
        });

        // 重要: created_at（レコード作成日時）と timestamp（入力日）の乖離を確認
        // Supabaseのcreated_atカラムがあれば確認する
        console.log('\n【created_at解析（システムによる自動記録 vs 入力日の乖離）】');
        const { data: sampleCheck } = await db.from('transactions')
            .select('id, timestamp, created_at, remarks, type, department_id')
            .order('timestamp', { ascending: false })
            .limit(5);

        if (sampleCheck && sampleCheck[0] && sampleCheck[0].created_at !== undefined) {
            console.log('created_atカラムが存在します。乖離分析を実行します...');
            // 未来日付レコードのcreated_atを確認
            const { data: futureWithCreated } = await db.from('transactions')
                .select('id, timestamp, created_at, remarks, type, department_id, item_id')
                .gt('timestamp', now.toISOString())
                .order('timestamp', { ascending: false })
                .limit(20);

            if (futureWithCreated && futureWithCreated.length > 0) {
                console.log('\nID | 入力日(timestamp) | DB保存日(created_at) | 乖離 | 署所 | タイプ');
                console.log('-'.repeat(100));
                futureWithCreated.forEach(tx => {
                    const ts = new Date(tx.timestamp);
                    const ca = new Date(tx.created_at);
                    const diffDays = Math.round((ts - ca) / (1000 * 60 * 60 * 24));
                    const deptName = DEPARTMENTS[tx.department_id] || `?`;
                    const typeLabel = tx.type === 'IN' ? '入庫' : '出庫';
                    console.log(`${tx.id} | ${tx.timestamp.substring(0, 10)} | ${tx.created_at.substring(0, 10)} | +${diffDays}日 | ${deptName} | ${typeLabel} | ${tx.remarks || ''}`);
                });
                
                // 乖離の統計
                const diffs = futureWithCreated.map(tx => {
                    const ts = new Date(tx.timestamp);
                    const ca = new Date(tx.created_at);
                    return Math.round((ts - ca) / (1000 * 60 * 60 * 24));
                });
                const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
                const maxDiff = Math.max(...diffs);
                console.log(`\n平均乖離: +${avgDiff.toFixed(1)}日 / 最大乖離: +${maxDiff}日`);
            }
        } else {
            console.log('※ created_atカラムなし。timestampのみで判断します。');
        }
    }

    // 結論と推定
    console.log('\n=================================================');
    console.log('【原因推定】');
    console.log('=================================================');
    if (futureTx.length > 0) {
        // 入力日（今日）との乖離が小さければヒューマンエラー、大きければシステムエラー疑い
        const tsVals = futureTx.map(tx => new Date(tx.timestamp).getTime());
        const maxFutureDays = Math.round((Math.max(...tsVals) - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (maxFutureDays <= 5) {
            console.log('▶ 最大乖離は約', maxFutureDays, '日。');
            console.log('  → ヒューマンエラー（日付の誤入力）の可能性が高いです。');
            console.log('  → DatePickerに未来日付の制限がないため入力可能な状態でした。');
        } else if (maxFutureDays > 365) {
            console.log('▶ 最大乖離は約', maxFutureDays, '日（1年超）。');
            console.log('  → システムの日付処理エラーまたは意図的な将来入力の可能性があります。');
        } else {
            console.log('▶ 最大乖離は約', maxFutureDays, '日。');
            console.log('  → ヒューマンエラー（日付の誤入力）の可能性があります。');
        }
    }
    console.log('\n※ created_atとtimestampの乖離を見ることで、');
    console.log('  「DBに保存された日」と「ユーザーが入力した日付」の差がわかります。');
    console.log('  乖離が大きい場合: ユーザーが意図的に未来の日付を入力した可能性。');
    console.log('  乖離がない場合: システムが自動で未来日付を設定してしまった可能性。');
}

main().catch(console.error);
