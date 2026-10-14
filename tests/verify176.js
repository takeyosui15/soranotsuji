// 第151ラウンド検証: v1.90.0 可視マップの資産のFile出力/File読込と端末の資産の管理(依頼者の依頼・デッサン05 Q26)
// ①静的資産は間引きなし(--tol 0: 頂点数=間引き前) ②File出力=選んだ山の資産(meta/islands/outline)を1つのJSONに
// ③File読込=JSONを端末(IndexedDB: soranotsuji-kashimap/assets)に保存→山リストの「静的/動的」列(静/動/静/動)と島の数・資産の読込は端末優先
// ④可視マップ節の「端末に保存した資産」の一覧(山・範囲・樹冠・島・サイズ・✕)と合計・資産を全て削除・標高タイルを削除
// ⑤注記「この機能はPC向け機能…」(依頼者起草)・reset.htmlのIndexedDB消去
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
const resetSrc = fs.readFileSync(path.join(ROOT, 'reset.html'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'reset.js'), 'utf8');   // 第159: スクリプトは reset.js に分離(CSP)
const toolSrc = fs.readFileSync(path.join(ROOT, 'tools', 'kashimap', 'viewshed.js'), 'utf8');
const ASSET = path.join(ROOT, 'data', 'kashimap', 'v1');

