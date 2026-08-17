#!/usr/bin/env node
/**
 * @name index-gen — MederuUの各フォルダにindex.md(腐らない目次)を自動生成する
 * @synopsis node index-gen.js [<ルート>] [--dry-run] | node index-gen.js --self-test
 * @description
 *   フォルダを歩いて、各フォルダにindex.md(目次)を書く。目次の一言説明は次の順で拾う:
 *   .js = 先頭のJSDocブロックの独自タグ(@name/@synopsis。manの章名をタグにした書式) /
 *   .py = モジュールdocstringのNAME:/SYNOPSIS:見出し行 /
 *   .md = YAMLフロントマターのtitle+description、無ければ最初の「# 見出し」行。
 *   index.md自体は毎回作り直す(手書きしない=腐らない目次)。内容が同じなら書き換えない(冪等)。
 *   .git/node_modules/*-repo-staging は歩かない。sync.jsの一方向ミラーとは
 *   「sync→index-gen→commit」の実行順で整合する(syncが古い目次を消し、index-genが作り直す)。
 * @history
 *   MederuUデッサン00の手順6(第43ラウンドで書式を5セクション=name/synopsis/description/
 *   history/seeAlsoに統一、第92ラウンドで実装)。ツールヘッダのman文化(第41ラウンドの依頼者提案)を
 *   機械処理して「道具が道具を説明する」を実現する最初の道具。
 * @seealso sync.js(一方向吸い上げ) / MederuU CLAUDE.md / 宙の辻 tests/harness/sync-apptest.py(書式の実例第1号)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set(['.git', 'node_modules']);
const isSkipDir = (name) => SKIP_DIRS.has(name) || name.endsWith('-repo-staging');

/** .js: 先頭のJSDocブロックから@name/@synopsisを抽出(未知タグはJSDoc系ツールが無視する前提の独自タグ) */
function parseJsHeader(text) {
    const m = text.match(/\/\*\*([\s\S]*?)\*\//);
    if (!m) return null;
    const body = m[1].replace(/^\s*\* ?/gm, '');
    const tag = (name) => {
        const t = body.match(new RegExp('@' + name + '\\s+([^\\n]+)'));
        return t ? t[1].trim() : null;
    };
    const name = tag('name'), synopsis = tag('synopsis');
    if (!name && !synopsis) return null;
    return { title: name, desc: synopsis };
}

/** .py: モジュールdocstring(先頭の"""...""")のNAME:/SYNOPSIS:見出し行を抽出 */
function parsePyHeader(text) {
    const m = text.match(/^(?:#[^\n]*\n)*\s*(?:'''|""")([\s\S]*?)(?:'''|""")/);
    if (!m) return null;
    const line = (name) => {
        const t = m[1].match(new RegExp('^\\s*' + name + ':\\s*([^\\n]+)', 'm'));
        return t ? t[1].trim() : null;
    };
    const name = line('NAME'), synopsis = line('SYNOPSIS');
    if (!name && !synopsis) return null;
    return { title: name, desc: synopsis };
}

/** .md: YAMLフロントマター(title/description)、無ければ最初の「# 見出し」行 */
function parseMdHeader(text) {
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (fm) {
        const f = (name) => {
            const t = fm[1].match(new RegExp('^' + name + ':\\s*(.+)$', 'm'));
            return t ? t[1].trim().replace(/^["']|["']$/g, '') : null;
        };
        const title = f('title'), desc = f('description');
        if (title || desc) return { title, desc };
    }
    const h = text.match(/^#\s+(.+)$/m);
    return h ? { title: h[1].trim(), desc: null } : null;
}

/** 1ファイルの目次行の素材を作る({title, desc}|null。読めない形式はnull=ファイル名だけの行になる) */
function describeFile(fullPath) {
    const ext = path.extname(fullPath);
    if (!['.js', '.py', '.md'].includes(ext)) return null;
    let text;
    try { text = fs.readFileSync(fullPath, 'utf8'); } catch (_) { return null; }
    if (ext === '.js') return parseJsHeader(text);
    if (ext === '.py') return parsePyHeader(text);
    return parseMdHeader(text);
}

const GEN_NOTE = '*この目次はindex-genが自動生成します(手書きしない=腐らない目次)。再生成: `node index-gen.js`*';

/** 1フォルダのindex.md本文を作る(サブフォルダ→ファイルの順。indexとログ類は載せない) */
function buildIndex(dirAbs, relFromRoot) {
    const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory() && !isSkipDir(e.name)).map(e => e.name).sort();
    const files = entries.filter(e => e.isFile() && e.name !== 'index.md').map(e => e.name).sort();
    let out = `# 目次: ${relFromRoot === '' ? '(ルート)' : relFromRoot + '/'}\n\n${GEN_NOTE}\n`;
    if (dirs.length) {
        out += '\n## フォルダ\n\n';
        for (const d of dirs) out += `- [${d}/](${d}/index.md)\n`;
    }
    if (files.length) {
        out += '\n## ファイル\n\n';
        for (const f of files) {
            const info = describeFile(path.join(dirAbs, f));
            const label = info && info.title ? `${info.title}` : f;
            const desc = info && info.desc ? ` — ${info.desc}` : '';
            out += `- [${f}](${f})` + (info && info.title && info.title !== f ? ` : ${label}${desc}` : desc) + '\n';
        }
    }
    return out;
}

/** ルート以下を歩いて各フォルダへindex.mdを書く(同内容なら書かない)。戻り値=書いた件数 */
function generate(root, dryRun) {
    let written = 0, unchanged = 0;
    const walk = (dirAbs) => {
        const rel = path.relative(root, dirAbs).split(path.sep).join('/');
        const body = buildIndex(dirAbs, rel);
        const target = path.join(dirAbs, 'index.md');
        const old = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
        if (old !== body) {
            if (!dryRun) fs.writeFileSync(target, body);
            written++;
            console.log(`${dryRun ? '[dry-run] ' : ''}write: ${rel === '' ? '' : rel + '/'}index.md`);
        } else unchanged++;
        for (const e of fs.readdirSync(dirAbs, { withFileTypes: true })) {
            if (e.isDirectory() && !isSkipDir(e.name)) walk(path.join(dirAbs, e.name));
        }
    };
    walk(root);
    console.log(`index-gen: 書き込み${written}件 / 変更なし${unchanged}件`);
    return written;
}

/** 自己テスト(壊した入力で落ちることまで確認する掟) */
function selfTest() {
    let pass = 0, fail = 0;
    const check = (n, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}`); ok ? pass++ : fail++; };
    const js = parseJsHeader('/**\n * @name foo — 一言\n * @synopsis node foo.js\n */\ncode');
    check('JS: @name/@synopsisを抽出', !!js && js.title === 'foo — 一言' && js.desc === 'node foo.js');
    check('JS: ヘッダ無しはnull', parseJsHeader('const a = 1;') === null);
    const py = parsePyHeader('#!/usr/bin/env python3\n"""\nNAME: bar — 一言\nSYNOPSIS: python3 bar.py\n"""\npass');
    check('PY: NAME:/SYNOPSIS:を抽出', !!py && py.title === 'bar — 一言' && py.desc === 'python3 bar.py');
    check('PY: docstring無しはnull', parsePyHeader('x = 1\n') === null);
    const fm = parseMdHeader('---\ntype: note\ntitle: 学びの題\ndescription: 一言\n---\n# 本文');
    check('MD: フロントマターのtitle/descriptionを抽出', !!fm && fm.title === '学びの題' && fm.desc === '一言');
    const md = parseMdHeader('# 見出しだけの文書\n本文');
    check('MD: フロントマター無しは最初の見出し', !!md && md.title === '見出しだけの文書' && md.desc === null);
    check('MD: 見出しも無ければnull', parseMdHeader('ただの本文') === null);
    // 生成の冪等性(仮フォルダで2回走らせて2回目が0件)
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'idxgen-'));
    fs.writeFileSync(path.join(tmp, 'a.md'), '# A\n');
    fs.mkdirSync(path.join(tmp, 'sub'));
    fs.writeFileSync(path.join(tmp, 'sub', 'b.js'), '/**\n * @name b — B\n * @synopsis node b\n */\n');
    const w1 = generate(tmp, false);
    const w2 = generate(tmp, false);
    check('生成: 初回は書き、2回目は0件(冪等)', w1 === 2 && w2 === 0);
    const rootIdx = fs.readFileSync(path.join(tmp, 'index.md'), 'utf8');
    check('生成: ルート目次にフォルダとファイルの行がある', rootIdx.includes('[sub/](sub/index.md)') && rootIdx.includes('[a.md](a.md)'));
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`---- PASS=${pass} FAIL=${fail}`);
    process.exit(fail ? 1 : 0);
}

if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.includes('--self-test')) selfTest();
    else {
        const dryRun = args.includes('--dry-run');
        const root = args.find(a => !a.startsWith('--')) || __dirname;
        generate(path.resolve(root), dryRun);
    }
}
module.exports = { parseJsHeader, parsePyHeader, parseMdHeader, generate };
