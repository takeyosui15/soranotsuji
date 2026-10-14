// 第157ラウンド検証: v1.96.0 数の単一情報源 sora-constants.js・気差係数は設定に表示されている値で全処理・統一可視判定を可視マップと同じ3つに(大円・海は海面0m・K)・
//   山リストのズーム列と▲(最大表示範囲より広い資産)・島リストの分割描画と進捗・可視マップ節の水平線と剣ヶ峯の注記
// ①静的: 版数ピン・単一情報源の配線(index.html/ハーネス/3ワーカーのimportScripts/道具のrequire・本体に地球の大きさの生の数が残らない)・Kの規則・大円と海(本体とワーカーの式が同じ)・UI
// ②Node: モジュールの値と式(ハバーサインは旧式とビット一致・大円の端点と中点・ワーカーがvmで読める)
// ③ブラウザ: Kの表示と値(オフ=0.132・オン=算出値)・大円(弦の北の壁に当たる/弦の上の壁は避ける)・海は海面0m(日本域だけ)・山リストのズーム列と▲と繰り上げ・ズームの補完・島リストの分割描画・ワーカーのmetaの半径
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');
const ROOT = path.join(__dirname, '..');
const idxSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const constSrc = fs.readFileSync(path.join(ROOT, 'sora-constants.js'), 'utf8');
const tmSrc = fs.readFileSync(path.join(ROOT, 'tm-vis-worker.js'), 'utf8');
const wkSrc = fs.readFileSync(path.join(ROOT, 'kashimap-worker.js'), 'utf8');
const dpSrc = fs.readFileSync(path.join(ROOT, 'dp-line-worker.js'), 'utf8');
const toolSrc = fs.readFileSync(path.join(ROOT, 'tools', 'kashimap', 'viewshed.js'), 'utf8');
const harnessSrc = fs.readFileSync(path.join(ROOT, 'tests', 'harness', 'sync-apptest.py'), 'utf8');
const indexJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'kashimap', 'v1', 'index.json'), 'utf8'));

check('V0 版数 1.96.0以降(ピンは最新のverifyが持つ)+Version Historyに第157', /APP_VERSION = '1\.9[6-9]\.\d+'/.test(src) && (src.includes('第157ラウンド — 数の単一情報源 sora-constants.js') || !!process.argv[2]));
// 本体に「地球の大きさの生の数」が(注釈以外に)残っていない
const rawLits = ['6371000', '6378137', '6356752.3142', '40075016.686'];
const leaks = [];
src.split('\n').forEach((line, i) => { for (const lit of rawLits) { const at = line.indexOf(lit); if (at < 0) continue; const c = line.indexOf('//'); const t = line.trim(); if ((c >= 0 && c < at) || t.startsWith('Version ') || t.startsWith('*') || t.startsWith('//')) continue; leaks.push(`${i + 1}:${lit}`); } });
check('S1 単一情報源の配線: sora-constants.js(UMD=本体はSORA・道具はmodule.exports)・index.htmlはscript.jsの前に読む・ハーネスのFILES・tm-vis/kashimap/dp-lineの各ワーカーがimportScripts・道具がrequire・本体の別名(EARTH_RADIUS/REFRACTION_K/STD_*/WGS84/_geoDistM/calculateKFromMeteo/getLocalEarthRadius/_pointInsideJapan/SB_*/除外の既定/TSUJIMESH_ZOOM)・生の数が残らない',
  constSrc.includes('root.SORA = api') && constSrc.includes('module.exports = api') && constSrc.includes('K_STANDARD: 0.132') && constSrc.includes('HAVERSINE_RADIUS_M: 6371000') && constSrc.includes('EQUATOR_CIRCUMFERENCE_M: 40075016.686') && constSrc.includes('STD_LAPSE_RATE_K_PER_M: 0.0125') &&
  idxSrc.includes('<script src="sora-constants.js"></script>\n    <script src="script.js"></script>') && harnessSrc.includes("'sora-constants.js'") &&
  [tmSrc, wkSrc, dpSrc].every(t => t.includes("importScripts('sora-constants.js')")) && toolSrc.includes("require(path.join(REPO, 'sora-constants.js'))") &&
  ['const EARTH_RADIUS = SORA.EARTH.WGS84_SEMI_MAJOR_M;', 'const REFRACTION_K = SORA.REFRACTION.K_STANDARD;', 'const STD_L = SORA.REFRACTION.STD_LAPSE_RATE_K_PER_M;', 'const STD_L_OLD = SORA.REFRACTION.ISA_LAPSE_RATE_K_PER_M;', 'const WGS84_SEMI_MAJOR = SORA.EARTH.WGS84_SEMI_MAJOR_M;',
   'function _geoDistM(lat1, lng1, lat2, lng2) { return SORA.haversineDistanceM(lat1, lng1, lat2, lng2); }', 'function calculateKFromMeteo(p, tCel, l) { return SORA.calculateKFromMeteo(p, tCel, l); }', 'function getLocalEarthRadius(latDeg) { return SORA.getLocalEarthRadius(latDeg); }',
   'function _pointInsideJapan(lat, lng) { return SORA.insideJapan(lat, lng); }', 'const SB_SEARCH_M = SORA.VISIBILITY.SUMMIT_SEARCH_M;', 'const SB_UP_M = SORA.VISIBILITY.SUMMIT_UP_M;', 'def: SORA.VISIBILITY.EXCLUDE_TARGET_M', 'def: SORA.VISIBILITY.EXCLUDE_OBSERVER_M', 'def: SORA.VISIBILITY.SUMMIT_BAND_M', 'const TSUJIMESH_ZOOM = SORA.DEM.COARSE_ZOOM;', 'obsH: SORA.OBSERVER.EYE_HEIGHT_M,'].every(t => src.includes(t)) &&
  wkSrc.includes('const NODATA = SORA.DEM.GRID_NODATA;') && wkSrc.includes('const GSI_BBOX = SORA.DEM.JAPAN_BBOX;') && wkSrc.includes('const MPP = SORA.metersPerPixel(lat, Z);') && dpSrc.includes('const WGS84_A = SORA.EARTH.WGS84_SEMI_MAJOR_M;') && dpSrc.includes('function getLocalEarthRadius(latDeg) { return SORA.getLocalEarthRadius(latDeg); }') &&
  toolSrc.includes('const R_EARTH = SORA.EARTH.HAVERSINE_RADIUS_M;') && toolSrc.includes('const MPP = SORA.metersPerPixel(M.lat, Z);') && leaks.length === 0, JSON.stringify({ leaks }));
