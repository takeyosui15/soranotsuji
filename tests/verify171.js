// 第127ラウンド検証: v1.87.0 — Googleドライブ同期の「:自動更新」(依頼者提案・GO・設計条件3つ込み)。
// ①デバウンス(最後の変更から一定時間後にまとめて1回+visibilitychangeで即時1回)
// ②競合ガード(ドライブが前回同期から進んでいたら自動では上書きせず👎で人に委ねる)
// ③トークン切れ=🈚️・通信失敗=静かに次の機会へ。
// 方式はverify170と同じ状態注入(isGoogleLoggedIn/resolveAppFile/saveAppToDriveのスタブ+
// _autoSyncDebounceMsの短縮)。
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

// ---- V0: 版数の形(第128でピンはverify172へ移譲=最新の検証が持つ) ----
check('V0 版数の形+Version Historyに1.87.0の行', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) && (src.includes('Version 1.87.0 - ') || !!process.argv[2]));

// ---- S1: 配線の静的な形 ----
check('S1 saveAppStateから_autoSyncArm+visibilitychangeで即時flush+saveAppToDriveのquiet',
  /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(stateToSave\)\);\s*\n\s*_autoSyncArm\(\);/.test(src) &&
  src.includes("document.visibilityState === 'hidden' && appState.googleDrive.autoSync && _autoSyncTimer") &&
  src.includes('async function saveAppToDrive(opts)') && src.includes('const quiet = !!(opts && opts.quiet);'));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof _autoSyncArm==='function',{timeout:8000});
  await p.waitForTimeout(400);

  // A1: チェックボックスの存在・初期値オフ・永続・ダイアログへの反映
  {
    const r=await p.evaluate(()=>{
      const el=document.getElementById('chk-gdrive-autosync');
      const out={exists:!!el, def:appState.googleDrive.autoSync===false};
      el.checked=true; el.dispatchEvent(new Event('change'));
      out.on=appState.googleDrive.autoSync===true;
      out.saved=JSON.parse(localStorage.getItem(STORAGE_KEY)).googleDrive.autoSync===true;
      el.checked=false; el.dispatchEvent(new Event('change'));
      out.off=appState.googleDrive.autoSync===false;
      appState.googleDrive.autoSync=true;
      openGdriveSyncDialog(); out.reflect=el.checked===true; closeGdriveSyncDialog();
      appState.googleDrive.autoSync=false;
      if (_autoSyncTimer) { clearTimeout(_autoSyncTimer); _autoSyncTimer=null; }
      return out;
    });
    check('A1 「:自動更新」チェック(ダイアログ最下段)=初期値オフ・appState/保存/ダイアログ反映', r.exists&&r.def&&r.on&&r.saved&&r.off&&r.reflect, JSON.stringify(r));
  }

  // A2〜A7: エンジンの実測(スタブ+デバウンス短縮)
  {
    const r=await p.evaluate(async()=>{
      const gd=appState.googleDrive;
      const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
      const origLogged=isGoogleLoggedIn, origResolve=resolveAppFile, origSave=saveAppToDrive, origMs=_autoSyncDebounceMs;
      const T1='2026-08-23T01:00:00.000Z', T2='2026-08-23T02:00:00.000Z';
      let uploads=0;
      isGoogleLoggedIn=()=>true;
      resolveAppFile=async()=>({modifiedTime:T1,size:'10'});
      saveAppToDrive=async(o)=>{ uploads++; gd.lastSyncFingerprint=localContentFingerprint(); gd.lastSyncDriveModifiedTime=T1; return true; };
      _autoSyncDebounceMs=100;
      gd.autoSync=true; gd.lastSyncDriveModifiedTime=T1;
      const out={};
      // A2: 3回の変更(saveAppState)→デバウンスで1回だけ書き込み
      gd.lastSyncFingerprint='beef';
      saveAppState(); saveAppState(); saveAppState();
      await sleep(350);
      out.A2=uploads;
      // A3: 内容の変更なし(指紋一致)は書かない
      uploads=0; gd.lastSyncFingerprint=localContentFingerprint();
      saveAppState(); await sleep(350);
      out.A3=uploads;
      // A4: 競合ガード(ドライブが前回同期から進んでいる)→書かずに👎
      uploads=0; gd.lastSyncFingerprint='beef';
      resolveAppFile=async()=>({modifiedTime:T2,size:'10'});
      saveAppState(); await sleep(350);
      out.A4=uploads; out.A4state=googleSyncState; out.A4drv=gd.lastDriveModifiedTime===T2;
      // A5: トークン切れ→書かずに🈚️(none)
      uploads=0; isGoogleLoggedIn=()=>false; googleSyncState='ok';
      saveAppState(); await sleep(350);
      out.A5=uploads; out.A5state=googleSyncState;
      // A6: visibilitychangeで待たずに1回(デバウンスを長くして即時性を確認)
      uploads=0; isGoogleLoggedIn=()=>true; resolveAppFile=async()=>({modifiedTime:T1,size:'10'});
      gd.lastSyncFingerprint='beef'; gd.lastSyncDriveModifiedTime=T1;
      _autoSyncDebounceMs=100000;
      saveAppState();   // タイマーだけ armed
      Object.defineProperty(document,'visibilityState',{get:()=>'hidden',configurable:true});
      document.dispatchEvent(new Event('visibilitychange'));
      await sleep(250);
      delete document.visibilityState;
      out.A6=uploads;
      // A7: オフなら何も起きない
      uploads=0; gd.autoSync=false; gd.lastSyncFingerprint='beef';
      saveAppState(); await sleep(250);
      out.A7=uploads; out.A7timer=_autoSyncTimer===null;
      // 後始末
      isGoogleLoggedIn=origLogged; resolveAppFile=origResolve; saveAppToDrive=origSave; _autoSyncDebounceMs=origMs;
      gd.lastSyncFingerprint=null; gd.lastSyncDriveModifiedTime=null; gd.lastDriveModifiedTime=null;
      googleSyncState='none'; updateGoogleLoginIcon();
      if (_autoSyncTimer) { clearTimeout(_autoSyncTimer); _autoSyncTimer=null; }
      return out;
    });
    check('A2 3回の変更→デバウンスで書き込みは1回だけ', r.A2===1, String(r.A2));
    check('A3 内容の変更なし(簿記保存のみ)は書かない', r.A3===0, String(r.A3));
    check('A4 競合ガード: ドライブが先に進んでいたら書かずに👎(表示用の日時も更新)', r.A4===0&&r.A4state==='stale'&&r.A4drv, JSON.stringify({u:r.A4,s:r.A4state,d:r.A4drv}));
    check('A5 トークン切れ: 書かずに🈚️(none)へ', r.A5===0&&r.A5state==='none', JSON.stringify({u:r.A5,s:r.A5state}));
    check('A6 visibilitychange(hidden)で待たずに1回書き込み', r.A6===1, String(r.A6));
    check('A7 オフなら書き込みもタイマーも無し', r.A7===0&&r.A7timer, JSON.stringify({u:r.A7,t:r.A7timer}));
  }

  check('E1 ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
