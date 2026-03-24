
const SUPABASE_URL = 'https://aacntdoacjjssspoctul.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY250ZG9hY2pqc3NzcG9jdHVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzkwMDk5NywiZXhwIjoyMDgzNDc2OTk3fQ.knTlspYRILXuyA9NVTc58iMeM6OEcsJwH-J21FGddRs';

async function main() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/items?select=id,name`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const items = await res.json();
    const sorted = items.sort((a, b) => a.name.localeCompare(b.name));
    console.log('--- Items Scan ---');
    sorted.forEach(item => {
        if (item.name.includes('アドレナリン')) {
            console.log(`ID: ${item.id}, Name: "${item.name}"`);
        }
    });
}
main();
