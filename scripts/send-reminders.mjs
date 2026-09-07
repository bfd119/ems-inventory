// 使用期限リマインドメール送信
//
// 旧 mail_sender.js（Google Apps Script）の置き換え。
// GitHub Actions から毎日実行される。
//
// 旧実装からの変更点:
//   1. 既定値を [1, 25] から [30, 10] に修正。
//      旧実装は「毎月1日と25日」という日付の意味の値が、
//      「期限まで何日か」を見る現行ロジックに残っていた（単位の取り違え）。
//   2. 「期限まで残りちょうど30日/10日」の完全一致判定をやめた。
//      完全一致だと実行が1日でも飛ぶとその用品は永久に通知されなかった。
//      代わりに「通知済みの段階」を backup/_reminder_state.json に記録し、
//      より短い段階に入った時だけ通知する。実行漏れがあっても取りこぼさず、
//      かつ毎日同じ通知が届くこともない。

import { readFile, writeFile } from 'node:fs/promises';
import nodemailer from 'nodemailer';
import { fetchAll, fetchSetting } from './supabase.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const STATE_PATH = 'backup/_reminder_state.json';

const APP_URL = 'https://bfd119.github.io/ems-inventory/';

/** 期限なしを表す値。DB は NULL だが、過去データに 9999-12-31 も混在している */
function hasRealExpiry(d) {
    return d && d !== '9999-12-31' && String(d).trim() !== '';
}

/** 日付文字列の差分日数（JST基準・時刻無視） */
function daysUntil(expiryStr, today) {
    const [y, m, d] = expiryStr.split('-').map(Number);
    const exp = Date.UTC(y, m - 1, d);
    return Math.round((exp - today) / 86400000);
}

/** その残日数が該当する通知段階を返す。該当しなければ null */
function bandFor(daysLeft, thresholds) {
    // thresholds は降順（例: [30, 10]）。0 は「期限切れ」を表す暗黙の段階
    const bands = [...thresholds, 0].sort((a, b) => b - a);
    let hit = null;
    for (const t of bands) {
        if (daysLeft <= t) hit = t; // より小さい段階で上書きされていく
    }
    return hit;
}

async function loadState() {
    try {
        return JSON.parse(await readFile(STATE_PATH, 'utf8'));
    } catch {
        return {};
    }
}

