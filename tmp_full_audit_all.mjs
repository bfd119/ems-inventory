// Built-in fetch used
import * as fs from 'node:fs';

const SUPABASE_URL = 'https://aacntdoacjjssspoctul.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY250ZG9hY2pqc3NzcG9jdHVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzkwMDk5NywiZXhwIjoyMDgzNDc2OTk3fQ.knTlspYRILXuyA9NVTc58iMeM6OEcsJwH-J21FGddRs';

async function supabaseRequest(table, query = '', all = false) {
    if (!all) {
        const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
        const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' } });
        return res.json();
    }
    
    let results = [];
    let offset = 0;
    while (true) {
        const url = `${SUPABASE_URL}/rest/v1/${table}${query}${query.includes('?') ? '&' : '?'}offset=${offset}&limit=1000`;
        const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'count=exact' } });
        const data = await res.json();
        results = results.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }
    return results;
}

const DEPARTMENTS = [
    { id: 1, name: "警防課" }, { id: 2, name: "三次" }, { id: 3, name: "作木" },
    { id: 4, name: "吉舎" }, { id: 5, name: "三和" }, { id: 6, name: "口和" },
    { id: 7, name: "甲奴" }, { id: 8, name: "庄原" }, { id: 9, name: "西城" },
    { id: 10, name: "高野" }, { id: 11, name: "東城" }
];

async function run() {
    console.log("Fetching ALL data...");
    const [allItems, allStocks, allTransactions] = await Promise.all([
        supabaseRequest('items', '', true),
        supabaseRequest('stocks', '', true),
        supabaseRequest('transactions', '', true)
    ]);

    const deptMap = Object.fromEntries(DEPARTMENTS.map(d => [d.id, d.name]));
    const itemMap = Object.fromEntries(allItems.map(i => [i.id, i.name]));

    console.log(`Statistics: Items: ${allItems.length}, Stocks: ${allStocks.length}, Transactions: ${allTransactions.length}`);

    const stockGroups = {};
    allStocks.forEach(s => {
        const key = `${s.department_id}-${s.item_id}-${s.expiry_date || 'null'}`;
        if (!stockGroups[key]) stockGroups[key] = [];
        stockGroups[key].push(s);
    });

    const expected = {};
    allTransactions.forEach(tx => {
        const srcKey = `${tx.department_id}-${tx.item_id}-${tx.expiry_date || 'null'}`;
        const isOut = tx.type.startsWith('OUT');
        if (!expected[srcKey]) expected[srcKey] = 0;
        expected[srcKey] += isOut ? -Number(tx.quantity) : Number(tx.quantity);

        if (tx.target_department_id) {
            const tgtKey = `${tx.target_department_id}-${tx.item_id}-${tx.expiry_date || 'null'}`;
            if (!expected[tgtKey]) expected[tgtKey] = 0;
            expected[tgtKey] += Number(tx.quantity);
        }
    });

    const actual = {};
    Object.entries(stockGroups).forEach(([key, records]) => {
        actual[key] = records.reduce((sum, r) => sum + Number(r.quantity), 0);
    });

    const results = {
        duplicates: [],
        mismatches: []
    };

    Object.entries(stockGroups).forEach(([key, records]) => {
        if (records.length > 1) {
            const parts = key.split('-');
            results.duplicates.push({
                dept: deptMap[parts[0]] || parts[0],
                item: itemMap[parts[1]] || parts[1],
                expiry: parts.slice(2).join('-'),
                records: records.map(r => ({ id: r.id, qty: r.quantity }))
            });
        }
    });

    const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    allKeys.forEach(key => {
        const expQty = expected[key] || 0;
        const actQty = actual[key] || 0;
        if (expQty !== actQty && (expQty !== 0 || actQty !== 0)) {
            const parts = key.split('-');
            results.mismatches.push({
                dept: deptMap[parts[0]] || parts[0],
                item: itemMap[parts[1]] || parts[1],
                expiry: parts.slice(2).join('-'),
                expected: expQty,
                actual: actQty,
                diff: actQty - expQty
            });
        }
    });

    fs.writeFileSync('audit_results_all.json', JSON.stringify(results, null, 2));
    console.log(`Audit complete. Found ${results.duplicates.length} duplicates and ${results.mismatches.length} mismatches.`);
}

run().catch(console.error);
