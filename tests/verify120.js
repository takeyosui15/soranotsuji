// 第36ラウンド検証: 後日課題の全実施+整合性修正+閉じるボタン
// (1)時刻ラベルのsymbolレイヤ化(ローカルglyphs) (2)標準ピン+観測点/目的点マーカーの永続化
// (3)整合性修正: fw復元/空上書きガード/[New]判定/指紋の簿記非依存/封鎖中のMy宙検索温存/
//    辻検索URLの基準値保護/期間clamp (4)閉じるボタン5種 (5)モバイルワーカー上限(ソース検査)
// ローカルハーネス(vendor)。外部への実アクセスは行わない(route abort)。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };
(async()=>{
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    // 版数ピンは最新のverify(現在は121)のみに置く(テスト方針)。ここでは存在だけ確認する
    check('Z0 APP_VERSIONが定義されている', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
    check('Z0 ローカルglyphs同梱(fonts/SoraSans/0-255.pbf)', fs.existsSync(path.join(__dirname,'..','fonts','SoraSans','0-255.pbf')));
    check('Z0 モバイルはワーカー台数上限6(ソース検査)', /_IS_TOUCH_ENV \? 6 : 31/.test(src));
  }
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let glyphOk=false; p.on('response',r=>{ if(r.url().includes('0-255.pbf')&&r.status()===200) glyphOk=true; });
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null&&glMap.isStyleLoaded&&glMap.isStyleLoaded(),{timeout:10000});
  await p.waitForTimeout(600);

  // Z1: 時刻ラベル=symbolレイヤ(DOMマーカー0個・全点にHH:MMラベル・ローカルglyphs取得)
  {
    const r=await p.evaluate(async()=>{
      appState.isDPActive=true;
      await updateDPLines();
      const feats=glMap.getSource('dp-times')._data.features;
      return { n: feats.length, lbl: feats.filter(f=>/^\d{1,2}:\d{2}$/.test(f.properties.label||'')).length,
               dom: document.querySelectorAll('#map .dp-label-icon').length,
               lyr: !!glMap.getLayer('dp-time-labels'),
               font: glMap.getLayoutProperty('dp-time-labels','text-font').join(',') };
    });
    await p.waitForTimeout(800);
    check('Z1 時刻ラベルがsymbolレイヤ(DOM 0個・全点ラベル・SoraSansフォント)',
      r.n>0&&r.lbl===r.n&&r.dom===0&&r.lyr&&r.font==='SoraSans', JSON.stringify(r));
    check('Z1 ローカルglyphs(0-255.pbf)が同一オリジンから取得される', glyphOk);
  }

  // Z2: 標準ピン(SVG)+識別クラス+観測点/目的点マーカーの永続化(updateAllで作り直さない)
  {
    const r=await p.evaluate(()=>{
      const q=c=>document.querySelector('#map .'+c);
      const obs=q('location-marker-observer'), tgt=q('location-marker-target');
      const mk0=_glLocMarkers.obs;
      _glLocMarkers.obs.togglePopup();   // 表示中ポップアップが更新で閉じないこと
      updateAll(); updateAll();
      return { std: !!obs&&obs.classList.contains('maplibregl-marker')&&!!obs.querySelector('svg'),
               tgtStd: !!tgt&&!!tgt.querySelector('svg'),
               samePin: _glLocMarkers.obs===mk0,
               cnt: (_glMarkerGroups.location||[]).length,
               popupOpen: _glLocMarkers.obs.getPopup().isOpen() };
    });
    await p.evaluate(()=>{ _glLocMarkers.obs.togglePopup(); });
    check('Z2 観測点/目的点=標準ピン(SVG+識別クラス)・updateAllで使い回し・ポップアップ維持',
      r.std&&r.tgtStd&&r.samePin&&r.cnt===2&&r.popupOpen, JSON.stringify(r));
  }

  // Z3: 整合性修正(fw復元/指紋/[New]/空上書きガード/封鎖中温存/clamp)
  {
    await p.evaluate(()=>{ appState.fwEnabled=true; appState.fwRadius=120; appState.fwSize='30'; appState.fwSpread=3; saveAppState(); });
    await p.reload({waitUntil:'load'});
    await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:10000});
    await p.waitForTimeout(400);
    const fw=await p.evaluate(()=>({en:appState.fwEnabled,r:appState.fwRadius,sz:appState.fwSize,sp:appState.fwSpread}));
    check('Z3 花火モード設定がリロード後も復元される(実装漏れの修正)',
      fw.en===true&&fw.r===120&&fw.sz==='30'&&fw.sp===3, JSON.stringify(fw));
    const r=await p.evaluate(async()=>{
      appState.mySets=[{id:1,name:'t',sheetId:'x',offline:false,data:null,lastSyncSheetTime:1,updatedAt:1}];
      saveAppState();
      const f1=localContentFingerprint();
      appState.mySets[0].lastSyncSheetTime=999; appState.mySets[0].updatedAt=999; saveAppState();
      const f2=localContentFingerprint();
      appState.myObservations.push({id:99,name:'x',lat:1,lng:2,elev:3,height:0}); saveAppState();
      const f3=localContentFingerprint();
      appState.myObservations.pop(); saveAppState();
      // [New]判定: 同期済み+簿記保存のみ→ローカルに付かない/Drive側更新→Driveに付く
      appState.googleDrive.lastSyncFingerprint=localContentFingerprint();
      appState.googleDrive.lastDriveModifiedTime='2026-07-20T00:00:00Z';
      appState.googleDrive.lastSyncDriveModifiedTime='2026-07-20T00:00:00Z';
      saveAppState();
      openGdriveSyncDialog();
      const localNew=/New/.test(document.getElementById('gdrive-sync-local').innerHTML);
      appState.googleDrive.lastDriveModifiedTime='2026-07-21T00:00:00Z';
      openGdriveSyncDialog();
      const driveNew=/New/.test(document.getElementById('gdrive-sync-drive').innerHTML);
      closeGdriveSyncDialog();
      // 空上書きガード(書き込みAPIに到達しないこと)
      let alerted=''; const oa=window.alert; window.alert=(m)=>{alerted=String(m);};
      window.isGoogleLoggedIn=()=>true;
      let wrote=0; window.sheetsApiFetch=async(u)=>{ if(/batchClear|batchUpdate/.test(u)) wrote++; return {valueRanges:[]}; };
      window.driveGetMeta=async()=>({id:'x',trashed:false,name:'t',modifiedTime:'2026-07-20T00:00:00Z'});
      const blocked=!(await mySetSaveToSheet(appState.mySets[0]));
      window.alert=oa;
      // 封鎖中のシート読込: My宙検索を温存
      appState.mySoraSearches=[{id:1,name:'keep'}];
      window.sheetsApiFetch=async()=>({valueRanges:[{values:[]},{values:[]},{values:[]},{values:[]}]});
      const fetched=await _mySetFetchSheetData({id:appState.mySetCurrentId,sheetId:'x'});
      // 期間clamp
      appState.tsujiSearchDays=999999; normalizeAppState();
      return { fpStable:f1===f2, fpChanges:f2!==f3, localNew, driveNew, blocked, noWrite:wrote===0,
               guardMsg:/読み込み/.test(alerted), soraKept:fetched.data.mySoraSearches.length===1,
               clamped:appState.tsujiSearchDays===36500 };
    });
    check('Z3 指紋はシート同期簿記に依存せず内容変更のみで変わる', r.fpStable&&r.fpChanges);
    check('Z3 [New]判定=前回同期からの変更(簿記保存でローカルに付かない/Drive側更新で付く)', !r.localNew&&r.driveNew);
    check('Z3 空データのシート上書きを書込API到達前にガード(読み込みを案内)', r.blocked&&r.noWrite&&r.guardMsg);
    check('Z3 機能封鎖中のシート読込でMy宙検索が温存される', r.soraKept);
    check('Z3 辻検索期間がnormalizeで1..36500へ丸められる', r.clamped);
  }

  // Z4: 辻検索URLの基準方位角/視高度が自動再計算で上書きされない(プレビュー再現の修正)
  {
    const p2=await ctx.newPage();
    await p2.goto(BASE+'/index.html?mode=tsujisearch&startLat=35.5&startLng=138.8&endLat=35.36&endLng=138.73&tsujiAz=123.4&tsujiAlt=5.6&starId=Sun',{waitUntil:'load'});
    await p2.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:10000});
    await p2.waitForTimeout(1200);
    const r=await p2.evaluate(()=>({ az:appState.tsujiSearchBaseAz, alt:appState.tsujiSearchBaseAlt,
      dom:document.getElementById('input-tsuji-az').value }));
    check('Z4 URLの基準方位角123.4/視高度5.6が再計算に上書きされずDOMにも反映',
      Math.abs(r.az-123.4)<1e-9&&Math.abs(r.alt-5.6)<1e-9&&r.dom==='123.4', JSON.stringify(r));
    await p2.close();
  }

  // Z5: 閉じるボタン5種(開→✕クリック→閉)
  {
    const r=await p.evaluate(async()=>{
      const out={};
      const tryOne=async(openFn,btnId,flag)=>{
        openFn();
        await new Promise(res=>setTimeout(res,250));
        const btn=document.getElementById(btnId);
        const vis=btn&&btn.getBoundingClientRect().width>0;
        btn.click();
        await new Promise(res=>setTimeout(res,250));
        return vis&&!appState[flag];
      };
      out.elev=await tryOne(toggleElevation,'btn-elevation-close','isElevationActive');
      out.mw=await tryOne(toggleMilkyWayInstrument,'btn-milkyway-close','isMilkyWayActive');
      out.sora=await tryOne(toggleSoramado,'btn-soramado-close','isSoramadoActive');
      out.ts=await tryOne(toggleTsujiSearch,'btn-tsujisearch-close','isTsujiSearchActive');
      out.tm=await tryOne(toggleTsujiMesh,'btn-tsujimesh-close','isTsujiMeshActive');
      return out;
    });
    check('Z5 閉じるボタン: 全天儀/標高グラフ/辻検索/辻メッシュ/宙の窓の5種が開→✕で閉じる',
      r.elev&&r.mw&&r.sora&&r.ts&&r.tm, JSON.stringify(r));
  }

  check('Z6 ページエラーなし', errs.length===0, errs.slice(0,3).join(' | '));

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
