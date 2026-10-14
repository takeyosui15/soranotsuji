// 第156ラウンド検証: v1.95.0 可視マップ節のデッサン05改訂版・資産の一覧3行1組・山リストの資産の列・直し(点滅/島リスト全件/9,500枚/資産の再利用)・気差係数(その場計算は常にk≧0.132・既定Γ0.0125と移行)・辻ラインの端を揃える
// ①静的な形: 版数ピン・節の段組み(ラベル行・:端末保存・計算済み可視マップを検索・水平線3本・:目的点/:My目的点+計算範囲リスト7つ+:精細/:最高精細+範囲を計算・可視タイル/山頂と全展望は別の段・標高タイルの注記・横幅いっぱいのボタン・三等分)・ヘルプ・設定の文言・script.js/worker/CSS/道具/索引の要点
// ②単体: 解像度の段(最高精細)・その場計算のk(補正オフでも0.132・オンなら設定)・既定Γ0.0125・保存データの移行(旧既定なら新既定へ・触っていれば据え置き)
// ③整列の実測: 水平線が見える・範囲を計算/全削除/一括選択は横幅いっぱい・⬇DL/削除/全て登録は三等分・可視タイルと山頂は同じ段/全展望は別の段・合計件数は13pxの黒字細字
// ④資産の一覧(3行1組・文字サイズ・一括選択トグルの見た目・kのツールチップ)・山リストの列(範囲/樹冠/構造物/サイズ・:端末保存)・点滅(目的点の資産の鍵)・島リスト全件(3,500行)・資産の再利用(確認→使う/計算し直す)・meta.k・辻ラインの端(1分刻みでも両端が揃う)
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');
const ROOT = path.join(__dirname, '..');
const idxSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cssSrc = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const dpSrc = fs.readFileSync(path.join(ROOT, 'dp-line-worker.js'), 'utf8');
const toolSrc = fs.readFileSync(path.join(ROOT, 'tools', 'kashimap', 'viewshed.js'), 'utf8');
const wkSrc = fs.readFileSync(path.join(ROOT, 'kashimap-worker.js'), 'utf8');
const indexJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'kashimap', 'v1', 'index.json'), 'utf8'));
const mysite = fs.readFileSync(path.join(ROOT, 'docs', 'dessin', 'dessin', '09-mysite.md'), 'utf8');

check('V0 版数 1.95.0以降(ピンは最新のverifyが持つ)+Version Historyに第156', /APP_VERSION = '1\.9[5-9]\.\d+'/.test(src) && (src.includes('第156ラウンド — 可視マップ節をデッサン05の改訂版に') || !!process.argv[2]));
const kmHtml = idxSrc.slice(idxSrc.indexOf('id="sec-kashimap"'), idxSrc.indexOf('data-arg="sec-soramado"'));
const order = (...ids) => { let pos = -1; return ids.every(t => { const v = kmHtml.indexOf(t, pos + 1); if (v < 0) return false; pos = v; return true; }); };   // 第157: 同じ字句(水平線)が複数回並ぶので、直前の位置より後ろで探す
check('S1 可視マップ節(デッサン05の改訂版): 推し山→検索条件:→AND/OR→山リスト:→百/二百/三百→百高/その他/:端末保存→最大表示範囲:→100/300/700→障害物オプション:→:樹冠/:構造物→「計算済み可視マップを検索」→注記3つ→水平線→:目的点/:My目的点(1段)→計算範囲リスト(7つ・500なし・初期値24)→:精細→:最高精細→「範囲を計算」→注記(剣ヶ峯)[第157]→水平線→:可視タイル/:山頂マーカー(1段)→:全展望マーカー(別の段)→水平線→標高タイル:→件数/容量→注記→全削除(横幅いっぱい)→水平線[第157]→可視タイル:→件数/容量→一括選択(main-btn)→⬇DL/削除/全て登録(三等分)→一覧 / 旧ボタンのidが残らない',
  order('id="input-kashimap-query"', '>検索条件:</label>', 'id="radio-kashimap-and"', '>山リスト:</label>', 'id="chk-kashimap-100"', 'id="chk-kashimap-high"', 'id="chk-kashimap-other"', 'id="chk-kashimap-device"', '>最大表示範囲:</label>', 'name="kashimap-range-menu" value="100" checked', '>障害物オプション:</label>', 'id="chk-kashimap-menu-canopy"', 'id="chk-kashimap-menu-building"', '>計算済み可視マップを検索</button>', '山リストは百名山', '標高・建物・木の高さからの概算です', 'この機能はPC向け機能なので', '<hr class="tsujisearch-separator km-hr">', 'id="radio-kashimap-tgt" value="tgt" checked>:目的点', 'id="radio-kashimap-mytgt" value="mytgt">:My目的点', 'id="sel-kashimap-tgt-range"', 'id="chk-kashimap-fine"', 'id="chk-kashimap-finest"', '>:最高精細(700kmを2段細かく)</label>', '>範囲を計算</button>', '富士山で範囲を計算する場合は、「火口」を中心とする場合と、「剣ヶ峯」を中心とする場合では、結果が異なります。宙の辻では、「剣ヶ峯」(標高:3771.3m)を推奨します。', '<hr class="tsujisearch-separator km-hr">', 'id="chk-kashimap-menu-tiles"', 'id="chk-kashimap-menu-summit"', 'id="chk-kashimap-menu-zen"', '>標高タイル:</label>', 'id="kashimap-tiles-count"', 'id="kashimap-tiles-size"', '可視タイル作成後は、標高タイルは不要です。いつでも、全削除可能です。', 'id="btn-kashimap-tiles-clear" class="nav-btn main-btn"', '<hr class="tsujisearch-separator km-hr">', '>可視タイル:</label>', 'id="kashimap-store-count"', 'id="kashimap-store-total"', 'id="btn-kashimap-store-selall" class="nav-btn main-btn"', '<div class="control-row km-store-actions">', 'id="btn-kashimap-store-dl" class="nav-btn main-btn"', 'id="btn-kashimap-store-del" class="nav-btn main-btn"', 'id="btn-kashimap-store-apply" class="nav-btn main-btn"', 'id="kashimap-store-table"') &&
  (kmHtml.match(/<hr class="tsujisearch-separator km-hr">/g) || []).length === 4 &&
  [...kmHtml.matchAll(/<option value="(\d+)"( selected)?>/g)].map(m => m[1] + (m[2] ? '*' : '')).join(',') === '24*,36,48,60,100,300,700' &&
  /id="chk-kashimap-menu-summit"[^\n]*\n\s*<\/div>\s*<div class="control-row left-row">\s*<input type="checkbox" id="chk-kashimap-menu-zen"/.test(kmHtml) &&   // 全展望マーカーは別の段
  /id="chk-kashimap-menu-tiles"[^\n]*\n\s*<input type="checkbox" id="chk-kashimap-menu-summit"/.test(kmHtml) &&   // 可視タイルと山頂マーカーは同じ段
  !/btn-kashimap-tgt|btn-kashimap-mytgt/.test(idxSrc) && !/btn-kashimap-tgt|btn-kashimap-mytgt/.test(src) && !/kashimap-btn-row/.test(kmHtml) && !/center-row/.test(kmHtml.slice(kmHtml.indexOf('標高タイル:'))));
