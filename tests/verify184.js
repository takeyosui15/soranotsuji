// 第159ラウンド検証: v1.98.0 セキュリティ対策の合格条件(自動で見張る層) —
// ①第三者ライブラリの自前配信(vendor/。版の固定と内容の指紋 MANIFEST.json)・外部ホストからのスクリプト読み込みが無い
// ②読み込み元の許可リスト(CSP meta: script-src 'self'+Googleのログイン/ピッカーだけ・object-src 'none'・base-uri 'self'・connect-src/img-src/frame-src の許可リスト)
// ③インラインの onclick=/<script> が無い(data-click の委譲+許可表)・eval/new Function/javascript: が無い・target=_blank は noopener
// ④秘密情報が追跡ファイルに無い・ハーネスが vendor/ をコピーする
// ⑤ブラウザ: 自サイトの資源がCSPで止められない・ライブラリの実体・data-click の配線・ワーカー・トークンは保存/バックアップ/状態に出ない・取り込みデータの型そろえ(XSSの回帰)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };
const ROOT = path.join(__dirname, '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const src = rd('script.js');
const idxSrc = rd('index.html');
const resetSrc = rd('reset.html'), resetJs = rd('reset.js');
const ffSrc = rd('forecast-features.html');
const workers = ['dp-line-worker.js', 'sora-mov-worker.js', 'sora-terrain-worker.js', 'tm-vis-worker.js', 'tsuji-search-worker.js', 'tsujimesh-search-worker.js', 'kashimap-worker.js'];
const workerSrc = Object.fromEntries(workers.map(w => [w, rd(w)]));
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

check('V0 版数ピン 1.98.0+Version Historyに第159', /APP_VERSION = '1\.98\.0'/.test(src) && src.includes('Version 1.98.0 - ') && src.includes('第159ラウンド'));

// ---- S1: 外部ホストからスクリプト/スタイルを読み込まない(自前配信) ----
const scriptTags = [...idxSrc.matchAll(/<script\b[^>]*>/g)].map(m => m[0]);
const extScript = scriptTags.filter(t => /src="https?:/.test(t));
const linkTags = [...idxSrc.matchAll(/<link\b[^>]*>/g)].map(m => m[0]);
const extLink = linkTags.filter(t => /href="https?:/.test(t));
const dynSrc = [...noComments(src).matchAll(/\.src\s*=\s*['"`](https?:[^'"`]+)['"`]/g)].map(m => m[1]);
const importScriptsExt = Object.entries(workerSrc).flatMap(([w, s]) => [...noComments(s).matchAll(/importScripts\(([^)]*)\)/g)].map(m => w + ':' + m[1]).filter(x => /https?:/.test(x)));
check('S1 外部ホストのスクリプト/スタイルが無い: index.html の <script src>/<link href> は自サイトだけ(vendor/)・動的に作るスクリプトは Google のログイン(accounts.google.com/gsi/client)とピッカー(apis.google.com/js/api.js)の2つだけ・ワーカーの importScripts は自サイトだけ・MathJax は撤去(ヘルプの数式はHTMLに。TeXの記号が残っていない)・使っていない GeographicLib の度分秒は読まない・QRコードは npm の配布物そのまま(qrcode.js)・Draco は vendor/',
  extScript.length === 0 && extLink.length === 0 && scriptTags.some(t => t.includes('src="vendor/maplibre-gl.js"')) && scriptTags.some(t => t.includes('src="vendor/astronomy.browser.min.js"')) &&
  scriptTags.some(t => t.includes('type="module" src="three-global.js"')) && scriptTags.some(t => t.includes('src="vendor/geographiclib-geodesic.min.js"')) && !idxSrc.includes('geographiclib-dms') && scriptTags.some(t => t.includes('src="vendor/qrcode.js"')) && !/\\\(|\\\[/.test(idxSrc) &&
  linkTags.some(t => t.includes('href="vendor/maplibre-gl.css"')) && !/mathjax/i.test(idxSrc) &&
  dynSrc.length === 2 && dynSrc.includes('https://accounts.google.com/gsi/client') && dynSrc.includes('https://apis.google.com/js/api.js') &&
  importScriptsExt.length === 0 && ['dp-line-worker.js', 'sora-mov-worker.js', 'tsuji-search-worker.js', 'tsujimesh-search-worker.js'].every(w => workerSrc[w].includes("importScripts('vendor/astronomy.browser.min.js');")) &&
  src.includes("const SM_BLDG_DRACO_BASE = 'vendor/draco/';") && rd('three-global.js').includes("import * as THREE from './vendor/three.module.min.js';"),
  JSON.stringify({ extScript, extLink, dynSrc, importScriptsExt }));

// ---- S2: vendor/ の台帳(MANIFEST.json)と中身の指紋が一致・台帳に無いファイルが無い・版が固定 ----
{
  const man = JSON.parse(rd('vendor/MANIFEST.json'));
  const bad = [];
  for (const f of man.files) {
    const p = path.join(ROOT, 'vendor', f.path);
    if (!fs.existsSync(p)) { bad.push(f.path + ':missing'); continue; }
    const b = fs.readFileSync(p);
    const h = 'sha384-' + crypto.createHash('sha384').update(b).digest('base64');
    if (h !== f.sha384) bad.push(f.path + ':sha384');
    if (crypto.createHash('sha256').update(b).digest('hex') !== f.sha256) bad.push(f.path + ':sha256');
    if (b.length !== f.bytes) bad.push(f.path + ':bytes');
    if (!/^\d+\.\d+\.\d+$/.test(f.version)) bad.push(f.path + ':version');
    if (!/^https:\/\/cdn\.jsdelivr\.net\/npm\/[^@]+@\d+\.\d+\.\d+\//.test(f.source)) bad.push(f.path + ':source');
    if (!fs.existsSync(path.join(ROOT, 'vendor', f.license_file))) bad.push(f.path + ':license');
  }
  const listed = new Set(man.files.map(f => f.path));
  const walk = (d, pre) => fs.readdirSync(path.join(ROOT, 'vendor', d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name), pre) : [path.join(d, e.name).replace(/\\/g, '/')]);
  const stray = walk('', '').filter(p => !listed.has(p) && p !== 'MANIFEST.json' && p !== 'README.md' && !p.startsWith('licenses/'));
  check('S2 vendor/ の台帳と中身: 8ファイルの sha384/sha256/バイト数が台帳どおり・.nojekyll がある(GitHub Pages が vendor/ を配信する条件)・出所は npm(cdn.jsdelivr.net/npm/…@版)で版は固定・ライセンス全文あり・台帳に無いファイルが無い',
    man.files.length === 8 && bad.length === 0 && stray.length === 0 && fs.existsSync(path.join(ROOT, '.nojekyll')), JSON.stringify({ bad, stray }));
}

// ---- S3: CSP meta(index.html / reset.html)と Referrer-Policy ----
const cspOf = (html) => { const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/); return m ? m[1] : null; };
const cspPairs = (s) => s.split(';').map(x => x.trim()).filter(Boolean).map(x => { const [k, ...v] = x.split(/\s+/); return [k, v]; });
const parseCsp = (s) => Object.fromEntries(cspPairs(s));
const cspNoDup = (s) => { const ks = cspPairs(s).map(([k]) => k); return new Set(ks).size === ks.length; };   // 同じディレクティブが2回あるとブラウザは先勝ち(Object.fromEntries は後勝ち)なので、重複そのものを禁じる
{
  const c = cspOf(idxSrc); const d = c ? parseCsp(c) : {};
  const has = (k, v) => Array.isArray(d[k]) && d[k].includes(v);
  const noWild = Object.values(d).every(vs => vs.every(v => !v.includes('*') && !v.startsWith('http:')));
  check("S3 index.html のCSP(ディレクティブの重複無し): default-src 'self'・script-src は 'self'+'wasm-unsafe-eval'+accounts.google.com/gsi/client+apis.google.com だけ('unsafe-inline'/'unsafe-eval' 無し)・object-src 'none'・base-uri 'self'・form-action 'self'・worker-src 'self' blob:・frame-src は Google(gsi/・docs)だけ・connect-src は使うAPIの許可リスト(地理院・OSM・terrarium・Open-Meteo・Google・GAS・PLATEAU)・img-src/media-src/font-src・ワイルドカードや http: が無い・Referrer-Policy meta",
    !!c && JSON.stringify(d['default-src']) === JSON.stringify(["'self'"]) &&
    JSON.stringify(d['script-src']) === JSON.stringify(["'self'", "'wasm-unsafe-eval'", 'https://accounts.google.com/gsi/client', 'https://apis.google.com']) &&
    JSON.stringify(d['object-src']) === JSON.stringify(["'none'"]) && JSON.stringify(d['base-uri']) === JSON.stringify(["'self'"]) && JSON.stringify(d['form-action']) === JSON.stringify(["'self'"]) &&
    JSON.stringify(d['worker-src']) === JSON.stringify(["'self'", 'blob:']) && JSON.stringify(d['frame-src']) === JSON.stringify(['https://accounts.google.com/gsi/', 'https://docs.google.com']) &&
    JSON.stringify(d['style-src']) === JSON.stringify(["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/style']) &&
    ['https://cyberjapandata.gsi.go.jp', 'https://tile.openstreetmap.org', 'https://s3.amazonaws.com', 'https://msearch.gsi.go.jp', 'https://nominatim.openstreetmap.org', 'https://api.open-meteo.com', 'https://archive-api.open-meteo.com', 'https://air-quality-api.open-meteo.com',
     'https://www.googleapis.com', 'https://sheets.googleapis.com', 'https://oauth2.googleapis.com', 'https://accounts.google.com/gsi/', 'https://script.google.com', 'https://script.googleusercontent.com', 'https://assets.cms.plateau.reearth.io'].every(h => has('connect-src', h)) && d['connect-src'].length === 16 && has('connect-src', "'self'") &&
    JSON.stringify(d['img-src']) === JSON.stringify(["'self'", 'data:', 'blob:', 'https://cyberjapandata.gsi.go.jp', 'https://tile.openstreetmap.org', 'https://s3.amazonaws.com']) &&
    JSON.stringify(d['media-src']) === JSON.stringify(["'self'", 'blob:']) && JSON.stringify(d['font-src']) === JSON.stringify(["'self'"]) && noWild && cspNoDup(c) &&
    idxSrc.includes('<meta name="referrer" content="strict-origin-when-cross-origin">'), c ? c.slice(0, 200) : 'no CSP');
  const r = cspOf(resetSrc); const rd2 = r ? parseCsp(r) : {};
  check("S3b reset.html のCSP: 自サイトだけ(script-src 'self'・object-src 'none'・base-uri 'self')+Referrer-Policy・スクリプトは reset.js(インライン無し)",
    !!r && cspNoDup(r) && JSON.stringify(rd2['script-src']) === JSON.stringify(["'self'"]) && JSON.stringify(rd2['object-src']) === JSON.stringify(["'none'"]) && JSON.stringify(rd2['base-uri']) === JSON.stringify(["'self'"]) &&
    resetSrc.includes('<meta name="referrer" content="strict-origin-when-cross-origin">') && resetSrc.includes('<script src="reset.js"></script>') && !/<script>/.test(resetSrc) && !/ on[a-z]+="/.test(resetSrc) && resetJs.includes("'soranotsuji-maptiles'"));
}

// ---- S4: インラインのハンドラ/スクリプトが無い・危険な構文が無い・data-click の許可表と一致 ----
{
  const inlineAttr = (s) => (s.match(/\son[a-z]+\s*=\s*["']/gi) || []).length;
  const inlineScripts = scriptTags.filter(t => !/\ssrc=/.test(t));
  const names = new Set([...(idxSrc + ffSrc).matchAll(/data-click="([A-Za-z_]+)"/g)].map(m => m[1]));
  const tableM = src.match(/const _CLICK_ACTIONS = Object\.freeze\(\{([\s\S]*?)\}\);/);
  const tableNames = new Set(tableM ? [...tableM[1].matchAll(/(\w+):\s*\(/g)].map(m => m[1]) : []);
  const same = names.size === tableNames.size && [...names].every(n => tableNames.has(n));
  const code = noComments(src) + noComments(resetJs) + Object.values(workerSrc).map(noComments).join('\n');
  check('S4 インラインの on*= が index.html/forecast-features.html/reset.html に無い・index.html にインラインの <script> ブロックが無い(three は three-global.js)・data-click の名前(12)は _CLICK_ACTIONS の許可表と一致・委譲リスナーと securitypolicyviolation の記録・eval/new Function/javascript:/document.write が本体・ワーカー・reset.js に無い',
    inlineAttr(idxSrc) === 0 && inlineAttr(ffSrc) === 0 && inlineAttr(resetSrc) === 0 && inlineScripts.length === 0 && names.size === 12 && same &&
    src.includes("const el = e.target && e.target.closest ? e.target.closest('[data-click]') : null;") && src.includes("document.addEventListener('securitypolicyviolation', (e) => {") && src.includes('    _wireDataClick();\n') &&
    !/\beval\s*\(/.test(code) && !/new Function\s*\(/.test(code) && !/javascript:/i.test(code + idxSrc + resetSrc + ffSrc) && !/document\.write\s*\(/.test(code),
    JSON.stringify({ inline: [inlineAttr(idxSrc), inlineAttr(ffSrc), inlineAttr(resetSrc)], inlineScripts: inlineScripts.length, names: [...names].sort(), table: [...tableNames].sort() }));
}

// ---- S5: 別タブで開くリンクは noopener・window.open は noopener・シートIDは文字種を限る ----
{
  const blankNoRel = (s) => [...s.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)].map(m => m[0]).filter(t => !/rel="[^"]*noopener/.test(t));
  const pages = { 'index.html': idxSrc, 'script.js': src, 'privacy.html': rd('privacy.html'), 'terms.html': rd('terms.html'), 'forecast-features.html': ffSrc, 'reset.html': resetSrc };
  const bad = Object.entries(pages).flatMap(([n, s]) => blankNoRel(s).map(t => n + ':' + t.slice(0, 80)));
  const opens = [...noComments(src).matchAll(/window\.open\(([^;]*)\)/g)].map(m => m[1]);
  check('S5 target="_blank" のリンク(index/script/privacy/terms/forecast/reset)は全て rel=noopener・window.open は noopener 指定・開くシートIDは [A-Za-z0-9_-] に限って encodeURIComponent',
    bad.length === 0 && opens.length >= 1 && opens.every(o => /noopener/.test(o)) && src.includes("if (!/^[A-Za-z0-9_-]+$/.test(String(s.sheetId))) return alert(") && src.includes("window.open(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(s.sheetId)}/edit`, '_blank', 'noopener,noreferrer');"),
    JSON.stringify({ bad: bad.slice(0, 5), opens }));
}

// ---- S6: 秘密情報が追跡ファイルに無い(Google Pickerの公開APIキーだけ=コンソールでリファラ制限する前提)・トークンはメモリだけ ----
{
  const { execSync } = require('child_process');
  const SCANNER_FIXTURES = ['ClaudeMederuU/mederuu-repo-staging/sync.js'];   // 秘密情報の検出器そのもの(検出パターンの自己テスト用の見本文字列を持つ)
  const files = execSync('git ls-files --cached --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(f => f && /\.(js|html|css|json|md|py|txt|yml|yaml|sh)$/.test(f) && !f.startsWith('vendor/') && !f.startsWith('node_modules/') && !SCANNER_FIXTURES.includes(f));
  // 秘密の「形」で探す(名前だけでは探さない): client_secret/refresh_token は「= または : の右に値がある」時だけ。語そのものは文書(この検査の説明・回答・README)に当然現れるので、語で探すと自分の説明に反応する(第160のスモークで検出)
  const pat = /ya29\.[A-Za-z0-9_-]{20,}|GOCSPX-[A-Za-z0-9_-]{20,}|\b1\/\/0[A-Za-z0-9_-]{20,}|[Cc]lient[_-]?[Ss]ecret["']?\s*[:=]\s*["']?[A-Za-z0-9_\-]{8,}|refresh_token["']?\s*[:=]\s*["']?[A-Za-z0-9_\-\/]{8,}|BEGIN (RSA|EC|OPENSSH|PRIVATE) |AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{32,}/;
  const hits = [];
  const keys = new Set();
  for (const f of files) {
    let t; try { t = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (_) { continue; }
    if (pat.test(t)) hits.push(f);
    for (const m of t.matchAll(/AIza[0-9A-Za-z_-]{35}/g)) keys.add(m[0]);
  }
  check("S6 追跡ファイル+未追跡の新しいファイルに秘密情報の形(ya29./GOCSPX-/1//0 のリフレッシュトークン/client_secret=値・refresh_token=値(語だけは対象外)/秘密鍵/AKIA/xox/ghp_/sk-)が無い・AIza のAPIキーは Google Picker 用の1つだけ・アクセストークンはメモリだけ(localStorage/保存/バックアップに書かない)",
    hits.length === 0 && keys.size === 1 && keys.has('AIzaSyBQsU3b8eSF2gISUkOvi_FDp-N0k2hpE-Y') && src.includes('let googleToken = null;') && !/localStorage\.setItem\([^)]*[Tt]oken/.test(noComments(src)) && !/googleToken[^\n]*saveAppState|appState\.googleToken|accessToken:\s*appState/.test(noComments(src)),
    JSON.stringify({ hits, keys: [...keys].map(k => k.slice(0, 8) + '…'), files: files.length }));
}

// ---- S7: ハーネスが vendor/ をリポジトリからコピーする・新しいファイルを含む ----
{
  const h = rd('tests/harness/sync-apptest.py');
  check("S7 ハーネス(sync-apptest.py): DIRS に vendor・FILES に reset.js と three-global.js・MathJax の代替は作らない・コピーした vendor/ を MANIFEST.json の指紋で確かめて違えば中断(CDNから取り直す案内は無い)",
    /DIRS = \['fonts', 'data', 'vendor'\]/.test(h) && h.includes("'reset.js', 'three-global.js'") && !h.includes('mathjax-stub.js') && h.includes("hashlib.sha256(open(p, 'rb').read()).hexdigest() != f['sha256']") && h.includes('sys.exit(2)') && !h.includes('curl -sL'));
}

// ---- S8: vendor/ への参照は全て台帳にある(逆方向)・Google連携の不変条件(スコープ1本・ホスト・APIキーの使い所・Bearer を付ける宛先) ----
{
  const man = JSON.parse(rd('vendor/MANIFEST.json')); const listed = new Set(man.files.map(f => f.path));
  const refs = [...idxSrc.matchAll(/(?:src|href)="vendor\/([^"]+)"/g)].map(m => m[1])
    .concat([...rd('three-global.js').matchAll(/from '\.\/vendor\/([^']+)'/g)].map(m => m[1]))
    .concat(Object.values(workerSrc).flatMap(w => [...noComments(w).matchAll(/importScripts\('vendor\/([^']+)'\)/g)].map(m => m[1])))
    .concat(['draco/draco_wasm_wrapper.js', 'draco/draco_decoder.wasm']);
  const unlisted = refs.filter(r => !listed.has(r));
  const bearer = (noComments(src).match(/'Bearer ' \+ token/g) || []).length;
  check("S8 vendor/ への参照(index.html・three-global.js・ワーカー・Draco)は全て台帳にある / Google連携の不変条件: スコープは drive.file 1本・本番/開発のホストは既知の4つ・APIキーはピッカーの setDeveloperKey だけで使う・Bearer トークンを付ける fetch の宛先は www.googleapis.com と sheets.googleapis.com だけ(4箇所)",
    unlisted.length === 0 && refs.length >= 8 &&
    src.includes("scope: 'https://www.googleapis.com/auth/drive.file'") && (src.match(/googleapis\.com\/auth\//g) || []).length === 1 &&
    src.includes("prod: { hosts: ['soranotsuji.net', 'www.soranotsuji.net']") && src.includes("dev:  { hosts: ['127.0.0.1', 'takeyosui15.github.io']") &&
    (noComments(src).match(/\.setDeveloperKey\(GOOGLE_CONFIG\.apiKey\)/g) || []).length === 1 && !/key=[\s\S]{0,12}GOOGLE_CONFIG\.apiKey/.test(noComments(src)) &&   // APIキーはピッカーに渡すだけ(URLの key= に付けてAPIを叩かない)
    bearer === 4 && src.includes("fetch('https://www.googleapis.com/drive/v3/' + path") && src.includes("fetch('https://sheets.googleapis.com/v4/' + path") && src.includes("const url = 'https://www.googleapis.com/upload/drive/v3/files' + (fileId ? '/' + encodeURIComponent(fileId) : '')") && src.includes("fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(gd.appFileId)}?alt=media`"),
    JSON.stringify({ unlisted, refs: refs.length, bearer }));
}

// ---- S9: 訪問者カウンタ(Apps Script)の不変条件・取り込み口の大きさの上限 ----
{
  const gas = rd('gas_spredsheet.js');
  check("S9 Apps Script: 例外の本文を外へ出さない(error: 'internal')・action の比較は 'visit'/'detail' だけ / 本体: 試すのは合計3回まで(再試行2回)・ファイルは8MBまで・書き戻しは4M文字まで・シートは1,100行まで・Myセット1件は4M文字まで(超えたら読込失敗として扱う)",
    gas.includes("error: 'internal'") && !/e\.toString\(\)|e\.message|e\.stack/.test(gas) && (gas.match(/action === '(visit|detail)'/g) || []).length === 2 && !/action === '(?!visit'|detail')/.test(gas) &&
    src.includes("if (attempt < 3) setTimeout(() => fetchVisitorData(action, todayStr, attempt + 1), 2700 * attempt);") &&
    src.includes('const PICK_FILE_MAX_BYTES = 8 * 1024 * 1024;') && src.includes('if (file.size > PICK_FILE_MAX_BYTES)') &&
    src.includes('const STORE_WRITE_MAX_CHARS = 4 * 1024 * 1024;') && src.includes('if (total > STORE_WRITE_MAX_CHARS) throw new Error(') &&
    src.includes('const MYSET_SHEET_MAX_ROWS = 1100;') && (src.match(/`'\$\{n\}'!1:\$\{MYSET_SHEET_MAX_ROWS\}`/g) || []).length === 2 && src.includes('if (n > STORE_WRITE_MAX_CHARS) { alert(`Myセット「${s.name}」の内容が大きすぎるため') && src.includes("if (!mySetSetData(s, data)) throw new Error('内容が大きすぎるため読み込みませんでした');"));
}

// ---- S10: CSVの式の注入対策(csvText/csvUnprefix の配線)・取り込みの鍵の許可リスト ----
{
  const exporters = (src.match(/csvText\(/g) || []).length, importers = (src.match(/csvUnprefix\(/g) || []).length;
  check("S10 CSV出力の自由文(名前・メモ・天体ID)は csvText(式の先頭文字 = @ + - タブはアポストロフィで文字に。負号の数値は対象外)・取り込みは csvUnprefix で戻す(5種の取り込み+シート)・3つの esc も csvText を通す / 書き戻しは soranotsuji_app だけ(本体 _writeSoranotsujiKeys・reset.js)で JSON として読める物だけ",
    src.includes('function csvText(v) {') && src.includes('function csvUnprefix(t) {') && exporters >= 9 && importers >= 13 &&
    src.includes("csv += `${s.id},${csvText(s.name)},${s.ra},${s.dec}\\r\\n`;") && src.includes("csvText(pt.name)") && src.includes("csvText(t.name ?? '')") && src.includes("csvText(t.memo ?? '')") && (src.match(/const s = csvText\(v\);/g) || []).length === 3 &&
    src.includes("if (k === STORAGE_KEY && typeof obj[k] === 'string') {") && !src.includes("if (k.startsWith('soranotsuji_') && typeof obj[k] === 'string') {") &&
    resetJs.includes("const v = data['soranotsuji_app'];") && resetJs.includes("if (v.length > 4 * 1024 * 1024) throw new Error(") && !resetJs.includes("if (k.startsWith('soranotsuji_') && typeof data[k] === 'string') localStorage.setItem"),   // 復元側に接頭辞だけの書き戻しが残っていない(バックアップの吸い上げ側の startsWith は別)
    JSON.stringify({ exporters, importers }));
}

// ============================================================
// ブラウザ検査
// ============================================================
(async () => {
  const { chromium } = require('playwright-core');
// ---- S11: 公開文と報告の窓口(第172・第173): /.well-known/security.txt(RFC 9116。Contact は非公開の脆弱性報告→リポジトリの順)と privacy.html の外部サービスの節 ----
{
  const secTxt = fs.existsSync(path.join(ROOT, '.well-known', 'security.txt')) ? fs.readFileSync(path.join(ROOT, '.well-known', 'security.txt'), 'utf8') : '';
  const field = (k) => (secTxt.match(new RegExp('^' + k + ':\\s*(.+)$', 'm')) || [])[1];
  const contacts = [...secTxt.matchAll(/^Contact:\s*(.+)$/gm)].map(m => m[1].trim());   // 第173: 1行目=非公開の脆弱性報告(依頼者が両リポで有効化)・2行目=リポジトリ
  const expires = field('Expires'); const expMs = expires ? Date.parse(expires.trim()) : NaN;
  const priv = fs.readFileSync(path.join(ROOT, 'privacy.html'), 'utf8');
  check("S11 /.well-known/security.txt がある(BOM 無し・欄名の後は1つの空白・Contact は2行: 1行目=GitHub の非公開の脆弱性報告(security/advisories/new)・2行目=リポジトリ・Expires は未来で1年と少し以内・Preferred-Languages・Canonical は本番の URL。.nojekyll があるので GitHub Pages が .well-known を配る)/ privacy.html の外部サービスの節に Open-Meteo・Nominatim・PLATEAU・Apps Script があり「ライブラリ配信(CDN)」が無い",
    secTxt.length > 0 && !secTxt.startsWith('\uFEFF') && !/^[A-Za-z-]+:(?! )/m.test(secTxt) &&   // RFC 9116: BOM 無し・欄名の後は1つの空白(第173のレビューで追加)
    contacts.length === 2 && contacts[0] === 'https://github.com/takeyosui15/soranotsuji/security/advisories/new' && contacts[1] === 'https://github.com/takeyosui15/soranotsuji' && Number.isFinite(expMs) && expMs > Date.now() && expMs < Date.now() + 400 * 86400000 &&
    /ja/.test(field('Preferred-Languages') || '') && (field('Canonical') || '').trim() === 'https://soranotsuji.net/.well-known/security.txt' && fs.existsSync(path.join(ROOT, '.nojekyll')) &&
    ['Open-Meteo', 'Nominatim', 'PLATEAU', 'Google Apps Script'].every(w => priv.includes(w)) && !priv.includes('ライブラリ配信(CDN)') && priv.includes('外部の配信網(CDN)は使いません'),
    JSON.stringify({ contacts, expires, daysLeft: Number.isFinite(expMs) ? Math.round((expMs - Date.now()) / 86400000) : null }));
}

  const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const BASE = 'http://127.0.0.1:8099';
  const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ARGS });
  const ctx = await b.newContext({ viewport: { width: 1000, height: 900 }, timezoneId: 'Asia/Tokyo' });
  const p = await ctx.newPage();
  const errors = [], cspLocal = [], cspAll = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { const t = m.text(); if (/Content Security Policy|CSP違反/.test(t)) { cspAll.push(t.slice(0, 160)); if (/127\.0\.0\.1|\(インライン\)|'inline'|blob:|data:/.test(t)) cspLocal.push(t.slice(0, 200)); } });
  await p.route('**/*', r => { const u = r.request().url(); if (u.startsWith(BASE)) return r.continue(); r.abort(); });
  await p.goto(BASE + '/index.html', { waitUntil: 'load' });
  await p.waitForFunction(() => typeof appState !== 'undefined' && typeof setupUI === 'function', { timeout: 20000 });
  await p.waitForTimeout(2500);

  // U1: CSPの下で自サイトの資源が全部読める・ライブラリの実体・インラインハンドラ無し・data-click の配線
  const u1 = await p.evaluate(() => {
    const h = document.querySelector('[data-click="toggleSection"]'); const id = h.dataset.arg;
    const before = document.getElementById(id).classList.contains('closed'); h.click(); const after = document.getElementById(id).classList.contains('closed'); h.click();
    return { csp: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'), maplibre: typeof maplibregl === 'object', three: window.THREE ? String(THREE.REVISION) : null, astro: typeof Astronomy === 'object', geod: typeof geodesic === 'object', qr: typeof qrcode === 'function',
      sources: (typeof glMap !== 'undefined' && glMap) ? Object.keys(glMap.getStyle().sources).length : 0, inline: document.querySelectorAll('[onclick]').length, dataClick: document.querySelectorAll('[data-click]').length, toggled: before !== after && document.getElementById(id).classList.contains('closed') === before };
  });
  check('U1 CSPの下で起動: 起動中のCSP違反が0(自サイト・インライン・blob:・data: も、外部の宛先も)・MapLibre/three(r160)/Astronomy/GeographicLib/qrcode の実体・地図のソースあり・[onclick] 0個・data-click 30個の委譲で節が開閉する',
    cspLocal.length === 0 && cspAll.length === 0 && u1.csp && u1.maplibre && u1.three === '160' && u1.astro && u1.geod && u1.qr && u1.sources > 0 && u1.inline === 0 && u1.dataClick === 30 && u1.toggled, JSON.stringify({ u1, cspLocal: cspLocal.slice(0, 3), cspAll: cspAll.slice(0, 3) }));

  // U2: ワーカー(importScripts は自サイトの vendor/)が起動する・宙の窓(three)が開く
  const u2 = await p.evaluate(async () => {
    const alive = (f) => new Promise(res => { try { const w = new Worker(f); w.onerror = e => res('error:' + (e.message || '')); setTimeout(() => { res('alive'); w.terminate(); }, 1200); } catch (e) { res('throw:' + e); } });
    const r = { ts: await alive('tsuji-search-worker.js'), tm: await alive('tsujimesh-search-worker.js'), dp: await alive('dp-line-worker.js'), mov: await alive('sora-mov-worker.js') };
    try { toggleSoramado(); } catch (e) { r.smErr = String(e); }
    await new Promise(res => setTimeout(res, 2500));
    r.sm = !!appState.isSoramadoActive && !_smFailed;
    try { toggleSoramado(); } catch (_) {}
    return r;
  });
  check('U2 ワーカー4種(辻検索/辻メッシュ/辻ライン/宙の窓の動き)が vendor/ の天体計算を読み込んで起動する・宙の窓(three)が開く', u2.ts === 'alive' && u2.tm === 'alive' && u2.dp === 'alive' && u2.mov === 'alive' && u2.sm === true, JSON.stringify(u2));

  // U3: アクセストークンは端末に残らない(保存・バックアップの吸い上げ・状態の文字列化に出ない)
  const u3 = await p.evaluate(() => {
    const marker = 'ya29.TESTTOKEN_' + Math.random().toString(36).slice(2);
    googleToken = { accessToken: marker, expiresAt: Date.now() + 3600e3 };
    saveAppState();
    const ls = Object.keys(localStorage).map(k => localStorage.getItem(k)).join('\n');
    const dump = JSON.stringify(collectLocalStorageAll());
    const st = JSON.stringify(appState);
    googleToken = null;
    return { inLs: ls.includes(marker), inDump: dump.includes(marker), inState: st.includes(marker), url: location.href.includes(marker) };
  });
  check('U3 アクセストークンは端末に残らない: ログイン相当の後に保存しても localStorage・バックアップの吸い上げ(collectLocalStorageAll)・appState の文字列化・URL のどこにも出ない', !u3.inLs && !u3.inDump && !u3.inState && !u3.url, JSON.stringify(u3));

  // U4: 取り込みデータの型そろえ(XSSの回帰): 他人から受け取ったバックアップ相当の毒入りデータを appState に入れて normalizeAppState→描画しても、HTMLとして解釈されない
  const u4 = await p.evaluate(() => {
    const P = '"><img src=x onerror="window.__pwned=(window.__pwned||0)+1">';
    const keep = JSON.stringify({ o: appState.myObservations, t: appState.myTargets, s: appState.myStars, j: appState.myTsujiSearches, b: appState.bodies, st: appState.start, en: appState.end, ae: appState.startApiElev, h: appState.startHeight });
    appState.myObservations = [{ id: P, name: 'x', lat: 35, lng: 135, elev: 0, height: 0, memo: '' }, { id: 7, name: P, lat: '35.1', lng: '135.1', elev: P, height: P, memo: P }, { id: 8, name: 'ok', lat: 'abc', lng: 1, elev: 0 }, { id: 11, name: '途中(未入力)', lat: null, lng: null, elev: null, height: 0, memo: '' }];
    appState.myTargets = [{ id: 9, name: 9, lat: 36, lng: 136, elev: '<b>1</b>', height: null }];
    appState.myStars = [{ id: P, name: 'ok', ra: 1, dec: 1, visible: false, color: '#DDA0DD', isDashed: true }, { id: 3, name: P, ra: '1.5', dec: '2.5', visible: 1, color: 'red;background:url(https://evil.example/p)', isDashed: 0 }];
    appState.myTsujiSearches = [{ id: 1, name: P, days: P, bodyIds: 'Sun', obsId: P, tgtId: 7, offsetAz: P, toleranceAz: P, moonBase: P, startTime: P, checked: 1 }];
    appState.bodies.find(b => b.id === 'Sun').color = 'red;position:fixed;inset:0';
    appState.start = { lat: 35.65, lng: 139.74, elev: P }; appState.startApiElev = P; appState.startHeight = P;
    normalizeAppState();
    const after = { o: appState.myObservations, s: appState.myStars, j: appState.myTsujiSearches[0], sun: appState.bodies.find(b => b.id === 'Sun').color, start: appState.start, ae: appState.startApiElev, h: appState.startHeight };
    renderMyPointsList('obs'); renderMyPointsList('tgt'); renderMyStarsList(); renderMyTsujiSearches(); renderCelestialList(); updateMyPointMarkers(); updateLocationDisplay();
    const html = document.getElementById('myobs-list').innerHTML + document.getElementById('mytgt-list').innerHTML + (document.getElementById('mystars-list') || {}).innerHTML + (document.getElementById('mytsuji-list') || {}).innerHTML;
    const popup = createLocationPopup('観測点', appState.start, appState.end, appState.startApiElev, appState.startHeight);
    const reached = document.querySelector('#myobs-list .mypoint-name[data-id="7"]');   // 陽性対照: 毒は欄に「文字として」届いている(届いていなければ検査は空振り)
    const res = { pwned: window.__pwned || 0, imgs: document.querySelectorAll('img[src="x"]').length, reachedName: !!reached && reached.value === P, reachedStar: !!document.getElementById('mystars-list') && document.getElementById('mystars-list').textContent.includes('<img src=x'),
      htmlEscaped: html.includes('&lt;img src=x') && !/<img src="?x"?/.test(html + popup), esc: escapeHtml(123) === '123' && escapeHtml(null) === '' && escapeHtml({}) === '[object Object]',
      o: after.o.map(x => [x.id, x.lat, x.lng, x.elev, x.height, x.name, x.memo]), s: after.s.map(x => [x.id, x.name, x.ra, x.dec, x.visible, x.color, x.isDashed]), j: [after.j.name, after.j.days, after.j.obsId, after.j.tgtId, after.j.offsetAz, after.j.toleranceAz, after.j.moonBase, after.j.startTime, after.j.checked],
      sun: after.sun, start: after.start, ae: after.ae, h: after.h, popupHasP: popup.includes('onerror') };
    const k = JSON.parse(keep); appState.myObservations = k.o; appState.myTargets = k.t; appState.myStars = k.s; appState.myTsujiSearches = k.j; appState.bodies = k.b; appState.start = k.st; appState.end = k.en; appState.startApiElev = k.ae; appState.startHeight = k.h;
    normalizeAppState(); renderMyPointsList('obs'); renderMyPointsList('tgt'); renderMyStarsList(); renderMyTsujiSearches(); renderCelestialList(); updateMyPointMarkers(); updateLocationDisplay();
    return res;
  });
  check('U4 毒入りの保存データを入れても HTML として解釈されない: My観測点(id/標高/高さが文字列→数値に・直せない行(緯度abc)は捨てる・緯度経度が未入力の行は残す・名前/メモは文字)・My目的点(名前が数値→文字)・My天体(idが文字列→行を捨てる・ra/decは数値・色の「;background:url」は既定色に)・My辻検索(数値欄→既定/数値・時刻→00:00・真偽は!!)・表示天体の色・観測点の標高/APIの標高/高さ→描画後に img 要素が無く、毒は欄と一覧に「文字として」届いている(陽性対照)・escapeHtml は数値/null/物も落ちない',
    u4.imgs === 0 && u4.reachedName && u4.reachedStar && u4.htmlEscaped && !u4.popupHasP && u4.esc &&   // pwned は CSP が先に止めるので判定には使わない(記録だけ)
    u4.o.length === 2 && u4.o[0][0] === 7 && u4.o[0][1] === 35.1 && u4.o[0][2] === 135.1 && u4.o[0][3] === null && u4.o[0][4] === 0 && typeof u4.o[0][5] === 'string' && typeof u4.o[0][6] === 'string' && u4.o[1][0] === 11 && u4.o[1][1] === null && u4.o[1][2] === null &&   // 行追加の途中(緯度経度が未入力)の行は残る(レビューの直し)
    u4.s.length === 1 && u4.s[0][0] === 3 && u4.s[0][2] === 1.5 && u4.s[0][3] === 2.5 && u4.s[0][4] === true && u4.s[0][5] === '#DDA0DD' && u4.s[0][6] === false &&
    u4.j[1] === 365 && u4.j[2] === null && u4.j[3] === 7 && u4.j[4] === 0 && u4.j[5] === 15 && u4.j[6] === 14.8 && u4.j[7] === '00:00' && u4.j[8] === true &&
    u4.sun === '#FF0000' && typeof u4.start.elev === 'number' && u4.start.elev === 0 && u4.ae === null && u4.h === 0, JSON.stringify(u4));   // APIの標高は数値以外→null・高さは→0

  // U4b: 可視マップの資産ファイルの取り込みは島の番号/画素数が数値でないと受け付けない(文字列(HTML)が島リストへ届かない)
  const u4b = await p.evaluate(async () => {
    const mk = (no) => ({ meta: { mountain: { id: 'test-m', name: 'テスト' }, range_km: 100, k: 0.132 }, islands: { islands: [{ no, px: 10, lat: 35, lon: 135, area_km2: 1, names: ['x'] }] }, outline: { v: 2, islands: [[no, 10, []]] } });
    const r = {};
    try { await _kmImportText(JSON.stringify(mk('<img src=x onerror=1>'))); r.bad = 'accepted'; } catch (e) { r.bad = String(e.message); }
    return r;
  });
  check('U4b 可視マップの資産の取り込み: 島の番号に文字列(HTML)が入ったファイルは「島の索引の形が違います」で拒む(全体の形の門は通った上で、番号の型で止まる)', /^島の索引の形が違います/.test(u4b.bad), JSON.stringify(u4b));

  // U5: 書き戻しの大きさの上限(4M文字を超えるバックアップは拒む)・小さい物は通る
  const u5 = await p.evaluate(() => {
    const before = localStorage.getItem('soranotsuji_app');
    let big; try { _writeSoranotsujiKeys({ soranotsuji_app: 'x'.repeat(4 * 1024 * 1024 + 1) }); big = 'accepted'; } catch (e) { big = e.message; }
    const after = localStorage.getItem('soranotsuji_app');
    return { big, unchanged: before === after, cap: PICK_FILE_MAX_BYTES === 8 * 1024 * 1024 };
  });
  check('U5 取り込み口の大きさ: 4M文字を超える書き戻しは「大きすぎます」で止まり localStorage は変わらない・ファイルの上限は8MB', /大きすぎます/.test(u5.big) && u5.unchanged && u5.cap, JSON.stringify(u5));

  // U6: CSP の許可リストが Google 連携の経路を止めない(ログイン/ピッカーのスクリプト・取り消し/Sheets への fetch は違反イベント0)・許可リスト外は止める(反証: example.invalid のスクリプトは違反1)
  const u6 = await p.evaluate(async () => {
    const viol = []; const h = (e) => viol.push(e.blockedURI + ' ' + e.violatedDirective); document.addEventListener('securitypolicyviolation', h);
    const addScript = (u) => new Promise(res => { const sc = document.createElement('script'); sc.src = u; sc.onload = () => res('load'); sc.onerror = () => res('error'); document.head.appendChild(sc); setTimeout(() => res('timeout'), 1500); });
    const r = {};
    r.gsi = await addScript('https://accounts.google.com/gsi/client');
    r.gapi = await addScript('https://apis.google.com/js/api.js');
    try { await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST' }); r.revoke = 'ok'; } catch (e) { r.revoke = 'network'; }
    try { await fetch('https://sheets.googleapis.com/v4/spreadsheets/x'); r.sheets = 'ok'; } catch (e) { r.sheets = 'network'; }
    try { await fetch('https://www.googleapis.com/drive/v3/files'); r.drive = 'ok'; } catch (e) { r.drive = 'network'; }
    await new Promise(res => setTimeout(res, 300));
    r.allowedViolations = viol.length;
    r.bad = await addScript('https://example.invalid/evil.js');
    try { await fetch('https://example.invalid/x'); } catch (e) {}
    await new Promise(res => setTimeout(res, 300));
    r.blockedViolations = viol.length - r.allowedViolations; r.sample = viol.slice(-2);
    document.removeEventListener('securitypolicyviolation', h);
    return r;
  });
  check('U6 CSP: Google のログイン/ピッカーのスクリプトと取り消し/Sheets/Drive への通信は CSP 違反にならない(通信遮断の失敗は別)・許可リスト外(example.invalid)のスクリプトと通信は CSP が止める(違反イベント2)', u6.allowedViolations === 0 && u6.blockedViolations === 2, JSON.stringify(u6));

  // U7: URL からの毒(My天体の名前にHTML)も normalizeAppState の型そろえを通り、文字として描かれる
  const q7 = await ctx.newPage(); const err7 = []; q7.on('pageerror', e => err7.push(String(e)));
  await q7.route('**/*', r => { const u = r.request().url(); if (u.startsWith(BASE)) return r.continue(); r.abort(); });
  const P7 = '"><img src=x onerror="window.__pwned=1">';
  await q7.goto(BASE + '/index.html?mode=full&starId=777&starName=' + encodeURIComponent(P7) + '&starRa=1.5&starDec=2.5&starColor=' + encodeURIComponent('red;background:url(https://evil.example/p)') + '&date=20261012&time=120000', { waitUntil: 'load' });
  await q7.waitForFunction(() => typeof appState !== 'undefined' && typeof renderMyStarsList === 'function', { timeout: 15000 });
  await q7.waitForTimeout(1200);
  const u7 = await q7.evaluate(() => { const st = appState.myStars.find(s => s.id === 777); const li = document.getElementById('mystars-list'); return { pwned: window.__pwned || 0, imgs: document.querySelectorAll('img[src="x"]').length, star: st ? [st.id, st.name, st.ra, st.dec, st.color] : null, listText: li ? li.textContent.includes('<img src=x') : null }; });
  await q7.close();
  check('U7 URL からの My天体(名前にHTML・色にCSSの注入)は、型そろえを通って文字として描かれ(onerror は走らず img は無い)・色は既定色に', u7.pwned === 0 && u7.imgs === 0 && u7.star && u7.star[1].includes('<img') && u7.star[4] === '#DDA0DD' && u7.listText === true && err7.length === 0, JSON.stringify({ u7, err7: err7.slice(0, 2) }));

  // U8: csvText/csvUnprefix の往復と、負号の数値・普通の名前はそのまま
  const u8 = await p.evaluate(() => ({
    f1: csvText('=HYPERLINK("https://evil.example","地図")'), f2: csvText('@SUM(A1)'), f3: csvText('+1+1'), f4: csvText('-cmd'), f5: csvText('-12.3'), f6: csvText('富士山'), f7: csvText(''),
    r1: csvUnprefix(csvText('=1+1')), r2: csvUnprefix(csvText('-cmd')), r3: csvUnprefix("'富士山"), r4: csvUnprefix(csvText('-12.3')),
    keys: (() => { const before = localStorage.getItem('soranotsuji_app'); const n = _writeSoranotsujiKeys({ soranotsuji_evil: 'x', soranotsuji_app: before }); return { n, planted: localStorage.getItem('soranotsuji_evil') }; })(),
  }));
  check("U8 CSVの式の注入対策: =HYPERLINK/@SUM/+1+1/-cmd はアポストロフィ付き・-12.3 と普通の名前と空はそのまま・取り込みで元に戻る(アポストロフィで始まる普通の名前は触らない)・書き戻しは soranotsuji_app 以外の鍵を植え付けない",
    u8.f1.startsWith("'=") && u8.f2 === "'@SUM(A1)" && u8.f3 === "'+1+1" && u8.f4 === "'-cmd" && u8.f5 === '-12.3' && u8.f6 === '富士山' && u8.f7 === '' &&
    u8.r1 === '=1+1' && u8.r2 === '-cmd' && u8.r3 === "'富士山" && u8.r4 === '-12.3' && u8.keys.n === 1 && u8.keys.planted === null, JSON.stringify(u8));

  check('E ページエラーなし', errors.length === 0, errors.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL ? 1 : 0);
})().catch(e => { console.log('ERR', e && e.stack || e); process.exit(1); });
