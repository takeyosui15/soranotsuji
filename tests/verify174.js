// 第148ラウンド検証: v1.88.0 可視マップ(段1=山データ+山リスト。デッサン05第7版「実装の段取り」)
// ①data/mountains.json(地理院1003山+地理院に無い三百名山4座=1063山頂・名山の印・別名・JIS順の都道府県)の遅延読込
// ②位置情報メニューの「可視マップ」ボタン(検索実行+結果パネル表示)と「可視マップ」節(推し山テキスト・AND/OR・
//   百/二百/三百/百高/その他のチェック・検索ボタン・My目的点で計算[第148〜152は準備中=無効。第153で有効=verify178])
// ③結果パネル: 山リスト(ソート・行チェックで選択・全て選択/解除・行クリックで山頂へ移動)・件数表示・
//   選んだ山の山頂に山色のマーカー(色の席=空いている最小番号・解除で空く)・辻検索/辻メッシュとの排他・閉じても選択は保つ
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
const idxSrc = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const cssSrc = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const dataPath = path.join(__dirname, '..', 'data', 'mountains.json');

// ---- V0: 版数ピン(最新の検証が持つ) ----
check('V0 版数(ピンはverify175へ移譲)+Version Historyに第148/第149', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) && ((src.includes('第148ラウンド — 可視マップ(段1') && src.includes('第149ラウンド — 可視マップ節の注記')) || !!process.argv[2]));
check('S0 可視マップ節に山リストの出典と「それ以外の山はMy目的点に」の注記(第149・依頼者起草)', idxSrc.includes('それ以外の山は、My目的点に登録してご利用ください') && idxSrc.includes('日本の主な山岳標高(1003山)」を元にしています'));

// ---- D1: 山データの形 ----
{
  const d = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const fuji = d.mountains.find(m => m.name === '富士山');
  const n100 = d.mountains.filter(m => (m.lists||[]).includes('100')).length;
  const nany = d.mountains.filter(m => (m.lists||[]).length).length;
  const extras = d.mountains.filter(m => m.src !== 'gsi');
  const prefSorted = d.mountains.every(m => m.prefCode.every((c,i,a) => i===0 || a[i-1] <= c));
  check('D1 山データ=1063山頂・百名山100・名山359・地理院に無い4座・富士山=索引368(剣ヶ峯・3776m・山梨/静岡)・都道府県はJIS順',
    d.count === 1063 && d.mountains.length === 1063 && n100 === 100 && nany === 359 && extras.length === 4 &&
    fuji && fuji.id === '368' && fuji.peak === '剣ヶ峯' && fuji.elev === 3776 && fuji.prefCode.join(',') === '19,22' && fuji.lists.includes('high') && prefSorted,
    JSON.stringify({count:d.count, n100, nany, extras: extras.map(e=>e.name), fuji: fuji && [fuji.id, fuji.peak, fuji.elev, fuji.prefCode]}));
}
// ---- S1: 静的な形(メニュー・節・パネル・ヘルプ・CSS) ----
check('S1 index.html: 可視マップボタンは辻検索/辻メッシュ/宙の窓検索の次の段(第158)・節(推し山/AND/OR/5チェック/検索/My目的点で計算[第153で有効])・結果パネル・ヘルプ「可視マップ」',
  /btn-tsujimesh"[^>]*>辻メッシュ<\/button>\s*<button id="btn-soramado"[^>]*>宙の窓検索<\/button>\s*<\/div>\s*<div class="control-row main-buttons-row" id="row-kashimap-btn">\s*<button id="btn-kashimap"/.test(idxSrc) &&   // 第158: 宙の窓検索が辻検索/辻メッシュの段・可視マップは次の段(封鎖の対象の段)
  ['input-kashimap-query','radio-kashimap-and','radio-kashimap-or','chk-kashimap-100','chk-kashimap-200','chk-kashimap-300','chk-kashimap-high','chk-kashimap-other','btn-kashimap-search','kashimap-panel','btn-kashimap-max','btn-kashimap-close','btn-kashimap-select-all','btn-kashimap-select-none','kashimap-status'].every(id => idxSrc.includes(`id="${id}"`)) &&
  /<input type="radio" name="kashimap-compute-target" id="radio-kashimap-mytgt" value="mytgt">:My目的点<\/label>/.test(idxSrc) && /<button id="btn-kashimap-compute"[^>]*>範囲を計算<\/button>/.test(idxSrc) &&   // 第156: 「:My目的点」ラジオ+「範囲を計算」
  idxSrc.includes('<h3>可視マップ</h3>') && idxSrc.includes('日本の主な山岳標高一覧 (1003山)') &&   // (第158のレビュー: 上の行末コメントがこの2条件を飲み込んでいたのを戻した)
  cssSrc.includes('#kashimap-panel.maximized') && cssSrc.includes('#kashimap-panel.with-soramado-max'));