check('S2 気差係数は「設定に表示されている値」: refractionKInUse(第158: オン=算出値・オフ=0)が1本で、地形の見通しの8箇所がそれを呼ぶ・_visInv2Reffは SORA.inv2ReffFor・可視マップのjobも同じ・係数欄は showKInUse・ヘルプ/設定の文言',
  src.includes('function refractionKInUse() {') && (src.match(/refractionKInUse\(\)/g) || []).length >= 10 && src.includes('calculateKFromMeteo(appState.meteo.p, appState.meteo.t, appState.meteo.l) : 0;') /* 第158: オフ=0 */ && !/_kmComputeK|_kmInv2Reff/.test(src) &&
  src.includes('function _visInv2Reff(latA, latB) { return SORA.inv2ReffFor(latA, latB, refractionKInUse()); }') && src.includes('inv2R: _visInv2Reff(lat, lat), k: refractionKInUse(),') && src.includes('const showKInUse = () => { iK.value = refractionKInUse().toFixed(4); };') &&
  idxSrc.includes('係数欄に表示されている値で、標高グラフ・辻検索・My辻検索・辻メッシュ検索・可視マップ・辻ライン・宙の窓の地形の見通しを計算します') && idxSrc.includes('title="いま使っている気差係数K。チェックオン=下の気象条件から算出した値(既定)、オフ=0') && idxSrc.includes('オンなら気象条件から算出した値、オフなら 0=気差なし) で、標高グラフ・辻検索・辻メッシュ検索と同じ1つの値です'));
const walkOf = (t, from) => { const i = t.indexOf(from); const j = t.indexOf('const r = j / steps;', i); return t.slice(i, j).split('\n').map(l => l.replace(/\s*\/\/.*$/, '').trim()).filter(Boolean).join('\n'); };   // 行末コメントは比べない(式だけを比べる)
const walkMain = walkOf(src.slice(src.indexOf('function _visJudgeCore(')), 'const pA = path.at(j0 / steps)'), walkTm = walkOf(tmSrc, 'const pA = path.at(j0 / steps)');
check('S3 統一可視判定は大円+海面0m: 本体(_visJudgeCore・タイル列挙・標高グラフの標本点)と辻メッシュのワーカーが SORA.greatCirclePath で同じ歩き(区間の両端を球面補間)・日本域の「データ無し」は0m・ワーカーの内側の式が本体と同一・ヘルプ',
  src.includes('const path = SORA.greatCirclePath(sLat, sLng, endLat, endLng);') && src.includes('const seaAsZero = _pointInsideJapan(sLat, sLng) && _pointInsideJapan(endLat, endLng);') && src.includes('if (e === null || e === undefined) { if (!seaAsZero) continue; e = 0; }') &&
  src.includes('const path = SORA.greatCirclePath(startLat, startLng, endLat, endLng);') && src.includes('const path = SORA.greatCirclePath(s.lat, s.lng, e.lat, e.lng);') && src.includes('const SEG = SORA.VISIBILITY.PATH_CHUNK;') &&
  tmSrc.includes('const path = SORA.greatCirclePath(sLat, sLng, endLat, endLng);') && tmSrc.includes('const seaAsZero = endInJapan && SORA.insideJapan(sLat, sLng);') && tmSrc.includes('const stepM = SORA.metersPerPixel(sLat, 15) / 2;') && tmSrc.includes('function _distanceM(lat1d, lng1d, lat2d, lng2d) { return SORA.haversineDistanceM(lat1d, lng1d, lat2d, lng2d); }') &&
  walkMain.length > 200 && walkMain === walkTm && idxSrc.includes('経路は観測点と目的点を結ぶ<strong>大円</strong>') && idxSrc.includes('<strong>海面0m</strong>として遮ります') && idxSrc.includes('(日本域で標高タイルの無い所=海は海面0m)'), JSON.stringify({ same: walkMain === walkTm, len: walkMain.length }));
