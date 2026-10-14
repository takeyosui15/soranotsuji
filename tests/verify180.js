// 第155ラウンド検証: v1.94.0 可視マップ節の新しい画面構成(デッサン05)・700kmの表示の直し・辻ライン400km・可視フィルタ・three.jsのES Modules版
// ①静的な形: 版数ピン・節(推し山の入力=ラベル無し/150字・表示範囲100/300/700[初期値100]・:樹冠/:構造物・検索・2つのボタン・計算範囲リスト8つ[初期値24・500あり]・:精細・
//    可視タイル/山頂/全展望・端末に保存した資産=標高タイルの件数/容量/全削除・可視タイルの件数/容量/一括選択/⬇DL/削除/全て登録)・コントロール(範囲3つ・樹冠/構造物)・
//    可視フィルタ(辻検索/辻メッシュ/結果コントロール/ヘルプ。CSV列名は据え置き)・樹冠/構造物のチェック(無効)・辻ライン400km・three.module.min.js・script.jsの要点
// ②単体: 解像度の段(精細)・表示範囲の枠・資産の種類の優先順・THREEがモジュール版で読めている(非推奨の警告なし)
// ③資産の一覧: 2行1組・樹冠/構造物の列・件数/容量・目的点名の編集→全て登録(要約と本文に反映。空で離れると戻る)・一括選択・⬇DL(チェックした分)・削除(チェックした分)・種類の優先順で選ぶ資産
// ④地図タイルの読み直し(_glRefreshRasterTiles)が落ちない
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
const harnessSrc = fs.readFileSync(path.join(ROOT, 'tests', 'harness', 'sync-apptest.py'), 'utf8');

check('V0 版数(ピンはverify181へ移譲)+Version Historyに第155', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) && (src.includes('第155ラウンド — 可視マップ節の新しい画面構成') || !!process.argv[2]));
const kmHtml = idxSrc.slice(idxSrc.indexOf('id="sec-kashimap"'), idxSrc.indexOf('data-arg="sec-soramado"'));
const ctrlHtml = idxSrc.slice(idxSrc.indexOf('id="kashimap-ctrl-body"'), idxSrc.indexOf('id="tsujimesh-panel"'));
const order = (...ids) => ids.map(t => kmHtml.indexOf(t)).every((v, i, a) => v >= 0 && (i === 0 || a[i - 1] < v));
check('S1 可視マップ節(デッサン05第155→第156の改訂版): 推し山の入力はラベル無し・横幅いっぱい(km-query)・150字・プレースホルダー → 検索条件:/AND/OR → 山リスト:/百/二百/三百/百高/その他/端末保存 → 最大表示範囲:/100/300/700(初期値100・60なし) → 障害物オプション:/:樹冠/:構造物 → 計算済み可視マップを検索 → :目的点/:My目的点 → 計算範囲リスト(7つ・初期値24・500なし) → :精細/:最高精細 → 範囲を計算 → 可視タイル/山頂/全展望 → 標高タイル: 件数/容量/全削除 → 可視タイル: 件数/容量/一括選択/⬇DL/削除/全て登録',
  /<input type="text" id="input-kashimap-query" class="km-query" placeholder="推し山名、読み、都道府県名" maxlength="150"/.test(kmHtml) && !/推し山:<\/label>/.test(kmHtml) &&
  [100,300,700].every(v => kmHtml.includes(`name="kashimap-range-menu" value="${v}"`)) && !kmHtml.includes('value="60" checked') && /name="kashimap-range-menu" value="100" checked/.test(kmHtml) &&
  order('id="input-kashimap-query"', '検索条件:', 'id="radio-kashimap-and"', '山リスト:', 'id="chk-kashimap-100"', 'id="chk-kashimap-high"', 'id="chk-kashimap-device"', '最大表示範囲:', 'name="kashimap-range-menu" value="100"', '障害物オプション:', 'id="chk-kashimap-menu-canopy"', 'id="chk-kashimap-menu-building"', 'id="btn-kashimap-search"', 'id="radio-kashimap-tgt"', 'id="sel-kashimap-tgt-range"', 'id="chk-kashimap-fine"', 'id="chk-kashimap-finest"', 'id="btn-kashimap-compute"', 'id="chk-kashimap-menu-tiles"', 'id="chk-kashimap-menu-summit"', 'id="chk-kashimap-menu-zen"', '標高タイル:', 'id="kashimap-tiles-count"', 'id="kashimap-tiles-size"', 'id="btn-kashimap-tiles-clear"', '可視タイル:', 'id="kashimap-store-count"', 'id="kashimap-store-total"', 'id="btn-kashimap-store-selall"', 'id="btn-kashimap-store-dl"', 'id="btn-kashimap-store-del"', 'id="btn-kashimap-store-apply"', 'id="kashimap-store-table"') &&   // 第156: デッサン05の改訂版の並び
  [...kmHtml.matchAll(/<option value="(\d+)"( selected)?>/g)].map(m => m[1] + (m[2] ? '*' : '')).join(',') === '24*,36,48,60,100,300,700' &&
  />:樹冠<\/label>/.test(kmHtml) && />:構造物<\/label>/.test(kmHtml) && kmHtml.includes('>標高タイルを全削除</button>') && !kmHtml.includes('btn-kashimap-store-clear') && kmHtml.includes('>一括選択</button>') && kmHtml.includes('>⬇DL</button>') && kmHtml.includes('>全て登録</button>'));