check('S1b ヘルプと設定の文言: その場で計算(ラジオ+範囲を計算・端末の資産を先に探す・計算範囲リスト7つ・最高精細・Kはオン=算出値/オフ=0[第158])・一覧は3行・気温減率の既定0.0125(入力欄のtitle・ヘルプ・数式の説明)・辻ラインの端 / UI文言に内輪文脈なし',
  idxSrc.includes('<li><strong>その場で計算 (「:目的点」「:My目的点」+「範囲を計算」)</strong>') && idxSrc.includes('同じ範囲の資産があればそれを使うか聞きます') && idxSrc.includes('24/36/48/60/100/300/700km四方') && !idxSrc.includes('300/500/700km四方') &&
  idxSrc.includes('「:最高精細」は700kmを約15m') && idxSrc.includes('先頭のチェックがオンのときは下の気象条件から算出した値 (既定。標準の気象条件で K=0.132)、オフのときは 0 (気差なし=地球の丸みだけ。K=0 の見え方を確かめるためのスイッチです)') && idxSrc.includes('一覧は資産ごとに3行で') && idxSrc.includes('3行目は島数・サイズです') &&
  idxSrc.includes('既定は 0.0125=測量標準の K=0.132 になる値') && idxSrc.includes('既定は0.0125で、測量標準の K=0.132 になります') && idxSrc.includes('既定の気温減率 <b>0.0125</b> で測量標準の') && !idxSrc.includes('通常は 0.0065') && !idxSrc.includes('通常は0.0065') &&
  idxSrc.includes('その時刻を1秒まで詰めて揃えています') &&
  !/可視マップ[^<]*第1\d\dラウンド/.test(idxSrc) && !/kashimap[^\n]*第1\d\d/.test(idxSrc.replace(/<!--[\s\S]*?-->/g,'')));
check('S2 script.js/worker/道具: 大円に沿う光線(geodesicHelpers・放物線の反り・行ごとの縮尺)・hSeenの添字・既定Γ0.0125(STD_L)と旧値(STD_L_OLD)・保存データの移行(meteoDefaultsV2)・計算範囲7つ・上限9,500/最高精細45,000・_kmZoomForRange(rangeKm, fine, finest)・refractionKInUse/_visInv2Reff[第157]・オフ=0[第158]・jobのk・点滅の鍵はlastIndexOf・KM_ROW_CAPなし・山リストの6欄(_kmInfoCells)と列・:端末保存・資産の再利用(確認)・3行1組・一括選択のトグル見た目・索引のk・DP_DIST_LIMITはモジュール定数で365にも / worker: evalAt+bisect / 道具: sizes / 索引: sizes / CSS',
  ['const STD_L = SORA.REFRACTION.STD_LAPSE_RATE_K_PER_M;', 'const STD_L_OLD = SORA.REFRACTION.ISA_LAPSE_RATE_K_PER_M;', '+saved.meteo.l === STD_L_OLD) appState.meteo = { p: STD_P, t: STD_T, l: STD_L };', 'meteoDefaultsV2: true,', 'const KM_TGT_RANGES = [24, 36, 48, 60, 100, 300, 700];', 'const KM_TGT_MAX_TILES = 9500;', 'const KM_TGT_MAX_TILES_FINEST = 45000;',
   'function _kmZoomForRange(rangeKm, fine, finest) {', 'if (finest && rangeKm > 500) return z + 2;', 'function refractionKInUse() {', 'inv2R: _visInv2Reff(lat, lat), k: refractionKInUse(),', '(finest && rangeKm > 500) ? KM_TGT_MAX_TILES_FINEST : KM_TGT_MAX_TILES',
   "const cut = key.lastIndexOf(':'); const mid = key.slice(0, cut), no = key.slice(cut + 1);", "else if (!_kmShown.has(key.slice(0, key.lastIndexOf(':')))) _kmBlink.delete(key);", 'function _kmInfoCells(info, lat)', "{ label: '範囲', compare:", "{ label: '樹冠', compare:", "{ label: '構造物', compare:", "{ label: 'サイズ', compare:", 'if (tr.children.length >= KM_INFO_COL0 + cells.length)',
   'if (f.device && !_kmHasDeviceAsset(m.id)) return false;', "const have0 = tid && !(opts && opts.force) ? _kmDeviceIndex.get(`${tid}/terrain/${rangeKm}`) : null;", 'OK=その資産を使う / キャンセル=計算し直す', "tr3.className = 'km-store-row3'", '<td rowspan="3" class="km-store-chk">', "all.classList.toggle('myset-toggle-active', allOn);", 'k: _kmNum(meta.k),', 'height: v.height, k: v.k, zoom: v.zoom });',
   'const DP_DIST_LIMIT = 400000;', "owner: 'dp365', altOffset: offAlt, distLimit: DP_DIST_LIMIT })", "const b = document.getElementById('btn-kashimap-compute');", "const fn = (my && my.checked) ? _kmComputeMyTargets : _kmComputeTarget;"].every(t => src.includes(t)) &&
  !/KM_ROW_CAP/.test(src) && src.includes('calculateKFromMeteo(appState.meteo.p, appState.meteo.t, appState.meteo.l) : 0;') &&   // 第158: 「オフ=0」が本体の規則(第157の「オフでも0.132」は取り下げ)
  ['const evalAt = (timeMs) => {', 'const bisect = (okMs, ngMs) => {', 'if (pt && !lastOk) { const b = bisect(timeMs, lastMs);', 'else if (lastOk && s > startSec) { const b = bisect(lastMs, timeMs);'].every(t => dpSrc.includes(t)) &&
  ['function geodesicHelpers(G)', 'const geo = geodesicHelpers(G);', 'const bend = geo.bend(ex, ey);', 'dM += stepM * geo.rowScale[py];', "path: 'geodesic-parabolic', scale: 'row-cos-lat'", 'const b = Math.floor(i / 8); return (hSeen[b] >> (i - b * 8)) & 1;', 'function allocArray(Ctor, n, forceWasm)', 'grid = allocArray(Uint16Array, W * H, !!job.forceWasm).fill(NODATA);', 'const visible = allocArray(Uint8Array, W * H);'].every(t => wkSrc.includes(t)) &&
  ['function geodesicHelpers() {', 'const geo = geodesicHelpers();', 'dM += stepM * geo.rowScale[py];', 'const bend = geo.bend(px, py);'].every(t => toolSrc.includes(t)) &&
  toolSrc.includes("ent.sizes = ent.sizes || {}; ent.sizes[`${kind}:${RANGE_KM}`]") && indexJson.mountains['368'].sizes && indexJson.mountains['368'].sizes['terrain:60'] > 8000000 && indexJson.mountains['370'].sizes['terrain:20'] > 700000 &&
  cssSrc.includes('#kashimap-store-table tr.km-store-row3 td { border-bottom: 1px solid') && cssSrc.includes('#kashimap-store-table .kashimap-store-name { width: 100%; box-sizing: border-box; font-size: 16px;') && cssSrc.includes('#sec-kashimap .km-stat { font-size: 13px; color: #000; font-weight: normal; }') &&
  !cssSrc.includes('background: rgba(40, 140, 60, 0.22)') && !cssSrc.includes('#btn-kashimap-store-apply.dirty') && cssSrc.includes('#sec-kashimap .km-store-actions .nav-btn { flex: 1 1 0; min-width: 0; }') &&
  /A\["Myセット\(非公開\)"\]/.test(mysite) && /subgraph viewer\["見る側の端末\(宙の辻\)"\]/.test(mysite));