check('V0 版数(ピンはverify177へ移譲)+Version Historyに第151', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) && (src.includes('第151ラウンド — 可視マップの資産のFile出力/File読込') || !!process.argv[2]));
check('S1 index.html: File出力(資産)/File読込/読込input・端末に保存した資産の一覧(表・合計・一括選択/⬇DL/削除[第155で全て削除から]・標高タイル全削除)・PC向けの注記(節とコントロール)・ヘルプ(静/静(端末)/動・端末に保存した資産・PC向け)',
  ['btn-kashimap-export','btn-kashimap-import','input-kashimap-import','kashimap-store','kashimap-store-empty','kashimap-store-table','kashimap-store-total','btn-kashimap-store-selall','btn-kashimap-store-dl','btn-kashimap-store-del','btn-kashimap-tiles-clear','kashimap-tiles-size'].every(id => idxSrc.includes(`id="${id}"`)) &&
  (idxSrc.match(/この機能はPC向け機能なので、スマートフォンでは動作が重たく感じる場合があります。/g) || []).length >= 2 &&
  !/title="山リストと島リスト\(縞島を含む\)をCSV/.test(idxSrc) && idxSrc.includes('「静(端末)」=サーバーの資産を端末にも保存済み') && idxSrc.includes('<strong>端末に保存した資産</strong>') && idxSrc.includes('<strong>PC向けの機能です</strong>'));
check('S1b UI文言に内輪文脈(ラウンド番号)が無い', !/可視マップ[^<]*第1\d\dラウンド/.test(idxSrc) && !/kashimap[^\n]*第1\d\d/.test(idxSrc.replace(/<!--[\s\S]*?-->/g,'')));
check('S2 reset.htmlの「すべてのデータを消去」がIndexedDB(soranotsuji-kashimap・soranotsuji-wx・soranotsuji-maptiles)も消す+注記', resetSrc.includes("indexedDB.deleteDatabase(name)") && resetSrc.includes("'soranotsuji-kashimap', 'soranotsuji-wx', 'soranotsuji-maptiles'") && resetSrc.includes('IndexedDB) も消去します'));   // 第159: 地図タイルの控えも
check('S3 道具: 間引きの既定0(--tol 0)・CSV出力の関数は撤去', /DP_TOL = parseFloat\(args\.tol \|\| '0'\)/.test(toolSrc) && !src.includes('function _kmExportCsv'));
{
  const meta = JSON.parse(fs.readFileSync(path.join(ASSET, '368', 'terrain', '60', 'meta.json'), 'utf8'));
  const meta2 = JSON.parse(fs.readFileSync(path.join(ASSET, '370', 'terrain', '20', 'meta.json'), 'utf8'));
  const sz = fs.statSync(path.join(ASSET, '368', 'terrain', '60', 'outline.json')).size;
  check('A1 同梱の資産は間引きなし(tol_px=0・頂点数=間引き前。富士山60km=約328万頂点・outline 6MB超)', meta.outline.tol_px === 0 && meta.outline.vertices === meta.outline.vertices_raw && meta.outline.vertices > 3000000 && meta2.outline.tol_px === 0 && meta2.outline.vertices === meta2.outline.vertices_raw && sz > 6e6, JSON.stringify({ v: meta.outline.vertices, raw: meta.outline.vertices_raw, sz }));
}

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html?kashimap=1',{waitUntil:'load'});   // 可視マップは封鎖中(第158)。開錠して検査
  await p.waitForFunction(()=>typeof runKashimapSearch==='function' && typeof glMap!=='undefined' && glMap && glMap.getLayer && !!glMap.getLayer('km-fill'),{timeout:15000});
  await p.evaluate(async ()=>{ window.confirm=()=>true; window._alerts=[]; window.alert=(m)=>{ window._alerts.push(String(m)); }; try { await _kmStoreClear(); } catch (e) {} });
  const jsClick = id => p.evaluate(i => document.getElementById(i).click(), id);
  const setChk = (id, on) => p.evaluate(([i, o]) => { const el = document.getElementById(i); if (el.checked !== o) { el.checked = o; el.dispatchEvent(new Event('change', { bubbles: true })); } }, [id, on]);
  const selectMountain = (id, on) => p.evaluate(([id, on]) => { const tr = document.querySelector(`#kashimap-content tr[data-id="${id}"]`); const c = tr.querySelector('input.kashimap-check'); if (c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change', { bubbles: true })); } }, [id, on]);
  const storeState = () => p.evaluate(() => ({ empty: !document.getElementById('kashimap-store-empty').classList.contains('hidden'), rows: Array.from(document.querySelectorAll('#kashimap-store-table tbody tr')).map(tr => ({ key: tr.dataset.key, c: Array.from(tr.children).map(td => td.textContent) })), total: document.getElementById('kashimap-store-total').textContent, tiles: document.getElementById('kashimap-tiles-size').textContent, n: _kmDeviceIndex.size }));

  // K1: 初期状態(端末の資産なし)・静的資産は「静」
  await setChk('chk-kashimap-200', true);
  await jsClick('btn-kashimap');
  await p.waitForFunction(() => document.querySelectorAll('#kashimap-content tr.td-data-row').length > 0, {timeout: 10000});
  const st0 = await storeState();
  const k1 = await p.evaluate(() => ({ f: _kmIndexInfo('368'), a: _kmIndexInfo('369'), cellF: Array.from(document.querySelector('#kashimap-content tr[data-id="368"]').children).slice(11).map(td => td.textContent), cellA: Array.from(document.querySelector('#kashimap-content tr[data-id="369"]').children).slice(11).map(td => td.textContent) }));
  check('K1 端末の資産なし(一覧は空・合計0)・富士山=静(サーバー)・愛鷹山=資産なし', st0.empty && st0.n === 0 && st0.total === '0.0 MB' && k1.f && k1.f.label === '静' && k1.f.src === 'server' && k1.a === null && k1.cellF.join() === '10,129,静,60km,-,-,z15(1画素≈4m・DEM5A/5B/5C),8.5 MB' && k1.cellA.join() === '—,,,,,,', JSON.stringify({ st0, k1 }));   // 第156: 範囲・樹冠・構造物・サイズの列(サーバーの索引のsizes) / 第157: ズーム

  // K2: File読込(=_kmImportText)で愛鷹山(369)の資産を作って取り込む(毛無山の資産を元にした検査用)→一覧・列・端末から描画
  const k2 = await p.evaluate(async () => {
    const a = await _kmLoadAsset('370', 'terrain', 20);
    await new Promise(r => setTimeout(r, 500)); await _kmStoreClear(); await _kmLoadDeviceIndex();   // 第152: サーバーの資産は端末にも保存されるので、この検査では一度空にする
    const files = JSON.parse(JSON.stringify(a.files));
    files.meta.mountain.id = '369'; files.meta.mountain.name = '愛鷹山'; files.outline.id = '369'; files.outline.name = '愛鷹山';
    const done = await _kmImportText(JSON.stringify({ format: 'soranotsuji-kashimap-assets', v: 1, assets: [files] }));
    return { done, info: _kmIndexInfo('369'), choice: _kmAssetChoice('369'), cell: Array.from(document.querySelector('#kashimap-content tr[data-id="369"]').children).slice(11).map(td => td.textContent) };
  });
  const st1 = await storeState();
  await selectMountain('369', true);
  await p.waitForFunction(() => _kmShown.has('369') && _kmIslandRows.length > 0, {timeout: 60000});
  const k2b = await p.evaluate(() => ({ src: _kmShown.get('369').src, range: _kmShown.get('369').range, note: document.getElementById('kashimap-detail-note').textContent, feats: glMap.getSource('km-islands')._data.features.length, radios: Array.from(document.querySelectorAll('input[name="kashimap-range"]')).map(e => e.value + (e.disabled ? 'x' : 'o')).join(',') }));
  check('K2 File読込→端末に保存(一覧に愛鷹山 20km 樹冠なし 島919 サイズ)・山リストは島の数919/「動」・選ぶと端末の資産から描画(注記に「端末の資産: 愛鷹山」・範囲100が選べる[第155])',
    k2.done.length === 1 && k2.done[0].name === '愛鷹山' && k2.done[0].islands === 919 && k2.done[0].size > 100000 && k2.info && k2.info.label === '動' && k2.info.src === 'device' && k2.info.islands === 919 && k2.cell.slice(0, 5).join() === '919,動,20km,-,-' && /^z15/.test(k2.cell[5]) && /MB$/.test(k2.cell[6]) &&
    !st1.empty && st1.n === 1 && st1.rows.length === 3 && st1.rows.every(r => r.key === '369/terrain/20') && st1.rows[1].c.join('|') === '範囲: 20km|樹冠: -|構造物: -' && st1.rows[2].c[0] === '島数: 919' && /^サイズ: [0-9.]+ MB$/.test(st1.rows[2].c[1]) && /^[0-9.]+ MB$/.test(st1.total) &&   // 第155: 1行目=チェック+目的点名の入力・合計はMBだけ / 第156: 3行1組(2行目=範囲・樹冠・構造物、3行目=島数・サイズ)
    k2b.src === 'device' && k2b.range === 20 && k2b.note.includes('端末の資産: 愛鷹山') && k2b.feats === 919 && /^100o\*?,300x,700x$/.test(k2b.radios), JSON.stringify({ k2, st1, k2b }));

  // K3: 同じ資産がサーバーと端末の両方(毛無山)→「静/動」・端末を優先(キャッシュは捨てて読み直す)
  const k3 = await p.evaluate(async () => {
    const a = await _kmLoadAsset('370', 'terrain', 20); const before = a.src;
    const files = JSON.parse(JSON.stringify(a.files)); files.meta.marker = 'device-copy';
    await _kmImportText(JSON.stringify(files));
    const b = await _kmLoadAsset('370', 'terrain', 20);
    return { before, after: b.src, marker: b.meta.marker, info: _kmIndexInfo('370') };
  });
  check('K3 サーバーと端末の両方にある資産=「静(端末)」・読込は端末を優先(単体JSONも読める)', k3.before === 'server' && k3.after === 'device' && k3.marker === 'device-copy' && k3.info.label === '静(端末)' && k3.info.rank === 3, JSON.stringify(k3));

  // K4: File出力=描画中の山の資産を1つのJSONに(愛鷹山+富士山)
  await selectMountain('368', true);
  await p.waitForFunction(() => _kmShown.has('368') && _kmShown.has('369'), {timeout: 120000});
  const k4 = await p.evaluate(() => { let got = null; const orig = window.downloadTextFile; window.downloadTextFile = (n, t, m) => { got = { n, m, obj: JSON.parse(t) }; }; try { _kmExportAssets(); } finally { window.downloadTextFile = orig; }
    return got && { n: got.n, m: got.m, format: got.obj.format, ids: got.obj.assets.map(a => a.meta.mountain.id).sort(), ok: got.obj.assets.every(a => a.meta && a.islands && a.outline && a.outline.islands.length === a.islands.islands.length) }; });
  check('K4 File出力: soranotsuji-可視マップ資産-*.json(application/json)・format・選んだ2山の資産(meta/islands/outlineが揃い島の数が一致)', k4 && /^soranotsuji-可視マップ資産-.+\.json$/.test(k4.n) && /json/.test(k4.m) && k4.format === 'soranotsuji-kashimap-assets' && k4.ids.join() === '368,369' && k4.ok, JSON.stringify(k4));

  // K5: 一覧のチェック+「削除」で個別削除(第155: 行の✕から)→山リストは資産なしに戻り、描画からも外れる
  await p.evaluate(() => { const c = document.querySelector('#kashimap-store-table tr[data-key="369/terrain/20"] .kashimap-store-check'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('btn-kashimap-store-del').click(); });
  await p.waitForFunction(() => !_kmDeviceIndex.has('369/terrain/20') && !_kmShown.has('369'), {timeout: 30000});
  const st2 = await storeState();
  const k5 = await p.evaluate(() => ({ info369: _kmIndexInfo('369'), cell: Array.from(document.querySelector('#kashimap-content tr[data-id="369"]').children).slice(11).map(td => td.textContent), shown: [..._kmShown.keys()], info370: _kmIndexInfo('370') && _kmIndexInfo('370').label }));
  check('K5 チェック+削除で愛鷹山の資産を削除→一覧から消え(毛無山は残る。富士山はサーバー由来で保存済み)・愛鷹山は資産なし(—)・描画から外れる・毛無山は静(端末)のまま', !st2.rows.some(r => r.key === '369/terrain/20') && st2.rows.some(r => r.key === '370/terrain/20') && k5.info369 === null && k5.cell.join() === '—,,,,,,' && k5.shown.join() === '368' && k5.info370 === '静(端末)', JSON.stringify({ st2, k5 }));

  // K6: 一括選択+削除で資産を全て削除(第155: 「資産を全て削除」から)・標高タイルを全削除(0MB)・読めないファイルはエラー文
  await p.evaluate(() => { document.getElementById('btn-kashimap-store-selall').click(); document.getElementById('btn-kashimap-store-del').click(); });
  await p.waitForFunction(() => _kmDeviceIndex.size === 0, {timeout: 30000});
  await jsClick('btn-kashimap-tiles-clear');
  await p.waitForTimeout(400);
  const st3 = await storeState();
  const k6 = await p.evaluate(async () => { let err = null; try { await _kmImportText('{"hello":1}'); } catch (e) { err = e.message; } return { err, info370: _kmIndexInfo('370').label }; });
  check('K6 資産を全て削除→空・合計0・毛無山は「静」に戻る / 標高タイルを削除(0.0 MB) / 資産でないJSONはエラー', st3.empty && st3.n === 0 && st3.total === '0.0 MB' && st3.tiles === '0.0 MB' && k6.info370 === '静' && /資産のファイルではありません/.test(k6.err), JSON.stringify({ st3, k6 }));

  check('E ページエラーなし', errs.length===0, errs.join(' | '));
  await b.close();
  console.log(`\n${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FAIL (exception)', e); process.exit(1); });