check('S1b コントロール: 範囲100/300/700(初期値100)・:樹冠・:構造物 / ヘルプ: 計算範囲リスト500・精細・可視タイルの一覧の説明 / UI文言に内輪文脈なし',
  [100,300,700].every(v => ctrlHtml.includes(`name="kashimap-range" value="${v}"`)) && !ctrlHtml.includes('value="60"') && /name="kashimap-range" value="100" checked/.test(ctrlHtml) &&
  />:樹冠<\/label>/.test(ctrlHtml) && />:構造物<\/label>/.test(ctrlHtml) && ctrlHtml.includes('id="chk-kashimap-building"') &&
  idxSrc.includes('24/36/48/60/100/300/700km四方') && idxSrc.includes('「:精細」をオンにすると300kmは約15m') && idxSrc.includes('「一括選択」で全部にチェック') && idxSrc.includes('「全て登録」を押すと端末の資産に反映') &&
  !/可視マップ[^<]*第1\d\dラウンド/.test(idxSrc) && !/kashimap[^\n]*第1\d\d/.test(idxSrc.replace(/<!--[\s\S]*?-->/g,'')));
check('S2 可視フィルタ: 辻検索/辻メッシュ/結果コントロール×2のラベルとヘルプが「可視フィルタ」(「標高フィルタ」は画面に残らない)・:樹冠(オフ)/:構造物(オン)のチェックは無効で配置・My辻の行フォームにも・My辻リストCSVの列名は据え置き / 辻ライン400km(定数とヘルプ) / three.jsはモジュール版(ハーネスの書き換えも) / 地図タイルの読み直し / 可視フィルタの状況表示',
  !/標高フィルタ/.test(idxSrc) && (idxSrc.match(/>可視フィルタ<\/label>/g) || []).length === 4 && (idxSrc.match(/<strong>可視フィルタ<\/strong>/g) || []).length === 2 &&
  /id="chk-tsuji-vis-canopy" class="body-checkbox" disabled>/.test(idxSrc) && /id="chk-tsuji-vis-building" class="body-checkbox" disabled checked>/.test(idxSrc) && /id="chk-tsujimesh-vis-canopy" class="body-checkbox" disabled>/.test(idxSrc) && /id="chk-tsujimesh-vis-building" class="body-checkbox" disabled checked>/.test(idxSrc) &&
  src.includes('class="body-checkbox mytsuji-vis-canopy"') && src.includes('class="body-checkbox mytsuji-vis-building"') && src.includes('<label>可視フィルタ</label>') && src.includes(',精度-フィルタ,標高フィルタ,標高OKフィルタ,') &&
  src.includes('const DP_DIST_LIMIT = 400000;') && idxSrc.includes('<strong>目的点から400km以内</strong>') &&
  /<script type="module" src="three-global.js"><\/script>/.test(idxSrc) && fs.readFileSync(path.join(ROOT, 'three-global.js'), 'utf8').includes("import * as THREE from './vendor/three.module.min.js';") && !idxSrc.includes('build/three.min.js') && harnessSrc.includes("DIRS = ['fonts', 'data', 'vendor']") &&
  src.includes('function _glRefreshRasterTiles()') && src.includes('    _glRefreshRasterTiles();   // 計算中に取りこぼした地図タイル') && src.includes("setStatus('(可視フィルタ 判定データ準備中…)');") && !/setStatus\([^)]*標高フィルタ/.test(src));
