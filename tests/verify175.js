// 第150ラウンド検証: v1.89.0 可視マップ段3(地図表示。デッサン05「実装の段取り」段3の第1弾)
// ①静的資産(data/kashimap/v1/: index.json+{id}/{kind}/{range}/{meta,islands,outline}.json)の形と、outline.json(外周+穴のポリライン符号)の
//   復号→符号付き面積の合計=画素数(穴込みの自己検査)
// ②山リストの「島の数」「静的/動的」列、山の選択で島の輪郭/塗りのソースとレイヤ、島リスト(重複数の降順→面積の降順・表示上限)、
//   2山で縞島(作業用格子の連結成分・重複数2)と縞の塗り、点滅、コントロール(範囲ラジオの灰色・可視タイル・樹冠・山頂/全展望マーカー)、
//   ホバー/クリックの情報とポップアップ、行クリックで島へ移動、File出力(CSV)、閉じても選択と資産を保つ
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
const toolSrc = fs.readFileSync(path.join(ROOT, 'tools', 'kashimap', 'viewshed.js'), 'utf8');
const ASSET = path.join(ROOT, 'data', 'kashimap', 'v1');

// ---- V0: 版数ピン(最新の検証が持つ) ----
check('V0 版数(ピンはverify176へ移譲)+Version Historyに第150', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) && (src.includes('第150ラウンド — 可視マップ段3') || !!process.argv[2]));

// ---- S1/S2: 静的な形 ----
check('S1 index.html: 島リスト(縞島のみ・全て選択/解除)・コントロール(範囲100/300/700[第155で60kmを外した]・可視タイル・樹冠・山頂/全展望マーカー・注記・File出力)・ヘルプに島リスト/縞島/山頂部',
  ['kashimap-detail-toolbar','chk-kashimap-stripe-only','btn-kashimap-island-all','btn-kashimap-island-none','kashimap-detail-title','kashimap-detail-note',
   'kashimap-ctrl','kashimap-ctrl-header','kashimap-ctrl-body','kashimap-ctrl-arrow','chk-kashimap-tiles','chk-kashimap-canopy','chk-kashimap-summit','chk-kashimap-zen','btn-kashimap-export'].every(id => idxSrc.includes(`id="${id}"`)) &&
  [100,300,700].every(v => idxSrc.includes(`name="kashimap-range" value="${v}"`)) && !idxSrc.includes('name="kashimap-range" value="60"') &&
  /<strong>島リスト<\/strong>/.test(idxSrc) && idxSrc.includes('縞島') && idxSrc.includes('山頂部') && idxSrc.includes('それ以外の山は、My目的点に登録してご利用ください'));
check('S1b ヘルプ・UI文言に内輪文脈(ラウンド番号)が無い', !/可視マップ[^<]*第1\d\dラウンド/.test(idxSrc) && !/kashimap[^\n]*第1\d\d/.test(idxSrc.replace(/<!--[\s\S]*?-->/g,'')));
check('S2 style.css: 島リスト・コントロールの骨組み(open/with-detail)・全展望マーカー', cssSrc.includes('#kashimap-ctrl.open') && cssSrc.includes('#kashimap-panel.with-detail #kashimap-ctrl.open') && cssSrc.includes('#kashimap-detail-body .td-table th') && cssSrc.includes('.kashimap-zen'));
check('S3 段2の道具v2: summit-mode(region/circle)・輪郭の外周+穴(extractRings)と自己検査・--asset・間引きは--tol(既定は第151で0)', toolSrc.includes("SUMMIT_MODE") && toolSrc.includes("'region'") && toolSrc.includes('function extractRings') && toolSrc.includes('輪郭の自己検査に失敗') && toolSrc.includes('ASSET_DIR') && /DP_TOL = parseFloat\(args\.tol \|\| '[0-9.]+'\)/.test(toolSrc));

