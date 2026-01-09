// Supabase データ初期化スクリプト
// Node.js で実行: node init-supabase-data.mjs

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
    return res.json();
}

// カテゴリと用品のデータ
const categoriesData = [
    { name: '医薬品', icon: 'medication', items: ['アドレナリン', 'ブドウ糖', 'ソルラクト'] },
    { name: '静脈路確保', icon: 'vaccines', items: ['針18G', '針20G', '針22G', '針24G', '輸液セット', 'カテーリープ', 'キープポア（サイズ1.2㎝）', 'キープポア（サイズ2.5㎝）', '酒精綿', '針ポイ', '穿刺絆創膏（インジェクション）'] },
    { name: '気管挿管', icon: 'medical_services', items: ['チューブ6.0mm', 'チューブ6.5mm', 'チューブ7.0mm', 'チューブ7.5mm', 'チューブ8.0mm', 'イントロック', 'イントロック薄型', 'イージーキャップⅡ', 'AWチェッカー', 'トーマスホルダー', 'スタイレット', 'ETCO2センサー'] },
    { name: '血糖測定', icon: 'bloodtype', items: ['血糖チップ', '血糖針'] },
    { name: '気道管理', icon: 'sick', items: ['LT#５', 'LT#４', 'LT#３', 'LT#2.5', 'LT#２', 'LT#１', 'LT#０', '酸素マスク成人高', '酸素マスク成人中', '酸素マスク小児高', '酸素マスク小児中', '鼻カニューレ', '吸引チューブ18Fr', '吸引チューブ16Fr', '吸引チューブ14Fr', '吸引チューブ12Fr', '吸引チューブ10Fr', 'サクション10Fr', 'サクション12Fr', 'サクション14Fr', 'サクション16Fr', 'サクション18Fr', '経鼻AW 6', '経鼻AW 7', '経鼻AW 8', '経口AW6.0', '経口AW7.0', '経口AW8.0', '人工鼻', 'セレスパック', '潤滑剤(チューブ塗布）', '羊水カテーテル', 'ヤンカーサクション', 'i-GEL #5', 'フローキャップ', 'i-GEL #4', 'i-GEL #3'] },
    { name: '感染防止衣', icon: 'checkroom', items: ['上衣S', '上衣M', '上衣L', '上衣LL', '下衣S', '下衣M', '下衣L', '下衣LL', 'タイベックLL', 'タイベックL', 'タイベックM', 'エアクールM', 'エアクールL', 'エアクールLL', 'エアクール（ファン）', 'エアクール（バッテリー）', 'エアクール（フィルター）'] },
    { name: '感染防止', icon: 'clean_hands', items: ['サージカルマスク（箱）', 'N95マスク（枚）', 'プラ手LL（箱）', 'プラ手L（箱）', 'プラ手M（箱）', 'プラ手S（箱）', 'アームカバー', 'ロング手袋L', 'ロング手袋M', 'ストレッチャーカバー', 'シューズカバー（枚）', 'シューズカバー（ブーツ）', 'ゴーグル', 'ソンタラシート'] },
    { name: '外傷', icon: 'healing', items: ['三角巾', 'サージカルパッド', '伸縮包帯', 'アルミックシート', 'ケーパイン', 'ネックカラー(成人）', 'ネックカラー(小児）', 'トランスーム', '養生テープ'] },
    { name: '消毒', icon: 'sanitizer', items: ['アルガーゼ詰替', 'アルガーゼ本体', '消毒用エタノール（手指消毒用）', '消毒用エタノール（資器材用）', '次亜塩素酸Na', 'マスキン液'] },
    { name: 'その他', icon: 'inventory_2', items: ['搬送表', 'ZOLL記録紙', 'DASH記録紙', '冷却剤', 'トリアージタグ', '救命講習テキスト', '応急手当テキスト', '入門テキスト', 'マスカー（大）', 'マスカー（小）', 'フェイスシールド', 'お産セット'] },
    { name: '心電図', icon: 'monitor_heart', items: ['AEDパッド(FR3)', 'AEDパッド(ZOLL）', 'ECGパッド'] }
];

async function main() {
    console.log('=== Supabase データ初期化開始 ===');

    // 1. 全データ削除（順序重要：トランザクション → 在庫 → 用品 → カテゴリ）
    console.log('トランザクションを削除中...');
    await supabaseRequest('transactions', 'DELETE', null, '?id=gt.0');

    console.log('在庫を削除中...');
    await supabaseRequest('stocks', 'DELETE', null, '?id=gt.0');

    console.log('用品を削除中...');
    await supabaseRequest('items', 'DELETE', null, '?id=gt.0');

    console.log('カテゴリを削除中...');
    await supabaseRequest('categories', 'DELETE', null, '?id=gt.0');

    console.log('全データ削除完了！');

    // 2. カテゴリ登録
    console.log('\\nカテゴリを登録中...');
    for (const cat of categoriesData) {
        const result = await supabaseRequest('categories', 'POST', { name: cat.name, icon: cat.icon });
        const catId = result[0]?.id;
        console.log(`  ${cat.name} (ID: ${catId})`);

        // 3. 用品登録
        for (const itemName of cat.items) {
            await supabaseRequest('items', 'POST', {
                category_id: catId,
                name: itemName,
                unit: '個',
                has_expiry: false,
                min_stock: 0
            });
        }
        console.log(`    → ${cat.items.length}件の用品を登録`);
    }

    console.log('\\n=== Supabase データ初期化完了 ===');
}

main().catch(console.error);
