// Supabase REST API の共通ヘルパー
// GitHub Actions とローカルの双方から使う。

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aacntdoacjjssspoctul.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_KEY) {
    console.error('環境変数 SUPABASE_SECRET_KEY が設定されていません。');
    console.error('ローカル実行時は .env に、GitHub Actions では Secrets に設定してください。');
    process.exit(1);
}

const PAGE_SIZE = 1000;

/**
 * テーブルを全件取得する。
 * PostgREST は1リクエスト最大1000行なので、必ずページングする。
 * （アプリ側で過去に取得漏れの不具合が出ているため、ここでは必ず全件取る）
 */
export async function fetchAll(table, select = '*', order = 'id') {
    const rows = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
        const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=${encodeURIComponent(order)}`;
        const res = await fetch(url, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                Range: `${offset}-${offset + PAGE_SIZE - 1}`,
            },
        });
        if (!res.ok) {
            throw new Error(`${table} の取得に失敗: ${res.status} ${await res.text()}`);
        }
        const batch = await res.json();
        rows.push(...batch);
        if (batch.length < PAGE_SIZE) break;
    }
    return rows;
}

/** 単一行の設定値を取得する。存在しなければ null。 */
export async function fetchSetting(key) {
    const url = `${SUPABASE_URL}/rest/v1/system_settings?select=value&key=eq.${encodeURIComponent(key)}`;
    const res = await fetch(url, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows.length > 0 ? rows[0].value : null;
}

export { SUPABASE_URL };
