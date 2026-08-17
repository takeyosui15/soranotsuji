#!/usr/bin/env node
/**
 * @name sync.js — プロジェクトからMederuUへの一方向吸い上げ(手順5)
 * @synopsis node sync.js <プロジェクトのリポジトリパス> [プロジェクト名] [--dry-run] | node sync.js --self-test
 * @description
 *   一方向ミラー: 吸い上げ元が正・projects/以下は写し(手で編集しない約束)。
 *   元に無いファイルは写しからも消す。コピー前に全ファイルへ秘密検査をかけ、
 *   1件でも疑いがあれば「そのファイルをスキップして」報告する(安全側)。
 *   吸い上げ対象は ClaudeMederuU/ 一式と .claude/skills/ だけ(場所規約=パス表を持たない)。
 *   ただし *-repo-staging/(他リポジトリへ送る待機コピー)・node_modules/・バイナリの
 *   ビルド成果物(*.vsix)は写さない(知識ではなく製品の複製のため)。
 *   実行後、projects/<名前>/SYNC.md に日時・元コミット・件数を記録する。
 * @history
 *   第80ラウンド(2026-08-14) 宙の辻で誕生。デッサン00の手順5。
 *   検査ツールの掟に従い --self-test で「壊した入力で落ちること」を確認できる。
 *   第92ラウンドでヘッダをJSDocタグ形式(デッサン00の書式規約=JSはmanの章名をタグで持つ)へ変換。
 * @seealso projects/README.md(写しの約束) / CLAUDE.md(書く時の規約) / index-gen.js(このヘッダから目次を作る)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---- 秘密検査のパターン(1件でも当たればそのファイルはスキップ) ----
const SECRET_PATTERNS = [
    ['AWSアクセスキー', /AKIA[0-9A-Z]{16}/],
    ['Google APIキー', /AIza[0-9A-Za-z_\-]{35}/],
    ['GitHubトークン', /\b(ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{36,}\b|github_pat_[0-9A-Za-z_]{22,}/],
    ['Slackトークン', /xox[baprs]-[0-9A-Za-z\-]{10,}/],
    ['秘密鍵ブロック', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['JWT', /\beyJ[0-9A-Za-z_\-]{10,}\.eyJ[0-9A-Za-z_\-]{10,}\./],
    ['鍵・トークンの代入', /\b(api[_-]?key|secret|token|password|passwd)\b\s*[:=]\s*['"][^'"\s]{16,}['"]/i],
    // 個人情報: メールアドレス(既知の無害な定型は許可リストで除外)
    ['メールアドレス', /[0-9A-Za-z._%+\-]+@[0-9A-Za-z.\-]+\.[A-Za-z]{2,}/],
];
// 許可リスト: 検査に当たっても無害と確認済みの定型文字列
const ALLOWLIST = [
    /noreply@anthropic\.com/,
    /users\.noreply\.github\.com/,
    /@example\.(com|org|net)\b/,   // RFC 2606の文書用予約ドメイン(Koushiのサンプル等の架空アドレス)
];

function scanSecrets(text) {
    const hits = [];
    for (const [name, re] of SECRET_PATTERNS) {
        const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
        let m;
        while ((m = g.exec(text)) !== null) {
            const s = m[0];
            if (ALLOWLIST.some(a => a.test(s))) continue;
            hits.push(`${name}: ${s.slice(0, 24)}${s.length > 24 ? '…' : ''}`);
            if (hits.length >= 5) return hits;   // 報告は5件まで(ファイルはどのみちスキップ)
        }
    }
    return hits;
}

// ---- 吸い上げ対象の列挙(除外規則つき) ----
const EXCLUDE_DIR = new Set(['node_modules', '.git']);
const isExcludedDir = (name) => EXCLUDE_DIR.has(name) || name.endsWith('-repo-staging');
const isExcludedFile = (name) => name === '.DS_Store' || name.endsWith('.vsix');

function listFiles(root) {
    const out = [];
    (function walk(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (e.isDirectory()) { if (!isExcludedDir(e.name)) walk(path.join(dir, e.name)); continue; }
            if (!isExcludedFile(e.name)) out.push(path.join(dir, e.name));
        }
    })(root);
    return out.sort();
}

function syncOne(srcRoot, dstRoot, dryRun, report) {
    const srcFiles = fs.existsSync(srcRoot) ? listFiles(srcRoot) : [];
    const wanted = new Set();
    for (const f of srcFiles) {
        const rel = path.relative(srcRoot, f);
        const text = fs.readFileSync(f);
        const hits = scanSecrets(text.toString('utf8'));
        if (hits.length) { report.skipped.push({ rel, hits }); continue; }
        wanted.add(rel);
        const dst = path.join(dstRoot, rel);
        const same = fs.existsSync(dst) && fs.readFileSync(dst).equals(text);
        if (same) { report.unchanged++; continue; }
        if (!dryRun) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, text); }
        report.copied.push(rel);
    }
    // 元に無い写しを消す(一方向ミラー)
    if (fs.existsSync(dstRoot)) {
        for (const f of listFiles(dstRoot)) {
            const rel = path.relative(dstRoot, f);
            if (wanted.has(rel)) continue;
            if (!dryRun) fs.rmSync(f);
            report.deleted.push(rel);
        }
    }
}

function selfTest() {
    let pass = 0, fail = 0;
    const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); ok ? pass++ : fail++; };
    check('AWSキーに当たる', scanSecrets('key=AKIAIOSFODNN7EXAMPLE').length > 0);
    check('GitHubトークンに当たる', scanSecrets('ghp_' + 'a'.repeat(36)).length > 0);
    check('秘密鍵ブロックに当たる', scanSecrets('-----BEGIN RSA PRIVATE KEY-----').length > 0);
    check('鍵の代入に当たる', scanSecrets('const apiKey = "0123456789abcdef0123"').length > 0);
    check('メールに当たる', scanSecrets('連絡先: someone@company.co.jp').length > 0);
    check('許可リストは通す', scanSecrets('Co-Authored-By: Claude <noreply@anthropic.com>').length === 0);
    check('文書用予約ドメイン(example.com)は通す', scanSecrets('サンプル: sophie@example.com').length === 0);
    check('普通の文は通す', scanSecrets('第80ラウンドの実験ノート。辻検索の話。').length === 0);
    console.log(`---- PASS=${pass} FAIL=${fail}`);
    process.exit(fail ? 1 : 0);
}

// ---- main ----
const args = process.argv.slice(2);
if (args.includes('--self-test')) selfTest();
const dryRun = args.includes('--dry-run');
const rest = args.filter(a => !a.startsWith('--'));
if (rest.length < 1) {
    console.error('使い方: node sync.js <プロジェクトのリポジトリパス> [プロジェクト名] [--dry-run] | --self-test');
    process.exit(2);
}
const srcRepo = path.resolve(rest[0]);
const projName = rest[1] || 'soranotsuji';
const mederuuRoot = __dirname;
const projRoot = path.join(mederuuRoot, 'projects', projName);
const report = { copied: [], deleted: [], skipped: [], unchanged: 0 };

syncOne(path.join(srcRepo, 'ClaudeMederuU'), path.join(projRoot, 'ClaudeMederuU'), dryRun, report);
syncOne(path.join(srcRepo, '.claude', 'skills'), path.join(projRoot, 'skills'), dryRun, report);

let commit = '(不明)';
try { commit = execSync('git rev-parse --short HEAD', { cwd: srcRepo }).toString().trim(); } catch (_) {}
const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const lines = [
    `# SYNC記録 — ${projName}`,
    '',
    'sync.js(一方向吸い上げ)の実行記録。このフォルダは写しであり、正はプロジェクト側にある。',
    '',
    `- 最終実行: ${stamp}${dryRun ? ' (dry-run)' : ''}`,
    `- 吸い上げ元: ${path.basename(srcRepo)} @ ${commit}`,
    `- コピー/更新: ${report.copied.length}件 / 変更なし: ${report.unchanged}件 / 削除: ${report.deleted.length}件 / 秘密検査スキップ: ${report.skipped.length}件`,
];
if (!dryRun) { fs.mkdirSync(projRoot, { recursive: true }); fs.writeFileSync(path.join(projRoot, 'SYNC.md'), lines.join('\n') + '\n'); }

console.log(lines.join('\n'));
if (report.copied.length) console.log('\n[コピー/更新]\n' + report.copied.map(r => '  ' + r).join('\n'));
if (report.deleted.length) console.log('\n[削除(元に無い写し)]\n' + report.deleted.map(r => '  ' + r).join('\n'));
if (report.skipped.length) {
    console.log('\n[秘密検査でスキップ(要確認)]');
    for (const s of report.skipped) console.log(`  ${s.rel}\n    ${s.hits.join('\n    ')}`);
    process.exitCode = 1;   // 疑いがある間は成功にしない
}
