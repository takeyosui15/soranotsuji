// 第128〜131ラウンド検証: v1.87.0への追補 — ①辻メッシュ精度フィルタに「:○」(±0.25°)を追加して初期値に
// (×8撤去=x8はx4へ読み替え・ctrlのselectにも○・辞書v21) ②宙の窓ボタンで開き直す度にカメラ
// オフセットをリセット(URL自動オープンは守る) ③更新系の結合レベルテスト(第126の未カバー4件:
// 一括更新の進捗%・checking多重押下・シート作成の実往復・ログイン/ログアウト)
// ④第130→131: 読み取り専用の精度フィルタ表示「:○」は常時オンの固定表示(依頼者の設計モデル:
// 精度フィルタ=対象の下限○までを示す固定の枠・精度フィルタオプション=保持する精度の範囲を決める)。
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

// ---- V0: 版数の形(等価ピンは最新のverify173へ移譲) ----
check('V0 版数の形+Version Historyに第128の追補', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) && (src.includes('第128ラウンド(リリース前の追補)') || !!process.argv[2]));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof TSUJIMESH_EPS==='object',{timeout:8000});
  await p.waitForTimeout(400);

  // ---- M1〜M4: 辻メッシュ精度フィルタ ----
  {
    const r=await p.evaluate(()=>{
      const radios=[...document.querySelectorAll('input[name="tsujimesh-accuracy"]')];
      const out={};
      out.values=radios.map(x=>x.value).join(',');
      out.defChecked=radios.find(x=>x.value==='o1').checked===true;
      out.def=APP_DEFAULTS.tsujiMeshAccuracy.def==='o1';
      out.eps=TSUJIMESH_EPS.o1===0.25 && TSUJIMESH_EPS.x8===undefined;
      // M2: x8→x4の読み替え(列挙検査より先)
      appState.tsujiMeshAccuracy='x8'; normalizeAppState();
      out.mig=appState.tsujiMeshAccuracy==='x4';
      appState.tsujiMeshAccuracy='o1';
      // M3: ctrlのselectに○
      const opts=[...document.getElementById('select-tsujimesh-time-eps').options].map(o=>o.value+':'+o.textContent);
      out.sel=opts[0]==='0.25:○(±0.25°)' && opts.length===9;
      // M4: 辞書v21(新既定の既定値ペア)+発行
      const q=buildCommonUrlParams('fixed','full').toString();
      out.emitted=q.includes('tsujiMeshAccuracy=o1');
      const enc=encodeQueryParam('tsujiMeshAccuracy=o1&mode=tsujimesh');
      out.ver=enc.slice(0,4); out.round=decodeQueryParam(enc)==='tsujiMeshAccuracy=o1&mode=tsujimesh';
      return out;
    });
    check('M1 精度フィルタの選択肢=○/◎/◎×2/◎×4(○が初期値・×8撤去)+ε表(o1=0.25)',
      r.values==='o1,x1,x2,x4'&&r.defChecked&&r.def&&r.eps, JSON.stringify(r));
    check('M2 旧保存/URLのx8は最も近いx4へ読み替え(既定の○へ落とさない)', r.mig);
    check('M3 辻時刻の精度フィルタオプションselectの先頭に○(±0.25°)が入り9段', r.sel);
    check('M4 既定URLにtsujiMeshAccuracy=o1が乗り、短縮URLはv21で往復', r.emitted&&r.ver==='~21~'&&r.round, JSON.stringify({v:r.ver}));
  }

  // ---- M5: 読み取り専用の精度フィルタ表示「:○」は常時オン(第131・オプションを切り替えても不変) ----
  {
    const r=await p.evaluate(()=>{
      const st=(id)=>document.getElementById(id).checked;
      const setAcc=(v)=>{ const el=document.querySelector(`input[name="tsujimesh-accuracy"][value="${v}"]`); el.checked=true; el.dispatchEvent(new Event('change')); };
      const both=()=>st('chk-tsujimesh-sym-maru')&&st('chk-tsujimeshres-acc-circle')&&st('chk-tsujimesh-sym-maru2');
      const out={};
      setAcc('o1'); out.o1=both();
      setAcc('x1'); out.x1=both();
      setAcc('x4'); out.x4=both();
      setAcc('o1'); out.back=both();
      out.symO=appState.tsujiMeshSymO===false;   // 状態キーは触らない(URL/保存互換)
      out.noSync=typeof window._tmSyncSymODisplay==='undefined';   // 第130の連動関数は撤去済み
      return out;
    });
    check('M5 読み取り専用「:○」は常時オン(○/◎/◎×4どれを選んでも両面オン・◎も常時オン・状態キー不変・連動関数撤去)',
      r.o1&&r.x1&&r.x4&&r.back&&r.symO&&r.noSync, JSON.stringify(r));
  }

  // ---- S1/S2: 宙の窓カメラオフセットのリセット ----
  {
    const r=await p.evaluate(async()=>{
      const out={};
      appState.soraOffsetAz=5; appState.soraOffsetAlt=3; saveAppState();
      document.getElementById('btn-soramado').click();
      await new Promise(r=>setTimeout(r,300));
      out.open1=appState.isSoramadoActive===true;
      out.reset1=Number(appState.soraOffsetAz)===0&&Number(appState.soraOffsetAlt)===0;
      appState.soraOffsetAz=-2; appState.soraOffsetAlt=1;   // 開いている間の操作(回転ボタン相当)
      document.getElementById('btn-soramado').click();      // 閉じる(値はそのまま)
      await new Promise(r=>setTimeout(r,200));
      out.keepClosed=Number(appState.soraOffsetAz)===-2;
      document.getElementById('btn-soramado').click();      // 開き直し→リセット
      await new Promise(r=>setTimeout(r,300));
      out.reset2=Number(appState.soraOffsetAz)===0&&Number(appState.soraOffsetAlt)===0;
      document.getElementById('btn-soramado').click();      // 後始末: 閉じる
      await new Promise(r=>setTimeout(r,200));
      return out;
    });
    check('S1 宙の窓ボタンで開き直す度にカメラオフセットが0へ(閉じただけでは消えない)',
      r.open1&&r.reset1&&r.keepClosed&&r.reset2, JSON.stringify(r));
  }
  {
    const p2=await ctx.newPage();
    await p2.goto(BASE+'/index.html?mode=preview&soramado=true&soraOffsetAz=7&soraOffsetAlt=2',{waitUntil:'load'});
    await p2.waitForFunction(()=>typeof appState==='object'&&appState.isSoramadoActive===true,{timeout:10000});
    await p2.waitForTimeout(400);
    const v=await p2.evaluate(()=>({az:Number(appState.soraOffsetAz), alt:Number(appState.soraOffsetAlt)}));
    check('S2 URL自動オープン(soramado=true)はオフセットを保持(共有構図を守る)', v.az===7&&v.alt===2, JSON.stringify(v));
    await p2.close();
  }

  // ---- B1〜B4: 更新系の結合レベル(第126の未カバー4件) ----
  {
    const r=await p.evaluate(async()=>{
      const out={};
      const origConfirm=window.confirm, origAlert=window.alert;
      const origLogged=isGoogleLoggedIn, origAll=allMySetRows, origSave=mySetSaveToSheet, origLoad=mySetLoadFromSheet, origMeta=driveGetMeta;
      isGoogleLoggedIn=()=>true;
      // B1: 一括更新の進捗表示とスキップ文
      const texts=[]; let alerts=[];
      window.confirm=()=>true; window.alert=(m)=>alerts.push(String(m));
      const rows=[
        {id:9911,name:'a',sheetId:'S1',checked:true,saveMode:'save'},
        {id:9912,name:'b',sheetId:'S2',checked:true,saveMode:'load'},
        {id:9913,name:'c',sheetId:null,checked:true,saveMode:'save'},
      ];
      allMySetRows=()=>rows;
      mySetSaveToSheet=async()=>{ texts.push(document.getElementById('btn-myset-update').textContent); return true; };
      mySetLoadFromSheet=async()=>{ texts.push(document.getElementById('btn-myset-update').textContent); return true; };
      await bulkUpdateMySets();
      out.B1prog=texts.length===2&&texts[0].includes('更新中(0%)')&&texts[1].includes('更新中(50%)');
      out.B1btn=document.getElementById('btn-myset-update').textContent==='更新';
      out.B1msg=alerts.some(m=>m.includes('成功: 2件')&&m.includes('スキップ: 1件'));
      // B2: checking中の多重押下無視(再確認が走らない)
      let metaCalls=0; driveGetMeta=async()=>{ metaCalls++; return null; };
      const s2={id:9914,name:'d',sheetId:'S3'};
      mySetSheetStates[9914]='checking';
      await mySetRowStatusClick(s2);
      out.B2=metaCalls===0;
      delete mySetSheetStates[9914];
      // B3: シート作成の実往復(mySetSaveToSheetの作成経路。API境界だけスタブ)
      mySetSaveToSheet=origSave;   // 本物に戻す
      const T='2026-08-23T04:00:00.000Z';
      const apiCalls=[];
      const origCreate=mySetCreateSheet, origSheets=sheetsApiFetch;
      mySetCreateSheet=async(s)=>{ apiCalls.push('create'); s.sheetId='SH-NEW'; };
      sheetsApiFetch=async(p)=>{ apiCalls.push(p.replace(/^spreadsheets\/[^/]+\//,'')); return {}; };
      driveGetMeta=async()=>({modifiedTime:T,name:'標本e'});
      const s3={id:9915,name:'標本e',sheetId:null,offline:true,data:{},localEdit:true,checked:false};
      appState.mySets.push(s3);
      const ok=await mySetSaveToSheet(s3,{quiet:true});
      out.B3=ok===true&&s3.sheetId==='SH-NEW'&&apiCalls[0]==='create'&&
             apiCalls.includes('values:batchClear')&&apiCalls.includes('values:batchUpdate')&&
             s3.lastSyncSheetTime===T&&s3.localEdit===false&&mySetSheetStates[9915]==='ok';
      appState.mySets.pop(); delete mySetSheetStates[9915]; delete mySetSheetTimes[9915];
      mySetCreateSheet=origCreate; sheetsApiFetch=origSheets;
      // B4: ログイン/ログアウトの実往復(GISとAPI境界だけスタブ)
      isGoogleLoggedIn=origLogged;   // 本物(googleTokenを見る)
      const origGis=loadGisScript, origResolve=resolveAppFile, origCheckSheets=checkAllMySetSheets, origCid=getGoogleClientId, origGoogle=window.google;
      loadGisScript=async()=>{};
      getGoogleClientId=()=>'CID-TEST';
      resolveAppFile=async()=>null;   // ファイル無し→nofile😢
      checkAllMySetSheets=async()=>{};
      window.google={accounts:{oauth2:{
        initTokenClient:(cfg)=>({requestAccessToken:()=>cfg.callback({access_token:'TOK',expires_in:3600})}),
        revoke:(t,cb)=>{ out.B4revoked=true; if(cb)cb(); }
      }}};
      googleTokenClient=null;
      const okLogin=await googleLogin();
      await new Promise(r=>setTimeout(r,150));   // ログイン直後のcheckGoogleSyncStateを待つ
      out.B4login=okLogin===true&&isGoogleLoggedIn()===true;
      out.B4state=googleSyncState;
      out.B4icon=document.getElementById('btn-google-login').textContent;
      googleLogout();
      out.B4logout=isGoogleLoggedIn()===false&&googleSyncState==='none'&&
                   document.getElementById('btn-google-login').textContent==='🈚️';
      // 後始末
      loadGisScript=origGis; resolveAppFile=origResolve; checkAllMySetSheets=origCheckSheets; getGoogleClientId=origCid;
      window.google=origGoogle; googleTokenClient=null; googleToken=null;
      allMySetRows=origAll; mySetLoadFromSheet=origLoad; driveGetMeta=origMeta;
      window.confirm=origConfirm; window.alert=origAlert;
      googleSyncState='none'; updateGoogleLoginIcon();
      return out;
    });
    check('B1 一括更新: 進捗%(0%→50%)がボタンに出て終了後「更新」へ+成功2件/スキップ1件の報告',
      r.B1prog&&r.B1btn&&r.B1msg, JSON.stringify({p:r.B1prog,b:r.B1btn,m:r.B1msg}));
    check('B2 checking中の行アイコン多重押下は無視(再確認が走らない)', r.B2);
    check('B3 シート作成の実往復: 作成→4シート書込→簿記(lastSyncSheetTime/localEdit解除/ok)',
      r.B3===true, JSON.stringify({B3:r.B3}));
    check('B4 ログイン実往復: GISトークン→👍系の状態確認(ファイル無し=😢)まで到達', r.B4login&&r.B4state==='nofile'&&r.B4icon==='😢', JSON.stringify({l:r.B4login,s:r.B4state,i:r.B4icon}));
    check('B4b ログアウト: revoke呼出+🈚️へ', r.B4revoked===true&&r.B4logout===true, JSON.stringify({r:r.B4revoked,o:r.B4logout}));
  }

  check('E1 ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