check('S1b ヘルプ・UI文言に内輪文脈(ラウンド番号)が無い', !/可視マップ[^<]*第1\d\dラウンド/.test(idxSrc) && !/kashimap[^\n]*第1\d\d/.test(idxSrc.replace(/<!--[\s\S]*?-->/g,'')));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html?kashimap=1',{waitUntil:'load'});   // 可視マップは封鎖中(第158)。開錠して検査
  await p.waitForFunction(()=>typeof drawSoramado==='function' && typeof runKashimapSearch==='function',{timeout:8000});
  await p.waitForTimeout(600);
  const jsClick = id => p.evaluate(i => document.getElementById(i).click(), id);
  const setQ = v => p.evaluate(v => { document.getElementById('input-kashimap-query').value = v; }, v);
  const setChk = (id, on) => p.evaluate(([i, o]) => { const el = document.getElementById(i); if (el.checked !== o) { el.checked = o; el.dispatchEvent(new Event('change', { bubbles: true })); } }, [id, on]);
  const rows = () => p.evaluate(() => Array.from(document.querySelectorAll('#kashimap-content tr.td-data-row')).map(tr => ({ id: tr.dataset.id, name: tr.children[3].textContent, pref: tr.children[6].textContent, elev: tr.children[9].textContent })));
  const waitRows = async () => { await p.waitForFunction(() => document.querySelectorAll('#kashimap-content tr.td-data-row').length > 0 || /失敗|該当する山が/.test(document.getElementById('kashimap-content').textContent), {timeout: 8000}); return rows(); };

  // K1: 位置情報メニューの「可視マップ」ボタン=検索実行+結果パネル表示。既定(百名山のみ・語なし)で100件
  await jsClick('btn-kashimap');
  let r = await waitRows();
  const k1 = await p.evaluate(() => ({ hidden: document.getElementById('kashimap-panel').classList.contains('hidden'), active: document.getElementById('btn-kashimap').classList.contains('active'), status: document.getElementById('kashimap-status').textContent, seqFirst: document.querySelector('#kashimap-content tr.td-data-row').children[1].textContent }));
  check('K1 可視マップボタン→パネル表示+百名山100件(既定=百名山のみ・連番の昇順=先頭は羅臼岳[連番5])', !k1.hidden && k1.active && r.length===100 && /山100件/.test(k1.status) && r.every(x=>x.id) && k1.seqFirst==='5' && r[0].name==='羅臼岳', JSON.stringify({...k1, n:r.length, first:r[0]}));

  // K2: 語の検索(AND): 「富士」→富士山を含み、全行が山名/別名に富士を含む
  await setQ('富士');
  await jsClick('btn-kashimap-search');
  await p.waitForTimeout(150);
  r = await rows();
  const k2ok = await p.evaluate(() => Array.from(document.querySelectorAll('#kashimap-content tr.td-data-row')).every(tr => { const m = _kmById.get(tr.dataset.id); return [m.name].concat(m.alias || []).some(v => v.includes('富士')); }));
  check('K2 「富士」(百名山)→富士山を含む・全行が山名か別名に「富士」(利尻富士・蝦夷富士も当たる)', r.length>=3 && r.some(x=>x.name==='富士山') && k2ok, JSON.stringify(r.map(x=>x.name)));

  // K3: AND/OR: 「長野 山梨」AND=両県の山だけ、OR=どちらかの県
  await setQ('長野 山梨');
  await jsClick('btn-kashimap-search'); await p.waitForTimeout(150);
  const rAnd = await rows();
  await setChk('radio-kashimap-or', true);
  await jsClick('btn-kashimap-search'); await p.waitForTimeout(150);
  const rOr = await rows();
  await setChk('radio-kashimap-and', true);
  check('K3 AND=長野と山梨の両方(全行)・OR=どちらか(件数が増える)', rAnd.length>=3 && rAnd.every(x=>/長野県/.test(x.pref)&&/山梨県/.test(x.pref)) && rOr.length>rAnd.length && rOr.every(x=>/長野県|山梨県/.test(x.pref)), JSON.stringify({and:rAnd.map(x=>x.name), or:rOr.length}));

  // K4: 全チェック+語なし=1063件(その他を含む)。その他のみ=704
  await setQ('');
  for (const id of ['chk-kashimap-200','chk-kashimap-300','chk-kashimap-high','chk-kashimap-other']) await setChk(id, true);
  await jsClick('btn-kashimap-search'); await p.waitForTimeout(300);
  const nAll = (await rows()).length;
  for (const id of ['chk-kashimap-100','chk-kashimap-200','chk-kashimap-300','chk-kashimap-high']) await setChk(id, false);
  await jsClick('btn-kashimap-search'); await p.waitForTimeout(300);
  const nOther = (await rows()).length;
  await setChk('chk-kashimap-100', true); await setChk('chk-kashimap-other', false);
  await jsClick('btn-kashimap-search'); await p.waitForTimeout(200);
  check('K4 全リスト+その他=1063件・その他だけ=704件', nAll===1063 && nOther===704, JSON.stringify({nAll,nOther}));

  // K5: 行チェック=選択→山頂マーカー(山色=席番号)・解除で席が空く・全て選択/全て解除
  const k5 = await p.evaluate(async () => {
    const trs = Array.from(document.querySelectorAll('#kashimap-content tr.td-data-row'));
    const chk = i => trs[i].querySelector('input.kashimap-check');
    const setC = (i, on) => { chk(i).checked = on; chk(i).dispatchEvent(new Event('change', { bubbles: true })); };
    setC(0, true); setC(1, true);
    const after2 = { n: _glMarkerGroups['kashimap'].length, seats: [ _kmSelected.get(trs[0].dataset.id), _kmSelected.get(trs[1].dataset.id) ], status: document.getElementById('kashimap-status').textContent };
    setC(0, false);            // 席0が空く
    setC(2, true);             // 3山目は空いている席0
    const after3 = { n: _glMarkerGroups['kashimap'].length, seat2: _kmSelected.get(trs[2].dataset.id), seat1: _kmSelected.get(trs[1].dataset.id), rowSel: trs[2].classList.contains('selected'), swatch: !!trs[2].querySelector('.kashimap-swatch') };
    const colors = _glMarkerGroups['kashimap'].map(mk => mk.getElement().querySelector('svg') ? 'svg' : 'x');
    return { after2, after3, colors };
  });
  check('K5 選択→マーカー2本(席0,1)・解除で席0が空き3山目が席0・行の強調と色見本', k5.after2.n===2 && k5.after2.seats.join(',')==='0,1' && /選択2/.test(k5.after2.status) && k5.after3.n===2 && k5.after3.seat2===0 && k5.after3.seat1===1 && k5.after3.rowSel && k5.after3.swatch, JSON.stringify(k5));
  await jsClick('btn-kashimap-select-all'); await p.waitForTimeout(200);
  const k5b = await p.evaluate(() => ({ sel: _kmSelected.size, mk: _glMarkerGroups['kashimap'].length, checked: document.querySelectorAll('#kashimap-content input.kashimap-check:checked').length }));
  await jsClick('btn-kashimap-select-none'); await p.waitForTimeout(200);
  const k5c = await p.evaluate(() => ({ sel: _kmSelected.size, mk: _glMarkerGroups['kashimap'].length, checked: document.querySelectorAll('#kashimap-content input.kashimap-check:checked').length }));
  check('K5b 全て選択=100山100本→全て解除=0', k5b.sel===100 && k5b.mk===100 && k5b.checked===100 && k5c.sel===0 && k5c.mk===0 && k5c.checked===0, JSON.stringify({k5b,k5c}));

  // K6: 見出しソート(標高の降順で先頭が富士山)
  const k6 = await p.evaluate(() => {
    const th = Array.from(document.querySelectorAll('#kashimap-content th')).find(h => h.textContent.startsWith('標高'));
    th.click(); th.click();
    const first = document.querySelector('#kashimap-content tr.td-data-row');
    return { head: th.textContent, first: first.children[3].textContent, elev: first.children[9].textContent };
  });
  check('K6 標高の見出しを2回クリック→降順・先頭は富士山3776', /▼$/.test(k6.head) && k6.first==='富士山' && k6.elev==='3776', JSON.stringify(k6));

  // K7: 行クリックで地図がその山頂へ(富士山)
  const k7 = await p.evaluate(async () => {
    const before = glMap.getCenter();
    document.querySelector('#kashimap-content tr.td-data-row').click();
    await new Promise(r => setTimeout(r, 600));
    const c = glMap.getCenter();
    return { before: [before.lat, before.lng], after: [c.lat, c.lng] };
  });
  // recenterPointInViewは下部パネルに隠れない領域の中央へ置くので、中心は山頂より南にずれる(経度は一致)
  check('K7 行クリック→地図が富士山(経度138.727)へ移動(緯度は下部パネル分だけ南へオフセット)', Math.abs(k7.after[1]-138.7274)<0.02 && (35.3607-k7.after[0])>-0.05 && (35.3607-k7.after[0])<0.9 && Math.abs(k7.before[1]-138.7274)>0.5, JSON.stringify(k7));

  // K8: 排他(辻メッシュを開くと可視マップが閉じる)・閉じても選択は保つ・開き直しでマーカー復帰
  const k8 = await p.evaluate(async () => {
    window.confirm = () => true; window.alert = () => {};
    const trs = document.querySelectorAll('#kashimap-content tr.td-data-row');
    const chk = trs[0].querySelector('input.kashimap-check'); chk.checked = true; chk.dispatchEvent(new Event('change', { bubbles: true }));
    const selBefore = _kmSelected.size, mkBefore = _glMarkerGroups['kashimap'].length;
    toggleTsujiMesh();                                    // 排他: 可視マップが閉じる
    const closedByMesh = document.getElementById('kashimap-panel').classList.contains('hidden') && !_kmActive && !document.getElementById('btn-kashimap').classList.contains('active');
    const mkClosed = _glMarkerGroups['kashimap'].length;
    closeTsujiMesh();
    document.getElementById('btn-kashimap').click();      // 開き直し(検索実行)
    await new Promise(r => setTimeout(r, 400));
    const meshHidden = document.getElementById('tsujimesh-panel').classList.contains('hidden');
    const reopened = _kmActive && !document.getElementById('kashimap-panel').classList.contains('hidden');
    return { selBefore, mkBefore, closedByMesh, mkClosed, meshHidden, reopened, selAfter: _kmSelected.size, mkAfter: _glMarkerGroups['kashimap'].length };
  });
  check('K8 辻メッシュで排他的に閉じる(マーカー0)→開き直しで選択1が復帰(マーカー1)', k8.selBefore===1 && k8.mkBefore===1 && k8.closedByMesh && k8.mkClosed===0 && k8.meshHidden && k8.reopened && k8.selAfter===1 && k8.mkAfter===1, JSON.stringify(k8));

  // K9: ✕で閉じる・最大化トグル
  const k9 = await p.evaluate(() => {
    document.getElementById('btn-kashimap-max').click();
    const maxOn = document.getElementById('kashimap-panel').classList.contains('maximized') && document.getElementById('btn-kashimap-max').classList.contains('active');
    document.getElementById('btn-kashimap-close').click();
    return { maxOn, hidden: document.getElementById('kashimap-panel').classList.contains('hidden'), active: document.getElementById('btn-kashimap').classList.contains('active'), maxReset: !document.getElementById('kashimap-panel').classList.contains('maximized'), mk: _glMarkerGroups['kashimap'].length };
  });
  check('K9 ⛶で最大化→✕で閉じる(最大化も戻る・マーカー0)', k9.maxOn && k9.hidden && !k9.active && k9.maxReset && k9.mk===0, JSON.stringify(k9));

  // K10: 読みでの検索(カタカナ入力→ひらがなの読みに当たる)・Enterキーで検索
  await setQ('ヤリ');
  await p.evaluate(() => document.getElementById('input-kashimap-query').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  await p.waitForTimeout(300);
  r = await rows();
  check('K10 「ヤリ」+Enter→読み「やりがたけ」の槍ヶ岳に当たる(パネルも開く)', r.some(x=>x.name==='槍ヶ岳') && await p.evaluate(()=>_kmActive), JSON.stringify(r.map(x=>x.name)));

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
