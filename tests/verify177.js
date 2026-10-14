// 第152ラウンド検証: v1.91.0 除外範囲メニューの「山頂部」(デッサン05 Q24/Q25・依頼者決定)と可視マップのメニュー側の連動・資産の端末保存
// ①基本オプション>除外範囲に「:山頂部」「山頂部(帯,m)」「:プレビュー」「除外範囲をリセット」 ②統一可視判定と辻メッシュのワーカーが山頂部の画素の遮蔽を無視
//   (合成標高の火口: 帯オフ=向こう側の縁に隠れてNG・帯オン=OK) ③別の山の山頂を含む時は帯を縮める ④プレビューの多角形と情報行
// ⑤可視マップ節の範囲ラジオ/目的点で計算(第152は準備中。第153で有効=verify178)/4つのチェック(全展望は初期値オン)がコントロールと連動 ⑥サーバーから読んだ資産の端末保存(静(端末))と「⬇」
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
const wkSrc = fs.readFileSync(path.join(ROOT, 'tm-vis-worker.js'), 'utf8');
const mountains = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'mountains.json'), 'utf8')).mountains;

check('V0 版数(ピンはverify178へ移譲)+Version Historyに第152・第153', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) && (src.includes('第152ラウンド — 除外範囲メニューに「山頂部」') && src.includes('第153ラウンド — 山頂部の基準の標高') || !!process.argv[2]));
check('S1 index.html: 除外範囲に「:山頂部」「:プレビュー」「山頂部(帯,m)」情報行「除外範囲をリセット」・可視マップ節に範囲ラジオ(100/300/700)/「目的点で計算」(第153で有効)/4つのチェック(全展望も初期値オン)・コントロールの全展望も初期値オン・ヘルプ',
  ['chk-baseopt-summit-band','chk-baseopt-summit-preview','input-baseopt-summit-band','baseopt-summit-preview-info','btn-baseopt-excl-reset','radio-kashimap-tgt','btn-kashimap-compute','chk-kashimap-menu-tiles','chk-kashimap-menu-canopy','chk-kashimap-menu-summit','chk-kashimap-menu-zen'].every(id => idxSrc.includes(`id="${id}"`)) &&
  [100,300,700].every(v => idxSrc.includes(`name="kashimap-range-menu" value="${v}"`)) &&   // 第155で60kmを外した /<button id="btn-kashimap-tgt"[^>]*>目的点で計算<\/button>/.test(idxSrc) && !/id="btn-kashimap-tgt"[^>]*disabled/.test(idxSrc) &&
  /id="chk-kashimap-menu-zen" class="body-checkbox" checked/.test(idxSrc) && /id="chk-kashimap-zen" class="body-checkbox" checked/.test(idxSrc) &&
  idxSrc.includes('<strong>「:山頂部」</strong>') && idxSrc.includes('「除外範囲をリセット」で初期値に戻ります') && idxSrc.includes('「静(端末)」') && idxSrc.includes('どちらを操作しても連動します'));