const kmHtml = idxSrc.slice(idxSrc.indexOf('id="sec-kashimap"'), idxSrc.indexOf('data-arg="sec-soramado"'));
const NOTE = '富士山で範囲を計算する場合は、「火口」を中心とする場合と、「剣ヶ峯」を中心とする場合では、結果が異なります。宙の辻では、「剣ヶ峯」(標高:3771.3m)を推奨します。';
check('S4 UI: 可視マップ節の水平線は4本(「可視タイル:」の上にも)・「範囲を計算」の下に剣ヶ峯の注記(依頼者の文のまま)→水平線・山リストのズーム列(_kmZoomLabel・ズームの見出し)・▲(_kmNearestLargerAsset・繰り上げ)・島リストの分割描画(KM_ISLAND_ROW_CHUNK=4000・onProgress)・索引のzooms・端末の索引のzoomと補完・道具のzooms・ワーカーのmetaの半径',
  (kmHtml.match(/<hr class="tsujisearch-separator km-hr">/g) || []).length === 4 && kmHtml.includes(NOTE) && kmHtml.indexOf('id="btn-kashimap-compute"') < kmHtml.indexOf(NOTE) && kmHtml.indexOf(NOTE) < kmHtml.indexOf('id="chk-kashimap-menu-tiles"') &&
  kmHtml.slice(kmHtml.indexOf('id="btn-kashimap-tiles-clear"'), kmHtml.indexOf('>可視タイル:</label>')).includes('<hr class="tsujisearch-separator km-hr">') &&
  ['function _kmNearestLargerAsset(id)', 'function _kmZoomLabel(zoom, lat)', "{ label: 'ズーム', compare:", 'const KM_ISLAND_ROW_CHUNK = 4000;', 'chunk: KM_ISLAND_ROW_CHUNK, onProgress:', 'async function _kmStorePutSummary(rec)', 'zoom: _kmNum(meta.zoom),', 'ズームの補完', "if (!_kmAssetChoice(id)) { const near = _kmNearestLargerAsset(id);"].every(t => src.includes(t)) &&
  indexJson.mountains['368'].zooms['terrain:60'] === 15 && indexJson.mountains['370'].zooms['terrain:20'] === 15 && toolSrc.includes('ent.zooms = ent.zooms || {}; ent.zooms[`${kind}:${RANGE_KM}`] = Z;') &&
  wkSrc.includes('earth_radius_m: (k !== null ? +((1 - k) / (2 * inv2R)).toFixed(1) : null)') && idxSrc.includes('「ズーム」は標高タイルの粒度で、z15(1画素≈4m・DEM5A/5B/5C) のように出ます'));

