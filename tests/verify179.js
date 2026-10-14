// 第154ラウンド検証: v1.93.0 その場計算の直し(画素ごとの穴埋め・再試行・目的点に近い順)・計算範囲リスト24〜700km(解像度の段)・経過表示・可視マップ節の整列・「:樹冠・構造物あり」
// ①静的な形: 版数ピン・選択欄(7つ・初期値60)・段組み(範囲ラジオ2段→検索→2つのボタンを1段→計算範囲リスト→チェック2段)・文言・ワーカー/script.js/道具の要点
// ②整列: 可視マップ節のチェックの文言が折り返さない(1行の高さ)・2つのボタンが同じ段・ラジオが2段
// ③解像度の段(合成標高・8km四方をz13で): meta/outlineのzoom=13・結果は妥当・経過表示が届き終わると消える・資産はz13の輪郭で描ける
// ④標高タイル(地理院のURLをテスト内で合成PNGに差し替え): 1枚の中の無効画素を次の源(dem_png z14)で埋める=データ画素100%・5Aの1枚目が503でも再試行で取れる・
//    404(5B/5C)も店に残る・2回目は店から(取得0)・「標高タイルを削除」で0
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
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
const wkSrc = fs.readFileSync(path.join(ROOT, 'kashimap-worker.js'), 'utf8');
const toolSrc = fs.readFileSync(path.join(ROOT, 'tools', 'kashimap', 'viewshed.js'), 'utf8');

check('V0 版数(ピンはverify180へ移譲)+Version Historyに第154', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) && (src.includes('第154ラウンド — その場計算の「タイルの継ぎ目の模様」の直し') || !!process.argv[2]));
const kmHtml = idxSrc.slice(idxSrc.indexOf('id="sec-kashimap"'), idxSrc.indexOf('data-arg="sec-soramado"'));   // 可視マップ節の全体(次の節の見出しまで)
const opts = [...kmHtml.matchAll(/<option value="(\d+)"( selected)?>(\d+)km \(1画素≈(\d+)m\)<\/option>/g)].map(m => [m[1], !!m[2], m[4]]);
check('S1 index.html: 計算範囲リスト=24/36/48/60/100/300/500/700(第155: 初期値24・500を追加・解像度4/4/4/4/8/30/30/60m)・段組み(ラジオ→樹冠/構造物→検索→「目的点で計算」「My目的点で計算」1段→計算範囲リスト→チェック)・km-label・「:樹冠」「:構造物」(節とコントロール)・下のボタンは1段ずつ・ヘルプ',
  opts.map(o => o[0]).join(',') === '24,36,48,60,100,300,700' && opts.filter(o => o[1]).map(o => o[0]).join() === '24' && opts.map(o => o[2]).join(',') === '4,4,4,4,8,30,60' &&   // 第156: 500を外した
  kmHtml.indexOf('name="kashimap-range-menu" value="100"') < kmHtml.indexOf('id="btn-kashimap-search"') && kmHtml.indexOf('id="btn-kashimap-search"') < kmHtml.indexOf('id="radio-kashimap-tgt"') &&
  /<input type="radio" name="kashimap-compute-target" id="radio-kashimap-tgt" value="tgt" checked>:目的点<\/label>\s*<label class="baseopt-radio"[^>]*><input type="radio" name="kashimap-compute-target" id="radio-kashimap-mytgt" value="mytgt">:My目的点<\/label>/.test(kmHtml) &&   // 第156: ラジオ2つが1段→計算範囲リスト→精細→「範囲を計算」
  kmHtml.indexOf('id="radio-kashimap-mytgt"') < kmHtml.indexOf('計算範囲リスト:') && kmHtml.indexOf('id="sel-kashimap-tgt-range"') < kmHtml.indexOf('id="btn-kashimap-compute"') && kmHtml.indexOf('id="btn-kashimap-compute"') < kmHtml.indexOf('id="chk-kashimap-menu-tiles"') &&
  (kmHtml.match(/class="km-label"/g) || []).length >= 9 && (idxSrc.match(/>:樹冠</g) || []).length >= 2 && (idxSrc.match(/>:構造物</g) || []).length >= 2 && !/>:樹冠あり<|>:樹冠・構造物あり</.test(idxSrc) &&
  /<div class="control-row">\s*<button id="btn-kashimap-tiles-clear" class="nav-btn main-btn"/.test(kmHtml) &&   // 第156: 横幅いっぱい
  idxSrc.includes('範囲は「計算範囲リスト」の 24/36/48/60/100/300/700km四方') && idxSrc.includes('薄い金の経過表示') && cssSrc.includes('.km-label { white-space: nowrap;'));