async function main() {
    const config = (await fetchSetting('reminder_config')) || {};
    const enabled = config.enabled !== false; // 未設定なら有効
    // 既定値は「期限の30日前・10日前」。旧 [1,25] は単位が違うため使わない
    const thresholds = Array.isArray(config.schedule_days) && config.schedule_days.length > 0
        ? [...config.schedule_days].sort((a, b) => b - a)
        : [30, 10];

    if (!enabled) {
        console.log('リマインド通知は設定で無効化されています。終了します。');
        return;
    }
    console.log(`通知段階: 期限の ${thresholds.join('日前 / ')}日前 ＋ 期限切れ`);

    const [stocks, items, departments] = await Promise.all([
        fetchAll('stocks'), fetchAll('items'), fetchAll('departments', '*', 'sort_order'),
    ]);
    const itemMap = new Map(items.map((i) => [i.id, i]));
    // 署所名は departments テーブルから取る（以前はこのファイルに直接書いていた）
    const deptNames = new Map(departments.map((d) => [String(d.id), d.full_name || d.name]));

    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

    const state = await loadState();
    const nextState = {};
    const byDept = {}; // deptId -> [{name, expiry, qty, daysLeft, band}]

    for (const s of stocks) {
        if (!hasRealExpiry(s.expiry_date) || s.quantity <= 0) continue;
        const item = itemMap.get(s.item_id);
        if (!item) continue;

        const daysLeft = daysUntil(s.expiry_date, today);
        const band = bandFor(daysLeft, thresholds);
        if (band === null) continue; // まだどの段階にも入っていない

        const key = `${s.department_id}:${s.item_id}:${s.expiry_date}`;
        nextState[key] = band; // 在庫が残っている限り状態を引き継ぐ

        const already = state[key];
        // 未通知、またはより短い段階に進んだ時だけ通知する
        if (already !== undefined && already <= band) continue;

        (byDept[s.department_id] ||= []).push({
            name: item.name,
            unit: item.unit || '個',
            expiry: s.expiry_date,
            qty: s.quantity,
            daysLeft,
            band,
        });
    }

    const deptIds = Object.keys(byDept);
    if (deptIds.length === 0) {
        console.log('新たに通知すべき用品はありません。');
        await writeFile(STATE_PATH, JSON.stringify(nextState, null, 2) + '\n', 'utf8');
        return;
    }

    // 宛先はリポジトリに置かず、GitHub Secrets / .env から読む
    let emails = {};
    try {
        emails = JSON.parse(process.env.DEPARTMENT_EMAILS || '{}');
    } catch {
        console.error('DEPARTMENT_EMAILS の JSON を解析できませんでした。');
        process.exit(1);
    }

    // SMTP の接続先は環境変数で差し替えられるようにしてある。
    // 既定は Gmail。将来 Google の仕様変更などで使えなくなった場合は、
    // SMTP_HOST / SMTP_PORT を別のサービスに変えるだけで移行できる。
    //
    // Google はアプリパスワードを "abcd efgh ijkl mnop" のように
    // 4文字ずつ区切って表示するため、そのまま貼ると空白が混ざり
    // 535-5.7.8 Username and Password not accepted で失敗する。
    // 実際の値は英数字16文字なので、空白と改行は取り除いてから使う。
    // 前後の引用符も取り除く（"abcd efgh ..." のように貼られる場合がある）
    const unquote = (v) => v.replace(/^["'\s]+|["'\s]+$/g, '');
    const smtpUser = unquote(process.env.SMTP_USER || '');
    const smtpPass = unquote(process.env.SMTP_PASS || '').replace(/\s+/g, '');

    if (!DRY_RUN && (!smtpUser || !smtpPass)) {
        console.error('SMTP_USER / SMTP_PASS が設定されていません。');
        console.error('GitHub の Settings > Secrets and variables > Actions を確認してください。');
        process.exit(1);
    }

    const transporter = DRY_RUN
        ? null
        : nodemailer.createTransport({
              host: process.env.SMTP_HOST || 'smtp.gmail.com',
              port: Number(process.env.SMTP_PORT) || 465,
              secure: (Number(process.env.SMTP_PORT) || 465) === 465,
              auth: { user: smtpUser, pass: smtpPass },
          });

    // 送信前に接続と認証だけ先に確認する。
    // 失敗時に何を直せばよいかを具体的に出す（メール本文の生成後に
    // 認証エラーで落ちると、原因が分かりにくいため）。
    if (transporter) {
        try {
            await transporter.verify();
        } catch (e) {
            console.error('SMTP の認証に失敗しました:', e.message);
            if (e.code === 'EAUTH') {
                console.error('');
                console.error('確認してください:');
                console.error('  1. SMTP_PASS は Google の「アプリパスワード」16文字か');
                console.error('     （通常のログインパスワードでは通りません）');
                console.error('  2. SMTP_USER のアカウントでそのアプリパスワードを発行したか');
                console.error('  3. そのアカウントで2段階認証が有効か');
                console.error('  4. アプリパスワードを取り消していないか');
                console.error('     https://myaccount.google.com/apppasswords');
                console.error('');
                // 値そのものは GitHub にマスクされるうえ機密なので、
                // 形だけを出して原因を切り分けられるようにする
                const rawPass = process.env.SMTP_PASS || '';
                console.error('設定値の形（値そのものは表示しません）:');
                console.error(`  SMTP_USER: ローカル部 ${smtpUser.split('@')[0].length} 文字 / ドメイン @${smtpUser.split('@')[1] || '(なし)'}`);
                console.error(`  SMTP_PASS: ${smtpPass.length} 文字（アプリパスワードなら 16）`);
                console.error(`             元の値には空白が ${(rawPass.match(/\s/g) || []).length} 個`);
                console.error(`             英小文字のみで構成: ${/^[a-z]+$/.test(smtpPass) ? 'はい（アプリパスワードの典型）' : 'いいえ'}`);
            }
            process.exit(1);
        }
    }

    let sent = 0;
    for (const deptId of deptIds) {
        const rows = byDept[deptId].sort((a, b) => a.expiry.localeCompare(b.expiry));
        const deptName = deptNames.get(String(deptId)) || `署所ID:${deptId}`;
        const to = emails[deptId];

        const expired = rows.filter((r) => r.daysLeft < 0);
        const soon = rows.filter((r) => r.daysLeft >= 0);

        let body = `${deptName} 御中\n\n使用期限が近づいている用品をお知らせします。\n\n`;
        if (expired.length > 0) {
            body += `■ 期限切れ（至急ご確認ください）\n`;
            for (const r of expired) {
                body += `  ・${r.name}  期限 ${r.expiry}（${-r.daysLeft}日超過） 残${r.qty}${r.unit}\n`;
            }
            body += '\n';
        }
        if (soon.length > 0) {
            body += `■ 期限が近い用品\n`;
            for (const r of soon) {
                body += `  ・${r.name}  期限 ${r.expiry}（あと${r.daysLeft}日） 残${r.qty}${r.unit}\n`;
            }
            body += '\n';
        }
        body += `在庫管理表はこちら:\n${APP_URL}\n\n`;
        body += `※このメールは自動送信です。通知の設定は上記アプリの「設定」画面から変更できます。\n`;

        const subject = `【在庫管理】使用期限のお知らせ（${deptName}）`;

        if (DRY_RUN || !to) {
            if (!to && !DRY_RUN) console.warn(`${deptName}: 宛先が未設定のため送信をスキップしました`);
            console.log(`\n--- ${deptName} (${to || '宛先なし'}) ---\n${subject}\n${body}`);
            continue;
        }

        await transporter.sendMail({ from: smtpUser, to, subject, text: body });
        console.log(`${deptName} (${to}) へ送信しました: ${rows.length}件`);
        sent++;
    }

    // 送信に成功した分だけでなく全体の状態を保存する。
    // dry-run では状態を書き換えない（本番の通知が飛ばなくなるため）
    if (!DRY_RUN) {
        await writeFile(STATE_PATH, JSON.stringify(nextState, null, 2) + '\n', 'utf8');
    }
    console.log(`\n完了: ${sent}件のメールを送信しました。`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
