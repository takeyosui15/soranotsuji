// 第153ラウンド検証: v1.92.0 可視マップ段4「目的点で計算」「My目的点で計算」(その場計算=kashimap-worker.js。デッサン05 段4/Q20)
// ①静的な形: 版数ピン・ワーカーの関数・index.html(範囲の選択欄24/36/48・ボタン有効・ヘルプ)・ハーネスのFILES・道具のz14の書き込み範囲・UI文言に内輪文脈なし
// ②合成標高の火口(verify177 B7と同じ形。目的点=初期値の富士山=火口の中心・標高3776)を8km四方でその場計算:
//    帯オン=ほぼ全画素が見える(縁と急斜面は山頂部で無視・下の緩い斜面は見通しの下) / 帯オフ=火口の底と縁だけ。島・輪郭(自己検査)・meta。
//    答え合わせ=標本画素をアプリの統一可視判定(computePathVisibility)で判定して一致率
// ③結果の保存(origin=compute・列「動」・一覧に「計算」)・山リストに所属「My」種別「目的点」の行・選択と描画・「⬇」でFile出力・「✕」で行も消える
// ④「My目的点で計算」(2件を順に。山腹の点は山頂部なし・構造物の高さ)・中止・標高タイルが取れない時の安全弁
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
const wkSrc = fs.readFileSync(path.join(ROOT, 'kashimap-worker.js'), 'utf8');
const toolSrc = fs.readFileSync(path.join(ROOT, 'tools', 'kashimap', 'viewshed.js'), 'utf8');
const harnessSrc = fs.readFileSync(path.join(ROOT, 'tests', 'harness', 'sync-apptest.py'), 'utf8');

check('V0 版数(ピンはverify179へ移譲)+Version Historyに第153(段4)', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) && (src.includes('第153ラウンド — 可視マップの段4「目的点で計算」「My目的点で計算」') || !!process.argv[2]));
const kmHtml = idxSrc.slice(idxSrc.indexOf('id="sec-kashimap"'), idxSrc.indexOf('id="kashimap-store-total"'));
check('S1 index.html: 範囲の選択欄(24/36/48…)・「目的点で計算」「My目的点で計算」は有効・ヘルプ「その場で計算」・「準備中」の文言なし',
  /<select id="sel-kashimap-tgt-range"[^>]*>\s*<option value="24"( selected)?>24km[^<]*<\/option>\s*<option value="36">36km[^<]*<\/option>\s*<option value="48">48km[^<]*<\/option>/.test(idxSrc) &&   // 第154で24〜700の7つ(初期値60)=verify179
  /<input type="radio" name="kashimap-compute-target" id="radio-kashimap-tgt" value="tgt" checked>:目的点<\/label>/.test(idxSrc) && /<button id="btn-kashimap-compute" class="nav-btn main-btn" title="[^"]*">範囲を計算<\/button>/.test(idxSrc) &&   // 第156: 「:目的点」「:My目的点」ラジオ+「範囲を計算」
  idxSrc.includes('<li><strong>その場で計算 (「:目的点」「:My目的点」+「範囲を計算」)</strong>') && /範囲は「計算範囲リスト」の 24\/36\/48/.test(idxSrc) && !/準備中/.test(kmHtml) && !idxSrc.split('\n').some(l => /kashimap|可視マップ/.test(l) && /準備中/.test(l)));
