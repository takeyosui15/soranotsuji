// 第158ラウンド検証: v1.97.0 気差の2本立て(大気差補正=地上K: オン=気象値/オフ=0・既定オン / 気差オプション=天体の大気差 astroRefraction・既定オン)・
// 宙の窓検索(ボタン名と段・注記・ctrlのドラッグの対象2チェック+辻検索/辻メッシュボタン)・地理院タイルのオフライン(gsicache://の店・標高タイルの店の読み直し・バックアップメニューの行)・可視マップの封鎖(?kashimap=1)
// ①静的: 本体/ワーカー/HTML/CSSの配線  ②ブラウザ: 既定値と係数欄・オフ=0・移行・封鎖の表示と開錠・宙の窓のドラッグの対象・ctrlボタンの連動・店の件数/容量/全削除・標高タイルの店の読み
'use strict';
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
const idxSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cssSrc = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const tsSrc = fs.readFileSync(path.join(ROOT, 'tsuji-search-worker.js'), 'utf8');
const tmSrc = fs.readFileSync(path.join(ROOT, 'tsujimesh-search-worker.js'), 'utf8');
const dpSrc = fs.readFileSync(path.join(ROOT, 'dp-line-worker.js'), 'utf8');
const stSrc = fs.readFileSync(path.join(ROOT, 'sora-terrain-worker.js'), 'utf8');

check('V0 版数は1.97以上+Version Historyに第158(ピンは最新のverifyへ移した)', /APP_VERSION = '1\.9[7-9]\.\d+'/.test(src) && src.includes('Version 1.97.0 - ') && src.includes('第158ラウンド — 気差を2本立てに'));