check('S3 script.js: KM_RANGES=[100,300,700]・_kmRange初期値100・_kmBuilding・_kmKindPrefs/_kmKindOf・_kmZoomForRange(rangeKm, fine)・_kmRangeBucket・計算後に表示範囲を広げる・_kmTilesStat・一覧の関数(名前の登録/⬇DL/削除)・CSS(2行1組の背景・dirty)',
  ['const KM_RANGES = [100, 300, 700];', 'let _kmRange = 100, _kmCanopy = true, _kmBuilding = true,', 'function _kmKindPrefs()', 'function _kmKindOf(meta)', 'function _kmZoomForRange(rangeKm, fine, finest) {', 'function _kmRangeBucket(rangeKm)', 'if (_kmRange < bucket) { _kmRange = bucket; _kmSyncUi(); }', 'async function _kmTilesStat()', 'async function _kmStoreRename(key, name)', 'async function _kmStoreExportChecked()', 'async function _kmStoreDeleteChecked()', 'function _kmStoreUpdateButtons()', "kind = _kmKindOf(meta)"].every(t => src.includes(t)) &&
  cssSrc.includes('#kashimap-store-table tr.km-store-row3 td { border-bottom: 1px solid') && cssSrc.includes('.nav-btn.dirty {'));   // 第156: 背景色なし・水平線 / 「全て登録」の赤太字はMy観測点と同じ .nav-btn.dirty

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  const warns=[]; p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text()); });
  await p.goto(BASE+'/index.html?kashimap=1',{waitUntil:'load'});   // 可視マップは封鎖中(第158)。開錠して検査
  await p.waitForFunction(()=>typeof runKashimapSearch==='function' && typeof _kmRenderStoreList==='function' && typeof glMap!=='undefined' && glMap && glMap.getLayer && !!glMap.getLayer('km-fill'),{timeout:15000});
  await p.evaluate(async ()=>{ window.confirm=()=>true; window.alert=(m)=>{ (window._alerts = window._alerts || []).push(String(m)); }; try { await _kmStoreClear(); await _kmTilesClear(); await _kmLoadDeviceIndex(); } catch (e) {} });

  // U1: 単体(解像度の段・表示範囲の枠・種類の優先順)+THREEがモジュール版で読めている
  const u1 = await p.evaluate(() => {
    const z = [[60,false,15],[100,false,14],[100,true,14],[300,false,12],[300,true,13],[500,false,12],[500,true,12],[700,false,11],[700,true,12]].map(([r,f,e]) => _kmZoomForRange(r,f) === e);
    const bk = [[24,100],[60,100],[100,100],[101,300],[300,300],[500,700],[700,700],[900,700]].map(([r,e]) => _kmRangeBucket(r) === e);
    const sv = [_kmCanopy, _kmBuilding]; let prefs = {};
    _kmCanopy = true; _kmBuilding = true; prefs.both = _kmKindPrefs().join();
    _kmCanopy = true; _kmBuilding = false; prefs.c = _kmKindPrefs().join();
    _kmCanopy = false; _kmBuilding = true; prefs.b = _kmKindPrefs().join();
    _kmCanopy = false; _kmBuilding = false; prefs.n = _kmKindPrefs().join();
    [_kmCanopy, _kmBuilding] = sv;
    const kinds = [_kmKindOf({}), _kmKindOf({ canopy: true }), _kmKindOf({ buildings: true }), _kmKindOf({ canopy: true, buildings: true })].join();
    return { z: z.every(Boolean), bk: bk.every(Boolean), prefs, kinds, three: typeof THREE === 'object' && String(THREE.REVISION), range: _kmRange, ranges: KM_RANGES.join(), sel: document.getElementById('sel-kashimap-tgt-range').value };
  });
  check('U1 単体: 解像度の段(精細は300→13・700→12。500と100以下は変わらない)・表示範囲の枠(24〜100→100・300→300・500〜700→700)・種類の優先順・THREE r160がモジュール版で読めて非推奨の警告が出ない・表示範囲の初期値100・計算範囲の初期値24',
    u1.z && u1.bk && u1.prefs.both === 'canopy-building,canopy,building,terrain' && u1.prefs.c === 'canopy,terrain' && u1.prefs.b === 'building,terrain' && u1.prefs.n === 'terrain' && u1.kinds === 'terrain,canopy,building,canopy-building' && u1.three === '160' && !warns.some(w => /deprecated with r150/.test(w)) && u1.range === 100 && u1.ranges === '100,300,700' && u1.sel === '24', JSON.stringify({ u1, deprecated: warns.filter(w => /three|deprecated/i.test(w)).slice(0, 2) }));

  // U2: 整列(節を開いて測る): 推し山の入力が横幅いっぱい・範囲ラジオ1段・km-labelは1行
  const u2 = await p.evaluate(() => {
    const panel = document.getElementById('control-panel'); if (panel) panel.classList.remove('minimized');
    const sec = document.getElementById('sec-kashimap'); if (sec.classList.contains('closed')) toggleSection('sec-kashimap');
    const secR = sec.getBoundingClientRect(); const q = document.getElementById('input-kashimap-query').getBoundingClientRect();
    const labels = Array.from(sec.querySelectorAll('label.km-label')).map(l => { const r = l.getBoundingClientRect(); return { t: l.textContent, h: Math.round(r.height), over: r.right > secR.right + 1 }; });
    const radios = Array.from(sec.querySelectorAll('input[name="kashimap-range-menu"]')).map(r => Math.round(r.getBoundingClientRect().top));
    return { qFrac: q.width / secR.width, labels: labels.length, oneLine: labels.every(l => l.h <= 24 && !l.over), radioRows: new Set(radios).size, nRadios: radios.length };
  });
  check('U2 整列: 推し山の入力は節の幅の85%以上・km-labelは全て1行で節からはみ出さない・表示範囲ラジオは3つで1段', u2.qFrac >= 0.85 && u2.labels >= 11 && u2.oneLine && u2.radioRows === 1 && u2.nRadios === 3, JSON.stringify(u2));

  // D1: 資産の一覧(合成の小さな資産を3つ: 地形24km/樹冠24km[同じ目的点]/構造物36km[別の目的点]) → 2行1組・列・件数/容量・種類の優先順
  const mk = (id, name, lat, lon, range, canopy, buildings) => ({
    meta: { tool: 'test', version: 2, mountain: { id, name, lat, lon, elev_list: 1000, height_m: 0 }, range_km: range, zoom: 15, canopy, buildings, summit_area: { drop_m: 300 }, result: { islands: 1 } },
    islands: { mountain: { id, name }, count: 1, islands: [{ no: 1, px: 4, area_km2: 0.0001, rep: [lat, lon], bbox: [lon, lat, lon, lat], dist_km: 0 }] },
    outline: { v: 2, id, name, range_km: range, zoom: 15, canopy, x0: 0, y0: 0, w: 2, h: 2, tol_px: 0, islands: [[1, 4, '??_@?A@?']] } });
  const d1 = await p.evaluate(async (specs) => {
    for (const sp of specs) { await _kmStoreSave(sp.meta, sp.islands, sp.outline, 'compute'); }
    await _kmLoadDeviceIndex();
    const rows1 = Array.from(document.querySelectorAll('#kashimap-store-table tr.km-store-row')), rows2 = Array.from(document.querySelectorAll('#kashimap-store-table tr.km-store-row2'));
    const names = rows1.map(r => r.querySelector('.kashimap-store-name').value), cols = rows2.map(r => Array.from(r.children).map(td => td.textContent).join('|'));
    const keys = Array.from(_kmDeviceIndex.keys()).sort();
    _kmCanopy = true; _kmBuilding = true; const chBoth = _kmAssetChoice('tgt:1'); _kmCanopy = false; const chNoCanopy = _kmAssetChoice('tgt:1'); _kmBuilding = false; const chNone = _kmAssetChoice('tgt:1'); _kmCanopy = true; _kmBuilding = true;
    const chB = _kmAssetChoice('tgt:2');
    return { n1: rows1.length, n2: rows2.length, names, cols, keys, count: document.getElementById('kashimap-store-count').textContent, total: document.getElementById('kashimap-store-total').textContent, tilesCount: document.getElementById('kashimap-tiles-count').textContent,
      dlDisabled: document.getElementById('btn-kashimap-store-dl').disabled, delDisabled: document.getElementById('btn-kashimap-store-del').disabled, selallText: document.getElementById('btn-kashimap-store-selall').textContent,
      chBoth: chBoth && chBoth.kind, chNoCanopy: chNoCanopy && chNoCanopy.kind, chNone: chNone && chNone.kind, chB: chB && chB.kind + '/' + chB.range, pseudo: _kmById ? [..._kmById.keys()].filter(k => k.startsWith('tgt:')).length : null };
  }, [mk('tgt:1', 'テスト甲', 35.1, 139.1, 24, false, false), mk('tgt:1', 'テスト甲', 35.1, 139.1, 24, true, false), mk('tgt:2', 'テスト乙', 35.2, 139.2, 36, false, true)]);
  check('D1 資産の一覧: 3つの資産が3行1組(1行目=目的点名の入力・2行目=範囲/樹冠/構造物・3行目=島数/サイズ。第156)・件数3・容量MB・標高タイル0枚・⬇DL/削除はチェック無しで無効・種類の優先順(樹冠オン=canopy・オフ=terrain・構造物の資産=building)',
    d1.n1 === 3 && d1.n2 === 3 && d1.names.slice().sort().join() === 'テスト乙,テスト甲,テスト甲'.split(',').sort().join() && d1.cols.some(c => c === '範囲: 24km|樹冠: -|構造物: -') && d1.cols.some(c => c === '範囲: 24km|樹冠: あり|構造物: -') && d1.cols.some(c => c === '範囲: 36km|樹冠: -|構造物: あり') &&   // 第156: 3行1組(2行目=範囲・樹冠・構造物)
    d1.keys.join() === 'tgt:1/canopy/24,tgt:1/terrain/24,tgt:2/building/36' && d1.count === '3' && /MB$/.test(d1.total) && d1.tilesCount === '0' && d1.dlDisabled && d1.delDisabled && d1.selallText === '一括選択' &&
    d1.chBoth === 'canopy' && d1.chNoCanopy === 'terrain' && d1.chNone === 'terrain' && d1.chB === 'building/36', JSON.stringify(d1));

  // D2: 目的点名の編集→「全て登録」が赤い太字→登録で要約と本文に反映 / 空で離れると元に戻る / 一括選択 / ⬇DL(チェックした分) / 削除(チェックした分)
  const d2 = await p.evaluate(async () => {
    const row = document.querySelector('#kashimap-store-table tr.km-store-row[data-key="tgt:2/building/36"]'); const inp = row.querySelector('.kashimap-store-name');
    inp.value = 'テスト乙(改名)'; inp.dispatchEvent(new Event('input', { bubbles: true }));
    const dirty = document.getElementById('btn-kashimap-store-apply').classList.contains('dirty'), title = inp.title;
    document.getElementById('btn-kashimap-store-apply').click();
    for (let i = 0; i < 100 && (_kmStoreDirty.size || (_kmDeviceIndex.get('tgt:2/building/36') || {}).name !== 'テスト乙(改名)'); i++) await new Promise(r => setTimeout(r, 50));
    const rec = await _kmStoreGet('tgt:2/building/36');
    const renamed = { summary: _kmDeviceIndex.get('tgt:2/building/36').name, meta: rec.meta.mountain.name, outline: rec.outlineObj.name, islands: rec.islandsObj.mountain.name, dirtyAfter: document.getElementById('btn-kashimap-store-apply').classList.contains('dirty'), pseudo: _kmById && _kmById.get('tgt:2') ? _kmById.get('tgt:2').name : null };
    // 空で離れる→元に戻る
    const row2 = document.querySelector('#kashimap-store-table tr.km-store-row[data-key="tgt:1/terrain/24"]'); const inp2 = row2.querySelector('.kashimap-store-name');
    inp2.value = ''; inp2.dispatchEvent(new Event('input', { bubbles: true })); inp2.dispatchEvent(new Event('blur'));
    const restored = inp2.value, dirty2 = document.getElementById('btn-kashimap-store-apply').classList.contains('dirty');
    // 一括選択
    document.getElementById('btn-kashimap-store-selall').click();
    const allChecked = Array.from(document.querySelectorAll('.kashimap-store-check')).every(c => c.checked), selText = document.getElementById('btn-kashimap-store-selall').textContent, dlEnabled = !document.getElementById('btn-kashimap-store-dl').disabled;
    document.getElementById('btn-kashimap-store-selall').click();
    const noneChecked = Array.from(document.querySelectorAll('.kashimap-store-check')).every(c => !c.checked);
    // ⬇DL: 1つだけチェック
    const c1 = document.querySelector('#kashimap-store-table tr.km-store-row[data-key="tgt:1/canopy/24"] .kashimap-store-check'); c1.checked = true; c1.dispatchEvent(new Event('change', { bubbles: true }));
    let got = null; const orig = window.downloadTextFile; window.downloadTextFile = (n, t) => { got = { n, obj: JSON.parse(t) }; };
    document.getElementById('btn-kashimap-store-dl').click(); for (let i = 0; i < 50 && !got; i++) await new Promise(r => setTimeout(r, 50)); window.downloadTextFile = orig;
    // 削除: さらに1つチェックして2つ削除
    const c2 = document.querySelector('#kashimap-store-table tr.km-store-row[data-key="tgt:1/terrain/24"] .kashimap-store-check'); c2.checked = true; c2.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('btn-kashimap-store-del').click();
    for (let i = 0; i < 100 && _kmDeviceIndex.size !== 1; i++) await new Promise(r => setTimeout(r, 50));
    return { dirty, title, renamed, restored, dirty2, allChecked, selText, dlEnabled, noneChecked, dl: got && { n: got.n, n_assets: got.obj.assets.length, id: got.obj.assets[0].meta.mountain.id, canopy: got.obj.assets[0].meta.canopy },
      left: Array.from(_kmDeviceIndex.keys()), rows: document.querySelectorAll('#kashimap-store-table tr.km-store-row').length, count: document.getElementById('kashimap-store-count').textContent, alerts: (window._alerts || []).slice(-1) };
  });
  check('D2 目的点名の編集で「全て登録」が赤い太字→登録で要約・meta・islands・outline・擬似の山に反映 / 空で離れると元に戻る / 一括選択(全部チェック→「一括解除」→全部外す) / ⬇DL=チェックした1つだけ / 削除=チェックした2つ→残り1つ',
    d2.dirty && /テスト乙\(改名\)/.test(d2.title) && d2.renamed.summary === 'テスト乙(改名)' && d2.renamed.meta === 'テスト乙(改名)' && d2.renamed.outline === 'テスト乙(改名)' && d2.renamed.islands === 'テスト乙(改名)' && !d2.renamed.dirtyAfter && (d2.renamed.pseudo === null || d2.renamed.pseudo === 'テスト乙(改名)') &&
    d2.restored === 'テスト甲' && !d2.dirty2 && d2.allChecked && d2.selText === '一括解除' && d2.dlEnabled && d2.noneChecked && d2.dl && d2.dl.n_assets === 1 && d2.dl.id === 'tgt:1' && d2.dl.canopy === true && /テスト甲24km/.test(d2.dl.n) &&
    d2.left.join() === 'tgt:2/building/36' && d2.rows === 1 && d2.count === '1', JSON.stringify(d2));

  // D3: 地図タイルの読み直しが落ちず、ラスタのソースのタイルURLは変わらない
  const d3 = await p.evaluate(() => { const before = glMap.getStyle().sources['base-std'].tiles.join(); let err = null; try { _glRefreshRasterTiles(); } catch (e) { err = e.message; } const after = glMap.getStyle().sources['base-std'].tiles.join(); return { err, same: before === after, n: Object.values(glMap.getStyle().sources).filter(s => s.type === 'raster').length }; });
  check('D3 地図タイルの読み直し: 例外なし・ラスタのソースのURLは同じ(読み直すだけ)・ラスタのソースが1つ以上', d3.err === null && d3.same && d3.n >= 1, JSON.stringify(d3));

  check('E ページエラーなし', errs.length===0, errs.join(' | '));
  await b.close();
  console.log(`\n${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('ERR', e); process.exit(1); });