// S3: ワーカーをNodeで読み、平らな地形(0m)・全画素が地平線の内側(hS=3776・60km)の窓で、どの光線にも標本されない画素が無いこと(=見えない画素が0)。
//     大円の反りを両軸に掛けると主軸が2画素飛ぶ歩があり、飛ばされた画素が「見えない」のまま残っていた(第156のレビューで検出)。反りは副軸だけに掛ける
{
  const vm = require('vm');
  const ctxw = { self: { postMessage() {}, addEventListener() {} }, console, WebAssembly, Uint16Array, Uint8Array, Float64Array, Int32Array, Float32Array, RangeError, Math, setTimeout, fetch: () => {}, indexedDB: undefined, performance };
  ctxw.self.SORA = undefined; ctxw.importScripts = (f) => { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctxw); if (ctxw.self && ctxw.self.SORA) ctxw.SORA = ctxw.self.SORA; };   // 第157: ワーカーは sora-constants.js を importScripts で読む
  vm.createContext(ctxw);
  vm.runInContext(wkSrc + '\n;this.__cv = computeViewshed; this.__wg = windowGeom;', ctxw);
  const holesFor = (lat, lon, rangeKm, Z, hS) => {
    const G = ctxw.__wg(lat, lon, rangeKm, Z); const grid = new Uint16Array(G.W * G.H).fill(1000);   // 1000 = 0m
    const r = ctxw.__cv(grid, G, hS, (1 - 0.132) / (2 * 6371000), 1.5, 15, 10, null, false);
    let holes = 0; for (let i = 0; i < r.visible.length; i++) if (r.visible[i] === 0) holes++;
    return { W: G.W, holes, vis: r.nVis };
  };
  const t0 = Date.now();
  const h1 = holesFor(35.3606, 138.7274, 60, 13, 3776);     // 富士山60km(z13)
  const h2 = holesFor(44.0, 143.0, 200, 11, 30000);          // 北緯44°・200km(反りが大きい。hSを高くして全画素を地平線の内側に)
  check('S3 ワーカー(Node): 平らな地形で全画素が見える=標本されない画素が0(富士山60km z13・北緯44° 200km z11)', h1.holes === 0 && h2.holes === 0 && h1.vis === h1.W * h1.W - 1 && h2.vis === h2.W * h2.W - 1, JSON.stringify({ h1, h2, ms: Date.now() - t0 }));
}

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html?kashimap=1',{waitUntil:'load'});   // 可視マップは封鎖中(第158)。開錠して検査
  const ready = () => p.waitForFunction(()=>typeof runKashimapSearch==='function' && typeof _kmRenderStoreList==='function' && typeof glMap!=='undefined' && glMap && glMap.getLayer && !!glMap.getLayer('km-fill') && typeof calculateDPPathPoints==='function',{timeout:15000});
  await ready();
  await p.evaluate(async ()=>{ window.confirm=()=>true; window.alert=(m)=>{ (window._alerts = window._alerts || []).push(String(m)); }; try { await _kmStoreClear(); await _kmTilesClear(); await _kmLoadDeviceIndex(); } catch (e) {} });

  // U1: 単体(解像度の段・k・既定Γ)
  const u1 = await p.evaluate(() => {
    const z = [[700,false,true,13],[700,true,false,12],[700,false,false,11],[300,false,true,12],[300,true,true,13],[100,true,true,14],[60,true,true,15]].map(([r,f,ff,e]) => _kmZoomForRange(r,f,ff) === e);
    const sv = [appState.refractionEnabled, { ...appState.meteo }];
    appState.refractionEnabled = false; const kOff = refractionKInUse(); const inv2ROff = _visInv2Reff(35.36, 35.36);   // 第157: _kmComputeK/_kmInv2Reff は refractionKInUse/_visInv2Reff に統合
    appState.refractionEnabled = true; appState.meteo = { p: 1013.25, t: 15, l: 0.0125 }; const kOn = refractionKInUse();
    appState.meteo = { p: 1013.25, t: 15, l: 0.0065 }; const kOld = refractionKInUse();
    [appState.refractionEnabled, appState.meteo] = sv;
    const reffOff = 1 / (2 * inv2ROff);
    return { z: z.every(Boolean), kOff, kOn: +kOn.toFixed(4), kOld: +kOld.toFixed(4), stdL: STD_L, stdLOld: STD_L_OLD, reffOff: Math.round(reffOff), expectReff: Math.round(getLocalEarthRadius(35.36)), ranges: KM_TGT_RANGES.join(), maxTiles: KM_TGT_MAX_TILES, finest: KM_TGT_MAX_TILES_FINEST, nOpt: document.getElementById('sel-kashimap-tgt-range').options.length };
  });
  check('U1 単体: 最高精細は700kmだけz13(精細は300→13・700→12)・その場計算のk=補正オフで0[第158]・オン+既定Γ0.0125で0.132・Γ0.0065なら0.169・STD_L=0.0125・実効半径はオフなら局所半径そのもの・計算範囲7つ・上限9,500/45,000',
    u1.z && u1.kOff === 0 && u1.kOn === 0.132 && u1.kOld === 0.1688 && u1.stdL === 0.0125 && u1.stdLOld === 0.0065 && u1.reffOff === u1.expectReff && u1.ranges === '24,36,48,60,100,300,700' && u1.maxTiles === 9500 && u1.finest === 45000 && u1.nOpt === 7, JSON.stringify(u1));

  // U1b: 保存データの移行(旧既定のまま→新既定へ / 触ってあれば据え置き / 一度保存すれば旧値に戻しても触らない)。ページを読み直して loadAppState を通す
  const migrate = async (meteo, flag) => {
    await p.evaluate(([m, f]) => { const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); s.meteo = m; if (f === null) delete s.meteoDefaultsV2; else s.meteoDefaultsV2 = f; localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }, [meteo, flag]);
    await p.reload({ waitUntil: 'load' }); await ready();
    return p.evaluate(() => ({ l: appState.meteo.l, p: appState.meteo.p, k: +appState.refractionK.toFixed(4), saved: JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').meteoDefaultsV2 }));
  };
  const m1 = await migrate({ p: 1013.25, t: 15, l: 0.0065 }, null);       // 旧既定のまま→0.0125
  const m2 = await migrate({ p: 1013.25, t: 15, l: 0.007 }, null);        // 触ってある→据え置き
  const m3 = await migrate({ p: 1013.25, t: 15, l: 0.0065 }, true);       // 移行済みの印があれば旧値でも触らない(意図して0.0065にした人)
  const m4 = await migrate({ p: 990, t: 5, l: 0.0065 }, null);            // 気圧・気温を触ってある→据え置き
  check('U1b 保存データの移行: 旧既定(1013.25/15/0.0065)のまま→0.0125(K=0.132)・減率を触ってあれば据え置き・移行済みの印があれば旧値でも据え置き・気圧/気温を触ってあれば据え置き・保存に印が立つ',
    m1.l === 0.0125 && m1.k === 0.132 && m2.l === 0.007 && m3.l === 0.0065 && m4.l === 0.0065 && m4.p === 990 && (m1.saved === true || m1.saved === undefined), JSON.stringify({ m1, m2, m3, m4 }));
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); s.meteo = { p: 1013.25, t: 15, l: 0.0125 }; localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); });
  await p.reload({ waitUntil: 'load' }); await ready();
  await p.evaluate(async ()=>{ window.confirm=()=>true; window.alert=(m)=>{ (window._alerts = window._alerts || []).push(String(m)); }; try { await _kmStoreClear(); await _kmTilesClear(); await _kmLoadDeviceIndex(); } catch (e) {} });

  // D1: 資産の一覧(合成の資産3つ)=3行1組・文字サイズ・一括選択トグルの見た目・kのツールチップ
  const mk = (id, name, lat, lon, range, canopy, buildings, k) => ({
    meta: { tool: 'test', version: 2, mountain: { id, name, lat, lon, elev_list: 1000, height_m: 0 }, range_km: range, zoom: 15, canopy, buildings, k, summit_area: { drop_m: 300 }, result: { islands: 1 } },
    islands: { mountain: { id, name }, count: 1, islands: [{ no: 1, px: 4, area_km2: 0.0001, rep: [lat, lon], bbox: [lon, lat, lon, lat], dist_km: 0 }] },
    outline: { v: 2, id, name, range_km: range, zoom: 15, canopy, x0: 29000 * 256, y0: 12900 * 256, w: 2, h: 2, tol_px: 0, islands: [[1, 4, '??_@?A@?']] } });
  const d1 = await p.evaluate(async (specs) => {
    for (const sp of specs) { await _kmStoreSave(sp.meta, sp.islands, sp.outline, 'compute'); }
    await _kmLoadDeviceIndex();
    const panel = document.getElementById('control-panel'); if (panel) panel.classList.remove('minimized');
    const sec = document.getElementById('sec-kashimap'); if (sec.classList.contains('closed')) toggleSection('sec-kashimap');
    const q = sel => Array.from(document.querySelectorAll(sel));
    const rows1 = q('#kashimap-store-table tr.km-store-row'), rows2 = q('#kashimap-store-table tr.km-store-row2'), rows3 = q('#kashimap-store-table tr.km-store-row3');
    const cs = el => getComputedStyle(el);
    const inp = rows1[0].querySelector('.kashimap-store-name'); const ref = document.getElementById('input-start-name');
    const td2 = rows2[0].children[0], td3 = rows3[0].children[0];
    const stat = document.querySelector('#sec-kashimap .km-stat'), lab = document.querySelector('#sec-kashimap label.baseopt-group-label.km-sub');
    const r1 = { cols2: rows2.map(r => Array.from(r.children).map(td => td.textContent).join('|')), cols3: rows3.map(r => Array.from(r.children).map(td => td.textContent).join('|')), rowspan: rows1.map(r => r.querySelector('.km-store-chk').getAttribute('rowspan')).join(),
      inpFont: cs(inp).fontSize, refFont: cs(ref).fontSize, td2Font: cs(td2).fontSize, td2Color: cs(td2).color, td3Font: cs(td3).fontSize, td3Border: cs(td3).borderBottomWidth, td2Bg: cs(td2).backgroundColor, statFont: cs(stat).fontSize, statColor: cs(stat).color, statWeight: cs(stat).fontWeight, labFont: cs(lab).fontSize,
      titles: rows1.map(r => r.querySelector('.kashimap-store-name').title) };
    const wait = ms => new Promise(r => setTimeout(r, ms));   // .nav-btn は色の transition があるので、切り替えの直後は途中の色が返る→少し待ってから読む
    document.getElementById('btn-kashimap-store-selall').click();
    const btn = document.getElementById('btn-kashimap-store-selall'); await wait(600);
    const on = { text: btn.textContent, cls: btn.classList.contains('myset-toggle-active'), bg: cs(btn).backgroundColor, weight: cs(btn).fontWeight };
    document.getElementById('btn-kashimap-store-selall').click();
    const off = { text: btn.textContent, cls: btn.classList.contains('myset-toggle-active') };
    // 「全て登録」の赤太字はMy観測点と同じ .nav-btn.dirty
    const inpEdit = rows1[0].querySelector('.kashimap-store-name'); inpEdit.value = inpEdit.value + '改'; inpEdit.dispatchEvent(new Event('input', { bubbles: true }));
    const ap = document.getElementById('btn-kashimap-store-apply'); await wait(600); const dirty = { cls: ap.classList.contains('dirty'), color: cs(ap).color, weight: cs(ap).fontWeight };
    const refBtn = document.getElementById('btn-myobs-regall'); refBtn.classList.add('dirty'); await wait(600); const refDirty = { color: cs(refBtn).color, weight: cs(refBtn).fontWeight }; refBtn.classList.remove('dirty');
    inpEdit.value = inpEdit.value.slice(0, -1); inpEdit.dispatchEvent(new Event('input', { bubbles: true }));
    return { n: [rows1.length, rows2.length, rows3.length], ...r1, on, off, dirty, refDirty, count: document.getElementById('kashimap-store-count').textContent };
  }, [mk('tgt:1', 'テスト甲', 35.1, 139.1, 24, false, false, 0.132), mk('tgt:1', 'テスト甲', 35.1, 139.1, 24, true, false, 0.132), mk('tgt:2', 'テスト乙', 35.2, 139.2, 36, false, true, 0.1688)]);
  check('D1 資産の一覧: 3つの資産が3行1組(チェックはrowspan=3 / 2行目=範囲・樹冠・構造物 / 3行目=島数・サイズ)・入力欄の文字は観測点名と同じ大きさ・2〜3行目は10pxの#555・背景色なし・3行目の下に水平線・合計件数はラベルと同じ13pxの黒字細字・kのツールチップ・一括選択→「一括解除」(黄色・太字)→戻る・「全て登録」の赤太字はMy観測点と同じ',
    d1.n.join() === '3,3,3' && d1.rowspan === '3,3,3' && d1.cols2.some(c => c === '範囲: 24km|樹冠: -|構造物: -') && d1.cols2.some(c => c === '範囲: 24km|樹冠: あり|構造物: -') && d1.cols2.some(c => c === '範囲: 36km|樹冠: -|構造物: あり') && d1.cols3.every(c => /^島数: 1\|サイズ: [\d.]+ MB$/.test(c)) &&
    d1.inpFont === d1.refFont && d1.td2Font === '10px' && d1.td2Color === 'rgb(85, 85, 85)' && d1.td3Font === '10px' && d1.td3Border === '1px' && /rgba\(0, 0, 0, 0\)|transparent/.test(d1.td2Bg) && d1.statFont === '13px' && d1.statFont === d1.labFont && d1.statColor === 'rgb(0, 0, 0)' && String(d1.statWeight) === '400' &&
    d1.titles.some(t => /気差係数k=0\.132/.test(t)) && d1.titles.some(t => /気差係数k=0\.169/.test(t)) && d1.on.text === '一括解除' && d1.on.cls && d1.on.bg === 'rgb(255, 255, 0)' && String(d1.on.weight) === '700' && d1.off.text === '一括選択' && !d1.off.cls &&
    d1.dirty.cls && d1.dirty.color === d1.refDirty.color && d1.dirty.weight === d1.refDirty.weight && d1.count === '3', JSON.stringify(d1));

  // U2: 整列の実測(水平線が見える・横幅いっぱいのボタン・三等分・段の構成)
  const u2 = await p.evaluate(() => {
    const sec = document.getElementById('sec-kashimap'); const secR = sec.getBoundingClientRect(); const r = id => document.getElementById(id).getBoundingClientRect();
    const hrs = Array.from(sec.querySelectorAll('hr.km-hr')).map(h => { const b = h.getBoundingClientRect(); return { w: Math.round(b.width), color: getComputedStyle(h).borderTopColor, visible: b.height >= 1 && getComputedStyle(h).borderTopStyle === 'solid' }; });
    const full = ['btn-kashimap-compute', 'btn-kashimap-tiles-clear', 'btn-kashimap-store-selall', 'btn-kashimap-search'].map(id => +(r(id).width / secR.width).toFixed(2));
    const thirds = ['btn-kashimap-store-dl', 'btn-kashimap-store-del', 'btn-kashimap-store-apply'].map(id => Math.round(r(id).width));
    const row = id => Math.round(r(id).top);
    const labels = Array.from(sec.querySelectorAll('label.km-label')).map(l => { const b = l.getBoundingClientRect(); return { t: l.textContent, h: Math.round(b.height), over: b.right > secR.right + 1 }; });
    const noteEl = Array.from(sec.querySelectorAll('.kashimap-note')).find(e => /可視タイル作成後は/.test(e.textContent));
    return { hrs, full, thirds, thirdsSum: +(thirds.reduce((a, b) => a + b, 0) / secR.width).toFixed(2), tgtRow: row('radio-kashimap-tgt') === row('radio-kashimap-mytgt'), tilesSummitRow: row('chk-kashimap-menu-tiles') === row('chk-kashimap-menu-summit'), zenRowDiff: row('chk-kashimap-menu-zen') - row('chk-kashimap-menu-summit'),
      noteAbove: noteEl && noteEl.getBoundingClientRect().bottom <= r('btn-kashimap-tiles-clear').top + 1, labels: labels.length, oneLine: labels.every(l => l.h <= 24 && !l.over), overflow: sec.scrollWidth <= sec.clientWidth + 1 };
  });
  check('U2 整列: 水平線4本が見える[第157](節の幅)・「計算済み可視マップを検索」「範囲を計算」「標高タイルを全削除」「一括選択」は横幅いっぱい・⬇DL/削除/全て登録は同じ幅で合計が横幅いっぱい・:目的点/:My目的点は同じ段・可視タイルと山頂マーカーは同じ段で全展望は下の段・注記は全削除の上・km-labelは1行ではみ出さない・横スクロールなし',
    u2.hrs.length === 4 && u2.hrs.every(h => h.visible && h.w >= 300) && u2.full.every(f => f >= 0.9) && Math.max(...u2.thirds) - Math.min(...u2.thirds) <= 2 && u2.thirdsSum >= 0.9 && u2.tgtRow && u2.tilesSummitRow && u2.zenRowDiff > 10 && u2.noteAbove && u2.labels >= 13 && u2.oneLine && u2.overflow, JSON.stringify(u2));

  // D2: 山リストの列(範囲/樹冠/構造物/サイズ)と「:端末保存」
  await p.evaluate(() => { document.getElementById('input-kashimap-query').value = ''; document.getElementById('chk-kashimap-100').checked = true; document.getElementById('btn-kashimap-search').click(); });   // 語なし=百名山(富士山)+端末の資産の擬似の山(tgt:1/tgt:2)
  await p.waitForFunction(() => document.querySelectorAll('#kashimap-content tr.td-data-row').length > 0, { timeout: 15000 });
  const d2 = await p.evaluate(async () => {
    const ths = Array.from(document.querySelectorAll('#kashimap-content thead th')).map(t => t.textContent.replace(/[▲▼]/g, ''));   // 第157: 「ズーム」列が加わり18列
    const tr = document.querySelector('#kashimap-content tr[data-id="368"]'); const cells = tr ? Array.from(tr.children).slice(11).map(td => td.textContent) : null;
    const t1 = document.querySelector('#kashimap-content tr[data-id="tgt:1"]'); const c1 = t1 ? Array.from(t1.children).slice(11).map(td => td.textContent) : null;
    _kmCanopy = false; _kmBuilding = false; _kmSyncUi(); _kmRenderList(); const t1n = document.querySelector('#kashimap-content tr[data-id="tgt:1"]'); const c1n = t1n ? Array.from(t1n.children).slice(11).map(td => td.textContent) : null;
    _kmCanopy = true; _kmBuilding = true; _kmSyncUi(); _kmRenderList();
    // :端末保存=端末に資産がある山だけ
    document.getElementById('input-kashimap-query').value = ''; document.getElementById('chk-kashimap-device').checked = true; await runKashimapSearch();
    const devRows = Array.from(document.querySelectorAll('#kashimap-content tr.td-data-row')).map(t => t.dataset.id).sort();
    document.getElementById('chk-kashimap-device').checked = false; await runKashimapSearch();
    const allRows = document.querySelectorAll('#kashimap-content tr.td-data-row').length;
    return { ths: ths.slice(11), nCols: ths.length, cells, c1, c1n, devRows, allRows };   // 第157: cellsは7欄(…構造物・ズーム・サイズ)
  });
  check('D2 山リスト: 見出しに「島の数・静的/動的・範囲・樹冠・構造物・ズーム・サイズ」(18列・第157)・富士山=10,129/静/60km/-/-/z15/8.5 MB(索引のsizes・zooms)・端末の資産(tgt:1)は樹冠オンで「樹冠あり」の資産・オフで地形の資産・「:端末保存」で端末に資産がある行だけ(tgt:1・tgt:2)',
    d2.ths.join() === '島の数,静的/動的,範囲,樹冠,構造物,ズーム,サイズ' && d2.nCols === 18 && d2.cells && d2.cells.join('|') === '10,129|静|60km|-|-|z15(1画素≈4m・DEM5A/5B/5C)|8.5 MB' && d2.c1 && d2.c1.join('|') === '1|動|24km|あり|-|z15(1画素≈4m・DEM5A/5B/5C)|' + d2.c1[6] && /MB$/.test(d2.c1[6]) && d2.c1n && d2.c1n.join('|').startsWith('1|動|24km|-|-|') &&
    d2.devRows.join() === 'tgt:1,tgt:2' && d2.allRows >= 100, JSON.stringify(d2));

  // D3: 点滅(目的点の資産の鍵「tgt:…:項番」)
  const d3 = await p.evaluate(async () => {
    _kmSelect('tgt:1', true); await _kmRefresh();
    for (let i = 0; i < 50 && !_kmShown.has('tgt:1'); i++) await new Promise(r => setTimeout(r, 100));
    const row = Array.from(document.querySelectorAll('#kashimap-detail-body tr.td-data-row')).find(t => t.dataset.key === 'tgt:1:1');
    const chk = row && row.querySelector('input.kashimap-island-check'); if (chk) { chk.checked = true; chk.dispatchEvent(new Event('change', { bubbles: true })); }
    const feats = glMap.getSource('km-blink')._data.features;
    const r = { shown: _kmShown.has('tgt:1'), row: !!row, keys: Array.from(_kmBlink), feats: feats.length, featKey: feats[0] && feats[0].properties.key, timer: !!_kmBlinkTimer, vis: glMap.getLayoutProperty('km-blink', 'visibility') };
    _kmPruneBlink(); r.afterPrune = Array.from(_kmBlink);
    _kmBlink.clear(); _kmUpdateBlink(); r.stopped = !_kmBlinkTimer;
    return r;
  });
  check('D3 点滅: 目的点の資産(id「tgt:1」)の島の行をチェック→鍵「tgt:1:1」で輪郭が点滅(featureが1つ・タイマーが動く)・_kmPruneBlinkで落ちない・解除で止まる(第156の不具合の直し)',
    d3.shown && d3.row && d3.keys.join() === 'tgt:1:1' && d3.feats === 1 && d3.featKey === 'tgt:1:1' && d3.timer && d3.afterPrune.join() === 'tgt:1:1' && d3.stopped, JSON.stringify(d3));

  // D4: 島リストは全件(3,500行の合成)
  const d4 = await p.evaluate(() => {
    const sv = _kmIslandRows;
    _kmIslandRows = Array.from({ length: 3500 }, (_, i) => ({ key: `tgt:1:${i + 1}`, stripe: false, mid: 'tgt:1', no: i + 1, dup: 1, names: ['テスト甲'], yomi: '', lat: 35 + i * 1e-4, lon: 139 + i * 1e-4, area: 0.01, px: 4, dists: [i * 0.01], seat: 0 }));
    _kmRenderIslandList();
    const n = document.querySelectorAll('#kashimap-detail-body tr.td-data-row').length, title = document.getElementById('kashimap-detail-title').textContent;
    // 緯度で並べ替え→最北(最後の行)が末尾に来る
    const ths = Array.from(document.querySelectorAll('#kashimap-detail-body thead th')); const thLat = ths.find(t => /代表点の緯度/.test(t.textContent)); thLat.click();
    const first = document.querySelector('#kashimap-detail-body tbody tr').children[6].textContent; thLat.click(); const firstDesc = document.querySelector('#kashimap-detail-body tbody tr').children[6].textContent;
    _kmIslandRows = sv; _kmRenderIslandList();
    return { n, title, first, firstDesc };
  });
  check('D4 島リスト: 3,500件を全部描く(「表示は上位」の注記なし)・緯度の並べ替えで最南/最北が先頭に来る', d4.n === 3500 && /島リスト\(3,500件/.test(d4.title) && !/表示は上位/.test(d4.title) && d4.first === '35.000000' && d4.firstDesc === '35.349900', JSON.stringify(d4));

  // D5: 資産の再利用(端末に同じ範囲の資産があれば確認→使う / キャンセルで計算し直す)・meta.k(第158: 補正オフは0・オンなら設定の値)
  const d5 = await p.evaluate(async () => {
    window._tmSyntheticElev15 = () => 100; window._tmSyntheticElev = () => 100;   // 平らな地形(標高100m)
    appState.end = { lat: DEFAULT_END.lat, lng: DEFAULT_END.lng, elev: 3776 }; appState.endApiElev = 3776; appState.endHeight = 0; document.getElementById('input-end-name').value = '再利用の富士';
    appState.refractionEnabled = false; appState.meteo = { p: STD_P, t: STD_T, l: STD_L };
    const r1 = await _kmComputeTarget({ rangeKm: 2, quiet: true }); const d1 = r1.done[0];
    const t0 = performance.now(); window.confirm = () => true; const r2 = await _kmComputeTarget({ rangeKm: 2, quiet: true }); const ms2 = Math.round(performance.now() - t0); const d2 = r2.done[0];
    window.confirm = () => false; appState.refractionEnabled = true; appState.meteo = { p: STD_P, t: STD_T, l: 0.0065 };
    const r3 = await _kmComputeTarget({ rangeKm: 2, quiet: true }); const d3 = r3.done[0];
    window.confirm = () => true; appState.refractionEnabled = false; appState.meteo = { p: STD_P, t: STD_T, l: STD_L };
    delete window._tmSyntheticElev15; delete window._tmSyntheticElev;
    return { k1: d1 && d1.meta && d1.meta.k, reff1: d1 && d1.meta && d1.meta.reff_m, reused2: !!(d2 && d2.reused), hasMeta2: !!(d2 && d2.meta), ms2, key2: d2 && d2.key, k3: d3 && d3.meta && +d3.meta.k.toFixed(4), reused3: !!(d3 && d3.reused), nDev: _kmDeviceIndex.size, idxK: (_kmDeviceIndex.get(d1.key) || {}).k, errs: [r1.errs, r2.errs, r3.errs].flat(), sel: _kmSelected.has(d1.id), bucket: _kmRange, btn: document.getElementById('btn-kashimap-compute').textContent };
  });
  check('D5 資産の再利用: 1回目は計算(meta.k=0・補正オフ[第158]・実効半径=局所半径)→2回目はOKで端末の資産を使う(reused・計算なし・速い)→キャンセルで計算し直す(補正オン+Γ0.0065→k=0.169)・索引にk・選択される・ボタンは「範囲を計算」に戻る',
    d5.k1 === 0 && Math.abs(d5.reff1 - 6371014) < 2 && d5.reused2 && !d5.hasMeta2 && d5.ms2 < 1500 && d5.key2 && /\/terrain\/2$/.test(d5.key2) && d5.k3 === 0.1688 && !d5.reused3 && d5.nDev === 4 && +(+d5.idxK).toFixed(4) === 0.1688 && d5.errs.length === 0 && d5.sel && d5.bucket === 100 && d5.btn === '範囲を計算', JSON.stringify(d5));

  // D6: 辻ラインの端(1分刻みでも両端が「見かけ高度の下限の距離」に揃う。5秒刻みとも揃う)
  const d6 = await p.evaluate(async () => {
    appState.start = { lat: DEFAULT_START.lat, lng: DEFAULT_START.lng, elev: DEFAULT_START.elev + DEFAULT_START.height }; appState.end = { lat: DEFAULT_END.lat, lng: DEFAULT_END.lng, elev: 3776 };
    const observer = new Astronomy.Observer(appState.start.lat, appState.start.lng, appState.start.elev);
    const body = appState.bodies.find(x => x.id === 'Sun') || { id: 'Sun' };
    const out = [];
    for (const d of [0, 1, 2, 40, 120]) {
      const day = new Date(2026, 9, 6 + d, 0, 0, 0, 0);
      const pts = await calculateDPPathPoints(day, body, observer, { stepSeconds: 60, forceWorker: true, owner: 'dp365', distLimit: DP_DIST_LIMIT });
      out.push({ d, n: pts.length, first: +(pts[0].dist / 1000).toFixed(1), last: +(pts[pts.length - 1].dist / 1000).toFixed(1), dt0: (pts[1].time - pts[0].time) / 1000, dtEnd: (pts[pts.length - 1].time - pts[pts.length - 2].time) / 1000 });
    }
    const day = new Date(2026, 9, 6, 0, 0, 0, 0);
    const t0 = findBodyTransitMs(body, observer, day.getTime());
    const p5 = await calculateDPPathPoints(day, body, observer, { stepSeconds: 5, windowStartMs: Math.floor((t0 - 43200000) / 60000) * 60000, distLimit: DP_DIST_LIMIT });
    const fine = { n: p5.length, first: +(p5[0].dist / 1000).toFixed(1), last: +(p5[p5.length - 1].dist / 1000).toFixed(1) };
    return { out, fine };
  });
  const ends = d6.out.map(o => [o.first, o.last]).flat();
  // 第158: 境界が標本の1秒以内に落ちると二分の点は足されず刻みは60のまま(端の距離は両端で揃っているのでそれで見る)
  check('D6 辻ラインの端: 太陽の1分刻み(365モード)5日とも両端の距離の差が2km以内・日ごとの端は季節でなだらかに動くだけ(10km以内)・端の直前の刻みは1分以内(二分で詰めた点。境界が標本の1秒以内なら標本のまま)・5秒刻み(当日線)の端とも2km以内・端は400km未満(見かけ高度の下限で決まる)',
    d6.out.every(o => o.n > 100 && Math.abs(o.first - o.last) <= 2 && o.dt0 <= 60 && o.dtEnd <= 60) && Math.max(...ends) - Math.min(...ends) <= 10 && Math.abs(d6.fine.first - d6.out[0].first) <= 2 && Math.abs(d6.fine.last - d6.out[0].last) <= 2 && Math.max(...ends) < 400, JSON.stringify(d6));

  // D7: 大円の反り(第156): 北緯44°・200km四方・z11(1画素≈55m)。中心(目的点1000m)から東の縁へ向かう光線は、メルカトルの弦より北へ最大約3.4画素反る(δ=L²·tanφ/(8R)=189m)。
  //     弦の3〜4画素北・中点付近(t=0.35〜0.65)に高さ900mの壁を置く→大円に沿う光線は壁に当たって東の縁の中心の行は見えない。南側(t同じ・行CY+6)の壁は当たらない(反りは北)=見える。西の縁(壁なし)は見える
  const d7 = await p.evaluate(async () => {
    const LAT = 44.0, LON = 143.0, RANGE = 200, Z = 11;
    const G = _kmWindow(LAT, LON, RANGE, Z); const fz = Math.pow(2, 15 - Z);
    const L = G.W - 1 - G.CX; const xa = G.CX + Math.round(0.35 * L), xb = G.CX + Math.round(0.65 * L);
    window._tmSyntheticElev15 = (gx15, gy15) => {
      const x = Math.floor(gx15 / fz) - G.X0, y = Math.floor(gy15 / fz) - G.Y0;
      if (x === G.CX && y === G.CY) return 1000;
      if (x >= xa && x <= xb && (y === G.CY - 3 || y === G.CY - 4)) return 900;        // 弦の北の壁(大円が通る)
      if (x >= xa && x <= xb && (y === G.CY + 9 || y === G.CY + 10)) return 900;       // 行CY+6の光線の弦の北側に同じ壁(反りで避けられない比較用)
      return 0;
    };
    window._tmSyntheticElev = (gx14, gy14) => window._tmSyntheticElev15(gx14 * 2, gy14 * 2);
    appState.end = { lat: LAT, lng: LON, elev: 1000 }; appState.endApiElev = 1000; appState.endHeight = 0; document.getElementById('input-end-name').value = '大円の検査';
    appState.refractionEnabled = false;
    const t0 = performance.now();
    const r = await _kmComputeTarget({ rangeKm: RANGE, zoom: Z, returnBits: true, quiet: true, force: true });
    const ms = Math.round(performance.now() - t0);
    delete window._tmSyntheticElev15; delete window._tmSyntheticElev;
    const d = r.done[0]; if (!d || !d.bits) return { errs: r.errs, ms };
    const bit = (x, y) => { const i = y * G.W + x; const b = Math.floor(i / 8); return (d.bits[b] >> (7 - (i - b * 8))) & 1; };
    // 反りの大きさの検算: 東の縁の中心の行への大円の中点のずれ(画素)
    const D2R = Math.PI / 180, R = 6371008.8; const Lm = L * G.MPP; const deltaPx = Lm * Lm * Math.tan(LAT * D2R) / (8 * R) / G.MPP;
    return { ms, W: G.W, L, deltaPx: +deltaPx.toFixed(2), east: bit(G.W - 1, G.CY), eastS: bit(G.W - 1, G.CY + 6), west: bit(0, G.CY), north: bit(G.CX, 0), gridNote: d.meta.grid.path + '/' + d.meta.grid.scale, method: /大円/.test(d.meta.method), visible: d.meta.result.visible_px, errs: r.errs };
  });
  check('D7 大円の反り: 東の縁の中心の行は弦の北の壁(3〜4画素北・δ≈3.4画素)に当たって見えない・6行南の光線は(反りが北なので)壁を避けて見える・西の縁と北の縁は見える・metaに大円と行ごとの縮尺の印',
    d7.east === 0 && d7.eastS === 1 && d7.west === 1 && d7.north === 1 && d7.deltaPx > 3 && d7.deltaPx < 4 && d7.gridNote === 'geodesic-parabolic/row-cos-lat' && d7.method && d7.errs.length === 0, JSON.stringify(d7));

  // D8: 海(データ無し)は海面0mとして遮る(第156): 目的点100m・周りは全部データ無し(海)。東40kmの島(光線は海面の上)は見える・東100kmの島(光線が海面の下を通る)は見えない
  const d8 = await p.evaluate(async () => {
    const LAT = 44.0, LON = 143.0, RANGE = 200, Z = 11;
    const G = _kmWindow(LAT, LON, RANGE, Z); const fz = Math.pow(2, 15 - Z);
    const xA = G.CX + Math.round(40000 / G.MPP), xB = G.CX + Math.round(100000 / G.MPP);
    window._tmSyntheticElev15 = (gx15, gy15) => {
      const x = Math.floor(gx15 / fz) - G.X0, y = Math.floor(gy15 / fz) - G.Y0;
      if (Math.abs(x - G.CX) <= 1 && Math.abs(y - G.CY) <= 1) return 100;
      if ((Math.abs(x - xA) <= 1 || Math.abs(x - xB) <= 1) && Math.abs(y - G.CY) <= 6) return 0;   // 島(海抜0m)
      return null;   // 海=データ無し
    };
    window._tmSyntheticElev = (gx14, gy14) => window._tmSyntheticElev15(gx14 * 2, gy14 * 2);
    appState.end = { lat: LAT, lng: LON, elev: 100 }; appState.endApiElev = 100; appState.endHeight = 0; document.getElementById('input-end-name').value = '海の検査';
    appState.refractionEnabled = false;
    const r = await _kmComputeTarget({ rangeKm: RANGE, zoom: Z, returnBits: true, quiet: true, force: true });
    delete window._tmSyntheticElev15; delete window._tmSyntheticElev;
    const d = r.done[0]; if (!d || !d.bits) return { errs: r.errs };
    const bit = (x, y) => { const i = y * G.W + x; const b = Math.floor(i / 8); return (d.bits[b] >> (7 - (i - b * 8))) & 1; };
    const col = x => [-2, -1, 0, 1, 2].map(j => bit(x, G.CY + j)).join('');
    return { a: col(xA), b: col(xB), seaBit: bit(G.CX + 10, G.CY), nodata: d.meta.grid.nodata, visible: d.meta.result.visible_px, data: d.meta.result.data_px, errs: r.errs };
  });
  check('D8 海は遮る: 東40kmの島は見える・東100kmの島は海面に遮られて見えない・海の画素は見える画素にならない・metaに印(nodata: sea-level-0m)',
    /1/.test(d8.a) && d8.b === '00000' && d8.seaBit === 0 && d8.nodata === 'sea-level-0m' && d8.errs.length === 0, JSON.stringify(d8));

  check('E ページエラーなし', errs.length===0, errs.join(' | '));
  await b.close();
  console.log(`\n${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('ERR', e); process.exit(1); });
