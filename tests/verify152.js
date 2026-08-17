// 第85ラウンド検証: v1.69.0
// 怒号の項目12: 基本オプションの辻ライン項目の刷新。
//   旧「天の川の基準点」ラジオ撤去(項目6のチェックが同状態を担う)・「:辻オフセット方位角/視高度」
//   チェック新設(オン=検索中心の辻ライン)・「検索中心オプション」の3面連動(基本オプション⇄辻検索⇄辻メッシュ)・
//   線モードでは仰角1°置きの複数実線(装飾は両端のみ)。
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
const wsrc = fs.readFileSync(path.join(path.dirname(target), 'dp-line-worker.js'), 'utf8');

// ---- V0: 版数の存在検査(版数ピンは最新のverify153へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.69.0の行がある', src.includes('Version 1.69.0 - ') || !!process.argv[2]);

// ---- V1: 静的な形(視高度オフセットが両方の経路計算に入っている) ----
check('V1 workerがaltOffsetを受けて目標高度をずらす',
  wsrc.includes('altOffset') && wsrc.includes('hor.altitude - altOff'));
check('V1 スクリプト側がaltOffsetをworkerへ渡し、アニメ経路でも使う',
  src.includes('altOffset,    // 辻オフセット視高度') && src.includes('calculateDistanceForAltitudes(hor.altitude - altOffset'));
check('V1 保存キーtsujiLineIncludeOffsetがある',
  src.includes('tsujiLineIncludeOffset: appState.tsujiLineIncludeOffset') && src.includes("'tsujiLineIncludeOffset'"));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof updateDPLines==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // D1: メニューの形(旧ラジオ撤去+新チェック/新ラジオ)
  {
    const r=await p.evaluate(()=>({
      oldGone: document.querySelector('input[name="baseopt-mw-base"]')===null,
      chk: !!document.getElementById('chk-baseopt-tsujiline-offset'),
      chkOn: document.getElementById('chk-baseopt-tsujiline-offset').checked,
      radios: document.querySelectorAll('input[name="baseopt-center-mode"]').length,
      pointOn: document.querySelector('input[name="baseopt-center-mode"][value="point"]').checked,
      stateOn: appState.tsujiLineIncludeOffset !== false
    }));
    check('D1 旧「天の川の基準点」ラジオ撤去・新チェック(既定オン)・検索中心ラジオ2個(点が既定)',
      r.oldGone&&r.chk&&r.chkOn&&r.radios===2&&r.pointOn&&r.stateOn, JSON.stringify(r));
  }

  // D2: 検索中心オプションの3面連動
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      const bLine=document.querySelector('input[name="baseopt-center-mode"][value="line"]');
      bLine.checked=true; bLine.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,100));
      const toLine={ t:appState.tsujiCenterMode, m:appState.tsujiMeshCenterMode,
        tR:document.querySelector('input[name="tsuji-center-mode"][value="line"]').checked,
        mR:document.querySelector('input[name="tsujimesh-center-mode"][value="line"]').checked };
      const tPoint=document.querySelector('input[name="tsuji-center-mode"][value="point"]');
      tPoint.checked=true; tPoint.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,150));
      const back={ t:appState.tsujiCenterMode, m:appState.tsujiMeshCenterMode,
        bR:document.querySelector('input[name="baseopt-center-mode"][value="point"]').checked };
      return { toLine, back };
    });
    check('D2 基本オプションで線→辻検索/辻メッシュの状態とラジオが線に',
      r.toLine.t==='line'&&r.toLine.m==='line'&&r.toLine.tR&&r.toLine.mR, JSON.stringify(r.toLine));
    check('D2 辻検索で点に戻す→基本オプションのラジオも点に追従', r.back.t==='point'&&r.back.m==='point'&&r.back.bR, JSON.stringify(r.back));
  }

  // D3: 辻ラインへのオフセットの効き(天の川だけ表示・日時固定で決定的に比較)
  {
    const r=await p.evaluate(async()=>{
      appState.bodies.forEach(b=>b.visible=(b.id==='MilkyWay'));
      appState.currentDate=new Date(2026,7,14,21,0,0);
      appState.isDPActive=true;
      appState.tsujiLineIncludeOffset=true;
      appState.tsujiSearchOffsetAz=0; appState.tsujiSearchOffsetAlt=0;
      appState.tsujiCenterMode='point';
      const firstSolid=()=>{ const f=_glDpFeatures.find(f=>f.properties.dash==='solid'); return f?f.geometry.coordinates[0].slice():null; };
      await updateDPLines();
      const A=firstSolid(), nA=_glDpFeatures.length;
      appState.tsujiSearchOffsetAz=10;
      await updateDPLines();
      const B=firstSolid();
      appState.tsujiLineIncludeOffset=false;   // チェックオフ→基準点の辻ラインへ戻る
      await updateDPLines();
      const C=firstSolid();
      appState.tsujiLineIncludeOffset=true; appState.tsujiSearchOffsetAz=0; appState.tsujiSearchOffsetAlt=3;
      await updateDPLines();
      const D=firstSolid();
      const eq=(u,v)=>u&&v&&Math.abs(u[0]-v[0])<1e-9&&Math.abs(u[1]-v[1])<1e-9;
      return { has:!!A&&!!B&&!!C&&!!D, azMoves:!eq(A,B), offRestores:eq(A,C), altMoves:!eq(A,D)&&!eq(B,D), nA };
    });
    check('D3 方位角オフセット10°で線が動き・チェックオフで基準点の線に戻り・視高度オフセット3°でも動く',
      r.has&&r.azMoves&&r.offRestores&&r.altMoves, JSON.stringify(r));
  }

  // D4: 線モードは仰角1°置きの複数実線(装飾は両端のみ=実線が増える)
  {
    const r=await p.evaluate(async()=>{
      appState.tsujiSearchOffsetAz=0; appState.tsujiSearchOffsetAlt=2; appState.tsujiCenterMode='point';
      await updateDPLines();
      const solidPoint=_glDpFeatures.filter(f=>f.properties.dash==='solid').length;
      appState.tsujiCenterMode='line';   // 仰角2°→0/1/2の3本
      await updateDPLines();
      const solidLine=_glDpFeatures.filter(f=>f.properties.dash==='solid').length;
      const total=_glDpFeatures.length;
      // 後始末
      appState.tsujiCenterMode='point'; appState.tsujiSearchOffsetAlt=0;
      appState.bodies.forEach(b=>{ if(b.id==='Sun'||b.id==='Moon'||b.id==='MilkyWay') b.visible=true; });
      await updateDPLines();
      return { solidPoint, solidLine, total };
    });
    check('D4 線モード(仰角2°)で実線の本数が点モードより増える(3本分)', r.solidLine>r.solidPoint&&r.solidLine>=3, JSON.stringify(r));
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