// ---- Node: モジュールの値と式 ----
{
  const S = require(path.join(ROOT, 'sora-constants.js'));
  const oldHav = (lat1, lng1, lat2, lng2) => { const rad = Math.PI / 180, R = 6371000; const sinDLat = Math.sin((lat2 - lat1) * rad / 2); const sinDLng = Math.sin((lng2 - lng1) * rad / 2); const a = sinDLat * sinDLat + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * sinDLng * sinDLng; return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); };
  const oldTm = (lat1d, lng1d, lat2d, lng2d) => { const rad = Math.PI / 180, lat1 = lat1d * rad, lat2 = lat2d * rad, sinDLat = Math.sin((lat2d - lat1d) * rad / 2), sinDLon = Math.sin((lng2d - lng1d) * rad / 2), a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon, c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return 6371000 * c; };
  const pairs = [[35.6585309298041, 139.74538790268673, 35.3627986111111, 138.730781416667], [36.378279, 139.326292, 36.34217, 137.64744], [44.0, 142.0, 44.0, 143.25], [35.289496, 135.858703, 35.360738, 138.727373], [20.4, 136.1, 45.5, 141.9]];
  const bit = pairs.every(([a, b, c, d]) => S.haversineDistanceM(a, b, c, d) === oldHav(a, b, c, d) && S.haversineDistanceM(a, b, c, d) === oldTm(a, b, c, d));
  const oldMpp = (lat, z) => 40075016.686 * Math.cos(lat * Math.PI / 180) / (Math.pow(2, z) * 256);   // 旧 _visJudgeCore の式(scale15*256)
  const mppBit = [[35.3, 15], [44.0, 15], [35.36, 12], [20.4, 11]].every(([lat, z]) => S.metersPerPixel(lat, z) === oldMpp(lat, z) && S.metersPerPixel(lat, z) === 40075016.686 * Math.cos(lat * Math.PI / 180) / (256 * Math.pow(2, z)));
  const g = S.greatCirclePath(35.289496, 135.858703, 35.360738, 138.727373); const m = g.at(0.5), e0 = g.at(0), e1 = g.at(1);
  const same = S.greatCirclePath(35, 139, 35, 139).at(0.3);
  const ctxw = { self: { postMessage() {}, addEventListener() {} }, console, Math, Uint8Array, Int32Array, Map, setTimeout };
  ctxw.importScripts = (f) => { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctxw); if (ctxw.self && ctxw.self.SORA) ctxw.SORA = ctxw.self.SORA; };
  vm.createContext(ctxw); let tmErr = null; try { vm.runInContext(tmSrc + '\n;this.__ok = typeof SORA === "object" && typeof self.onmessage === "function";', ctxw); } catch (e) { tmErr = e.message; }
  check('N1 モジュール: K_STANDARD 0.132・K(1013.25,15,0.0125)=0.13197・局所半径(35.36°)≈6371014・ハバーサインは旧 _geoDistM/_distanceM と5組でビット一致・1画素の長さも旧式とビット一致・大円の端点は入力そのもの/中点は弦より北(緯度35.33)/同じ点なら線形・tm-vis-worker.js は importScripts で SORA を得て読める',
    S.REFRACTION.K_STANDARD === 0.132 && Math.abs(S.calculateKFromMeteo(1013.25, 15, 0.0125) - 0.131973) < 1e-5 && Math.abs(S.getLocalEarthRadius(35.3628) - 6371014.06) < 0.1 && bit && mppBit &&
    Math.abs(e0.lat - 35.289496) < 1e-9 && Math.abs(e0.lng - 135.858703) < 1e-9 && Math.abs(e1.lat - 35.360738) < 1e-9 && Math.abs(e1.lng - 138.727373) < 1e-9 && Math.abs(m.lat - 35.3336) < 0.001 && Math.abs(m.lng - 137.2924) < 0.001 && Math.abs(same.lat - 35) < 1e-9 && Math.abs(same.lng - 139) < 1e-9 &&
    Math.abs(g.angleRad * 6371000 - 260363) < 2 && tmErr === null && ctxw.__ok === true, JSON.stringify({ bit, mppBit, m, tmErr, ok: ctxw.__ok }));
}

