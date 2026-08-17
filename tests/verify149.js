// 第82ラウンド検証: v1.66.0
// 怒号の項目6: 「:天の川オプション」チェックボックス(4面+My辻行)と、オフセット中心角の±表示反転。
//   実体は基準点(baseOptMwBase)と同じ1状態(オン=オフセット点/オフ=中心座標。値は保持)。
//   ±は画面の入出力だけ反転(夏の天の川を上から見て時計回り=正)。内部・保存・URL・CSV・Fileは従来符号。
// 意図更新(第85ラウンド・項目12): 「天の川の基準点」ラジオは撤去された(チェックが同じ状態を担うため)。
//   W2/W3のラジオ追従の表明を削り、W4はラジオ撤去の確認に置き換えた。
// 意図更新(第93ラウンド): ±は内部値ごと新しい符号に統一(表示だけの反転を廃止)・検索記録は生の
//   オフセット中心角へ・My辻行の初期値はオフ。W3/W6/W7と静的表明を新仕様へ置き換えた。
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

// ---- V0: 版数の存在検査(版数ピンは最新のverify150へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.66.0の行がある', src.includes('Version 1.66.0 - ') || !!process.argv[2]);

// ---- V1: 静的な形(実効角ヘルパーの使用箇所・Fileの生符号・既存行の正規化) ----
check('V1 getMilkyWayBaseRaDecが実効角(_mwEffOffsetAngle)を使う',
  /function getMilkyWayBaseRaDec\(\) \{\s*\n\s*const ang = _mwEffOffsetAngle\(\);/.test(src));
check('V1 検索記録(ctx)は生のオフセット中心角を記す(第93ラウンドで実効角から戻した)',
  src.includes('mwOff: Number(appState.mwOffsetAngle) || 0') && (src.match(/mwOffAngle: Number\(appState\.mwOffsetAngle\) \|\| 0/g) || []).length >= 2);
check('V1 File出力のオフセット中心角は内部符号のまま', src.includes("(Number(r.tsuji.mwOffsetAngle) || 0).toFixed(4) + '°'"));
check('V1 未定義行の正規化(mwOffsetEnabled未定義→オフ=初期値オフ・第93ラウンド)', src.includes('if (t.mwOffsetEnabled === undefined) t.mwOffsetEnabled = false'));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof drawSoramado==='function',{timeout:8000});
  await p.waitForTimeout(800);

  const CHK_IDS=['chk-baseopt-mw-enable','chk-tsuji-mw-enable','chk-tsujimesh-mw-enable','chk-mwctrl-mw-enable'];
  const IN_IDS=['input-baseopt-mw-offset','input-tsuji-mw-offset','input-tsujimesh-mw-offset',
                'input-mwctrl-mw-offset','input-mwctrl-mw-offset-slider'];

  // W1: 初期状態(既定=中心座標)→チェック4面オフ・角度入力は無効
  {
    const r=await p.evaluate(([chkIds,inIds])=>({
      base: appState.baseOptMwBase,
      allOff: chkIds.every(id=>document.getElementById(id) && !document.getElementById(id).checked),
      allDisabled: inIds.every(id=>document.getElementById(id) && document.getElementById(id).disabled)
    }),[CHK_IDS,IN_IDS]);
    check('W1 初期状態: 既定=中心座標でチェック4面オフ・角度入力5個は無効', r.base==='center'&&r.allOff&&r.allDisabled, JSON.stringify(r));
  }

  // W2: チェックオン(辻検索面)→状態offset・ラジオ追従・4面オン・入力が有効に
  {
    const r=await p.evaluate(async([chkIds,inIds])=>{
      window.confirm=()=>true; window.alert=()=>{};
      const el=document.getElementById('chk-tsuji-mw-enable');
      el.checked=true; el.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,100));
      return {
        base: appState.baseOptMwBase,
        allOn: chkIds.every(id=>document.getElementById(id).checked),
        allEnabled: inIds.every(id=>!document.getElementById(id).disabled)
      };
    },[CHK_IDS,IN_IDS]);
    check('W2 チェックオン→baseOptMwBase=offset・4面オン・入力が有効', r.base==='offset'&&r.allOn&&r.allEnabled, JSON.stringify(r));
  }

  // W3: チェックオフ(ctrl面)→状態center・ラジオ追従・4面オフ・入力無効(値は保持)
  {
    const r=await p.evaluate(async([chkIds,inIds])=>{
      appState.mwOffsetAngle=-30; syncBaseOptionUI();   // 保持の確認用に角度を仕込む
      const el=document.getElementById('chk-mwctrl-mw-enable');
      el.checked=false; el.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,100));
      return {
        base: appState.baseOptMwBase,
        allOff: chkIds.every(id=>!document.getElementById(id).checked),
        allDisabled: inIds.every(id=>document.getElementById(id).disabled),
        kept: appState.mwOffsetAngle===-30,
        shown: document.getElementById('input-baseopt-mw-offset').value   // 収録符号そのまま(-30。第93ラウンド)
      };
    },[CHK_IDS,IN_IDS]);
    check('W3 チェックオフ→center・4面オフ・入力無効・値は保持(表示-30=収録符号)',
      r.base==='center'&&r.allOff&&r.allDisabled&&r.kept&&r.shown==='-30', JSON.stringify(r));
  }

  // W4: 「天の川の基準点」ラジオは撤去済み(第85ラウンド・項目12。チェックが同じ状態を担う)
  {
    const r=await p.evaluate(async()=>{
      const gone = document.querySelector('input[name="baseopt-mw-base"]') === null;
      const chk=document.getElementById('chk-baseopt-mw-enable');
      chk.checked=true; chk.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,100));
      return { gone, base: appState.baseOptMwBase };
    });
    check('W4 基準点ラジオは撤去済みで、チェックだけで状態が切り替わる', r.gone&&r.base==='offset', JSON.stringify(r));
  }

  // W5: 実効角: チェックオフ中は0(=中心座標のRA/Dec)・オン中は角度が効く
  {
    const r=await p.evaluate(()=>{
      appState.mwOffsetAngle=30;
      appState.baseOptMwBase='center';
      const c=getMilkyWayBaseRaDec();
      const e0=_mwEffOffsetAngle();
      appState.baseOptMwBase='offset';
      const o=getMilkyWayBaseRaDec();
      const e1=_mwEffOffsetAngle();
      return { centerIsBase: c.ra===MILKYWAY_RA&&c.dec===MILKYWAY_DEC, e0, e1,
               offsetDiffers: o.ra!==MILKYWAY_RA||o.dec!==MILKYWAY_DEC };
    });
    check('W5 実効角: オフ中は0で中心座標・オン中は角度30が効く',
      r.centerIsBase&&r.e0===0&&r.e1===30&&r.offsetDiffers, JSON.stringify(r));
  }

  // W6: 収録符号の素通し(第93ラウンドで表示反転を廃止: 入力値=収録値=表示値)
  {
    const r=await p.evaluate(async()=>{
      appState.mwOffsetAngle=-30; appState.baseOptMwBase='offset'; syncBaseOptionUI();
      const disp={ base: document.getElementById('input-baseopt-mw-offset').value,
                   ctrl: document.getElementById('input-mwctrl-mw-offset').value,
                   slider: document.getElementById('input-mwctrl-mw-offset-slider').value };
      const el=document.getElementById('input-tsuji-mw-offset');
      el.value='25'; el.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,100));
      const after={ state: appState.mwOffsetAngle,
                    mesh: document.getElementById('input-tsujimesh-mw-offset').value };
      const sl=document.getElementById('input-mwctrl-mw-offset-slider');
      sl.value='10'; sl.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(r=>setTimeout(r,100));
      return { disp, after, sliderState: appState.mwOffsetAngle };
    });
    check('W6 収録-30→表示-30(3面。表示変換なし)', r.disp.base==='-30'&&r.disp.ctrl==='-30'&&r.disp.slider==='-30', JSON.stringify(r.disp));
    check('W6 入力25→収録25・相手面の表示も25 / スライダー10→収録10',
      r.after.state===25&&r.after.mesh==='25'&&r.sliderState===10, JSON.stringify({after:r.after,slider:r.sliderState}));
  }

  // W7: My辻行の「:天の川オプション」(行ごと独立・表示反転・オフで実効0と入力無効・値は保持)
  {
    const r=await p.evaluate(async()=>{
      appState.myTsujiSearches=[];
      appState.baseOptMwBase='offset';
      addMyTsujiRow();
      const t=appState.myTsujiSearches[0];
      const initOn = t.mwOffsetEnabled===false;   // 第93ラウンド: 行の初期値は常にオフ
      t.mwOffsetAngle=-30; renderMyTsujiSearches();
      const inp=document.querySelector(`.mytsuji-mw-offset[data-id="${t.id}"]`);
      const chk=document.querySelector(`.mytsuji-mw-enable[data-id="${t.id}"]`);
      chk.checked=true; chk.dispatchEvent(new Event('change',{bubbles:true}));   // 初期オフなので一度オンにして表示を見る
      await new Promise(r=>setTimeout(r,50));
      renderMyTsujiSearches();
      const inp2=document.querySelector(`.mytsuji-mw-offset[data-id="${t.id}"]`);
      const chk2=document.querySelector(`.mytsuji-mw-enable[data-id="${t.id}"]`);
      const disp30 = inp2.value==='-30' && !inp2.disabled && chk2.checked;   // 収録符号そのまま
      chk2.checked=false; chk2.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,50));
      const offRow = t.mwOffsetEnabled===false && inp2.disabled===true && t.mwOffsetAngle===-30;
      const gated = (()=>{ const g=_myTsujiMwRaDec(t); return g.ra===MILKYWAY_RA&&g.dec===MILKYWAY_DEC; })();
      const globalUntouched = appState.baseOptMwBase==='offset';   // 行のチェックは全体に波及しない
      chk2.checked=true; chk2.dispatchEvent(new Event('change',{bubbles:true}));
      inp2.disabled=false; inp2.value='25'; inp2.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,50));
      const typed = t.mwOffsetAngle===25 && inp2.value==='25';   // 入力値=収録値(第93ラウンド)
      const ungated = (()=>{ const g=_myTsujiMwRaDec(t); return g.ra!==MILKYWAY_RA; })();
      appState.baseOptMwBase='center';
      addMyTsujiRow();
      const initOff = appState.myTsujiSearches[1].mwOffsetEnabled===false;   // 初期値は常にオフ(第93ラウンド)
      appState.myTsujiSearches=[]; renderMyTsujiSearches();
      return { initOn, disp30, offRow, gated, globalUntouched, typed, ungated, initOff };
    });
    check('W7 My辻行: 初期値オフ・表示は収録符号・オフで実効0/入力無効/値保持・全体に波及しない',
      r.initOn&&r.disp30&&r.offRow&&r.gated&&r.globalUntouched, JSON.stringify(r));
    check('W7 My辻行: 入力25→収録25・再オンで角度が効く・新規行は常にオフ',
      r.typed&&r.ungated&&r.initOff, JSON.stringify({typed:r.typed,ungated:r.ungated,initOff:r.initOff}));
  }

  // W8: CSVは内部符号のまま(表示反転しない)
  {
    const r=await p.evaluate(()=>{
      const csv=_buildMyTsujiCsv([{id:901,name:'RAWTEST',mwOffsetAngle:-13}]);
      const cols=csv.split('\r\n')[1].split(',');
      return { col13: cols[13] };
    });
    check('W8 CSV出力のオフセット中心角は内部符号-13のまま', r.col13==='-13', JSON.stringify(r));
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
