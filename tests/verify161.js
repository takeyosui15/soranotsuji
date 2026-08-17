// 第96ラウンド検証: v1.78.0
// まとめ確認への対応 最終陣: ①辻ライン365にも「:辻オフセット方位角/視高度」を反映
//   (方位角=描画時の回転・視高度=経路計算のaltOffset。オフセット/チェックの変更はキャッシュの
//    キー比較で検知して引き直す。線モードの刻みは365には適用しない)
//   ②花火モードの頻度スライダー(表示モードとばらつきの間。50=基準・100=3倍・0=停止。
//    メニュー/ctrl連動・保存・URLキーfwFreq=辞書v18)。
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

// ---- V0: 版数の存在検査(版数ピンは最新のverify162へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.78.0の行がある', src.includes('Version 1.78.0 - ') || !!process.argv[2]);

// ---- V1: 静的な形 ----
check('V1 365の経路計算にaltOffsetが渡る', src.includes("owner: 'dp365', altOffset: offAlt"));
check('V1 365の描画に方位角の回転(-offAz)が渡る', src.includes('drawDP365Path(pts, body.color, null, body.id, -offAz)'));
check('V1 辞書はv18(fwFreqのシード)', src.includes("_QP_SEEDS_V18 = _QP_SEEDS_V17.concat(['&fwFreq=50', '&fwFreq='])"));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof updateDP365Lines==='function',{timeout:8000});
  await p.waitForTimeout(400);

  // D1: 辻ライン365がオフセットを反映する(経路計算の差し替えで実測: altOffsetの伝搬・回転・キャッシュ引き直し)
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      const origCalc = calculateDPPathPoints;
      const calls=[];
      // 疑似経路: 方位角100°・距離50kmの1点(lat/lngはnull=描画側が方位角から座標を求める経路を通す)
      window.calculateDPPathPoints = (day, body, obs, opts) => {
        calls.push({ alt: opts.altOffset, owner: opts.owner });
        return Promise.resolve([{ az: 100, dist: 50000, time: new Date(), lat: null, lng: null }]);
      };
      const vis0 = appState.bodies.map(b=>b.visible);
      appState.bodies.forEach(bd=>bd.visible = bd.id==='MilkyWay');
      appState.tsujiLineIncludeOffset = true;
      appState.tsujiSearchOffsetAz = 10; appState.tsujiSearchOffsetAlt = 3;
      appState.isDP365Active = true;
      clearAllDP365Layers();
      await updateDP365Lines();
      const c1 = { n: calls.length, alt: calls[0] && calls[0].alt, owner: calls[0] && calls[0].owner };
      // 描いた線の座標: 方位角100-10=90°の位置(回転が効いている)
      const feat = (_glDp365Features['MilkyWay']||[])[0];
      const got1 = feat && feat.geometry.coordinates[0][0];
      const exp90 = getObserverFromTargetBackAzimuth(appState.end.lat, appState.end.lng, 90, 50000);
      const rotOk = got1 && Math.abs(got1[0]-exp90.lng)<1e-9 && Math.abs(got1[1]-exp90.lat)<1e-9;
      // チェックをオフ→キャッシュのキーが変わり引き直し(計算済みでも再計算される)
      calls.length = 0;
      appState.tsujiLineIncludeOffset = false;
      await updateDP365Lines();
      const c2 = { n: calls.length, alt: calls[0] && calls[0].alt };
      const feat2 = (_glDp365Features['MilkyWay']||[])[0];
      const got2 = feat2 && feat2.geometry.coordinates[0][0];
      const exp100 = getObserverFromTargetBackAzimuth(appState.end.lat, appState.end.lng, 100, 50000);
      const baseOk = got2 && Math.abs(got2[0]-exp100.lng)<1e-9 && Math.abs(got2[1]-exp100.lat)<1e-9;
      // 同じ設定のままもう一度→キャッシュ有効(再計算なし)
      calls.length = 0;
      await updateDP365Lines();
      const c3 = calls.length;
      // 後始末
      appState.isDP365Active = false;
      clearAllDP365Layers();
      window.calculateDPPathPoints = origCalc;
      appState.bodies.forEach((bd,i)=>bd.visible = vis0[i]);
      appState.tsujiLineIncludeOffset = true;
      appState.tsujiSearchOffsetAz = 0; appState.tsujiSearchOffsetAlt = 0;
      return { c1, rotOk, c2, baseOk, c3 };
    });
    check('D1 365日分の経路計算に視高度オフセット3°が渡る(365回・owner=dp365)',
      r.c1.n===365&&r.c1.alt===3&&r.c1.owner==='dp365', JSON.stringify(r.c1));
    check('D1 描いた線は方位角オフセット10°の回転込み(方位角100°の点が90°の位置へ)', r.rotOk, JSON.stringify(r.c1));
    check('D1 チェックオフ→キャッシュを捨てて引き直し(altOffset=0・線は基準点の位置へ戻る)',
      r.c2.n===365&&r.c2.alt===0&&r.baseOk, JSON.stringify(r.c2));
    check('D1 同じ設定の再呼び出しは再計算しない(キャッシュ有効)', r.c3===0, String(r.c3));
  }

  // F1: 頻度スライダーの部品と配置(表示モードとばらつきの間・両面)+初期値50
  {
    const r=await p.evaluate(()=>{
      const between=(aSel,bId,cId)=>{
        const a=document.querySelector(aSel).closest('.control-row');
        const bRow=document.getElementById(bId).closest('.control-row');
        const cRow=document.getElementById(cId).closest('.control-row');
        return (a.compareDocumentPosition(bRow)&Node.DOCUMENT_POSITION_FOLLOWING) &&
               (bRow.compareDocumentPosition(cRow)&Node.DOCUMENT_POSITION_FOLLOWING);
      };
      return {
        main: between('input[name="fw-mode"]','input-fw-freq','input-fw-spread'),
        ctrl: between('input[name="fw-mode-ctrl"]','input-fw-ctrl-freq','input-fw-ctrl-spread'),
        lbl: document.getElementById('fw-freq-label').textContent,
        val: document.getElementById('input-fw-freq').value,
        cval: document.getElementById('input-fw-ctrl-freq').value };
    });
    check('F1 頻度の段が表示モードとばらつきの間にある(メニュー/ctrl両面)', r.main&&r.ctrl, JSON.stringify(r));
    check('F1 初期値50(ラベルとスライダー両面)', r.lbl==='50'&&r.val==='50'&&r.cval==='50', JSON.stringify(r));
  }

  // F2: 頻度の実効(スケジューラの間隔と停止)+連動+丸め
  {
    const r=await p.evaluate(async()=>{
      // 宙の窓を開いて花火グループを生やす
      toggleSoramado();
      await new Promise(r=>setTimeout(r,600));
      appState.fwEnabled = true;
      const iv = v => {   // 頻度vで1回スケジュールした時の次回までの間隔
        appState.fwFreq = v;
        _fwShells = []; _fwNextLaunchAt = 0;
        _fwUpdateScene(10000);
        return { gap: _fwNextLaunchAt ? _fwNextLaunchAt - 10000 : 0, shells: _fwShells.length };
      };
      const at50 = iv(50), at100 = iv(100), at0 = iv(0);
      // ctrl側スライダーで75へ→本家ラベル/スライダーが追従
      const el=document.getElementById('input-fw-ctrl-freq');
      el.value='75'; el.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(r=>setTimeout(r,100));
      const sync={ st: appState.fwFreq, lbl: document.getElementById('fw-freq-label').textContent,
                   main: document.getElementById('input-fw-freq').value };
      // 丸め(normalize)
      appState.fwFreq = 999; normalizeAppState(); const clamped = appState.fwFreq;
      appState.fwFreq = 50; fwSyncUI();
      appState.fwEnabled = false;
      toggleSoramado();
      await new Promise(r=>setTimeout(r,200));
      return { at50, at100, at0, sync, clamped };
    });
    check('F2 頻度50=基準間隔(500〜1700ms)・100=1/3(167〜567ms)で玉も上がる',
      r.at50.shells===1&&r.at50.gap>=500&&r.at50.gap<=1700&&
      r.at100.shells===1&&r.at100.gap>=166&&r.at100.gap<=567, JSON.stringify({at50:r.at50,at100:r.at100}));
    check('F2 頻度0=打ち上げ停止(玉もスケジュールも増えない)', r.at0.shells===0&&r.at0.gap===0, JSON.stringify(r.at0));
    check('F2 ctrlのスライダー75→状態/本家ラベル/本家スライダーが追従', r.sync.st===75&&r.sync.lbl==='75'&&r.sync.main==='75', JSON.stringify(r.sync));
    check('F2 範囲外999はnormalizeで100へ丸め', r.clamped===100, String(r.clamped));
  }

  // F3: URLキーfwFreq(発行=full/soramadoに乗る・復元)
  {
    const r=await p.evaluate(()=>{
      appState.fwFreq = 80;
      const full=buildCommonUrlParams('fixed');
      const sora=buildCommonUrlParams('fixed','soramado');
      const tsuji=buildCommonUrlParams('fixed','tsuji');
      appState.fwFreq = 50;
      return { full: full.get('fwFreq'), sora: sora.get('fwFreq'), tsuji: tsuji.has('fwFreq') };
    });
    check('F3 fwFreqが位置情報/宙の窓URLに乗り(80)、辻検索URLには乗らない', r.full==='80'&&r.sora==='80'&&r.tsuji===false, JSON.stringify(r));
  }
  check('E1 ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();

  // F4: URLからの復元(長いURL直書き)
  {
    const ctx2=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
    await ctx2.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    const p2=await ctx2.newPage();
    await p2.goto(BASE+'/index.html?mode=preview&fwFreq=80',{waitUntil:'load'});
    await p2.waitForFunction(()=>typeof drawSoramado==='function',{timeout:8000});
    await p2.waitForTimeout(600);
    const r=await p2.evaluate(()=>({ fq: appState.fwFreq, lbl: document.getElementById('fw-freq-label').textContent }));
    await ctx2.close();
    check('F4 URLのfwFreq=80が復元されUIにも映る', r.fq===80&&r.lbl==='80', JSON.stringify(r));
  }

  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