// ---- A1/A2: 静的資産の形と復号の自己検査 ----
function decodePoly(s) { const out = []; let i = 0, x = 0, y = 0; const next = () => { let r = 0, sh = 0, b; do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20); return (r & 1) ? ~(r >> 1) : (r >> 1); }; while (i < s.length) { x += next(); y += next(); out.push([x, y]); } return out; }
function ringArea(r) { let a = 0; for (let i = 0, n = r.length; i < n; i++) { const p = r[i], q = r[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
let fujiIslands = null, fujiMeta = null, fujiN = 0, kenashiN = 0;
{
  const ix = JSON.parse(fs.readFileSync(path.join(ASSET, 'index.json'), 'utf8'));
  const m368 = ix.mountains['368'], m370 = ix.mountains['370'];
  const isl = JSON.parse(fs.readFileSync(path.join(ASSET, '368', 'terrain', '60', 'islands.json'), 'utf8'));
  const meta = JSON.parse(fs.readFileSync(path.join(ASSET, '368', 'terrain', '60', 'meta.json'), 'utf8'));
  const ol = JSON.parse(fs.readFileSync(path.join(ASSET, '368', 'terrain', '60', 'outline.json'), 'utf8'));
  fujiIslands = isl.islands; fujiMeta = meta; fujiN = isl.count; kenashiN = m370 ? m370.islands['terrain:20'] : 0;
  check('A1 index.json: 富士山368=terrain[60]・毛無山370=terrain[20]・島の数=islands.json=meta.result.islands・meta=version2/region/山頂部(300m)/k=0.132/観測者1.5m',
    m368 && m368.terrain.join() === '60' && m368.islands['terrain:60'] === isl.count && isl.islands.length === isl.count && meta.result.islands === isl.count &&
    m370 && m370.terrain.join() === '20' && meta.version === 2 && meta.summit_mode === 'region' && meta.summit_area.drop_m === 300 && meta.k === 0.132 && meta.observer_h_m === 1.5 && meta.outline.tol_px === 0 && ol.v === 2 && ol.islands.length === isl.count,
    JSON.stringify({ m368, m370, count: isl.count, metaIslands: meta.result.islands, mode: meta.summit_mode, olV: ol.v, olN: ol.islands.length }));
  // 復号の自己検査: 大きい順に5島と穴のある島を1つ、符号付き面積(外周が正・穴が負)の合計が画素数と一致(間引き1pxの分だけ違う→許容は画素数の1%か外周の頂点数の2倍)
  const byPx = ol.islands.slice().sort((a, b) => b[1] - a[1]);
  const sample = byPx.slice(0, 5).concat(ol.islands.filter(r => r.length > 3).slice(0, 3));
  let ok = true; const det = [];
  for (const rec of sample) {
    const rings = rec.slice(2).map(decodePoly); const areas = rings.map(ringArea); const sum = areas.reduce((s, a) => s + a, 0);
    const nv = rings.reduce((s, r) => s + r.length, 0); const tol = Math.max(rec[1] * 0.01, nv * 2);
    const holesNeg = areas.slice(1).every(a => a < 0) && areas[0] > 0;
    if (Math.abs(sum - rec[1]) > tol || !holesNeg) ok = false;
    det.push({ no: rec[0], px: rec[1], rings: rings.length, sum: Math.round(sum), nv });
  }
  check('A2 outline.jsonの復号: 外周が正・穴が負・合計≈画素数(間引き1px以内)。最大の島は穴が多数', ok && det[0].rings > 100, JSON.stringify(det.slice(0, 3)));
}

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html?kashimap=1',{waitUntil:'load'});   // 可視マップは封鎖中(第158)。開錠して検査
  await p.waitForFunction(()=>typeof runKashimapSearch==='function' && typeof glMap!=='undefined' && glMap && glMap.getLayer && !!glMap.getLayer('km-fill') && !!glMap.getLayer('km-stripe-fill') && !!glMap.getLayer('km-blink'),{timeout:15000});
  await p.waitForTimeout(500);
  const jsClick = id => p.evaluate(i => document.getElementById(i).click(), id);
  const setChk = (id, on) => p.evaluate(([i, o]) => { const el = document.getElementById(i); if (el.checked !== o) { el.checked = o; el.dispatchEvent(new Event('change', { bubbles: true })); } }, [id, on]);
  const selectMountain = (id, on) => p.evaluate(([id, on]) => { const tr = document.querySelector(`#kashimap-content tr[data-id="${id}"]`); const c = tr.querySelector('input.kashimap-check'); if (c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change', { bubbles: true })); } }, [id, on]);
  const islandRows = () => p.evaluate(() => Array.from(document.querySelectorAll('#kashimap-detail-body tr.td-data-row')).map(tr => ({ key: tr.dataset.key, c: Array.from(tr.children).map(td => td.textContent) })));

  // K1: 山リストの「島の数」「静的/動的」列(索引から)
  await setChk('chk-kashimap-200', true);
  await jsClick('btn-kashimap');
  await p.waitForFunction(() => document.querySelectorAll('#kashimap-content tr.td-data-row').length > 0, {timeout: 10000});
  const k1 = await p.evaluate(() => { const g = id => { const tr = document.querySelector(`#kashimap-content tr[data-id="${id}"]`); return tr ? [tr.children[11].textContent, tr.children[12].textContent] : null; }; return { f: g('368'), k: g('370'), r: g('5'), heads: Array.from(document.querySelectorAll('#kashimap-content th')).map(th => th.textContent.replace(/[▲▼]/g, '')) }; });
  check('K1 山リストに「島の数」「静的/動的」列: 富士山=索引の島数/静・毛無山=索引の島数/静・羅臼岳=—/空', k1.f && k1.f[0] === fujiN.toLocaleString() && k1.f[1] === '静' && k1.k && k1.k[0] === kenashiN.toLocaleString() && k1.k[1] === '静' && k1.r && k1.r[0] === '—' && k1.r[1] === '' && k1.heads.slice(-7).join() === '島の数,静的/動的,範囲,樹冠,構造物,ズーム,サイズ', JSON.stringify(k1));   // 第156: 範囲・樹冠・構造物・サイズの列 / 第157: ズーム

  // K2: 富士山を選ぶ→資産を読んで島の輪郭/塗り・島リスト
  await selectMountain('368', true);
  await p.waitForFunction(() => _kmShown.size === 1 && _kmIslandRows.length > 0, {timeout: 60000});
  await p.waitForFunction(() => !/描画中/.test(document.getElementById('kashimap-detail-title').textContent), {timeout: 60000});   // 第157: 島リストは分割描画(進捗つき)。描き終わるまで待つ
  await p.waitForTimeout(300);
  const maxIsl = fujiIslands.slice().sort((a, b) => b.px - a.px)[0];
  const k2 = await p.evaluate(() => ({ feats: glMap.getSource('km-islands')._data.features.length, fill: glMap.getLayoutProperty('km-fill', 'visibility'), line: glMap.getLayoutProperty('km-line', 'visibility'),
    status: document.getElementById('kashimap-status').textContent, title: document.getElementById('kashimap-detail-title').textContent, note: document.getElementById('kashimap-detail-note').textContent,
    withDetail: document.getElementById('kashimap-panel').classList.contains('with-detail'), detailHidden: document.getElementById('kashimap-detail').classList.contains('hidden'),
    nRows: document.querySelectorAll('#kashimap-detail-body tr.td-data-row').length, rows: _kmIslandRows.length, first: Array.from(document.querySelector('#kashimap-detail-body tr.td-data-row').children).map(td => td.textContent), markers: (_glMarkerGroups['kashimap'] || []).length }));
  const fujiS = fujiN.toLocaleString();
  check('K2 富士山を選択→島(索引の島数)のソースと塗り/輪郭が表示・島リスト(重複数降順→面積降順=先頭は最大の島・全件を表示[第156])・注記「表示中: 100km(富士山は60km)・樹冠なし・構造物なし」(第155: 表示範囲は100/300/700)・山頂マーカー',
    k2.feats === fujiN && k2.fill === 'visible' && k2.line === 'visible' && k2.status.includes(`島${fujiS}`) && k2.title.includes(`${fujiS}件`) && !/上位/.test(k2.title) && k2.note.includes('表示中: 100km(富士山は60km)・樹冠なし・構造物なし') &&
    k2.withDetail && !k2.detailHidden && k2.nRows === fujiN && k2.rows === fujiN && +k2.first[1] === maxIsl.no && k2.first[3] === '1' && k2.first[4].startsWith('富士山') && Math.abs(+k2.first[8] - maxIsl.area_km2) < 0.01 && k2.markers === 1,
    JSON.stringify({ ...k2, first: k2.first.slice(0, 9), maxNo: maxIsl.no, maxArea: maxIsl.area_km2 }));

  // K3: 毛無山も選ぶ→縞島(重複数2)・縞の塗り・注記に範囲の違い
  await selectMountain('370', true);
  await p.waitForFunction(() => _kmShown.size === 2 && _kmStripes.length > 0 && document.querySelectorAll('#kashimap-detail-body tr.td-data-row').length > 0, {timeout: 60000});
  await p.waitForTimeout(300);
  const k3 = await p.evaluate(() => ({ n: _kmStripes.length, allDup2: _kmStripes.every(c => c.dup === 2 && c.mids.length === 2), sortedDesc: _kmStripes.every((c, i, a) => i === 0 || a[i - 1].px >= c.px), top: { no: _kmStripes[0].no, px: _kmStripes[0].px, area: _kmStripes[0].area_km2 }, grid: _kmStripeGrid && { S: _kmStripeGrid.S, gw: _kmStripeGrid.gw },
    rows: _kmIslandRows.length, stripeFeats: glMap.getSource('km-stripes')._data.features.length, stripeVis: glMap.getLayoutProperty('km-stripe-fill', 'visibility'), title: document.getElementById('kashimap-detail-title').textContent, note: document.getElementById('kashimap-detail-note').textContent,
    first: Array.from(document.querySelector('#kashimap-detail-body tr.td-data-row').children).map(td => td.textContent), status: document.getElementById('kashimap-status').textContent }));
  check('K3 毛無山も選択→縞島(全て重複数2・面積降順)・地図に縞の塗り(上位20まで)・島リスト=富士山の島+毛無山の島+縞島・先頭は縞島・注記「100km(富士山は60km・毛無山は20km)」',
    k3.n > 10 && k3.allDup2 && k3.sortedDesc && k3.top.area > 10 && k3.grid && k3.grid.S === 8 && k3.rows === fujiN + kenashiN + k3.n && k3.stripeFeats === Math.min(20, k3.n) && k3.stripeVis === 'visible' &&
    k3.title.includes(`縞島${k3.n}`) && k3.note.includes('100km(富士山は60km・毛無山は20km)') && k3.first[2] === '縞' && k3.first[3] === '2' && k3.first[4] === '富士山/毛無山' && k3.first[8].startsWith('約') && k3.status.includes(`島${(fujiN + kenashiN + k3.n).toLocaleString()}`),
    JSON.stringify({ ...k3, first: k3.first.slice(0, 9) }));

  // K4: ホバー情報(重なる塗りの分だけ来る)とクリックの固定ポップアップ(観測点に設定)
  const k4 = await p.evaluate(() => {
    const fs = glMap.getSource('km-islands')._data.features;
    const f1 = fs.find(f => f.properties.mid === '368'), f2 = fs.find(f => f.properties.mid === '370');
    const info = _kmHoverInfo([f1, f2, f1]);
    _kmShowPopup({ lng: 138.6, lat: 35.38 }, [f1, f2]);
    const el = _kmPopup && _kmPopup.getElement();
    const txt = el ? el.textContent : '';
    const hi = Array.from(document.querySelectorAll('#kashimap-detail-body tr.td-data-row.hover')).map(tr => tr.dataset.key);
    const hasBtn = !!(el && el.querySelector('.km-popup-set'));
    _kmPopup.remove();
    return { info, txt: txt.slice(0, 80), hi, hasBtn, popupNull: _kmPopup === null, guard: typeof _kmTiles === 'boolean' };
  });
  check('K4 ホバー情報=重複数2・山名2つ・島のキー2つ / クリックのポップアップ「可視辻(重複数2)」+「観測点に設定」ボタン+該当行の強調 / 閉じると解除',
    k4.info.dup === 2 && k4.info.names.join('・') === '富士山・毛無山' && k4.info.keys.length === 2 && k4.txt.includes('可視辻(重複数2)') && k4.txt.includes('観測点に設定') && k4.hasBtn && k4.popupNull &&
    src.includes("glMap.queryRenderedFeatures(e.point, { layers: ['km-fill'] }).length) return;"), JSON.stringify(k4));

  // K5: 点滅(行チェック→輪郭ソース1件・0.5秒交互・全て解除で止まる)
  await p.evaluate(() => { const tr = document.querySelector('#kashimap-detail-body tr.td-data-row'); const c = tr.querySelector('input'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
  const b1 = await p.evaluate(() => ({ n: glMap.getSource('km-blink')._data.features.length, keys: [..._kmBlink], timer: _kmBlinkTimer !== null, on: _kmBlinkOn, vis: glMap.getLayoutProperty('km-blink', 'visibility'), rings: glMap.getSource('km-blink')._data.features[0].geometry.coordinates.length }));
  // 描画が重い環境ではタイマーが遅れるので、状態が反転するまで待つ(最大5秒)
  await p.waitForFunction(() => _kmBlinkOn === false, {timeout: 5000}).catch(() => {});
  const b2 = await p.evaluate(() => ({ on: _kmBlinkOn, vis: glMap.getLayoutProperty('km-blink', 'visibility') }));
  await jsClick('btn-kashimap-island-none');
  const b3 = await p.evaluate(() => ({ timer: _kmBlinkTimer !== null, vis: glMap.getLayoutProperty('km-blink', 'visibility'), n: glMap.getSource('km-blink')._data.features.length, size: _kmBlink.size }));
  check('K5 島リストの行チェックで縞島の輪郭が点滅(0.5秒交互)・全て解除で止まる', b1.n === 1 && b1.keys[0].startsWith('S:') && b1.timer && b1.on && b1.vis === 'visible' && b1.rings >= 1 && b2.on === false && b2.vis === 'none' && !b3.timer && b3.vis === 'none' && b3.n === 0 && b3.size === 0, JSON.stringify({ b1, b2, b3 }));

  // K6: コントロール(範囲の灰色・可視タイル・樹冠・山頂/全展望マーカー・開閉)
  await jsClick('kashimap-ctrl-header');
  await setChk('chk-kashimap-zen', true);
  const k6a = await p.evaluate(() => ({ open: document.getElementById('kashimap-ctrl').classList.contains('open'), arrow: document.getElementById('kashimap-ctrl-arrow').textContent,
    radios: Array.from(document.querySelectorAll('input[name="kashimap-range"]')).map(e => e.value + (e.disabled ? 'x' : 'o') + (e.checked ? '*' : '')).join(','), zen: (_glMarkerGroups['kashimap-zen'] || []).length, zenClass: document.querySelectorAll('.kashimap-zen').length }));
  await setChk('chk-kashimap-tiles', false);
  const k6b = await p.evaluate(() => [glMap.getLayoutProperty('km-fill', 'visibility'), glMap.getLayoutProperty('km-line', 'visibility'), glMap.getLayoutProperty('km-stripe-fill', 'visibility')].join());
  await setChk('chk-kashimap-tiles', true);
  await setChk('chk-kashimap-summit', false);
  const k6c = await p.evaluate(() => (_glMarkerGroups['kashimap'] || []).length);
  await setChk('chk-kashimap-summit', true);
  await setChk('chk-kashimap-canopy', false);
  await p.waitForFunction(() => _kmShown.size === 2 && _kmIslandRows.length > 0, {timeout: 30000});
  const k6d = await p.evaluate(() => ({ note: document.getElementById('kashimap-detail-note').textContent, kinds: Array.from(_kmShown.values()).map(l => l.kind).join(), markers: (_glMarkerGroups['kashimap'] || []).length }));
  check('K6 コントロール: 開閉・範囲ラジオ=100だけ選べる(300/700は灰色。第155で60kmを外し24〜100kmの資産は100の枠)・全展望マーカー=重複数最大の縞島(上位20)・可視タイルoffで塗りだけ消える・山頂マーカーoff/on・樹冠offでも地形の資産',
    k6a.open && k6a.arrow === '▲' && k6a.radios === '100o*,300x,700x' && k6a.zen === 20 && k6a.zenClass === 20 && k6b === 'none,visible,none' && k6c === 0 && k6d.markers === 2 && k6d.kinds === 'terrain,terrain' && k6d.note.includes('樹冠なし'), JSON.stringify({ k6a, k6b, k6c, k6d }));

  // K7: 島リストの行クリックで地図がその島(代表点)へ(下部パネル分のオフセット=経度が一致し、緯度は南へ)
  await p.evaluate(() => glMap.jumpTo({ center: [139.5, 36.0], zoom: 9 }));
  const r7 = (await islandRows())[1];
  await p.evaluate(() => { document.querySelectorAll('#kashimap-detail-body tr.td-data-row')[1].click(); });
  // easeTo(250ms)は描画フレーム駆動なので、重い環境では移動が終わるまで待つ(最大15秒)
  await p.waitForTimeout(300);
  await p.waitForFunction(() => !glMap.isMoving(), {timeout: 15000}).catch(() => {});
  const c7 = await p.evaluate(() => { const c = glMap.getCenter(); return { lng: c.lng, lat: c.lat }; });
  check('K7 島リストの行クリックで地図がその島の代表点へ', Math.abs(c7.lng - +r7.c[7]) < 0.002 && c7.lat <= +r7.c[6] + 0.001, JSON.stringify({ row: r7.c.slice(1, 8), c7 }));

  // K8: File出力(第151で資産のJSONへ: 描画中の2山の資産=meta/islands/outline)
  const k8 = await p.evaluate(() => { let got = null; const orig = window.downloadTextFile; window.downloadTextFile = (n, t, m) => { got = { n, m, obj: JSON.parse(t) }; }; try { _kmExportAssets(); } finally { window.downloadTextFile = orig; }
    return got && { name: got.n, mime: got.m, format: got.obj.format, ids: got.obj.assets.map(a => a.meta.mountain.id).sort(), ok: got.obj.assets.every(a => a.meta && a.islands && a.outline && a.outline.islands.length === a.islands.islands.length) }; });
  check('K8 File出力: soranotsuji-可視マップ資産-*.json・描画中の2山(富士山・毛無山)の資産(meta/islands/outline)', k8 && /^soranotsuji-可視マップ資産-.+\.json$/.test(k8.name) && /json/.test(k8.mime) && k8.format === 'soranotsuji-kashimap-assets' && k8.ids.join() === '368,370' && k8.ok, JSON.stringify(k8));

  // K9: 「:縞島のみ」→縞島だけ / 山の全て解除→島リストが消え、ソースが空
  await setChk('chk-kashimap-stripe-only', true);
  const k9a = await p.evaluate(() => { const rows = Array.from(document.querySelectorAll('#kashimap-detail-body tr.td-data-row')); return { n: rows.length, all: rows.every(tr => tr.children[2].textContent === '縞'), title: document.getElementById('kashimap-detail-title').textContent }; });
  await setChk('chk-kashimap-stripe-only', false);
  await jsClick('btn-kashimap-select-none');
  await p.waitForFunction(() => _kmShown.size === 0 && _kmIslandRows.length === 0, {timeout: 30000});
  const k9b = await p.evaluate(() => ({ feats: glMap.getSource('km-islands')._data.features.length, stripes: _kmStripes.length, hidden: document.getElementById('kashimap-detail').classList.contains('hidden'), zen: (_glMarkerGroups['kashimap-zen'] || []).length, status: document.getElementById('kashimap-status').textContent }));
  check('K9 「:縞島のみ」で縞島だけ / 山の全て解除で島リスト・ソース・縞島・全展望マーカーが消える', k9a.n > 10 && k9a.all && k9a.title.includes('縞島のみ') && k9b.feats === 0 && k9b.stripes === 0 && k9b.hidden && k9b.zen === 0 && /選択0\)/.test(k9b.status), JSON.stringify({ k9a, k9b }));

  // K10: 選び直して閉じる→レイヤ非表示・点滅停止。開き直す→戻る(資産は読み直さない)
  await selectMountain('368', true);
  await p.waitForFunction(() => _kmShown.size === 1, {timeout: 30000});
  await p.evaluate(() => { const tr = document.querySelector('#kashimap-detail-body tr.td-data-row'); const c = tr.querySelector('input'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await jsClick('btn-kashimap-close');
  const k10a = await p.evaluate(() => ({ active: _kmActive, line: glMap.getLayoutProperty('km-line', 'visibility'), fill: glMap.getLayoutProperty('km-fill', 'visibility'), timer: _kmBlinkTimer !== null, sel: _kmSelected.size, assets: _kmAssets.size }));
  const t0 = Date.now();
  await jsClick('btn-kashimap');
  await p.waitForFunction((n) => _kmActive && _kmShown.size === 1 && _kmIslandRows.length === n, fujiN, {timeout: 30000});
  const k10b = await p.evaluate(() => ({ line: glMap.getLayoutProperty('km-line', 'visibility'), timer: _kmBlinkTimer !== null, blink: _kmBlink.size, markers: (_glMarkerGroups['kashimap'] || []).length }));
  check('K10 閉じる→レイヤ非表示・点滅停止(選択と資産は保つ) / 開き直す→島とマーカーと点滅が戻る', !k10a.active && k10a.line === 'none' && k10a.fill === 'none' && !k10a.timer && k10a.sel === 1 && k10a.assets === 2 && k10b.line === 'visible' && k10b.timer && k10b.blink === 1 && k10b.markers === 1 && (Date.now() - t0) < 15000, JSON.stringify({ k10a, k10b, ms: Date.now() - t0 }));

  check('E ページエラーなし', errs.length===0, errs.join(' | '));
  await b.close();
  console.log(`\n${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FAIL (exception)', e); process.exit(1); });