check('S1 気差の2本立て(本体): refractionKInUse はオフ=0・既定は両方オン・保存/復元/移行(refractionV3)・天体の大気差は astroRefraction だけが決める(旧式が残らない)・ワーカーへは astroRefraction・共有URL(2つのビルダー+復元)・辞書v22',
  src.includes("return appState.refractionEnabled ? calculateKFromMeteo(appState.meteo.p, appState.meteo.t, appState.meteo.l) : 0;") &&
  src.includes("    refractionEnabled: true,\n") && src.includes("    astroRefraction: true,\n") &&
  src.includes("        astroRefraction: appState.astroRefraction,\n        refractionV3: true,") &&
  src.includes("if(saved.astroRefraction !== undefined) appState.astroRefraction = saved.astroRefraction;") &&
  src.includes("if (saved.refractionV3 !== true) { appState.refractionEnabled = true; appState.astroRefraction = true; }") &&
  src.includes("if (data.settings.astroRefraction !== undefined) appState.astroRefraction = data.settings.astroRefraction;") &&
  src.includes("if (data.settings.astroRefraction === undefined && data.settings.refractionEnabled !== undefined) { appState.refractionEnabled = true; appState.astroRefraction = true; }") &&   // 旧形式のバックアップも一度だけ両方オンへ(レビューの直し)
  src.includes("const offKey = `${offAz}|${offAlt}|${appState.astroRefraction ? 1 : 0}|${refractionKInUse()}`;") &&   // 辻ライン365の鍵に気差(レビューの直し)
  !/appState\.refractionEnabled \? ['"]normal['"]/.test(src) && (src.match(/appState\.astroRefraction \? ['"]normal['"] : null/g) || []).length >= 10 &&
  (src.match(/const astroRefraction = appState\.astroRefraction;/g) || []).length === 2 && (src.match(/bodyMsg, observerData, astroRefraction,/g) || []).length === 4 &&
  src.includes("observerData, astroRefraction: appState.astroRefraction,") && (src.match(/C\.astroRefraction \? 'normal' : null/g) || []).length === 3 &&
  src.includes("refraction: appState.astroRefraction }") && src.includes("${appState.mwOffsetAngle}|${appState.astroRefraction}`") &&
  (src.match(/params\.set\('astroRefraction', appState\.astroRefraction \? 'true' : 'false'\);/g) || []).length === 2 && src.includes("soraBool('refractionEnabled'); soraBool('astroRefraction');") &&
  src.includes("const _QP_SEEDS_V22 = _QP_SEEDS_V21.concat(['&refractionEnabled=true', '&astroRefraction=true', '&astroRefraction=false', '&astroRefraction=']);") && src.includes("_QP_SEEDS_V21, _QP_SEEDS_V22]") &&
  src.includes("'&refractionEnabled=false', '&meteoP=1013.25', '&meteoT=15', '&meteoL=0.0065',"));   // v16の種は凍結のまま

check('S1b 気差の2本立て(ワーカー・設定の部品・ヘルプ): 3ワーカーは astroRefraction で受けて Horizon の normal/null に・設定メニューに「:気差オプション」が登録の前・chk-astro-refraction の配線と同期(2つのチェックと設定登録は _refractionSettingChanged=保存→再計算→辻ライン365も引き直す)・ヘルプの2項目',
  (tsSrc.match(/astroRefraction/g) || []).length >= 4 && !tsSrc.includes('refractionEnabled') && tsSrc.includes("A.Horizon(time, observer, ra, dec, astroRefraction ? 'normal' : null)") &&
  (tmSrc.match(/astroRefraction/g) || []).length >= 4 && !tmSrc.includes('refractionEnabled') &&
  dpSrc.includes("body, observerData, targetData, astroRefraction, k,") && dpSrc.includes("const refr = astroRefraction ? 'normal' : null;") &&
  /<input type="checkbox" id="chk-astro-refraction" class="body-checkbox"[^>]*>\s*<label class="input-label meteo-label" for="chk-astro-refraction">:気差オプション\(Astronomy Engine気差補正\)<\/label>\s*<\/div>\s*<div class="action-area">\s*<button id="btn-reg-settings"/.test(idxSrc) &&
  src.includes("if (chkAstro) chkAstro.addEventListener('change', (e) => { appState.astroRefraction = e.target.checked; _refractionSettingChanged(); });") && src.includes("function _refractionSettingChanged() {\n    saveAppState();\n    updateAll();\n    if (appState.isDP365Active) updateDP365Lines();\n}") && (src.match(/_refractionSettingChanged\(\);/g) || []).length === 3 && src.includes("if (chkAstro) chkAstro.checked = !!appState.astroRefraction;") &&
  idxSrc.includes('<li><strong>気差係数 K (大気差補正)</strong>') && idxSrc.includes('オフのときは 0 (気差なし=地球の丸みだけ。K=0 の見え方を確かめるためのスイッチです)') &&
  idxSrc.includes('<li><strong>気差オプション (Astronomy Engine気差補正)</strong>') && idxSrc.includes('両方オンでも二重にはかかりません (既定は両方オン)') &&
  idxSrc.includes('title="いま使っている気差係数K。チェックオン=下の気象条件から算出した値(既定)、オフ=0(気差なし。'));

check('S2 宙の窓検索(静的): 位置情報メニューの段(辻検索/辻メッシュ/宙の窓検索・可視マップは次の段)・宙の窓メニューの注記・ctrlの先頭に2つのチェック(構図=初期オン・辻オフセット点)と「辻検索」「辻メッシュ」(2分割)・本体のドラッグの分岐と配線・ctrlボタンの連動(syncBottomPanels)・ヘルプ',
  /btn-tsujimesh"[^>]*>辻メッシュ<\/button>\s*<button id="btn-soramado"[^>]*>宙の窓検索<\/button>\s*<\/div>\s*<div class="control-row main-buttons-row" id="row-kashimap-btn">\s*<button id="btn-kashimap"/.test(idxSrc) &&
  /<div id="sec-soramado" class="section-content closed">\s*<div class="control-row left-row"><span class="menu-note">プレビュー下のコントロールメニューから構図を見ながら辻オフセット点を変更できます。<\/span><\/div>/.test(idxSrc) &&
  /<div id="soramado-ctrl-body" class="hidden">\s*<div class="control-row left-row">\s*<input type="checkbox" id="chk-sora-ctrl-drag-frame" class="body-checkbox" checked[^>]*>\s*<label[^>]*for="chk-sora-ctrl-drag-frame">:構図をドラッグ\(二本指\)で変更<\/label>\s*<\/div>\s*<div class="control-row left-row">\s*<input type="checkbox" id="chk-sora-ctrl-drag-tsuji" class="body-checkbox"[^>]*>\s*<label[^>]*for="chk-sora-ctrl-drag-tsuji">:辻オフセット点をドラッグ\(二本指\)で変更<\/label>\s*<\/div>\s*<div class="control-row main-buttons-row sora-ctrl-search-row">\s*<button id="btn-sora-ctrl-tsuji-search" class="nav-btn main-btn"[^>]*>辻検索<\/button>\s*<button id="btn-sora-ctrl-tsujimesh" class="nav-btn main-btn"[^>]*>辻メッシュ<\/button>\s*<\/div>/.test(idxSrc) &&
  src.includes('let _smDragFrame = true, _smDragTsuji = false;') && src.includes('if (_smDragTsuji) {') && src.includes('const dAz = dx * hAov / _smFinderW;') && src.includes("if (!_smDragFrame) return;") &&
  src.includes('function _smSetupSearchCtrl() {') && src.includes('function _smSyncSearchButtons() {') && src.includes("function syncBottomPanels() {\n    _smSyncSearchButtons();") &&
  src.includes("if (b1) b1.addEventListener('click', toggleTsujiSearch);") && src.includes("if (b2) b2.addEventListener('click', toggleTsujiMesh);") &&
  cssSrc.includes('#soramado-ctrl-body .sora-ctrl-search-row .nav-btn { flex: 1 1 0; min-width: 0; }') && cssSrc.includes('.kashimap-note, .menu-note { font-size: 11px; color: #aaa; }') &&
  idxSrc.includes('<h3>宙の窓検索</h3>') && idxSrc.includes('<strong>:辻オフセット点をドラッグ(二本指)で変更</strong> は画面中心(+)と目的点(+)を据えて検索中心(×)だけを動かします'));

check('S3 地理院タイルのオフライン(静的): gsicache:// の店(IndexedDB soranotsuji-maptiles・上限1GB・404は status 404 の例外=MapLibreの既定と同じ)・地図の地理院ソース4つ+宙断面の淡色は店経由(OSMはそのまま)・標高タイルは _demTileLoad が店(可視マップと同じ tiles)を先に読む・宙の窓の地形ワーカーも同じ店・バックアップメニューの行と全削除・ヘルプ・CSS',
  src.includes("const MT_DB = 'soranotsuji-maptiles', MT_STORE = 'tiles';") && src.includes('const MT_MAX_BYTES = 1024 * 1024 * 1024;') && src.includes("maplibregl.addProtocol('gsicache', _mtProtocolHandler);") &&
  src.includes("const notFound = () => { const e = new Error('HTTP 404'); e.status = 404; throw e; };") && src.includes("function _mtUrl(url) { return url.includes(MT_HOST) ? 'gsicache://' + url : url; }") &&
  src.includes("_mtEnsureProtocol();   // 地理院タイルは端末の店を先に読む(第158)") &&
  src.includes("'base-std': rasterSrc([_mtUrl('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png')], gsiAttr, 18),") && src.includes("'base-photo': rasterSrc([_mtUrl('https://cyberjapandata.gsi.go.jp/xyz/ort/{z}/{x}/{y}.jpg')], gsiAttr, 18),") &&
  src.includes("'base-pale': rasterSrc([_mtUrl('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png')], gsiAttr, 18),") && src.includes("tiles: [_mtUrl('https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/{z}/{x}/{y}.pbf')],") &&
  src.includes("tiles: [_mtUrl('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png')],") && src.includes("'base-osm': rasterSrc(['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],") &&
  src.includes("const img = await _demTileLoad(tileUrl);") && src.includes('async function _demTileLoad(tileUrl) {') && src.includes("const DEM_TILE_URL_RE = /\\/xyz\\/(dem5a_png|dem5b_png|dem5c_png|dem_png)\\/(\\d+)\\/(\\d+)\\/(\\d+)\\.png$/;") &&
  src.includes("else { try { return await _demDecode(r.buf); } catch (_) {} }") &&
  stSrc.includes("const req = indexedDB.open('soranotsuji-kashimap');") && stSrc.includes("const rec = await demGet(db, key);") && stSrc.includes("if (db) { const buf = await blob.arrayBuffer(); await demPut(db, { key, kind: m[1], z: +m[2], x: +m[3], y: +m[4], size: buf.byteLength, buf, savedAt: Date.now() }); }") &&
  ['backup-maptiles-count', 'backup-maptiles-size', 'backup-maptiles-updated', 'btn-backup-maptiles-clear', 'backup-demtiles-count', 'backup-demtiles-size', 'backup-demtiles-updated', 'btn-backup-demtiles-clear'].every(id => idxSrc.includes(`id="${id}"`)) &&
  idxSrc.includes('<span class="menu-note">自動キャッシュなので、定期的に全削除してください。</span>') && idxSrc.includes('<li><strong>地理タイル / 標高タイル (端末の控え)</strong>') &&
  src.includes("_mtRefreshBackupRows();   // 地理タイル/標高タイルの件数・容量・最終更新(第158)") && src.includes("if (bDem) bDem.onclick = async () => {") &&
  src.includes("_idbStatByIndex(db.transaction('tiles', 'readonly').objectStore('tiles'))") && src.includes("_idbStatByIndex(db.transaction(MT_STORE, 'readonly').objectStore(MT_STORE))") &&   // 件数・容量は索引の鍵カーソルで(本文を読まない。レビューの直し)
  src.includes("indexedDB.open(MT_DB, 2)") && src.includes("indexedDB.open('soranotsuji-kashimap', 3)") && src.includes("_idbEnsureStatIndexes(tx.objectStore('tiles'));") &&
  src.includes("if (rec && rec.miss) { if (_storeMissFresh(rec)) notFound(); rec = null; }") && src.includes("if (r.miss || !r.buf) { if (_storeMissFresh(r)) return null; }") &&   // 「無し」の印は30日で取り直す
  src.includes("MISS_TTL_MS: 30 * 24 * 3600 * 1000,") === false && fs.readFileSync('sora-constants.js', 'utf8').includes("MISS_TTL_MS: 30 * 24 * 3600 * 1000,") &&
  fs.readFileSync('sora-terrain-worker.js', 'utf8').includes("importScripts('sora-constants.js');") && fs.readFileSync('sora-terrain-worker.js', 'utf8').includes("SORA.TILE_STORE.MISS_TTL_MS") && fs.readFileSync('kashimap-worker.js', 'utf8').includes("SORA.TILE_STORE.MISS_TTL_MS") &&
  src.includes("if (fetched) return await _loadTileImage(tileUrl);") && src.includes("if (sec && sec.classList.contains('closed')) return;") && src.includes("if (id === 'sec-backup' && !el.classList.contains('closed') && typeof _mtRefreshBackupRows === 'function') _mtRefreshBackupRows();") &&   // 取得の失敗は1回・閉じている間は数えない
  cssSrc.includes('#sec-backup .km-stat { font-size: 13px; color: #000; font-weight: normal; }'));

check('S4 可視マップの封鎖(静的): FEATURE_KASHIMAP_ENABLED(?kashimap=1)・applyFeatureLocks が4つの要素に .feature-locked・入口3つで止める・initで forecast の次に・CSS・HTMLの印(段/節/ヘルプの id)',
  src.includes("const FEATURE_KASHIMAP_ENABLED = (() => {") && src.includes("get('kashimap') === '1'") &&
  src.includes("for (const id of ['row-kashimap-btn', 'section-kashimap', 'help-kashimap', 'kashimap-panel']) { const el = document.getElementById(id); if (el) el.classList.add('feature-locked'); }") &&
  src.includes("async function runKashimapSearch() {\n    if (!FEATURE_KASHIMAP_ENABLED) return;") && src.includes("async function _kmComputeRun(targets, opts) {\n    if (!FEATURE_KASHIMAP_ENABLED) return;") &&
  src.includes("function toggleKashimap() { if (!FEATURE_KASHIMAP_ENABLED) return;") && src.includes("await loadForecastFeatures();\n    applyFeatureLocks();") &&
  cssSrc.includes('.feature-locked { display: none !important; }') &&
  idxSrc.includes('<div class="control-row main-buttons-row" id="row-kashimap-btn">') && idxSrc.includes('<div class="section" id="section-kashimap">') && idxSrc.includes('<section class="help-section" id="help-kashimap">') &&
  /id="row-kashimap-btn">\s*<button id="btn-kashimap"[^>]*>可視マップ<\/button>\s*<\/div>\s*<div id="ff-slot-soradanmen-btn" class="hidden"><\/div>/.test(idxSrc));   // 宙断面(forecast)のスロットは封鎖される段の外(レビューの直し: ?forecast=1 だけで宙断面が見えるように)

(async () => {
  const { chromium } = require('playwright-core');
  const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const BASE = 'http://127.0.0.1:8099';
  const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ARGS });
  const ctx = await b.newContext({ viewport: { width: 1000, height: 900 }, timezoneId: 'Asia/Tokyo' });
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const errors = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(String(e)));
  await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await p.goto(BASE + '/index.html', { waitUntil: 'load' });
  await p.waitForFunction(() => typeof appState !== 'undefined' && typeof refractionKInUse === 'function', { timeout: 15000 });
  await p.waitForTimeout(800);

  // U1: 封鎖(既定): 可視マップのボタンの段・メニューの節・ヘルプの節が隠れる。toggleKashimap は何もしない
  const u1 = await p.evaluate(() => {
    const disp = id => { const el = document.getElementById(id); return el ? getComputedStyle(el).display : 'missing'; };
    toggleKashimap();
    return { enabled: FEATURE_KASHIMAP_ENABLED, row: disp('row-kashimap-btn'), sec: disp('section-kashimap'), help: disp('help-kashimap'), panel: disp('kashimap-panel'), active: _kmActive, soraRow: disp('btn-soramado'), demNote: document.getElementById('backup-demtiles-note').textContent, btnText: document.getElementById('btn-soramado').textContent };
  });
  check('U1 封鎖(既定): ?kashimap=1 が無いと可視マップのボタンの段・メニューの節・ヘルプ・結果パネルは display:none で、toggleKashimap は何もしない。宙の窓検索のボタンは見える。標高タイルの注記は可視マップ抜きの文', !u1.enabled && u1.row === 'none' && u1.sec === 'none' && u1.help === 'none' && u1.panel === 'none' && u1.active === false && u1.soraRow !== 'none' && u1.btnText === '宙の窓検索' && u1.demNote.startsWith('標高グラフ・辻検索・辻メッシュ・宙の窓の計算に使う控えです') && !u1.demNote.includes('可視タイル'), JSON.stringify(u1));   // 封鎖中は標高タイルの注記が可視マップ抜きの文(レビューの直し)

  // U2: 気差の2本立て: 既定は両方オン・係数欄は0.1320・オフ=0.0000で refractionKInUse()===0・実効半径は丸みだけ・気差オプションのチェック
  const u2 = await p.evaluate(() => {
    const iK = document.getElementById('input-refraction-k'), chk = document.getElementById('chk-refraction'), chkA = document.getElementById('chk-astro-refraction');
    const d0 = { re: appState.refractionEnabled, ar: appState.astroRefraction, k: refractionKInUse(), shown: iK.value, chk: chk.checked, chkA: chkA.checked, v3: JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').refractionV3 };
    chk.checked = false; chk.dispatchEvent(new Event('change', { bubbles: true }));
    const invOff = _visInv2Reff(35.36, 35.36), R = getLocalEarthRadius(35.36);
    const d1 = { re: appState.refractionEnabled, k: refractionKInUse(), shown: iK.value, inv: invOff, expect: 1 / (2 * R), saved: JSON.parse(localStorage.getItem(STORAGE_KEY)).refractionEnabled };
    chk.checked = true; chk.dispatchEvent(new Event('change', { bubbles: true }));
    chkA.checked = false; chkA.dispatchEvent(new Event('change', { bubbles: true }));
    const d2 = { ar: appState.astroRefraction, saved: JSON.parse(localStorage.getItem(STORAGE_KEY)).astroRefraction, k: refractionKInUse(), shown: iK.value };
    chkA.checked = true; chkA.dispatchEvent(new Event('change', { bubbles: true }));
    return { d0, d1, d2, ar: appState.astroRefraction };
  });
  check('U2 気差の2本立て: 既定は両方オン(係数欄 0.1320・保存に refractionV3)→大気差補正オフで係数欄 0.0000・K=0・実効半径は地球の丸みだけ(1/(2R))・保存も false→戻す→気差オプションをオフにしても K は変わらず(別の量)・保存される',
    u2.d0.re === true && u2.d0.ar === true && Math.abs(u2.d0.k - 0.13197) < 1e-4 && u2.d0.shown === '0.1320' && u2.d0.chk && u2.d0.chkA && u2.d0.v3 === true &&
    u2.d1.re === false && u2.d1.k === 0 && u2.d1.shown === '0.0000' && Math.abs(u2.d1.inv - u2.d1.expect) < 1e-15 && u2.d1.saved === false &&
    u2.d2.ar === false && u2.d2.saved === false && Math.abs(u2.d2.k - 0.13197) < 1e-4 && u2.d2.shown === '0.1320' && u2.ar === true, JSON.stringify(u2));

  // U2b: 移行: 旧い保存データ(印なし・両方なし/オフ)は起動で両方オンに。印ありは保存どおり
  const migr = async (saved) => {
    const q = await ctx.newPage();
    await q.addInitScript((sv) => { try { localStorage.clear(); localStorage.setItem('soranotsuji_app', JSON.stringify(sv)); } catch (e) {} }, saved);
    await q.goto(BASE + '/index.html', { waitUntil: 'load' });
    await q.waitForFunction(() => typeof appState !== 'undefined' && typeof refractionKInUse === 'function', { timeout: 15000 });
    await q.waitForTimeout(300);
    const r = await q.evaluate(() => ({ re: appState.refractionEnabled, ar: appState.astroRefraction, chk: document.getElementById('chk-refraction').checked, chkA: document.getElementById('chk-astro-refraction').checked, k: refractionKInUse() }));
    await q.close();
    return r;
  };
  const m1 = await migr({ appSchema: 3, refractionEnabled: false, meteo: { p: 1013.25, t: 15, l: 0.0125 }, meteoDefaultsV2: true });
  const m2 = await migr({ appSchema: 3, refractionEnabled: false, astroRefraction: false, refractionV3: true, meteo: { p: 1013.25, t: 15, l: 0.0125 }, meteoDefaultsV2: true });
  check('U2b 移行: 旧い保存データ(refractionV3 なし・旧チェックはオフ)は起動で両方オン(K=0.132)。印つきの保存(両方オフ)はそのまま(K=0)', m1.re === true && m1.ar === true && m1.chk && m1.chkA && Math.abs(m1.k - 0.13197) < 1e-4 && m2.re === false && m2.ar === false && !m2.chk && !m2.chkA && m2.k === 0, JSON.stringify({ m1, m2 }));

  // U3: 宙の窓検索のドラッグの対象とctrlボタン
  await p.evaluate(() => { toggleSoramado(); });
  await p.waitForFunction(() => appState.isSoramadoActive && document.getElementById('soramado-canvas') && document.getElementById('soramado-canvas').width > 0, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const cvBox = await p.evaluate(() => { const r = document.getElementById('soramado-canvas').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, ok: r.width > 50 && r.height > 50 }; });
  const drag = async (dx, dy) => {
    const x0 = cvBox.x + cvBox.w / 2, y0 = cvBox.y + cvBox.h / 2;
    await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x0 + dx / 2, y0 + dy / 2, { steps: 2 }); await p.mouse.move(x0 + dx, y0 + dy, { steps: 2 }); await p.mouse.up();
    await p.waitForTimeout(150);
  };
  const st0 = await p.evaluate(() => { appState.soraOffsetAz = 0; appState.soraOffsetAlt = 0; appState.tsujiSearchOffsetAz = 1.5; appState.tsujiSearchOffsetAlt = 0.5; updateOffsetDistances(); soraSyncUI(); drawSoramado(); return { frame: document.getElementById('chk-sora-ctrl-drag-frame').checked, tsuji: document.getElementById('chk-sora-ctrl-drag-tsuji').checked, df: _smDragFrame, dt: _smDragTsuji }; });
  await drag(40, 0);   // 構図: 右へドラッグ=視線は左へ=カメラオフセット方位角が減る。辻オフセットは動かない
  const a1 = await p.evaluate(() => ({ az: appState.soraOffsetAz, alt: appState.soraOffsetAlt, taz: appState.tsujiSearchOffsetAz, talt: appState.tsujiSearchOffsetAlt }));
  await p.evaluate(() => { const c = document.getElementById('chk-sora-ctrl-drag-tsuji'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await drag(40, -20);   // 辻オフセット点: 右へ=方位角が増える・上へ=視高度が増える。カメラオフセットは動かない
  const a2 = await p.evaluate(() => ({ az: appState.soraOffsetAz, taz: appState.tsujiSearchOffsetAz, talt: appState.tsujiSearchOffsetAlt, menu: document.getElementById('input-tsuji-az-offset').value, ctrl: document.getElementById('input-sora-ctrl-tsuji-az-offset').value, base: _smTsujiDragBase, maz: appState.tsujiMeshOffsetAz, malt: appState.tsujiMeshOffsetAlt, mmenu: document.getElementById('input-tsujimesh-az-offset').value, dec: (String(appState.tsujiSearchOffsetAz).split('.')[1] || '').length }));
  await p.evaluate(() => { const c = document.getElementById('chk-sora-ctrl-drag-tsuji'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
  const a3 = await p.evaluate(() => ({ taz: appState.tsujiSearchOffsetAz, talt: appState.tsujiSearchOffsetAlt, base: _smTsujiDragBase, maz: appState.tsujiMeshOffsetAz, malt: appState.tsujiMeshOffsetAlt }));
  await p.evaluate(() => { const c = document.getElementById('chk-sora-ctrl-drag-frame'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
  const a4 = await p.evaluate(() => ({ az: appState.soraOffsetAz, alt: appState.soraOffsetAlt, df: _smDragFrame }));
  await drag(40, 0);   // どちらもオフ: 何も動かない
  const a5 = await p.evaluate(() => ({ az: appState.soraOffsetAz, taz: appState.tsujiSearchOffsetAz }));
  await p.evaluate(() => { const c = document.getElementById('chk-sora-ctrl-drag-frame'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); appState.tsujiSearchOffsetAz = 0; appState.tsujiSearchOffsetAlt = 0; updateOffsetDistances(); });
  check('U3 宙の窓検索のドラッグの対象: 構図(初期オン)=右ドラッグでカメラオフセット方位角が減り辻オフセットは不変 → 「:辻オフセット点」オンで右上へドラッグ=辻オフセット方位角が増え視高度が増え(辻検索メニューとctrlの欄・辻メッシュ側のオフセットも連動・4桁に丸める)カメラオフセットは不変 → オフで動かす前の値(1.5/0.5)に戻る → 「:構図」オフでカメラオフセットが0に戻り、両方オフならドラッグしても動かない',
    cvBox.ok && st0.frame && !st0.tsuji && st0.df && !st0.dt &&
    a1.az < -0.01 && Math.abs(a1.alt) < 1e-9 && a1.taz === 1.5 && a1.talt === 0.5 &&
    a2.az === a1.az && a2.taz > 1.5 + 0.01 && a2.talt > 0.5 + 0.005 && Math.abs(parseFloat(a2.menu) - a2.taz) < 1e-6 && Math.abs(parseFloat(a2.ctrl) - a2.taz) < 1e-6 && a2.base && a2.base.az === 1.5 &&
    a2.maz === a2.taz && a2.malt === a2.talt && Math.abs(parseFloat(a2.mmenu) - a2.taz) < 1e-6 && a2.dec <= 4 &&   // 辻メッシュ側にも写る(レビューの直し)・4桁に丸める
    a3.taz === 1.5 && a3.talt === 0.5 && a3.base === null && a3.maz === 1.5 && a3.malt === 0.5 &&
    a4.az === 0 && a4.alt === 0 && !a4.df && a5.az === 0 && a5.taz === 1.5, JSON.stringify({ cvBox, st0, a1, a2, a3, a4, a5 }));

  // U3b: ctrlの「辻検索」「辻メッシュ」は位置情報メニューのボタンと同じ働きで、押下状態も揃う
  const u3b = await p.evaluate(async () => {
    const st = () => ({ ts: appState.isTsujiSearchActive, tm: appState.isTsujiMeshActive, mainTs: document.getElementById('btn-tsuji-search').classList.contains('active'), ctrlTs: document.getElementById('btn-sora-ctrl-tsuji-search').classList.contains('active'), mainTm: document.getElementById('btn-tsujimesh').classList.contains('active'), ctrlTm: document.getElementById('btn-sora-ctrl-tsujimesh').classList.contains('active') });
    document.getElementById('btn-sora-ctrl-tsuji-search').click(); const s1 = st();
    document.getElementById('btn-sora-ctrl-tsujimesh').click(); const s2 = st();
    document.getElementById('btn-sora-ctrl-tsujimesh').click(); const s3 = st();
    document.getElementById('btn-sora-ctrl-tsuji-search').click(); document.getElementById('btn-sora-ctrl-tsuji-search').click(); const s4 = st();
    return { s1, s2, s3, s4 };
  });
  check('U3b ctrlの「辻検索」「辻メッシュ」: 押すと辻検索が開き(主ボタンもctrlも押下表示)→「辻メッシュ」で辻メッシュに切り替わる(辻検索は閉じる)→もう一度で閉じる→辻検索を開いて閉じる',
    u3b.s1.ts && u3b.s1.mainTs && u3b.s1.ctrlTs && !u3b.s1.tm && u3b.s2.tm && u3b.s2.mainTm && u3b.s2.ctrlTm && !u3b.s2.ts && !u3b.s2.ctrlTs && !u3b.s3.tm && !u3b.s3.ctrlTm && !u3b.s4.ts && !u3b.s4.ctrlTs, JSON.stringify(u3b));
  await p.evaluate(() => { if (appState.isTsujiSearchActive) toggleTsujiSearch(); if (appState.isTsujiMeshActive) toggleTsujiMesh(); toggleSoramado(); });

  // U4: 店: 地理タイルの店に1件入れると件数/容量/最終更新が出る→全削除で0。標高タイルの店(可視マップと同じ)の読み直し: 「無し」の印は null・PNGの本文は画像(256×256)。地図の地理院ソースは gsicache:// 経由
  const u4 = await p.evaluate(async () => {
    const png = await new Promise(ok => { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#804000'; g.fillRect(0, 0, 256, 256); c.toBlob(b => b.arrayBuffer().then(ok), 'image/png'); });
    await _mtClear();
    await _mtIdb('readwrite', st => st.put({ key: 'https://example.invalid/t/1/2/3.png', size: 1234, buf: new ArrayBuffer(1234), savedAt: Date.now() }));
    await _mtIdb('readwrite', st => st.put({ key: 'https://example.invalid/t/1/2/4.png', size: 0, miss: true, savedAt: Date.now() }));
    const st = await _mtStat();
    // gsicache:// の読み方そのもの(MapLibre が呼ぶ関数)を直接呼ぶ: 店にある→本文 / 「無し」の印→status 404 の例外 / 無い→取りに行く(テストでは外は遮断なので取得の失敗=404ではない例外)
    const ph = await _mtProtocolHandler({ url: 'gsicache://https://example.invalid/t/1/2/3.png' }, new AbortController());
    const phHit = !!(ph && ph.data && ph.data.byteLength === 1234);
    let phMiss; try { await _mtProtocolHandler({ url: 'gsicache://https://example.invalid/t/1/2/4.png' }, new AbortController()); phMiss = 'resolved'; } catch (e) { phMiss = e.status; }
    let phNew; try { await _mtProtocolHandler({ url: 'gsicache://https://example.invalid/t/1/2/5.png' }, new AbortController()); phNew = 'resolved'; } catch (e) { phNew = e.status === 404 ? 404 : 'fetch-failed'; }
    await _kmTilesClear();
    await _kmIdb('tiles', 'readwrite', s => s.put({ key: 'dem_png/14/14549/6450', kind: 'dem_png', z: 14, x: 14549, y: 6450, size: 0, miss: true, savedAt: Date.now() }));
    await _kmIdb('tiles', 'readwrite', s => s.put({ key: 'dem_png/14/14549/6451', kind: 'dem_png', z: 14, x: 14549, y: 6451, size: png.byteLength, buf: png, savedAt: Date.now() }));
    await _kmIdb('tiles', 'readwrite', s => s.put({ key: 'dem_png/14/14549/6452', kind: 'dem_png', z: 14, x: 14549, y: 6452, size: 0, miss: true, savedAt: Date.now() - 40 * 24 * 3600 * 1000 }));   // 40日前の「無し」の印=古い
    document.getElementById('sec-backup').classList.remove('closed');   // 閉じている間は数えないので開く
    await _mtRefreshBackupRows();
    const rows = () => ({ mc: document.getElementById('backup-maptiles-count').textContent, ms: document.getElementById('backup-maptiles-size').textContent, mu: document.getElementById('backup-maptiles-updated').textContent, dc: document.getElementById('backup-demtiles-count').textContent, ds: document.getElementById('backup-demtiles-size').textContent, du: document.getElementById('backup-demtiles-updated').textContent });
    const waitRows = async (ok) => { for (let i = 0; i < 40; i++) { if (ok()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };   // 最長4秒
    const r1 = rows();
    const miss = await _demTileLoad('https://cyberjapandata.gsi.go.jp/xyz/dem_png/14/14549/6450.png');   // 東京付近のタイル座標(日本域の外だと手前で弾かれる)
    const hit = await _demTileLoad('https://cyberjapandata.gsi.go.jp/xyz/dem_png/14/14549/6451.png');
    let stale; try { stale = await _demTileLoad('https://cyberjapandata.gsi.go.jp/xyz/dem_png/14/14549/6452.png'); } catch (e) { stale = 'refetch'; }   // 古い印は取り直しに行く(テストでは外は遮断なので失敗の例外=1回で諦める)
    const hitInfo = hit ? { w: hit.width, h: hit.height } : null; if (hit && hit.close) hit.close();
    const imgData = await _getTileImageData('https://cyberjapandata.gsi.go.jp/xyz/dem_png/14/14549/6451.png');
    const px = imgData ? [imgData.data[0], imgData.data[1], imgData.data[2]] : null;
    window.confirm = () => true;
    document.getElementById('btn-backup-maptiles-clear').click(); await waitRows(() => rows().mc === '0');   // 表示の更新(IndexedDB の読み直し)を待つ。固定の400msは負荷の高い時に足りない(第171)
    const st2 = await _mtStat(); const r2 = rows();
    document.getElementById('btn-backup-demtiles-clear').click(); await waitRows(() => rows().dc === '0');
    const dem2 = await _kmTilesStat(); const r3 = rows();
    const srcStd = glMap.getSource('base-std'), srcPhoto = glMap.getSource('base-photo'), srcPale = glMap.getSource('base-pale'), srcOsm = glMap.getSource('base-osm');
    return { st, phHit, phMiss, phNew, r1, miss, stale, hitInfo, px, st2, r2, dem2, r3, tiles: { std: srcStd && srcStd.tiles[0], photo: srcPhoto && srcPhoto.tiles[0], pale: srcPale && srcPale.tiles[0], osm: srcOsm && srcOsm.tiles[0] } };
  });
  check('U4 店: 地理タイル1件(+無しの印1件)で件数1・容量0.0 MB・最終更新あり・gsicache の読み方は店→本文/無しの印→404/無い→取りに行く → 標高タイルの店は「無し」の印が null・40日前の古い印は取り直しに行く・PNGの本文が256×256の画像(ImageDataの色も)→「地理タイルを全削除」で0件・「標高タイルを全削除」で0件 / 地図の地理院ソース3つは gsicache:// 経由・OSMはそのまま',
    u4.st.n === 1 && u4.st.bytes === 1234 && u4.r1.mc === '1' && u4.r1.ms === '0.0 MB' && u4.r1.mu !== '-' && u4.r1.dc === '1' && u4.r1.du !== '-' &&
    u4.phHit && u4.phMiss === 404 && u4.phNew === 'fetch-failed' &&   // 読み方の3分岐(レビュー: 文字列だけでなく実行で見る)
    u4.miss === null && u4.stale === 'refetch' && u4.hitInfo && u4.hitInfo.w === 256 && u4.hitInfo.h === 256 && u4.px && u4.px[0] === 128 && u4.px[1] === 64 && u4.px[2] === 0 &&
    u4.st2.n === 0 && u4.r2.mc === '0' && u4.dem2.n === 0 && u4.r3.dc === '0' &&
    u4.tiles.std === 'gsicache://https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png' && u4.tiles.photo.startsWith('gsicache://') && u4.tiles.pale.startsWith('gsicache://') && u4.tiles.osm === 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', JSON.stringify(u4));

  // U5: 開錠: ?kashimap=1 で可視マップのボタン・節・ヘルプが見え、toggleKashimap が動く
  const q = await ctx.newPage();
  await q.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await q.goto(BASE + '/index.html?kashimap=1', { waitUntil: 'load' });
  await q.waitForFunction(() => typeof appState !== 'undefined' && typeof toggleKashimap === 'function', { timeout: 15000 });
  await q.waitForTimeout(500);
  const u5 = await q.evaluate(() => { const disp = id => getComputedStyle(document.getElementById(id)).display; return { enabled: FEATURE_KASHIMAP_ENABLED, row: disp('row-kashimap-btn'), sec: disp('section-kashimap'), help: disp('help-kashimap'), demNote: document.getElementById('backup-demtiles-note').textContent }; });
  check('U5 開錠: ?kashimap=1 で可視マップのボタンの段・メニューの節・ヘルプが見える', u5.enabled && u5.row !== 'none' && u5.sec !== 'none' && u5.help !== 'none' && u5.demNote === '可視タイル作成後は、標高タイルは不要です。いつでも、全削除可能です。', JSON.stringify(u5));   // 開錠時はデッサン18の文のまま
  await q.close();

  check('E ページエラーなし', errors.length === 0, errors.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL ? 1 : 0);
})().catch(e => { console.log('ERR', e && e.stack || e); process.exit(1); });