check('S5 レビューの直し(第157): 基準視高度の自動算出の位置の鍵にK(_basePosKey・URL復元は気象値の後で鍵を取り直す)・宙の窓の陰影の鍵にK・設定の大気差の部品を appState に合わせる1本(syncRefractionUiFromState: 起動時+古い形式のバックアップ取り込み)・辻メッシュの帯域分割も PATH_CHUNK・端末の資産の再利用はKが同じ時だけ(文言にk)・道具の答え合わせ(judgeLikeApp)も大円+海面0m・辻メッシュのコリドー(タイルの先取りの扇形)に角からの大円のふくらみを入れる・ポップアップの海の文は日本域の条件つき',
  src.includes('function _basePosKey()') && (src.match(/_basePosKey\(\)/g) || []).length >= 9 && !src.includes('const posKey = `${appState.start.lat},${appState.start.lng},${appState.start.elev}|${appState.end.lat}') && src.includes("if (params.has('tsujiAz') || params.has('tsujiAlt')) appState._lastTsujiPosKey = _basePosKey();") &&
  /const shadeKey = `[^`\n]*\|K\$\{refractionKInUse\(\)\.toFixed\(5\)\}`/.test(src) &&
  src.includes('function syncRefractionUiFromState()') && (src.match(/syncRefractionUiFromState\(\);/g) || []).length >= 2 &&
  src.includes('const Cmax = Math.max(1, Math.ceil((maxSteps - 1) / SEG));') && src.includes('const jS = 1 + c0 * SEG, jE = c1 * SEG;') && !/\(maxSteps - 1\) \/ 64\)/.test(src) &&
  src.includes('Math.abs(+have0.k - kNow) < 1e-4') && src.includes('気差係数k=${kNow.toFixed(3)}') &&
  toolSrc.includes('const path = SORA.greatCirclePath(sLat, sLng, endLat, endLng);') && toolSrc.includes('if (e === undefined) continue; if (e === null) e = 0;') &&
  src.includes('const gc = SORA.greatCirclePath(ll.lat, ll.lng, end.lat, end.lng); for (let i = 1; i < 16; i++) { const q = gc.at(i / 16); bowPts.push(toXY({ lat: q.lat, lng: q.lng })); }') && src.includes('const azs = sectorPts.map(c => Math.atan2(c.x, c.y));') &&   // 辻メッシュのコリドー(先取りするタイルの扇形)に大円のふくらみを入れる
  src.includes("? '海は海面0mとして遮る判定です' : '標高データの無い所は判定しません(日本域の外)'"));   // ポップアップの海の文は判定と同じ条件

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html?kashimap=1',{waitUntil:'load'});   // 可視マップは封鎖中(第158)。開錠して検査
  await p.waitForFunction(()=>typeof runKashimapSearch==='function' && typeof refractionKInUse==='function' && typeof glMap!=='undefined' && glMap && glMap.getLayer && !!glMap.getLayer('km-fill'),{timeout:15000});
  await p.evaluate(async ()=>{ window.confirm=()=>true; window.alert=(m)=>{ (window._alerts = window._alerts || []).push(String(m)); }; try { await _kmStoreClear(); await _kmTilesClear(); await _kmLoadDeviceIndex(); } catch (e) {} });

  // U1: Kの表示と値
  const u1 = await p.evaluate(() => {
    const iK = document.getElementById('input-refraction-k'), chk = document.getElementById('chk-refraction');
    const set = (on) => { chk.checked = on; chk.dispatchEvent(new Event('change', { bubbles: true })); };
    appState.meteo = { p: STD_P, t: STD_T, l: 0.0065 };
    set(false); const off = { k: refractionKInUse(), shown: iK.value, inv: _visInv2Reff(35, 35), expect: SORA.inv2ReffFor(35, 35, 0), dist: calculateDistanceForAltitudes(0.5, 100, 3776, 35.6, 35.36) };   // 第158: オフ=0
    set(true); const on = { k: +refractionKInUse().toFixed(4), shown: iK.value, inv: _visInv2Reff(35, 35), expect: SORA.inv2ReffFor(35, 35, refractionKInUse()), dist: calculateDistanceForAltitudes(0.5, 100, 3776, 35.6, 35.36) };
    set(false); appState.meteo = { p: STD_P, t: STD_T, l: STD_L };
    return { off, on, same: window.SORA === SORA && Object.isFrozen(SORA) && REFRACTION_K === SORA.REFRACTION.K_STANDARD && STD_L === 0.0125, frozenK: appState.refractionK };
  });
  check('U1 K: オフ=0(係数欄「0.0000」・実効半径は地球の丸みだけ)[第158]・オン(Γ0.0065)=0.1688(係数欄「0.1688」)・辻ラインの距離もkに連動(オンの方が遠い)・SORAは凍結・別名は同じ値',
    u1.off.k === 0 && u1.off.shown === '0.0000' && u1.off.inv === u1.off.expect && u1.on.k === 0.1688 && u1.on.shown === '0.1688' && u1.on.inv === u1.on.expect && u1.on.dist > u1.off.dist && u1.same, JSON.stringify(u1));

  // U2: 大円(北緯44°・東西100km): 弦の中点から北へ約190m(大円の反り)の所に壁→当たる。弦の上の壁→避ける
  const u2 = await p.evaluate(async () => {
    const A = { lat: 44.0, lng: 142.0 }, B = { lat: 44.0, lng: 143.25 };
    const scale15 = Math.pow(2, 15), R128 = 128 / Math.PI;
    const gpx = (lng) => Math.floor(128 * (lng / 180 + 1) * scale15), gpy = (lat) => Math.floor((128 - R128 * Math.atanh(Math.sin(lat * Math.PI / 180))) * scale15);
    const mid = SORA.greatCirclePath(A.lat, A.lng, B.lat, B.lng).at(0.5);   // 大円の中点(弦より北)
    const wallGx = gpx(mid.lng), wallGyGC = gpy(mid.lat), wallGyChord = gpy(44.0);
    const sep = wallGyChord - wallGyGC;   // 北へ何画素離れているか
    appState.elevExcludeEnabled = false; appState.elevSummitBandEnabled = false; _sbCache.clear(); appState.refractionEnabled = false;
    const run = async (wallGy) => {
      window._tmSyntheticElev15 = (gx, gy) => (Math.abs(gx - wallGx) <= 40 && Math.abs(gy - wallGy) <= 2) ? 3000 : 0;
      window._tmSyntheticElev = (gx14, gy14) => window._tmSyntheticElev15(gx14 * 2, gy14 * 2);
      const r = await computePathVisibility(A.lat, A.lng, 1001.5, B.lat, B.lng, 1000, 1000);
      return r;
    };
    const onGC = await run(wallGyGC), onChord = await run(wallGyChord);
    delete window._tmSyntheticElev15; delete window._tmSyntheticElev; appState.elevExcludeEnabled = true; appState.elevSummitBandEnabled = true; _sbCache.clear();
    return { sep, dist: +(_geoDistM(A.lat, A.lng, B.lat, B.lng) / 1000).toFixed(1), onGC, onChord, midLat: mid.lat };
  });
  check('U2 大円: 大円の中点は弦より北(約50画素=約190m)。そこに置いた壁に当たって見えない(遮りは約50km地点)。弦の上に置いた壁は避けて見える(経路が地図の直線なら逆になる)',
    u2.sep >= 40 && u2.sep <= 70 && u2.onGC.visible === false && Math.abs(u2.onGC.blockingDist - u2.dist / 2) < 2 && u2.onChord.visible === true && u2.dist > 95 && u2.dist < 105, JSON.stringify(u2));

  // U3: 海は海面0m(日本域だけ): 標高タイルの無い海の上を150km先の1,000mの島へ。目の高さ1.5m→海に遮られて見えない。日本域の外では従来どおり「データ無しは判定しない」=見える
  const u3 = await p.evaluate(async () => {
    const mk = (lat0, lng0) => {
      const A = { lat: lat0, lng: lng0 }; const dLng = 150000 / (SORA.metersPerPixel(lat0, 15) * 256 * Math.pow(2, 15) / 360); const B = { lat: lat0, lng: lng0 + dLng };
      const scale15 = Math.pow(2, 15), R128 = 128 / Math.PI; const tgx = Math.floor(128 * (B.lng / 180 + 1) * scale15), tgy = Math.floor((128 - R128 * Math.atanh(Math.sin(B.lat * Math.PI / 180))) * scale15);
      window._tmSyntheticElev15 = (gx, gy) => (gx > tgx && gx <= tgx + 3 && Math.abs(gy - tgy) <= 2) ? 1000 : null;   // 島は目的点の画素より先(手前の標本に島が無い=除外範囲に頼らず、海の規則だけで決まる。レビューの指摘)。島以外は海(データ無し)
      window._tmSyntheticElev = (gx14, gy14) => window._tmSyntheticElev15(gx14 * 2, gy14 * 2);
      return { A, B };
    };
    appState.elevExcludeEnabled = false; appState.elevSummitBandEnabled = false; _sbCache.clear(); appState.refractionEnabled = false;   // 除外範囲も切る(見える/見えないが海の規則だけで決まるように)
    const jp = mk(35.0, 139.0); const rJp = await computePathVisibility(jp.A.lat, jp.A.lng, 1.5, jp.B.lat, jp.B.lng, 1000, 1000);
    const out = mk(10.0, 139.0); const rOut = await computePathVisibility(out.A.lat, out.A.lng, 1.5, out.B.lat, out.B.lng, 1000, 1000);
    delete window._tmSyntheticElev15; delete window._tmSyntheticElev; appState.elevExcludeEnabled = true; appState.elevSummitBandEnabled = true; _sbCache.clear();
    return { rJp, rOut, dJp: +(_geoDistM(jp.A.lat, jp.A.lng, jp.B.lat, jp.B.lng) / 1000).toFixed(1), inJp: _pointInsideJapan(jp.A.lat, jp.A.lng), inOut: _pointInsideJapan(out.A.lat, out.A.lng) };
  });
  check('U3 海は海面0m: 日本域では海に遮られて見えない(遮りは観測点の近く・標高0m)。日本域の外ではデータ無しを判定しない(見える。島は目的点の先・除外範囲オフなので海の規則だけで決まる)', u3.inJp && !u3.inOut && u3.rJp.visible === false && u3.rJp.blockingElev === 0 && u3.rJp.blockingDist < 5 && u3.rOut.visible === true && Math.abs(u3.dJp - 150) < 3, JSON.stringify(u3));

  // U4: 山リストのズーム列・▲・繰り上げ・ズームの補完
  const mk = (id, name, lat, lon, range, zoom) => ({
    meta: { tool: 'test', version: 2, mountain: { id, name, lat, lon, elev_list: 1000, height_m: 0 }, range_km: range, zoom, canopy: false, buildings: false, k: 0.132, summit_area: { drop_m: 300 }, result: { islands: 1 } },
    islands: { mountain: { id, name }, count: 1, islands: [{ no: 1, px: 4, area_km2: 0.0001, rep: [lat, lon], bbox: [lon, lat, lon, lat], dist_km: 0 }] },
    outline: { v: 2, id, name, range_km: range, zoom, canopy: false, x0: 29000 * 256, y0: 12900 * 256, w: 2, h: 2, tol_px: 0, islands: [[1, 4, '??_@?A@?']] } });
  const u4 = await p.evaluate(async (specs) => {
    for (const sp of specs) await _kmStoreSave(sp.meta, sp.islands, sp.outline, 'compute');
    // 第157より前の資産(ズーム無し)を模す: 要約から zoom を落として書き直す→索引の読み直しで補われる
    const old = await _kmStoreGet('tgt:8/terrain/24'); delete old.zoom; await _kmStorePut(old);
    await _kmLoadDeviceIndex();
    const filled = _kmDeviceIndex.get('tgt:8/terrain/24').zoom, stored = (await _kmStoreGet('tgt:8/terrain/24')).zoom;
    _kmRange = 100; _kmSyncUi();
    document.getElementById('input-kashimap-query').value = ''; document.getElementById('chk-kashimap-device').checked = true; await runKashimapSearch();
    const cells = id => { const tr = document.querySelector(`#kashimap-content tr[data-id="${id}"]`); return tr ? Array.from(tr.children).slice(11).map(td => ({ t: td.textContent, title: td.title || '' })) : null; };
    const c7 = cells('tgt:7'), c8 = cells('tgt:8');
    // ▲の山を選ぶ→表示範囲が300kmへ繰り上がり、列から▲が消える
    const tr7 = document.querySelector('#kashimap-content tr[data-id="tgt:7"]'); const chk = tr7.querySelector('input.kashimap-check'); chk.checked = true; chk.dispatchEvent(new Event('change', { bubbles: true }));
    for (let i = 0; i < 50 && !_kmShown.has('tgt:7'); i++) await new Promise(r => setTimeout(r, 100));
    const after = cells('tgt:7'), range = _kmRange, radio = document.querySelector('input[name="kashimap-range-menu"]:checked').value, radioCtrl = document.querySelector('input[name="kashimap-range"]:checked').value;
    const tr7b = document.querySelector('#kashimap-content tr[data-id="tgt:7"]'); const rowState = { checked: !!(tr7b && tr7b.querySelector('input.kashimap-check').checked), selected: !!(tr7b && tr7b.classList.contains('selected')), swatch: !!(tr7b && tr7b.querySelector('.kashimap-swatch')) };   // 描き直した行(繰り上げで山リストを描き直す)もチェック済み・色付き
    document.getElementById('chk-kashimap-device').checked = false; _kmSelected.clear(); _kmRange = 100; _kmSyncUi();
    return { filled, stored, c7, c8, after, range, radio, radioCtrl, shown: _kmShown.has('tgt:7'), rowState };
  }, [mk('tgt:7', 'テスト丙', 35.2, 139.2, 300, 12), mk('tgt:8', 'テスト丁', 35.1, 139.1, 24, 15)]);
  check('U4 山リスト: 300kmの資産しか無い山は「300km▲」(ツールチップに最大表示範囲100km)・ズームはz12(1画素≈31m・DEM10B)/z15(1画素≈4m・DEM5A/5B/5C)・ズーム無しの古い資産は索引の読み直しで補われる(保存にも)・▲の山を選ぶと表示範囲が300km(ラジオ2つも)へ繰り上がり▲が消えて描ける・描き直した行もチェック済みで色付き(席を決めてから描く)',
    u4.rowState.checked && u4.rowState.selected && u4.rowState.swatch && u4.filled === 15 && u4.stored === 15 && u4.c7 && u4.c7[2].t === '300km▲' && /最大表示範囲\(100km\)/.test(u4.c7[2].title) && u4.c7[5].t === 'z12(1画素≈31m・DEM10B)' && u4.c7[1].t === '動' && u4.c8 && u4.c8[2].t === '24km' && u4.c8[5].t === 'z15(1画素≈4m・DEM5A/5B/5C)' &&
    u4.range === 300 && u4.radio === '300' && u4.radioCtrl === '300' && u4.after && u4.after[2].t === '300km' && u4.after[2].title === '' && u4.shown, JSON.stringify(u4));

  // U5: 島リストの分割描画: 9,000行→最初の4,000行はその場で・見出しに「描画中 4,000/9,000」・進捗バー→終わると9,000行で見出しが戻る。描画中に並べ替え直しても重複しない
  const u5 = await p.evaluate(async () => {
    const sv = _kmIslandRows;
    _kmIslandRows = Array.from({ length: 9000 }, (_, i) => ({ key: `tgt:1:${i + 1}`, stripe: false, mid: 'tgt:1', no: i + 1, dup: 1, names: ['テスト'], yomi: '', lat: 35 + i * 1e-4, lon: 139 + i * 1e-4, area: 0.01, px: 4, dists: [i * 0.01], seat: 0 }));
    _kmRenderIslandList();
    const q = () => document.querySelectorAll('#kashimap-detail-body tr.td-data-row').length;
    const t0 = { n: q(), title: document.getElementById('kashimap-detail-title').textContent, prog: !document.getElementById('kashimap-progress').classList.contains('hidden') };
    for (let i = 0; i < 100 && /描画中/.test(document.getElementById('kashimap-detail-title').textContent); i++) await new Promise(r => setTimeout(r, 50));
    const t1 = { n: q(), title: document.getElementById('kashimap-detail-title').textContent, prog: !document.getElementById('kashimap-progress').classList.contains('hidden') };
    // 描画中に並べ替え直す(緯度→緯度の逆)
    const th = Array.from(document.querySelectorAll('#kashimap-detail-body thead th')).find(t => /代表点の緯度/.test(t.textContent)); th.click(); th.click();
    const mid = q();
    for (let i = 0; i < 100 && /描画中/.test(document.getElementById('kashimap-detail-title').textContent); i++) await new Promise(r => setTimeout(r, 50));
    const rows = document.querySelectorAll('#kashimap-detail-body tbody tr'); const t2 = { n: rows.length, first: rows[0].children[6].textContent, last: rows[rows.length - 1].children[6].textContent };
    // 描画の途中で表ごと作り直す(「:縞島のみ」で0件に)→古い描画は止まり、見出しも進捗バーも新しいまま(古い描画が見出しを「描画中」に戻さない)
    _kmRenderIslandList(); const t3a = document.getElementById('kashimap-detail-title').textContent;
    _kmStripeOnly = true; _kmRenderIslandList();
    await new Promise(r => setTimeout(r, 400));
    const t3 = { during: /描画中/.test(t3a), title: document.getElementById('kashimap-detail-title').textContent, n: q(), prog: !document.getElementById('kashimap-progress').classList.contains('hidden') };
    _kmStripeOnly = false;
    _kmIslandRows = sv; _kmRenderIslandList();
    return { t0, t1, mid, t2, t3 };
  });
  check('U5 島リスト: 9,000行→直後は4,000行+「描画中 4,000/9,000」+進捗バー→終わると9,000行で見出しが戻り進捗が消える。描画中の並べ替え直しでも9,000行(重複なし)で緯度の降順。描画中に表ごと作り直すと古い描画は止まる(見出し「島リスト(0件・縞島のみ)」のまま・行0・進捗なし)',
    u5.t0.n === 4000 && /描画中 4,000\/9,000/.test(u5.t0.title) && u5.t0.prog && u5.t1.n === 9000 && !/描画中/.test(u5.t1.title) && !u5.t1.prog && u5.mid <= 4000 && u5.t2.n === 9000 && u5.t2.first === '35.899900' && u5.t2.last === '35.000000' && u5.t3.during && u5.t3.title === '島リスト(0件・縞島のみ)' && u5.t3.n === 0 && !u5.t3.prog, JSON.stringify(u5));

  // U6: ワーカーのmeta: earth_radius_m は実際に使った局所半径(≈6371014)、reff_m はその/(1−0.132)
  const u6 = await p.evaluate(async () => {
    window._tmSyntheticElev15 = () => 100; window._tmSyntheticElev = () => 100;
    appState.end = { lat: DEFAULT_END.lat, lng: DEFAULT_END.lng, elev: 3776 }; appState.endApiElev = 3776; appState.endHeight = 0; document.getElementById('input-end-name').value = '半径の検査';
    appState.refractionEnabled = false;
    const r = await _kmComputeTarget({ rangeKm: 2, quiet: true, force: true }); const d = r.done[0];
    delete window._tmSyntheticElev15; delete window._tmSyntheticElev;
    return { k: d.meta.k, earth: d.meta.earth_radius_m, reff: d.meta.reff_m, expectEarth: +getLocalEarthRadius(DEFAULT_END.lat).toFixed(1), obsH: d.meta.observer_h_m, errs: r.errs };
  });
  check('U6 ワーカーのmeta: k=0(補正オフ。第158)・earth_radius_m=実際の局所半径(≈6371014)・reff_m=局所半径/(1−k)=局所半径・観測者1.5m(単一情報源の値)', u6.k === 0 && Math.abs(u6.earth - u6.expectEarth) < 1 && Math.abs(u6.reff - u6.earth) < 1 && u6.obsH === 1.5 && u6.errs.length === 0, JSON.stringify(u6));

  check('E ページエラーなし', errs.length===0, errs.join(' | '));
  await b.close();
  console.log(`\n${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('ERR', e); process.exit(1); });
