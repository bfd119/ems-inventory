// バックアップ ＋ Supabase スリープ防止（keep-alive）
//
// このスクリプトは1つで2つの役割を果たす:
//   1. 全テーブルを読むことで Supabase の「7日間アクセスなしで自動停止」を回避する
//   2. 読んだ内容を backup/ に JSON で保存し、万一に備える
//
// 出力は「日付つきファイル」ではなく「同じファイルを上書き」する。
// 日付つきにするとリポジトリが際限なく肥大化するため。
// git は追記中心のテキスト差分を効率よく圧縮するので、上書き方式が最も軽い。

import { writeFile, mkdir } from 'node:fs/promises';
import { fetchAll } from './supabase.mjs';

const TABLES = [
    { name: 'categories', order: 'id' },
    { name: 'items', order: 'id' },
    { name: 'item_categories', order: 'id' },
    { name: 'stocks', order: 'id' },
    { name: 'transactions', order: 'id' },
    { name: 'system_settings', order: 'key' },
];

async function main() {
    await mkdir('backup', { recursive: true });

    const counts = {};
    const failures = [];

    for (const { name, order } of TABLES) {
        try {
            const rows = await fetchAll(name, '*', order);
            // キー順を安定させると git の差分が最小になる
            const stable = rows.map((r) =>
                Object.fromEntries(Object.keys(r).sort().map((k) => [k, r[k]]))
            );
            await writeFile(`backup/${name}.json`, JSON.stringify(stable, null, 2) + '\n', 'utf8');
            counts[name] = rows.length;
            console.log(`${name}: ${rows.length} 件`);
        } catch (e) {
            // system_settings など、まだ存在しないテーブルがあっても全体は止めない
            failures.push({ table: name, error: e.message });
            console.warn(`${name}: 取得できませんでした (${e.message})`);
        }
    }

    // _meta.json は毎回必ず内容が変わる。
    // これにより「差分なし＝コミットなし」にならず、リポジトリの活動が途切れない。
    // GitHub Actions のスケジュールは public リポジトリで60日間活動がないと
    // 自動停止するため、この毎回のコミットがその対策も兼ねている。
    await writeFile(
        'backup/_meta.json',
        JSON.stringify(
            {
                generated_at: new Date().toISOString(),
                counts,
                failures,
                note: 'scripts/backup.mjs により自動生成。手動で編集しないこと。',
            },
            null,
            2
        ) + '\n',
        'utf8'
    );

    if (failures.length > 0 && failures.length === TABLES.length) {
        // 全テーブル失敗＝接続そのものが壊れている。Actions を失敗させて通知する
        console.error('すべてのテーブルの取得に失敗しました。');
        process.exit(1);
    }

    console.log('バックアップ完了');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