check('S1b UI文言に内輪文脈(ラウンド番号)が無い', !/可視マップ[^<]*第1\d\dラウンド/.test(idxSrc) && !/kashimap[^\n]*第1\d\d/.test(idxSrc.replace(/<!--[\s\S]*?-->/g,'')) && !/ラウンド/.test(wkSrc.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')));
check('S2 ワーカー: 源はズームごと(sourcesFor)・画素ごとの穴埋め(holes)・再試行3回・priority low・近い順・経過表示(preview)・窓はズーム付き / script.js: _kmZoomForRange(60→15/100→14/300→12/700→11)・経過表示の描画と消去・範囲7つ・上限4000 / 道具: SOURCES・穴埋め・filled_from_next',
  ['function sourcesFor(Z)', 'FETCH_RETRIES = 3', "priority: 'low'", 'if (holes(clip) === 0) break;', 'st.filled++', 'jobs.sort(', "type: 'preview'", 'function windowGeom(lat, lon, rangeKm, Z)', 'filled_from_next: st.filled'].every(t => wkSrc.includes(t)) &&
  ['function _kmZoomForRange(rangeKm, fine, finest) {', 'function _kmPreviewDraw(m)', 'function _kmPreviewClear()', 'const KM_TGT_RANGES = [24, 36, 48, 60, 100, 300, 700];', 'const KM_TGT_MAX_TILES = 9500;', "else if (m.type === 'preview') _kmPreviewDraw(m);"].every(t => src.includes(t)) &&   // 第155: 精細(fine) / 第156: 500を外す・上限9500・最高精細(finest)
  ['const SOURCES = Z >= 15', 'if (holes() === 0) break;', 'filled_from_next: stats.filled'].every(t => toolSrc.includes(t)));

// ---- 合成の標高PNG(地理院の符号: x=2^16R+2^8G+B。無効=128,0,0) ----
function pngEncodeRGB(w, h, rgb) {
  const stride = w * 3; const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const crcTable = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); crcTable[n] = c; }
  const crc = b => { let c = -1; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, body) => { const len = Buffer.alloc(4); len.writeUInt32BE(body.length); const tb = Buffer.concat([Buffer.from(type, 'ascii'), body]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(tb)); return Buffer.concat([len, tb, cc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
// D2の合成標高(z15の画素で定義): 緩い円錐(頂上1200m・0.02m/px)。中心=35.0,139.6(山リストの山が3km内に無い場所)
const D2 = { lat: 35.0, lng: 139.6 };
const scale15 = Math.pow(2, 15), WORLD15 = 256 * scale15;
const d2cx = Math.floor((D2.lng + 180) / 360 * WORLD15), d2cy = Math.floor((1 - Math.log(Math.tan(D2.lat * Math.PI / 180) + 1 / Math.cos(D2.lat * Math.PI / 180)) / Math.PI) / 2 * WORLD15);
const f15 = (gx, gy) => 1200 - 0.02 * Math.hypot(gx - d2cx, gy - d2cy);
const holed = (x, y) => (x + y) % 3 === 0;   // この5Aタイルは左上の1/4が無効
function tilePng(z, x, y, withHole) {
  const rgb = Buffer.alloc(256 * 256 * 3); const f = Math.pow(2, 15 - z);
  for (let py = 0; py < 256; py++) for (let px = 0; px < 256; px++) {
    const o = (py * 256 + px) * 3;
    if (withHole && px < 128 && py < 128) { rgb[o] = 128; rgb[o + 1] = 0; rgb[o + 2] = 0; continue; }
    const h = f15((x * 256 + px) * f, (y * 256 + py) * f); let v = Math.round(h * 100); if (v < 0) v += 16777216;
    rgb[o] = (v >> 16) & 255; rgb[o + 1] = (v >> 8) & 255; rgb[o + 2] = v & 255;
  }
  return pngEncodeRGB(256, 256, rgb);
}

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  const served = { a: new Set(), aHole: new Set(), n404: 0, z14: new Set(), err503: 0, other: 0, map: 0 };
  let flaky = null;   // 最初に来た5Aの1枚は1回だけ503(再試行で取れることの確認)
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(BASE)) return route.continue();
    const m = u.match(/cyberjapandata\.gsi\.go\.jp\/xyz\/(\w+)\/(\d+)\/(\d+)\/(\d+)\.png/);
    if (!m) return route.abort();
    const kind = m[1], z = +m[2], x = +m[3], y = +m[4];
    if (kind === 'dem5a_png' && z === 15) {
      if (flaky === null) { flaky = `${x}/${y}`; served.err503++; return route.fulfill({ status: 503, body: 'busy' }); }
      const hole = holed(x, y); served.a.add(`${x}/${y}`); if (hole) served.aHole.add(`${x}/${y}`);
      return route.fulfill({ status: 200, contentType: 'image/png', body: tilePng(15, x, y, hole), headers: { 'access-control-allow-origin': '*' } });
    }
    if ((kind === 'dem5b_png' || kind === 'dem5c_png') && z === 15) { served.n404++; return route.fulfill({ status: 404, body: '' }); }
    if (kind === 'dem_png' && z === 14) { served.z14.add(`${x}/${y}`); return route.fulfill({ status: 200, contentType: 'image/png', body: tilePng(14, x, y, false), headers: { 'access-control-allow-origin': '*' } }); }
    if (/dem/.test(kind)) served.other++; else served.map++;   // 地図タイル(std等)は数えない
    return route.fulfill({ status: 404, body: '' });
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html?kashimap=1',{waitUntil:'load'});   // 可視マップは封鎖中(第158)。開錠して検査
  await p.waitForFunction(()=>typeof runKashimapSearch==='function' && typeof _kmComputeTarget==='function' && typeof glMap!=='undefined' && glMap && glMap.getLayer && !!glMap.getLayer('km-fill'),{timeout:15000});
  await p.evaluate(async ()=>{ window.confirm=()=>true; window.alert=(m)=>{ (window._alerts = window._alerts || []).push(String(m)); }; try { await _kmStoreClear(); await _kmTilesClear(); await _kmLoadDeviceIndex(); } catch (e) {} });

  // U1: 整列(可視マップ節を開いて測る): チェックの文言は1行・2つのボタンは同じ段・ラジオは2段・選択欄は7つで60
  const u1 = await p.evaluate(() => {
    const panel = document.getElementById('control-panel'); if (panel) panel.classList.remove('minimized');
    const sec = document.getElementById('sec-kashimap'); if (sec.classList.contains('closed')) toggleSection('sec-kashimap');
    const secR = sec.getBoundingClientRect();
    const labels = Array.from(sec.querySelectorAll('label.km-label')).map(l => { const r = l.getBoundingClientRect(); return { t: l.textContent, h: Math.round(r.height), over: r.right > secR.right + 1 }; });
    const t1 = document.querySelector('label[for]') && document.getElementById('radio-kashimap-tgt').closest('label').getBoundingClientRect(), t2 = document.getElementById('radio-kashimap-mytgt').closest('label').getBoundingClientRect();   // 第156: 「:目的点」「:My目的点」ラジオが同じ段
    const radios = Array.from(sec.querySelectorAll('input[name="kashimap-range-menu"]')).map(r => Math.round(r.getBoundingClientRect().top));
    const sel = document.getElementById('sel-kashimap-tgt-range');
    const selR = sel.getBoundingClientRect();
    const cb = document.getElementById('btn-kashimap-compute').getBoundingClientRect();
    return { labels, sameRow: Math.abs(t1.top - t2.top) < 2 && t2.left > t1.right, btnW: [Math.round(cb.width), Math.round(secR.width)], radioRows: new Set(radios).size, nOpt: sel.options.length, val: sel.value, selOver: selR.right > secR.right + 1,
      canopyMenu: document.querySelector('label[for="chk-kashimap-menu-canopy"]').textContent, canopyCtrl: document.querySelector('label[for="chk-kashimap-canopy"]').textContent };
  });
  check('U1 整列: km-labelは全て1行(高さ24px以下)で節からはみ出さない / 「:目的点」「:My目的点」は同じ段・「範囲を計算」は横幅いっぱい(第156) / 範囲ラジオは1段(第155: 3つ) / 計算範囲リストは7つ(第156: 500なし)・初期値24・はみ出さない / 樹冠の文言(節とコントロール)',
    u1.labels.length >= 9 && u1.labels.every(l => l.h <= 24 && !l.over) && u1.sameRow && u1.btnW[0] >= 0.9 * u1.btnW[1] && u1.radioRows === 1 && u1.nOpt === 7 && u1.val === '24' && !u1.selOver && u1.canopyMenu === ':樹冠' && u1.canopyCtrl === ':樹冠', JSON.stringify(u1));

  // D1: 解像度の段(合成標高の火口=verify178と同じ。目的点=初期値の富士山)を8km四方・z13で計算。経過表示が届き、終わると消える。資産はz13の輪郭で描ける
  const d1 = await p.evaluate(async () => {
    const R128 = 128 / Math.PI, s15 = Math.pow(2, 15);
    const END = { lat: DEFAULT_END.lat, lng: DEFAULT_END.lng };
    const cx = Math.floor(128 * (END.lng / 180 + 1) * s15), cy = Math.floor((128 - R128 * Math.atanh(Math.sin(END.lat * Math.PI / 180))) * s15);
    window._tmSyntheticElev15 = (gx, gy) => { const d = Math.hypot(gx - cx, gy - cy); if (d <= 90) return 3550; if (d <= 106) return 3776; if (d <= 400) return 3776 - 0.25 * (d - 106); return Math.max(0, 3702.5 - 0.13 * (d - 400)); };
    window._tmSyntheticElev = (gx14, gy14) => window._tmSyntheticElev15(gx14 * 2, gy14 * 2);
    appState.end = { lat: END.lat, lng: END.lng, elev: 3776 }; appState.endApiElev = 3776; appState.endHeight = 0;
    document.getElementById('input-end-name').value = 'ズーム13の富士';
    appState.elevExcludeEnabled = true; appState.elevExcludeRadius = 15; appState.elevExcludeObsRadius = 10; appState.elevSummitBandEnabled = true; appState.elevSummitBandM = 300; _sbCache.clear();
    const n0 = _kmPreviewN;
    let layerSeen = false; const origDraw = _kmPreviewDraw;
    window._kmPreviewDraw = (m) => { origDraw(m); if (glMap.getLayer('km-preview-layer') && glMap.getSource('km-preview')) layerSeen = true; };
    const t0 = performance.now();
    const r = await _kmComputeTarget({ rangeKm: 8, zoom: 13 });
    window._kmPreviewDraw = origDraw;
    const ms = Math.round(performance.now() - t0);
    const d = r && r.done && r.done[0]; if (!d) return { r, ms };
    const m = d.meta; const G = _kmWindow(END.lat, END.lng, 8, 13);
    const a = await _kmLoadAsset(d.id, 'terrain', 8);
    const c0 = a.polys.length ? a.polys[0].coords[0][0] : null;
    for (let i = 0; i < 50 && _kmShown.size < 1; i++) await new Promise(res => setTimeout(res, 100));
    delete window._tmSyntheticElev15; delete window._tmSyntheticElev;
    return { ms, zoom: m.zoom, gridZoom: m.grid.zoom, W: G.W, mW: m.grid.w, mpp: m.grid.mpp_center, visible: m.result.visible_px, islands: m.result.islands, basis: m.summit_area.summit_elev_basis_m, dem: m.summit_area.summit_elev_dem_m, drop: m.summit_area.drop_m,
      previews: _kmPreviewN - n0, layerSeen, layerAfter: !!glMap.getLayer('km-preview-layer'), srcAfter: !!glMap.getSource('km-preview'), olZoom: a.zoom, polyN: a.polys.length, c0, range: _kmDeviceIndex.get(d.key) && _kmDeviceIndex.get(d.key).range, label: (_kmIndexInfo(d.id) || {}).label, feats: glMap.getSource('km-islands')._data.features.length, alerts: window._alerts || [] };
  });
  check('D1 解像度の段: 8km四方をz13で計算→窓≈513画素・1画素≈15.7m・meta/grid/outlineのzoom=13・火口の中心の基準3776/DEM3550/帯300・ほぼ全画素が見える・経過表示が届き(1回以上)終わると層とソースが消える・資産はz13の輪郭で復号され目的点の近くに描ける',
    d1.zoom === 13 && d1.gridZoom === 13 && d1.olZoom === 13 && d1.mW === d1.W && d1.W >= 500 && d1.W <= 530 && d1.mpp > 15 && d1.mpp < 16.5 && d1.visible >= 0.99 * (d1.W * d1.W - 1) && d1.islands >= 1 && d1.basis === 3776 && d1.dem === 3550 && d1.drop === 300 &&
    d1.previews >= 1 && d1.layerSeen && !d1.layerAfter && !d1.srcAfter && d1.polyN >= 1 && d1.c0 && Math.abs(d1.c0[0] - 138.7308) < 0.06 && Math.abs(d1.c0[1] - 35.3628) < 0.05 && d1.range === 8 && d1.label === '動' && d1.feats >= 1 && d1.alerts.length === 0, JSON.stringify(d1));

  // D2: 標高タイルの取得(合成PNG): 2km四方・z15。(x+y)%3==0 の5Aは左上1/4が無効→dem_png(z14)で埋まる。最初の5Aは1回503→再試行。2回目は店から
  const d2 = await p.evaluate(async ([lat, lng]) => {
    appState.end = { lat, lng, elev: 1200 }; appState.endApiElev = 1200; appState.endHeight = 0;
    document.getElementById('input-end-name').value = '合成タイルの丘';
    const r = await _kmComputeTarget({ rangeKm: 2 });
    const d = r && r.done && r.done[0]; if (!d) return { r, alerts: window._alerts };
    const G = _kmWindow(lat, lng, 2, 15);
    const size1 = await _kmTilesSize();
    const r2 = await _kmComputeTarget({ rangeKm: 2, force: true });   // 第156: 同じ範囲の資産があるので force で計算し直す(店からの読み直しを見る)
    const d2 = r2 && r2.done && r2.done[0];
    const uiSize = document.getElementById('kashimap-tiles-size').textContent;
    await _kmTilesClear(); _kmRenderStoreList(); await new Promise(res => setTimeout(res, 300));
    const size0 = await _kmTilesSize();
    return { dem: d.meta.dem, W: G.W, X0: G.X0, Y0: G.Y0, data: d.meta.result.data_px, visible: d.meta.result.visible_px, islands: d.meta.result.islands, size1, uiSize, dem2: d2 && d2.meta.dem, size0, uiSize0: document.getElementById('kashimap-tiles-size').textContent, errs: r.errs, errs2: r2.errs, alerts: window._alerts || [] };
  }, [D2.lat, D2.lng]);
  const nA = served.a.size, n14 = served.z14.size;
  // 穴(左上1/4)が窓の中にかかる5Aタイルだけが次の源を必要とする。親タイル(z14)が同じなら2枚目は店から
  const nHoleIn = d2.X0 !== undefined ? Array.from(served.aHole).filter(k => { const [x, y] = k.split('/').map(Number); const hx0 = x * 256, hy0 = y * 256; return hx0 < d2.X0 + d2.W && hx0 + 128 > d2.X0 && hy0 < d2.Y0 + d2.W && hy0 + 128 > d2.Y0; }).length : -1;
  check('D2 標高タイル(合成PNG): 全タイル5A(タイル数=窓の枚数)・無効画素が窓にかかるタイルは次の源(dem_png z14)で埋めてデータ画素100%(filled_from_next=そのタイル数・5B/5Cの404はその2倍・親が同じ分は店から)・5Aの1枚は503→再試行で取れる(retried=1・errors=0)・店に貯まる(0MB超・表示)・2回目は取得0で全部店から・削除で0',
    d2.dem && d2.dem.tiles === nA && d2.dem.from5a === nA && nHoleIn >= 1 && d2.dem.filled_from_next === nHoleIn && d2.dem.missing === 0 && d2.data === d2.W * d2.W && d2.dem.retried === 1 && served.err503 === 1 && d2.dem.errors === 0 &&
    served.n404 === 2 * nHoleIn && n14 >= 1 && n14 <= nHoleIn && d2.dem.fetched === nA + 2 * nHoleIn + n14 && d2.dem.cached === nHoleIn - n14 && d2.size1 > 0 && /MB$/.test(d2.uiSize) && d2.uiSize !== '0.0 MB' &&
    d2.dem2 && d2.dem2.fetched === 0 && d2.dem2.cached === nA + 3 * nHoleIn && d2.dem2.data_px === d2.data && d2.size0 === 0 && d2.uiSize0 === '0.0 MB' && d2.errs.length === 0 && d2.errs2.length === 0 && d2.visible > 0 && served.other === 0,
    JSON.stringify({ d2: { dem: d2.dem, W: d2.W, data: d2.data, visible: d2.visible, islands: d2.islands, size1: d2.size1, uiSize: d2.uiSize, dem2: d2.dem2, size0: d2.size0, errs: d2.errs, errs2: d2.errs2, alerts: d2.alerts }, served: { nA, nHole: served.aHole.size, nHoleIn, n14, n404: served.n404, err503: served.err503, other: served.other, map: served.map } }));

  check('E ページエラーなし', errs.length===0, errs.join(' | '));
  await b.close();
  console.log(`\n${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('ERR', e); process.exit(1); });