check('S1b UI文言に内輪文脈(ラウンド番号)が無い', !/可視マップ[^<]*第1\d\dラウンド/.test(idxSrc) && !/kashimap[^\n]*第1\d\d/.test(idxSrc.replace(/<!--[\s\S]*?-->/g,'')) && !/第1\d\dラウンド|ラウンド/.test(wkSrc.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')));
check('S2 ワーカー: 窓・山頂部(アプリと同じ規則)・視域(R2)・島・輪郭・ポリライン符号・端末の店(tiles)・安全弁(上限枚数/失敗の連続)・z14は子タイル1枚分だけ書く',
  ['function windowGeom(', 'function summitBand(', 'function computeViewshed(', 'function labelIslands(', 'function extractRings(', 'function encodeIntPolyline(', "indexedDB.open('soranotsuji-kashimap')", 'MAX_NET_ERRORS', 'maxTiles', 'function decodeElevInto(grid, G, png, tx, ty, zt, clip)', "m.d <= 60 || (m.d <= 500 && (m.elev === null || m.elev === undefined || m.elev - hT <= 100))", 'bandMax > hT + (job.upM || 100)'].every(t => wkSrc.includes(t)) &&
  wkSrc.includes("self.postMessage({ type: 'done'") && wkSrc.includes("{ type: 'progress', phase, done, total, note }"));
check('S3 script.js: new Worker(kashimap-worker.js)・_kmComputeOne/_kmComputeTarget/_kmComputeMyTargets/_kmSyncPseudo/_kmPseudoRows・所属「My」・端末の索引に位置と標高・ハーネスのFILESにワーカー・道具のz14の書き込み範囲(clip)',
  ["new Worker('kashimap-worker.js')", 'async function _kmComputeOne(', 'async function _kmComputeTarget(', 'async function _kmComputeMyTargets(', 'function _kmSyncPseudo(', 'function _kmPseudoRows(', "'my': 'My'", 'lat: v.lat, lon: v.lon, elev: v.elev, height: v.height', 'const KM_TGT_RANGES = [24, 36, 48'].every(t => src.includes(t)) &&   // 第154で24〜700の7つ(verify179)
  harnessSrc.includes("'kashimap-worker.js'") && toolSrc.includes('function decodeElevInto(png, tx, ty, zt, clip)') && /decodeElevInto\(pngDecode\(buf\), (tx >> 1, ty >> 1, Z - 1|x, y, s\.z), clip\)/.test(toolSrc));   // 第154で源ごとの汎用の呼び出しに

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html?kashimap=1',{waitUntil:'load'});   // 可視マップは封鎖中(第158)。開錠して検査
  await p.waitForFunction(()=>typeof runKashimapSearch==='function' && typeof _kmComputeTarget==='function' && typeof glMap!=='undefined' && glMap && glMap.getLayer && !!glMap.getLayer('km-fill'),{timeout:15000});
  await p.evaluate(async ()=>{ window.confirm=()=>true; window.alert=(m)=>{ (window._alerts = window._alerts || []).push(String(m)); }; try { await _kmStoreClear(); await _kmTilesClear(); await _kmLoadDeviceIndex(); } catch (e) {} });

  // 合成標高の火口(verify177 B7と同じ): 火口の底3550(d≤90px)・縁3776(d≤106px)・上部は急(0.25/px)・下部は緩(0.13/px)。目的点=初期値の富士山(火口の中心)
  await p.evaluate(() => {
    const scale15 = Math.pow(2, 15), R128 = 128 / Math.PI;
    const END = { lat: DEFAULT_END.lat, lng: DEFAULT_END.lng };
    const cx = Math.floor(128 * (END.lng / 180 + 1) * scale15), cy = Math.floor((128 - R128 * Math.atanh(Math.sin(END.lat * Math.PI / 180))) * scale15);
    window._crater = { cx, cy, END };
    window._tmSyntheticElev15 = (gx, gy) => { const d = Math.hypot(gx - cx, gy - cy); if (d <= 90) return 3550; if (d <= 106) return 3776; if (d <= 400) return 3776 - 0.25 * (d - 106); return Math.max(0, 3702.5 - 0.13 * (d - 400)); };
    window._tmSyntheticElev = (gx14, gy14) => window._tmSyntheticElev15(gx14 * 2, gy14 * 2);
    appState.end = { lat: END.lat, lng: END.lng, elev: 3776 }; appState.endApiElev = 3776; appState.endHeight = 0;
    document.getElementById('input-end-name').value = 'テスト富士';
    appState.elevExcludeEnabled = true; appState.elevExcludeRadius = 15; appState.elevExcludeObsRadius = 10; appState.elevSummitBandEnabled = true; appState.elevSummitBandM = 300; _sbCache.clear();
  });

  // D1: 帯オン・8km四方
  const d1 = await p.evaluate(async () => {
    const t0 = performance.now();
    const r = await _kmComputeTarget({ rangeKm: 8, returnBits: true });
    const ms = Math.round(performance.now() - t0);
    const d = r && r.done && r.done[0]; if (!d) return { r, ms, alerts: window._alerts };
    const meta = d.meta; const G = _kmWindow(_crater.END.lat, _crater.END.lng, 8);
    const rec = await _kmStoreGet(d.key);
    // 答え合わせ: 標本画素をアプリの統一可視判定で(観測者=地上1.5m・目的点=3776)
    const scale15 = Math.pow(2, 15);
    const toLL = (gx, gy) => ({ lng: (gx + 0.5) / scale15 / 128 * 180 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * (gy + 0.5) / (256 * scale15)))) * 180 / Math.PI });
    let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    let agree = 0, n = 0, bitVis = 0;
    _sbCache.clear();
    for (let i = 0; i < 120; i++) {
      const x = Math.floor(rnd() * G.W), y = Math.floor(rnd() * G.H); const dPx = Math.hypot(x - G.CX, y - G.CY); if (dPx * G.MPP < 30) continue;
      const bi = y * G.W + x; const vis = ((d.bits[bi >> 3] >> (7 - (bi & 7))) & 1) === 1;
      const ll = toLL(G.X0 + x, G.Y0 + y); const e = window._tmSyntheticElev15(G.X0 + x, G.Y0 + y);
      const app = await computePathVisibility(ll.lat, ll.lng, e + 1.5, _crater.END.lat, _crater.END.lng, 3776, 3776);
      n++; if (app.visible === vis) agree++; if (vis) bitVis++;
    }
    const info = _kmIndexInfo(d.id);
    const tr = document.querySelector(`#kashimap-content tr[data-id="${d.id}"]`);
    const feats = glMap.getSource('km-islands')._data.features;
    const storeRow = Array.from(document.querySelectorAll('#kashimap-store-table tbody tr')).find(t => t.dataset.key === d.key);
    return { ms, id: d.id, key: d.key, name: rec && rec.name, origin: rec && rec.origin, lat: rec && rec.lat, lon: rec && rec.lon, elevRec: rec && rec.elev, W: G.W, H: G.H,
      visible: meta.result.visible_px, data: meta.result.data_px, islands: meta.result.islands, outlineN: rec && rec.outlineObj.islands.length, holes: meta.outline.holes, verts: meta.outline.vertices,
      mode: meta.summit_mode, basis: meta.summit_area.summit_elev_basis_m, dem: meta.summit_area.summit_elev_dem_m, drop: meta.summit_area.drop_m, others: meta.summit_area.other_peaks_in_search, total: meta.summit_area.target_total_m, k: meta.k, reff: meta.reff_m, tool: meta.tool, synthetic: /synthetic/.test(meta.dem.sources),
      agree, n, bitVis, label: info && info.label, infoIslands: info && info.islands, rowText: tr && tr.textContent, checked: tr && tr.querySelector('input.kashimap-check').checked, feats: feats.length, featMid: feats.length ? feats[0].properties.mid : null,
      markers: document.querySelectorAll('.kashimap-summit').length, storeRow: storeRow && (storeRow.querySelector('.kashimap-store-name').value + storeRow.nextElementSibling.textContent), storeTitle: storeRow && storeRow.querySelector('.kashimap-store-name').title, status: document.getElementById('kashimap-status').textContent, busy: _kmComputeBusy, btn: document.getElementById('btn-kashimap-compute').textContent,
      selDisabled: document.getElementById('sel-kashimap-tgt-range').disabled, alerts: window._alerts || [] };
  });
  check('D1 目的点で計算(火口の中心・標高3776・帯オン・8km四方): ほぼ全画素が見える・島は少数・輪郭の自己検査OK・meta(基準3776/DEM3550/帯300/目的点の高さ3776/合成標高)・アプリの判定との一致97%以上・保存(origin=compute・列「動」)・山リストに「My」「目的点」の行(選択済み)・地図に描画・山頂マーカー・一覧に「計算」・UIが戻る',
    d1.visible !== undefined && d1.data === d1.W * d1.H && d1.visible >= 0.99 * (d1.W * d1.H - 1) && d1.islands >= 1 && d1.islands <= 5 && d1.outlineN === d1.islands && d1.verts > 0 &&
    d1.mode === 'region' && d1.basis === 3776 && d1.dem === 3550 && d1.drop === 300 && Array.isArray(d1.others) && d1.others.length === 0 && d1.total === 3776 && d1.synthetic && d1.tool === 'kashimap-worker.js' && d1.reff > 6371000 &&
    d1.n >= 100 && d1.agree >= 0.97 * d1.n && d1.id === 'tgt:35.362799,138.730781' && d1.key === d1.id + '/terrain/8' && d1.name === 'テスト富士' && d1.origin === 'compute' && Math.abs(d1.lat - 35.3627986) < 1e-5 && d1.elevRec === 3776 &&
    d1.label === '動' && d1.infoIslands === d1.islands && d1.rowText && /テスト富士/.test(d1.rowText) && /My/.test(d1.rowText) && /目的点/.test(d1.rowText) && d1.checked === true && d1.feats >= 1 && d1.featMid === d1.id && d1.markers >= 1 &&
    d1.storeRow && /テスト富士/.test(d1.storeRow) && /8km/.test(d1.storeRow) && /計算の資産/.test(d1.storeTitle) && d1.busy === false && d1.btn === '範囲を計算' && d1.selDisabled === false && !/計算中/.test(d1.status) && d1.alerts.length === 0, JSON.stringify(d1));

  // D2: 帯オフ(山頂部オフ)→火口の底と縁だけが見える。同じ鍵に上書き保存。答え合わせ(底・縁の標本も)
  const d2 = await p.evaluate(async () => {
    appState.elevSummitBandEnabled = false; _sbCache.clear();
    const r = await _kmComputeTarget({ rangeKm: 8, returnBits: true, force: true });   // 第156: 同じ範囲の資産があるので force で計算し直す
    appState.elevSummitBandEnabled = true; _sbCache.clear();
    const d = r && r.done && r.done[0]; if (!d) return { r };
    const meta = d.meta; const G = _kmWindow(_crater.END.lat, _crater.END.lng, 8);
    const scale15 = Math.pow(2, 15);
    const toLL = (gx, gy) => ({ lng: (gx + 0.5) / scale15 / 128 * 180 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * (gy + 0.5) / (256 * scale15)))) * 180 / Math.PI });
    let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    let agree = 0, n = 0, floorVis = 0, floorN = 0;
    appState.elevSummitBandEnabled = false; _sbCache.clear();
    const samples = [];
    for (let i = 0; i < 90; i++) samples.push([Math.floor(rnd() * G.W), Math.floor(rnd() * G.H)]);
    for (let i = 0; i < 40; i++) { const a = rnd() * 2 * Math.PI, rr = 20 + rnd() * 84; samples.push([Math.round(G.CX + rr * Math.cos(a)), Math.round(G.CY + rr * Math.sin(a))]); }   // 底(d≤90)と縁(≤106)
    for (const [x, y] of samples) {
      const dPx = Math.hypot(x - G.CX, y - G.CY); if (dPx * G.MPP < 30) continue;
      const bi = y * G.W + x; const vis = ((d.bits[bi >> 3] >> (7 - (bi & 7))) & 1) === 1;
      const ll = toLL(G.X0 + x, G.Y0 + y); const e = window._tmSyntheticElev15(G.X0 + x, G.Y0 + y);
      const app = await computePathVisibility(ll.lat, ll.lng, e + 1.5, _crater.END.lat, _crater.END.lng, 3776, 3776);
      n++; if (app.visible === vis) agree++; if (dPx <= 104) { floorN++; if (vis) floorVis++; }
    }
    appState.elevSummitBandEnabled = true; _sbCache.clear();
    const nDev = Array.from(_kmDeviceIndex.values()).filter(v => v.id === d.id).length;
    return { visible: meta.result.visible_px, W: G.W, H: G.H, islands: meta.result.islands, mode: meta.summit_mode, drop: meta.summit_area.drop_m, reason: meta.summit_area.none_reason, exclHow: meta.excl_target_how, agree, n, floorVis, floorN, nDev, key: d.key };
  });
  check('D2 帯オフ→火口の底と縁だけが見える(全体の5%未満・2万画素以上)・meta(summit_mode=off・帯0)・底と縁の標本は全部見える・アプリの判定との一致97%以上・同じ鍵に上書き(端末の索引は1件のまま)',
    d2.visible !== undefined && d2.visible > 20000 && d2.visible < 0.05 * d2.W * d2.H && d2.islands >= 1 && d2.mode === 'off' && d2.drop === 0 && /山頂部オフ/.test(d2.reason) && /半径15mの円/.test(d2.exclHow) && d2.n >= 100 && d2.agree >= 0.97 * d2.n && d2.floorN >= 30 && d2.floorVis === d2.floorN && d2.nDev === 1, JSON.stringify(d2));

  // D3: 「⬇」でその資産だけをFile出力(id=tgt:…)
  const d3 = await p.evaluate(async () => {
    window.downloadTextFile = (n, t) => { window._dl = { n, t }; };
    const row = Array.from(document.querySelectorAll('#kashimap-store-table tbody tr')).find(t => t.dataset.key === 'tgt:35.362799,138.730781/terrain/8');
    const c = row.querySelector('.kashimap-store-check'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('btn-kashimap-store-dl').click();
    for (let i = 0; i < 50 && !window._dl; i++) await new Promise(r => setTimeout(r, 100));
    const o = window._dl ? JSON.parse(window._dl.t) : null;
    return { n: window._dl && window._dl.n, format: o && o.format, id: o && o.assets[0].meta.mountain.id, name: o && o.assets[0].meta.mountain.name, outlineN: o && o.assets[0].outline.islands.length, islandsN: o && o.assets[0].islands.count, v: o && o.assets[0].outline.v };
  });
  check('D3 チェック+「⬇DL」でその場計算の資産をFile出力(format/資産のid=tgt:…/山名/輪郭と索引の数が揃う/outline v2)', d3.n && /テスト富士8km/.test(d3.n) && d3.format === 'soranotsuji-kashimap-assets' && d3.id === 'tgt:35.362799,138.730781' && d3.name === 'テスト富士' && d3.outlineN === d3.islandsN && d3.v === 2, JSON.stringify(d3));

  // D4: 「My目的点で計算」(今のMyセットのMy目的点2件を順に・4km四方): 山腹の点=山頂部なし(別の山「富士山」の山腹) / 構造物の高さ100m
  const d4 = await p.evaluate(async () => {
    const END = _crater.END;
    // My山A=北2.2kmの山腹(標高は未設定=DEMを基準) / My塔B=東1.8kmの山腹に高さ100mの構造物(標高3694≒DEM)。8km四方(探索半径3kmの中に剣ヶ峯が入る)
    appState.myTargets = [ { id: 'tgt-1', name: 'My山A', lat: END.lat + 0.02, lng: END.lng, elev: null, height: 0, memo: '' }, { id: 'tgt-2', name: 'My塔B', lat: END.lat, lng: END.lng + 0.02, elev: 3694, height: 100, memo: '' } ];
    const r = await _kmComputeMyTargets({ rangeKm: 8, quiet: true });
    for (let i = 0; i < 100 && _kmShown.size < 3; i++) await new Promise(res => setTimeout(res, 100));
    const rows = Array.from(document.querySelectorAll('#kashimap-content tr.td-data-row')).filter(t => t.dataset.id.startsWith('tgt:')).map(t => t.textContent.replace(/\s+/g, ' '));
    const trA = Array.from(document.querySelectorAll('#kashimap-content tr.td-data-row')).find(t => /My山A/.test(t.textContent)); const aRowElev = trA ? trA.children[9].textContent : null;
    const a = r.done.find(d => d.meta.mountain.name === 'My山A'), bb = r.done.find(d => d.meta.mountain.name === 'My塔B');
    const sel = Array.from(_kmSelected.keys()).filter(k => k.startsWith('tgt:'));
    return { n: r.done.length, errs: r.errs, cancelled: r.cancelled, rows: rows.length, rowsText: rows.join(' | ').slice(0, 300),
      aMode: a && a.meta.summit_mode, aReason: a && a.meta.summit_area.none_reason, aVis: a && a.meta.result.visible_px, aBasis: a && a.meta.summit_area.summit_elev_basis_m, aElev: a && a.meta.mountain.elev_list, aTotal: a && a.meta.summit_area.target_total_m,
      bHeight: bb && bb.meta.mountain.height_m, bTotal: bb && bb.meta.summit_area.target_total_m, bBasis: bb && bb.meta.summit_area.summit_elev_basis_m, bMode: bb && bb.meta.summit_mode, bReason: bb && bb.meta.summit_area.none_reason, bVis: bb && bb.meta.result.visible_px, shown: _kmShown.size, aRowElev,
      nDev: _kmDeviceIndex.size, sel: sel.length, feats: glMap.getSource('km-islands')._data.features.length, status: document.getElementById('kashimap-status').textContent, busy: _kmComputeBusy, btn: document.getElementById('btn-kashimap-compute').textContent };
  });
  check('D4 My目的点で計算(2件・8km四方): 2件とも保存・山リストに「My」の行が3つ(富士+2)・山腹の点は山頂部なし(別の山「富士山」の山腹)・標高なしはDEMが基準と目的点の高さ・構造物は標高+高さ=目的点の高さ(3694+100)で基準はDEM(3694.1)・3つとも選択され地図に描画・UIが戻る',
    d4.n === 2 && d4.errs.length === 0 && d4.cancelled === false && d4.rows === 3 && d4.aMode === 'none' && /別の山「富士山」/.test(d4.aReason) && d4.aVis > 0 && d4.aElev === null && d4.aRowElev === '' && Math.abs(d4.aBasis - 3680.3) < 0.2 && d4.aTotal === d4.aBasis &&
    d4.bHeight === 100 && d4.bTotal === 3794 && Math.abs(d4.bBasis - 3694.1) < 0.2 && d4.bMode === 'none' && /別の山「富士山」/.test(d4.bReason) && d4.bVis > 0 && d4.nDev === 3 && d4.sel === 3 && d4.shown === 3 && d4.feats >= 3 && d4.busy === false && d4.btn === '範囲を計算' && !/計算中/.test(d4.status), JSON.stringify(d4));

  // D5: 中止(呼んだ直後に中止→何も保存しない・UIが戻る)/ 標高タイルが取れない時(合成標高なし・ネット遮断)は安全弁で失敗を知らせる
  const d5 = await p.evaluate(async () => {
    const before = _kmDeviceIndex.size;
    const pr = _kmComputeTarget({ rangeKm: 8, quiet: true, force: true }); _kmComputeCancel();
    const r = await pr;
    const st1 = { busy: _kmComputeBusy, btn: document.getElementById('btn-kashimap-compute').textContent, n: r ? r.done.length : null, cancelled: r && r.cancelled, size: _kmDeviceIndex.size - before };
    delete window._tmSyntheticElev15; delete window._tmSyntheticElev;
    const t0 = performance.now();
    const r2 = await _kmComputeTarget({ rangeKm: 24, quiet: true });
    const ms = Math.round(performance.now() - t0);
    const tiles = await _kmTilesSize();
    return { st1, n2: r2.done.length, errs2: r2.errs, ms, busy: _kmComputeBusy, size2: _kmDeviceIndex.size - before, tiles };
  });
  check('D5 中止→保存なし・UIが戻る / 標高タイルが取れない(遮断)→失敗の連続で中止して知らせる(保存なし・店は0)', d5.st1.busy === false && d5.st1.btn === '範囲を計算' && d5.st1.n === 0 && d5.st1.cancelled === true && d5.st1.size === 0 && d5.n2 === 0 && d5.errs2.length === 1 && /失敗が続く|取得に失敗|中止/.test(d5.errs2[0]) && d5.busy === false && d5.size2 === 0 && d5.tiles === 0, JSON.stringify(d5));

  // D6: 「✕」でその場計算の資産を削除→山リストの行・選択・描画も消える(残り2件)
  const d6 = await p.evaluate(async () => {
    const key = 'tgt:35.362799,138.730781/terrain/8';
    document.querySelectorAll('#kashimap-store-table .kashimap-store-check').forEach(c => { c.checked = c.closest('tr').dataset.key === key; c.dispatchEvent(new Event('change', { bubbles: true })); });
    document.getElementById('btn-kashimap-store-del').click();
    for (let i = 0; i < 100 && _kmDeviceIndex.has(key); i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 300));
    for (let i = 0; i < 50 && document.querySelector('#kashimap-content tr[data-id="tgt:35.362799,138.730781"]'); i++) await new Promise(r => setTimeout(r, 100));
    return { has: _kmDeviceIndex.has(key), byId: _kmById.has('tgt:35.362799,138.730781'), row: !!document.querySelector('#kashimap-content tr[data-id="tgt:35.362799,138.730781"]'), sel: _kmSelected.has('tgt:35.362799,138.730781'),
      rows: document.querySelectorAll('#kashimap-content tr.td-data-row[data-id^="tgt:"]').length, nDev: _kmDeviceIndex.size, storeRows: document.querySelectorAll('#kashimap-store-table tr.km-store-row').length };
  });
  check('D6 チェック+「削除」で削除→端末の索引・擬似の山・山リストの行・選択から消える(残り2件)', d6.has === false && d6.byId === false && d6.row === false && d6.sel === false && d6.rows === 2 && d6.nDev === 2 && d6.storeRows === 2, JSON.stringify(d6));

  check('E ページエラーなし', errs.length===0, errs.join(' | '));
  await b.close();
  console.log(`\n${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('ERR', e); process.exit(1); });
