// Built-in fetch used

const SUPABASE_URL = 'https://aacntdoacjjssspoctul.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY250ZG9hY2pqc3NzcG9jdHVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzkwMDk5NywiZXhwIjoyMDgzNDc2OTk3fQ.knTlspYRILXuyA9NVTc58iMeM6OEcsJwH-J21FGddRs';

async function supabaseRequest(table, query = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
    const options = {
        method: 'GET',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        }
    };
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

const DEPARTMENTS = [
    { id: 1, name: "警防課" }, { id: 2, name: "三次" }, { id: 3, name: "作木" },
    { id: 4, name: "吉舎" }, { id: 5, name: "三和" }, { id: 6, name: "口和" },
    { id: 7, name: "甲奴" }, { id: 8, name: "庄原" }, { id: 9, name: "西城" },
    { id: 10, name: "高野" }, { id: 11, name: "東城" }
];

async function run() {
    console.log("Fetching all data...");
    const [allItems, allStocks, allTransactions] = await Promise.all([
        supabaseRequest('items'),
        supabaseRequest('stocks'),
        supabaseRequest('transactions', '?order=timestamp.desc')
    ]);

    const deptMap = Object.fromEntries(DEPARTMENTS.map(d => [d.id, d.name]));
    const itemMap = Object.fromEntries(allItems.map(i => [i.id, i.name]));

    console.log(`\nStatistics:`);
    console.log(`- Items: ${allItems.length}`);
    console.log(`- Stocks: ${allStocks.length}`);
    console.log(`- Transactions: ${allTransactions.length}`);

    // Investigate Tyvek L in Miyoshi (ID 2)
    console.log("\n--- 'タイベックL' in Miyoshi (ID 2) ---");
    const tyvekLItems = allItems.filter(i => i.name.includes('タイベックL'));
    tyvekLItems.forEach(item => {
        console.log(`Item: ${item.name} (ID: ${item.id})`);
        const miyoshiStocks = allStocks.filter(s => s.department_id == 2 && s.item_id == item.id);
        const miyoshiTxs = allTransactions.filter(t => (t.department_id == 2 || t.target_department_id == 2) && t.item_id == item.id);
        
        console.log(`  Miyoshi Stock Records: ${miyoshiStocks.length}`);
        miyoshiStocks.forEach(s => console.log(`    * ID: ${s.id}, Qty: ${s.quantity}, Expiry: ${s.expiry_date}`));
        
        console.log(`  Miyoshi Transactions: ${miyoshiTxs.length}`);
        miyoshiTxs.forEach(t => console.log(`    * ID: ${t.id}, Type: ${t.type}, Qty: ${t.quantity}, Date: ${t.timestamp}, Remarks: ${t.remarks}`));
    });

    // Check for any other Ghost Stocks in Miyoshi
    console.log("\n--- Ghost Stocks in Miyoshi (No History) ---");
    allStocks.filter(s => s.department_id == 2).forEach(s => {
        const hasHistory = allTransactions.some(t => (t.department_id == 2 || t.target_department_id == 2) && t.item_id == s.item_id);
        if (!hasHistory && s.quantity > 0) {
            console.log(`Ghost Stock: Item: ${itemMap[s.item_id]} (ID: ${s.item_id}), Qty: ${s.quantity}, Stock ID: ${s.id}`);
        }
    });
}

run().catch(console.error);