check('S1b UI文言に内輪文脈(ラウンド番号)が無い', !/可視マップ[^<]*第1\d\dラウンド/.test(idxSrc) && !/kashimap[^\n]*第1\d\d/.test(idxSrc.replace(/<!--[\s\S]*?-->/g,'')) && !/山頂部[^<\n]*第1\d\dラウンド/.test(idxSrc));
check('S2 統一可視判定・辻メッシュ(逐次/ワーカー)・ワーカー本体に山頂部の除外が入っている', src.includes('function _visJudgeCore(sLat, sLng, startTotal, endLat, endLng, endTotal, exclM, obsExclM, elevAtPix15, inv2ReffOpt, bandOpt)') && src.includes('if (bandOpt && _sbHas(bandOpt, gx, gy)) continue;') &&
  src.includes("const band = await _visSummitBandFor(endLat, endLng, endGroundElev);") && src.includes("const band = await _visSummitBandFor(end.lat, end.lng, endGroundElev);") && src.includes('elevAtPix15, visInv2R, band).visible') && /band: band \? \{ x0: band\.x0/.test(src) &&
  wkSrc.includes('const band = m.band || null;') && wkSrc.includes('if (band && bandHas(gx, gy)) continue;'));
const SORA_BAND = require('../sora-constants.js').VISIBILITY.SUMMIT_BAND_M;   // 第157: 既定300は数の単一情報源(sora-constants.js)から
check('S3 既定値表: elevSummitBandEnabled=true・elevSummitBandM=300(0〜2000・第157からSORA定数)・LS保存/復元に含む', /elevSummitBandEnabled: \{ def: true, bool: 'nf' \}/.test(src) && /elevSummitBandM: \{ def: SORA\.VISIBILITY\.SUMMIT_BAND_M, min: 0, max: 2000 \}/.test(src) && SORA_BAND === 300 && src.includes('elevSummitBandM: appState.elevSummitBandM,') && src.includes("'elevSummitBandEnabled','elevSummitBandM']"));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html?kashimap=1',{waitUntil:'load'});   // 可視マップは封鎖中(第158)。開錠して検査
  await p.waitForFunction(()=>typeof runKashimapSearch==='function' && typeof glMap!=='undefined' && glMap && glMap.getSource && !!glMap.getSource('summit-band') && !!glMap.getLayer('sb-fill'),{timeout:15000});
  await p.evaluate(async ()=>{ window.confirm=()=>true; window.alert=()=>{}; try { await _kmStoreClear(); } catch (e) {} });
  const setChk = (id, on) => p.evaluate(([i, o]) => { const el = document.getElementById(i); if (el.checked !== o) { el.checked = o; el.dispatchEvent(new Event('change', { bubbles: true })); } }, [id, on]);

  // B1: 合成標高の火口(中心2900・縁3000・上部の斜面は急・下部は緩い)。目的点=西の縁、観測点=東2000画素。帯オフ=向こう側の縁に隠れてNG、帯オン=OK
  const b1 = await p.evaluate(async () => {
    const scale15 = Math.pow(2, 15), R128 = 128 / Math.PI;
    const cx = Math.floor(128 * (139.6 / 180 + 1) * scale15), cy = Math.floor((128 - R128 * Math.atanh(Math.sin(35.0 * Math.PI / 180))) * scale15);
    window._tmSyntheticElev15 = (gx, gy) => { const d = Math.hypot(gx - cx, gy - cy); if (d <= 90) return 2900; if (d <= 100) return 3000; if (d <= 400) return 3000 - 0.25 * (d - 100); return Math.max(0, 2925 - 0.13 * (d - 400)); };   // 下部の斜面0.13/px: 帯120m(2880m以上)は約2.9kmで終わり、帯300mは探索半径3kmいっぱい
    window._tmSyntheticElev = (gx14, gy14) => window._tmSyntheticElev15(gx14 * 2, gy14 * 2);
    const toLL = (gx, gy) => ({ lng: (gx + 0.5) / scale15 / 128 * 180 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * (gy + 0.5) / (256 * scale15)))) * 180 / Math.PI });
    const tgt = toLL(cx - 95, cy), obs = toLL(cx + 2000, cy);
    const eObs = window._tmSyntheticElev15(cx + 2000, cy), eTgt = window._tmSyntheticElev15(cx - 95, cy);
    window._t = { tgt, obs, eObs, eTgt };
    appState.elevExcludeEnabled = true; appState.elevExcludeRadius = 15; appState.elevExcludeObsRadius = 10; appState.elevSummitBandEnabled = false; _sbCache.clear();
    const off = await computePathVisibility(obs.lat, obs.lng, eObs + 1.5, tgt.lat, tgt.lng, eTgt);
    appState.elevSummitBandEnabled = true; appState.elevSummitBandM = 300; _sbCache.clear();
    const band = await _visSummitBandFor(tgt.lat, tgt.lng);
    const on = await computePathVisibility(obs.lat, obs.lng, eObs + 1.5, tgt.lat, tgt.lng, eTgt);
    // 帯120m: 縁(3000)と火口(2900)は入るが下の斜面(<2880)は入らない→縁は除外されOK
    appState.elevSummitBandM = 120; _sbCache.clear();
    const band120 = await _visSummitBandFor(tgt.lat, tgt.lng);
    const on120 = await computePathVisibility(obs.lat, obs.lng, eObs + 1.5, tgt.lat, tgt.lng, eTgt);
    appState.elevSummitBandM = 300; _sbCache.clear();
    return { off, on, on120, band: band && { px: band.px, hT: band.hT, drop: band.dropUsed, farM: band.farM, others: band.others, shrunkBy: band.shrunkBy }, band120: band120 && { px: band120.px, drop: band120.dropUsed, farM: band120.farM } };
  });
  check('B1 合成標高の火口: 帯オフ=向こう側の縁(と上部の急斜面)に隠れてNG / 帯300m=OK(探索半径3kmいっぱい) / 帯120m=OK・帯の画素は300mより少ない', b1.off && b1.off.visible === false && b1.on && b1.on.visible === true && b1.on120 && b1.on120.visible === true && b1.band && b1.band.hT === 3000 && b1.band.drop === 300 && b1.band.px > 100000 && b1.band.farM >= 2995 && b1.band.farM <= 3005 && b1.band.others.length === 0 && b1.band.shrunkBy === null && b1.band120 && b1.band120.drop === 120 && b1.band120.px < b1.band.px * 0.95 && b1.band120.farM <= 3005, JSON.stringify(b1));   // 帯120mの円は火口の中心が目的点から95画素ずれるため目的点からの広がりは探索半径いっぱいになる

  // B2: プレビュー(多角形1つ・情報行)。オフで消える。除外範囲オフ/山頂部オフでは帯なし
  const b2 = await p.evaluate(async () => {
    appState.end = { lat: window._t.tgt.lat, lng: window._t.tgt.lng, elev: window._t.eTgt }; appState.endApiElev = window._t.eTgt; appState.endHeight = 0;   // アプリと同じ不変条件(end.elev=endApiElev+endHeight)。山頂部の基準は endApiElev(第153)
    const pv = document.getElementById('chk-baseopt-summit-preview'); pv.checked = true; pv.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50)); await _sbUpdatePreview(true);
    const feats = glMap.getSource('summit-band')._data.features; const info = document.getElementById('baseopt-summit-preview-info').textContent;
    pv.checked = false; pv.dispatchEvent(new Event('change', { bubbles: true })); await _sbUpdatePreview(true);
    const after = glMap.getSource('summit-band')._data.features.length;
    appState.elevExcludeEnabled = false; const r1 = elevExcludeRadii(); const n1 = await _visSummitBandFor(window._t.tgt.lat, window._t.tgt.lng);
    appState.elevExcludeEnabled = true; appState.elevSummitBandEnabled = false; const r2 = elevExcludeRadii(); const n2 = await _visSummitBandFor(window._t.tgt.lat, window._t.tgt.lng);
    appState.elevSummitBandEnabled = true;
    return { n: feats.length, rings: feats.length ? feats[0].geometry.coordinates.length : 0, info, after, r1band: r1.band, n1, r2band: r2.band, n2, r2tgt: r2.tgt };
  });
  check('B2 プレビュー=山頂部の多角形1つ+情報行「山頂部: 帯300m …」/ オフで消える / 除外範囲オフ・山頂部オフでは帯なし(null)・除外範囲オフは目的点側も0', b2.n === 1 && b2.rings >= 1 && /^山頂部: 帯300m/.test(b2.info) && b2.after === 0 && b2.r1band === 0 && b2.n1 === null && b2.r2band === 0 && b2.n2 === null && b2.r2tgt === 15, JSON.stringify(b2));

  // B3: 別の山の山頂を含む時は縮める。合成標高=北岳の山頂を頂上(3193m=山リストの標高)にした円錐(火口なし)。山リストの小太郎山(2.95km・合成では3004m)が帯300mに入る→縮小
  const kita = mountains.find(m => m.name === '北岳');
  const b3 = await p.evaluate(async ([lat, lng]) => {
    const scale15 = Math.pow(2, 15), R128 = 128 / Math.PI;
    const cx = Math.floor(128 * (lng / 180 + 1) * scale15), cy = Math.floor((128 - R128 * Math.atanh(Math.sin(lat * Math.PI / 180))) * scale15);
    window._tmSyntheticElev15 = (gx, gy) => Math.max(0, 3193 - 0.25 * Math.hypot(gx - cx, gy - cy));
    window._tmSyntheticElev = (gx14, gy14) => window._tmSyntheticElev15(gx14 * 2, gy14 * 2);
    window._cone = { cx, cy };
    _sbCache.clear(); const band = await _visSummitBandRaw(lat, lng);
    return band && { none: !!band.none, drop: band.dropUsed, req: band.dropRequested, shrunkBy: band.shrunkBy, others: band.others };
  }, [kita.lat, kita.lon]);
  check('B3 目的点=北岳(合成の円錐)→帯300mに小太郎山の山頂が入るため帯を縮める(dropUsed<300・shrunkBy=小太郎山。同じ山の別峰と目的点自身は除く)', b3 && b3.none === false && b3.req === 300 && b3.drop < 300 && b3.drop > 0 && b3.shrunkBy === '小太郎山' && b3.others.includes('小太郎山') && !b3.others.includes('北岳'), JSON.stringify(b3));

  // B3b/B3c: 目的点が別の山の山腹(円錐の1.2km下)→帯0でも北岳を含む=山頂部なし(帯なし)で判定は従来どおり。
  //          目的点が北岳の山頂部の中(390m・標高差25m)→自身の山とみなして帯300mのまま(小太郎山で縮小はする)
  const b3b = await p.evaluate(async () => {
    const scale15 = Math.pow(2, 15); const { cx, cy } = window._cone;
    const toLL = (gx, gy) => ({ lng: (gx + 0.5) / scale15 / 128 * 180 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * (gy + 0.5) / (256 * scale15)))) * 180 / Math.PI });
    _sbCache.clear();
    const slope = toLL(cx + 300, cy); const rawSlope = await _visSummitBandRaw(slope.lat, slope.lng); const forSlope = await _visSummitBandFor(slope.lat, slope.lng);
    appState.end = { lat: slope.lat, lng: slope.lng, elev: 3118 }; appState.endApiElev = 3118; appState.endHeight = 0; _sbPreviewOn = true; await _sbUpdatePreview(true);
    const pvN = glMap.getSource('summit-band')._data.features.length, info = document.getElementById('baseopt-summit-preview-info').textContent; _sbPreviewOn = false; await _sbUpdatePreview(true);
    const near = toLL(cx + 100, cy); const rawNear = await _visSummitBandRaw(near.lat, near.lng);
    return { slope: rawSlope && { none: rawSlope.none, reason: rawSlope.reason }, forSlope, pvN, info, near: rawNear && { none: !!rawNear.none, drop: rawNear.dropUsed, req: rawNear.dropRequested, others: rawNear.others, shrunkBy: rawNear.shrunkBy } };
  });
  check('B3b 目的点が北岳の山腹(1.2km下)→帯0でも北岳を含むので山頂部なし(判定には帯を渡さない・プレビューは空+理由の行) / B3c 山頂部の中(390m・標高差25m)は自身の山=帯は取れる(小太郎山で縮小)',
    b3b.slope && b3b.slope.none === true && /山頂部なし/.test(b3b.slope.reason) && /北岳/.test(b3b.slope.reason) && b3b.forSlope === null && b3b.pvN === 0 && /山頂部なし/.test(b3b.info) &&
    b3b.near && b3b.near.none === false && b3b.near.req === 300 && b3b.near.drop > 0 && !b3b.near.others.includes('北岳') && b3b.near.shrunkBy === '小太郎山', JSON.stringify(b3b));

  // B3d: 目的点が山頂でない(円錐の裾=頂上より1000m以上低い。近くに山リストの山頂は無い)→帯の中に目的点より100mを超えて高い地形が続くので山頂部なし
  const b3d = await p.evaluate(async () => {
    const scale15 = Math.pow(2, 15), R128 = 128 / Math.PI;
    const cx = Math.floor(128 * (139.6 / 180 + 1) * scale15), cy = Math.floor((128 - R128 * Math.atanh(Math.sin(35.0 * Math.PI / 180))) * scale15);
    window._tmSyntheticElev15 = (gx, gy) => Math.max(0, 1500 - 0.25 * Math.hypot(gx - cx, gy - cy));   // 頂上1500mの円錐(山リストの山は無い場所)
    window._tmSyntheticElev = (gx14, gy14) => window._tmSyntheticElev15(gx14 * 2, gy14 * 2);
    const toLL = (gx, gy) => ({ lng: (gx + 0.5) / scale15 / 128 * 180 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * (gy + 0.5) / (256 * scale15)))) * 180 / Math.PI });
    _sbCache.clear();
    const foot = toLL(cx + 500, cy); const rawFoot = await _visSummitBandRaw(foot.lat, foot.lng);      // 裾(頂上より125m低い→100mを超える高い地形が続く)
    const top = toLL(cx, cy); const rawTop = await _visSummitBandRaw(top.lat, top.lng);                // 頂上
    const near = toLL(cx + 300, cy); const rawNear = await _visSummitBandRaw(near.lat, near.lng);     // 頂上より75m低い(100m以内)=山頂部あり
    return { foot: rawFoot && { none: !!rawFoot.none, reason: rawFoot.reason }, top: rawTop && { none: !!rawTop.none, drop: rawTop.dropUsed }, near: rawNear && { none: !!rawNear.none, drop: rawNear.dropUsed } };
  });
  check('B3d 目的点が山頂でない(頂上より125m低い裾)→山頂部なし(理由「目的点より…m高い地形」) / 頂上・頂上より75m低い点は山頂部あり(帯300m)', b3d.foot && b3d.foot.none === true && /目的点は山頂ではない/.test(b3d.foot.reason) && b3d.top && b3d.top.none === false && b3d.top.drop === 300 && b3d.near && b3d.near.none === false && b3d.near.drop === 300, JSON.stringify(b3d));

  // B7(第153・依頼者の報告): 目的点=初期値の富士山(火口の中心。座標は山頂の代表点・標高3776m)。合成標高: 火口の底3550(d≤90px)・縁3776(d≤106px。山リストの剣ヶ峯[385m≒99px]が縁に乗る)・上部は急(0.25/px)・下部は緩(0.13/px)。
  //   目的点の標高を渡さない(DEM 3550基準)→剣ヶ峯が「226m高い別の山」で山頂部なし(旧の症状) / 目的点の標高3776を渡す→基準3776で剣ヶ峯は自身の山=帯300mが取れ、東2000画素の観測点は帯オフ=縁に隠れてNG・帯オン=OK。プレビューの情報行に「基準の標高3776.0m(目的点の標高。DEMは3550.0m)」
  const b7 = await p.evaluate(async () => {
    const scale15 = Math.pow(2, 15), R128 = 128 / Math.PI;
    const END = { lat: DEFAULT_END.lat, lng: DEFAULT_END.lng };
    const cx = Math.floor(128 * (END.lng / 180 + 1) * scale15), cy = Math.floor((128 - R128 * Math.atanh(Math.sin(END.lat * Math.PI / 180))) * scale15);
    window._tmSyntheticElev15 = (gx, gy) => { const d = Math.hypot(gx - cx, gy - cy); if (d <= 90) return 3550; if (d <= 106) return 3776; if (d <= 400) return 3776 - 0.25 * (d - 106); return Math.max(0, 3702.5 - 0.13 * (d - 400)); };
    window._tmSyntheticElev = (gx14, gy14) => window._tmSyntheticElev15(gx14 * 2, gy14 * 2);
    const toLL = (gx, gy) => ({ lng: (gx + 0.5) / scale15 / 128 * 180 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * (gy + 0.5) / (256 * scale15)))) * 180 / Math.PI });
    const obs = toLL(cx + 2000, cy), eObs = window._tmSyntheticElev15(cx + 2000, cy);
    appState.elevExcludeEnabled = true; appState.elevExcludeRadius = 15; appState.elevExcludeObsRadius = 10; appState.elevSummitBandEnabled = true; appState.elevSummitBandM = 300; _sbCache.clear();
    const rawNo = await _visSummitBandRaw(END.lat, END.lng);          // 目的点の標高なし(DEM基準)=旧の振る舞い
    const raw = await _visSummitBandRaw(END.lat, END.lng, 3776);      // 目的点の標高3776
    const on = await computePathVisibility(obs.lat, obs.lng, eObs + 1.5, END.lat, END.lng, 3776, 3776);
    const onNo = await computePathVisibility(obs.lat, obs.lng, eObs + 1.5, END.lat, END.lng, 3776);   // 標高を渡さない=山頂部なし=NG(旧の症状)
    appState.elevSummitBandEnabled = false; _sbCache.clear();
    const off = await computePathVisibility(obs.lat, obs.lng, eObs + 1.5, END.lat, END.lng, 3776, 3776);
    appState.elevSummitBandEnabled = true; _sbCache.clear();
    appState.end = { lat: END.lat, lng: END.lng, elev: 3776 }; appState.endApiElev = 3776; appState.endHeight = 0;
    const pv = document.getElementById('chk-baseopt-summit-preview'); pv.checked = true; pv.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50)); await _sbUpdatePreview(true);
    const n = glMap.getSource('summit-band')._data.features.length, info = document.getElementById('baseopt-summit-preview-info').textContent;
    pv.checked = false; pv.dispatchEvent(new Event('change', { bubbles: true })); await _sbUpdatePreview(true);
    return { eObs, rawNo: rawNo && { none: !!rawNo.none, reason: rawNo.reason, hT: rawNo.hT }, raw: raw && { none: !!raw.none, hT: raw.hT, hDem: raw.hDem, drop: raw.dropUsed, px: raw.px, farM: raw.farM, others: raw.others, shrunkBy: raw.shrunkBy }, on, onNo, off, n, info };
  });
  check('B7 初期値の富士山(火口の中心・標高3776・DEMは火口の底3550): 標高なし=剣ヶ峯が別の山で山頂部なし(旧の症状) / 標高3776=基準3776で帯300m(縮小なし) / 観測点(東7.8km)は帯オフNG・帯オンOK・標高を渡さないとNG / プレビューの情報行に基準の標高とDEM',
    b7.rawNo && b7.rawNo.none === true && /別の山「富士山」/.test(b7.rawNo.reason) && b7.rawNo.hT === 3550 && b7.raw && b7.raw.none === false && b7.raw.hT === 3776 && b7.raw.hDem === 3550 && b7.raw.drop === 300 && b7.raw.others.length === 0 && b7.raw.shrunkBy === null && b7.raw.px > 100000 &&
    b7.on && b7.on.visible === true && b7.onNo && b7.onNo.visible === false && b7.off && b7.off.visible === false && b7.n === 1 && /基準の標高3776\.0m\(目的点の標高。DEMは3550\.0m\)/.test(b7.info), JSON.stringify(b7));

  // B4: 入力とリセット(値の丸め・主チェックオフで入力無効・リセットで15/10/300/オン)
  const b4 = await p.evaluate(() => {
    const setIn = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    setIn('input-baseopt-summit-band', '5000'); const clamped = appState.elevSummitBandM;
    setIn('input-baseopt-summit-band', '120'); setIn('input-baseopt-elev-exclude', '50');
    const chk = document.getElementById('chk-baseopt-summit-band'); chk.checked = false; chk.dispatchEvent(new Event('change', { bubbles: true }));
    const inDisabled = document.getElementById('input-baseopt-summit-band').disabled; const stOff = appState.elevSummitBandEnabled;
    const master = document.getElementById('chk-baseopt-elev-exclude'); master.checked = false; master.dispatchEvent(new Event('change', { bubbles: true }));
    const masterOff = { chkDisabled: document.getElementById('chk-baseopt-summit-band').disabled, inDisabled: document.getElementById('input-baseopt-summit-band').disabled };
    document.getElementById('btn-baseopt-excl-reset').click();
    return { clamped, inDisabled, stOff, masterOff, after: [appState.elevExcludeEnabled, appState.elevExcludeRadius, appState.elevExcludeObsRadius, appState.elevSummitBandEnabled, appState.elevSummitBandM], ui: [document.getElementById('input-baseopt-summit-band').value, document.getElementById('input-baseopt-elev-exclude').value, document.getElementById('chk-baseopt-summit-band').checked, document.getElementById('chk-baseopt-elev-exclude').checked, document.getElementById('input-baseopt-summit-band').disabled], saved: JSON.parse(localStorage.getItem('soranotsuji_appState') || '{}').elevSummitBandM };
  });
  check('B4 帯の入力は0〜2000に丸め・山頂部オフで入力無効・除外範囲オフで両方無効・リセットで15/10/300/オンに戻りUIと保存も揃う', b4.clamped === 2000 && b4.inDisabled && b4.stOff === false && b4.masterOff.chkDisabled && b4.masterOff.inDisabled && b4.after.join() === 'true,15,10,true,300' && b4.ui.join() === '300,15,true,true,false' && (b4.saved === 300 || b4.saved === undefined), JSON.stringify(b4));

  // B5: 可視マップ節(メニュー側)とコントロールの連動
  await p.evaluate(() => { delete window._tmSyntheticElev; delete window._tmSyntheticElev15; document.getElementById('chk-kashimap-200').checked = true; document.getElementById('btn-kashimap').click(); });
  await p.waitForFunction(() => document.querySelectorAll('#kashimap-content tr.td-data-row').length > 0, {timeout: 10000});
  const b5 = await p.evaluate(() => {
    const fire = (id, on) => { const el = document.getElementById(id); el.checked = on; el.dispatchEvent(new Event('change', { bubbles: true })); };
    const zen0 = [_kmZenMk, document.getElementById('chk-kashimap-zen').checked, document.getElementById('chk-kashimap-menu-zen').checked];
    fire('chk-kashimap-menu-zen', false); const zen1 = [_kmZenMk, document.getElementById('chk-kashimap-zen').checked];
    fire('chk-kashimap-tiles', false); const tiles = [_kmTiles, document.getElementById('chk-kashimap-menu-tiles').checked, glMap.getLayoutProperty('km-fill', 'visibility')];
    fire('chk-kashimap-tiles', true); fire('chk-kashimap-menu-zen', true);
    const radios = Array.from(document.querySelectorAll('input[name="kashimap-range-menu"]')).map(e => e.value + (e.disabled ? 'x' : 'o') + (e.checked ? '*' : '')).join(',');
    const ctrlRadios = Array.from(document.querySelectorAll('input[name="kashimap-range"]')).map(e => e.value + (e.disabled ? 'x' : 'o') + (e.checked ? '*' : '')).join(',');
    return { zen0, zen1, tiles, radios, ctrlRadios, tgt: document.getElementById('radio-kashimap-tgt').disabled, mytgt: document.getElementById('btn-kashimap-compute').disabled };   // 第156: ラジオ+「範囲を計算」
  });
  check('B5 メニュー側の全展望をオフ→コントロールと状態が連動 / コントロールの可視タイルをオフ→メニュー側と塗りが連動 / 範囲ラジオの灰色も両方 / 目的点で計算・My目的点で計算は有効(第153)', b5.zen0.join() === 'true,true,true' && b5.zen1.join() === 'false,false' && b5.tiles.join() === 'false,false,none' && b5.radios === '100o*,300x,700x' && b5.ctrlRadios === '100o*,300x,700x' && b5.tgt === false && b5.mytgt === false, JSON.stringify(b5));

  // B6: サーバーから読んだ資産は端末に保存(静(端末))・次は端末から・「⬇」でその山だけFile出力
  await p.evaluate(() => { const tr = document.querySelector('#kashimap-content tr[data-id="370"]'); const c = tr.querySelector('input.kashimap-check'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForFunction(() => _kmShown.has('370') && _kmDeviceIndex.has('370/terrain/20'), {timeout: 60000});
  await p.waitForTimeout(300);
  const b6 = await p.evaluate(async () => {
    const info = _kmIndexInfo('370'); const cell = Array.from(document.querySelector('#kashimap-content tr[data-id="370"]').children).slice(11).map(td => td.textContent);
    const row = document.querySelector('#kashimap-store-table tr[data-key="370/terrain/20"]'); const rowText = row ? (row.querySelector('.kashimap-store-name').value + row.nextElementSibling.textContent) : null;
    _kmAssets.delete('370/terrain/20'); const a = await _kmLoadAsset('370', 'terrain', 20);
    let got = null; const orig = window.downloadTextFile; window.downloadTextFile = (n, t) => { got = { n, obj: JSON.parse(t) }; };
    const c = row.querySelector('.kashimap-store-check'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('btn-kashimap-store-dl').click(); await new Promise(r => setTimeout(r, 600)); window.downloadTextFile = orig; c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true }));
    return { label: info && info.label, origin: info && info.origin, cell, rowText, reloadSrc: a.src, dl: got && { n: got.n, n_assets: got.obj.assets.length, id: got.obj.assets[0].meta.mountain.id } };
  });
  check('B6 サーバーの資産を読むと端末に保存(列=静(端末)・一覧にサーバー由来の行)・読み直しは端末から・「⬇」でその山だけのJSON', b6.label === '静(端末)' && b6.origin === 'server' && b6.cell.join() === '919,静(端末),20km,-,-,z15(1画素≈4m・DEM5A/5B/5C),0.7 MB' && b6.rowText && b6.rowText.includes('毛無山') && b6.rowText.includes('範囲: 20km') && b6.reloadSrc === 'device' && b6.dl && /毛無山20km/.test(b6.dl.n) && b6.dl.n_assets === 1 && b6.dl.id === '370', JSON.stringify(b6));

  check('E ページエラーなし', errs.length===0, errs.join(' | '));
  await b.close();
  console.log(`\n${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FAIL (exception)', e); process.exit(1); });
