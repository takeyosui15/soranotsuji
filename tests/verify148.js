// 第81ラウンド検証: v1.65.0
// 辻検索⇄辻メッシュ検索の同名項目連動(怒号の項目4・方針転換): ペア49項目の双方向連動・
// 起動時の統一(通常=辻検索が正/URLメッシュ復元=メッシュが正)・非連動項目の独立維持
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

// ---- V0: 版数の存在検査(版数ピンは最新のverify149へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.65.0の行がある', src.includes('Version 1.65.0 - ') || !!process.argv[2]);

// ---- V1: 静的な形(起動時の統一呼び出し・URL復元でメッシュ側を正にする印) ----
check('V1 起動時に_tsujiLinkPropagate(_tsujiLinkInitFrom)を呼ぶ', src.includes('_tsujiLinkPropagate(_tsujiLinkInitFrom)'));
check('V1 URLのメッシュ復元で_tsujiLinkInitFrom=mesh', src.includes("_tsujiLinkInitFrom = 'mesh'"));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof drawSoramado==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // K1: 辻検索→メッシュ(検索期間の実UI変更)
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      const el=document.getElementById('input-tsuji-search-days');
      el.value='123'; el.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,50));
      return { meshState: appState.tsujiMeshDays, meshInput: document.getElementById('input-tsujimesh-days').value,
               tsujiState: appState.tsujiSearchDays };
    });
    check('K1 辻検索の検索期間変更→メッシュの状態と入力欄に映る', r.tsujiState===123&&r.meshState===123&&r.meshInput==='123', JSON.stringify(r));
  }

  // K2: メッシュ→辻検索(基準月齢+許容範囲方位角)
  {
    const r=await p.evaluate(async()=>{
      const mb=document.getElementById('input-tsujimesh-moon-base');
      mb.value='7.5'; mb.dispatchEvent(new Event('change',{bubbles:true}));
      const tol=document.getElementById('input-tsujimesh-az-tolerance');
      tol.value='30'; tol.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,50));
      return { tsujiMoon: appState.tsujiMoonBase, tsujiMoonInput: document.getElementById('input-tsuji-moon-base').value,
               tsujiTol: appState.tsujiSearchToleranceAz, tsujiTolInput: document.getElementById('input-tsuji-az-tolerance').value };
    });
    check('K2 メッシュの基準月齢/許容範囲変更→辻検索の状態と入力欄に映る',
      r.tsujiMoon===7.5&&r.tsujiMoonInput==='7.5'&&r.tsujiTol===30&&r.tsujiTolInput==='30', JSON.stringify(r));
  }

  // K3: 検索中心ラジオ(メッシュで線→辻検索も線)+月間チェック(辻検索→メッシュ・活性状態も追従)
  {
    const r=await p.evaluate(async()=>{
      const lineR=document.querySelector('input[name="tsujimesh-center-mode"][value="line"]');
      lineR.checked=true; lineR.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,50));
      const centerOk=appState.tsujiCenterMode==='line'&&document.querySelector('input[name="tsuji-center-mode"][value="line"]').checked;
      const mf=document.getElementById('chk-tsuji-month-filter');
      mf.checked=true; mf.dispatchEvent(new Event('change',{bubbles:true}));
      const m3=document.getElementById('chk-tsuji-month-3');
      m3.checked=true; m3.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,50));
      const monthOk=appState.tsujiMeshMonthFilter===true&&appState.tsujiMeshMonth3===true&&
        document.getElementById('chk-tsujimesh-month-filter').checked&&
        document.getElementById('chk-tsujimesh-month-3').checked&&
        document.getElementById('chk-tsujimesh-month-3').disabled===false;   // 活性状態も追従
      // 後始末
      mf.checked=false; mf.dispatchEvent(new Event('change',{bubbles:true}));
      m3.checked=false; m3.dispatchEvent(new Event('change',{bubbles:true}));
      const pointR=document.querySelector('input[name="tsuji-center-mode"][value="point"]');
      pointR.checked=true; pointR.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,50));
      return { centerOk, monthOk, backPoint: appState.tsujiMeshCenterMode==='point' };
    });
    check('K3 検索中心(メッシュ→辻検索)と月間フィルタ(辻検索→メッシュ・活性も追従)が連動', r.centerOk&&r.monthOk&&r.backPoint, JSON.stringify(r));
  }

  // K4: 非連動項目は独立のまま(辻検索の精度フィルタ変更がメッシュの固定精度を動かさない)
  {
    const r=await p.evaluate(async()=>{
      const acc=document.getElementById('chk-tsuji-accuracy-filter');
      acc.checked=true; acc.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,50));
      // 第131の意図更新: メッシュの:○表示は常時オンの固定表示(依頼者の設計モデル=精度フィルタは
      // 対象の下限○までを示す固定の枠)。K4の意図「辻検索の変更が波及しない」はそのまま:
      // 辻検索の精度フィルタを切り替えても、○表示は常時オンのまま・状態キーもfalseのまま
      const meshFixed=document.getElementById('chk-tsujimesh-sym-maru').checked===true&&
        appState.tsujiMeshSymO===false;
      acc.checked=false; acc.dispatchEvent(new Event('change',{bubbles:true}));
      return { meshFixed, tsujiAcc: appState.tsujiAccuracyFilterEnabled===false };
    });
    check('K4 精度フィルタは非連動(辻検索の変更がメッシュの固定精度に影響しない)', r.meshFixed, JSON.stringify(r));
  }

  // K5: オフセット中心角(共有キー)の相手側表示追従
  {
    const r=await p.evaluate(async()=>{
      const el=document.getElementById('input-tsuji-mw-offset');
      el.value='25'; el.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,100));
      const meshShown=document.getElementById('input-tsujimesh-mw-offset').value;
      el.value='0'; el.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,50));
      return { meshShown, state: appState.mwOffsetAngle===0 };
    });
    check('K5 オフセット中心角の変更が相手メニューの表示にも映る', r.meshShown==='25', JSON.stringify(r));
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();

  // ---- K6: URLがメッシュ側を復元した時は起動時にメッシュ側が正 ----
  {
    const ctx2=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
    await ctx2.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    const p2=await ctx2.newPage();
    await p2.goto(BASE+'/index.html?mode=tsujimesh&tsujiMeshDays=77&tsujiMeshMoonFilter=true&tsujiMeshMoonBase=3.5',{waitUntil:'load'});
    await p2.waitForFunction(()=>typeof drawSoramado==='function',{timeout:8000});
    await p2.waitForTimeout(800);
    const r=await p2.evaluate(()=>({
      tDays: appState.tsujiSearchDays, mDays: appState.tsujiMeshDays,
      tMoon: appState.tsujiMoonFilterEnabled, tBase: appState.tsujiMoonBase,
      tInput: document.getElementById('input-tsuji-search-days').value }));
    await ctx2.close();
    check('K6 メッシュURLで開くと辻検索側もメッシュの値に揃う(77日・月齢3.5)',
      r.tDays===77&&r.mDays===77&&r.tMoon===true&&r.tBase===3.5&&r.tInput==='77', JSON.stringify(r));
  }

  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
