// 第126ラウンド検証: 更新系の全条件網羅の単体テスト(依頼者指示「マトリックスCLと状態遷移表を
// Koushiで作成して、テストを」)。表とテストIDの正は docs/operation/sync-test-matrix.md。
// 方式: ネットワークは繋がず状態注入(グローバル状態・簿記・スタブ関数の差し替え)で
// 導出関数・判定関数を全行ぶん呼び、戻り値/DOMを実測する。
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

// ---- V0: 版数の形(第127でピンはverify171へ移譲=最新の検証が持つ) ----
check('V0 版数の形+Version Historyに1.86.2の行', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) && (src.includes('Version 1.86.2 - ') || !!process.argv[2]));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof updateGoogleLoginIcon==='function',{timeout:8000});
  await p.waitForTimeout(400);

  // ---- 表D: アイコン導出(D1〜D7) ----
  {
    const r=await p.evaluate(()=>{
      const orig=isGoogleLoggedIn;
      const icon=(logged,state)=>{ isGoogleLoggedIn=()=>logged; googleSyncState=state; updateGoogleLoginIcon();
        const el=document.getElementById('btn-google-login'); return el.textContent+(el.classList.contains('clock-anim')?'*':''); };
      const out={};
      out.D1=icon(false,'ok');
      out.D2=icon(true,'checking');
      out.D3=icon(true,'nofile');
      out.D4=icon(true,'stale');
      out.D5=icon(true,'ok');
      out.D6=icon(true,'broken');
      out.D7=icon(true,'mystery');
      isGoogleLoggedIn=orig; googleSyncState='none'; updateGoogleLoginIcon();
      return out;
    });
    check('D1 未ログイン→🈚️', r.D1==='🈚️', r.D1);
    check('D2 checking→🕛+時計アニメ', r.D2==='🕛*', r.D2);
    check('D3 nofile→😢', r.D3==='😢', r.D3);
    check('D4 stale→👎', r.D4==='👎', r.D4);
    check('D5 ok→👍', r.D5==='👍', r.D5);
    check('D6 broken→❌', r.D6==='❌', r.D6);
    check('D7 未知の値→🈚️(noneへフォールバック)', r.D7==='🈚️', r.D7);
  }

  // ---- 表D2: checkGoogleSyncStateの状態決定(D8〜D14) ----
  {
    const r=await p.evaluate(async()=>{
      const gd=appState.googleDrive;
      const origLogged=isGoogleLoggedIn, origResolve=resolveAppFile;
      const T1='2026-08-23T01:00:00.000Z', T2='2026-08-23T02:00:00.000Z';
      const run=async(logged,meta,timeMatch,fpMatch)=>{
        isGoogleLoggedIn=()=>logged;
        resolveAppFile=async()=>{ if(meta==='throw') throw new Error('x'); return meta; };
        gd.lastSyncDriveModifiedTime=timeMatch?T1:T2;
        gd.lastSyncFingerprint=fpMatch?localContentFingerprint():'beef';
        await checkGoogleSyncState();
        return googleSyncState;
      };
      const out={};
      out.D8 =await run(false,{modifiedTime:T1,size:'10'},true,true);
      out.D9 =await run(true,null,true,true);
      out.D10=await run(true,{modifiedTime:T1,size:'10'},true,true);
      out.D11=await run(true,{modifiedTime:T1,size:'10'},false,true);
      out.D12=await run(true,{modifiedTime:T1,size:'10'},true,false);
      out.D13=await run(true,{modifiedTime:T1,size:'10'},false,false);
      out.D14=await run(true,'throw',true,true);
      isGoogleLoggedIn=origLogged; resolveAppFile=origResolve; googleSyncState='none'; updateGoogleLoginIcon();
      return out;
    });
    check('D8 未ログイン→none', r.D8==='none', r.D8);
    check('D9 ファイル無し→nofile', r.D9==='nofile', r.D9);
    check('D10 時刻一致+指紋一致→ok', r.D10==='ok', r.D10);
    check('D11 時刻不一致(ドライブが進んだ)→stale', r.D11==='stale', r.D11);
    check('D12 指紋不一致(端末が進んだ)→stale', r.D12==='stale', r.D12);
    check('D13 両方不一致(競合)→stale', r.D13==='stale', r.D13);
    check('D14 確認エラー→broken', r.D14==='broken', r.D14);
  }

  // ---- 表E: 同期ダイアログ[New]の全マトリックス(E1〜E8) ----
  {
    const r=await p.evaluate(()=>{
      const gd=appState.googleDrive;
      const setSavedAt=(ms)=>{ const s=JSON.parse(localStorage.getItem(STORAGE_KEY)); s.savedAt=ms; localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); };
      const marks=()=>{ openGdriveSyncDialog();
        const L=document.getElementById('gdrive-sync-local').innerHTML.includes('[New]');
        const D=document.getElementById('gdrive-sync-drive').innerHTML.includes('[New]');
        closeGdriveSyncDialog(); return (L?'L':'-')+(D?'D':'-'); };
      const T=(iso)=>new Date(iso).getTime();
      const DRV='2026-08-23T03:00:00.000Z';   // 12:00 JST
      const out={};
      // E1: 変更なし×変更なし
      gd.lastSyncDriveModifiedTime=DRV; gd.lastDriveModifiedTime=DRV;
      gd.lastSyncFingerprint=localContentFingerprint(); setSavedAt(T('2026-08-23T13:00:00+09:00'));
      out.E1=marks();
      // E2: ローカルのみ変更(時刻は見ない=ドライブ時刻が後でも付かない)
      gd.lastSyncFingerprint='beef'; setSavedAt(T('2026-08-23T09:00:00+09:00'));
      out.E2=marks();
      // E3: ドライブのみ変更(savedAtが後でも付かない=第36の性質)
      gd.lastSyncFingerprint=localContentFingerprint();
      gd.lastDriveModifiedTime='2026-08-23T05:00:00.000Z'; setSavedAt(T('2026-08-23T23:00:00+09:00'));
      out.E3=marks();
      // E4: 競合+ローカルが新しい
      gd.lastSyncFingerprint='beef'; setSavedAt(T('2026-08-23T23:30:00+09:00'));
      out.E4=marks();
      // E5: 競合+ドライブが新しい(同じ日付・時刻違い)
      setSavedAt(T('2026-08-23T11:00:00+09:00'));
      out.E5=marks();
      // E6: 競合+完全同時刻→どちらにも付けない
      setSavedAt(T('2026-08-23T05:00:00.000Z'));
      out.E6=marks();
      // E7: 簿記なし+ローカルが新しい
      gd.lastSyncFingerprint=null; gd.lastSyncDriveModifiedTime=null; setSavedAt(T('2026-08-23T23:00:00+09:00'));
      out.E7=marks();
      // E8: 簿記なし+ドライブが新しい
      setSavedAt(T('2026-08-23T01:00:00+09:00'));
      out.E8=marks();
      return out;
    });
    check('E1 変更なし×変更なし→どちらにも付かない', r.E1==='--', r.E1);
    check('E2 ローカルのみ変更→ローカルだけ(時刻は見ない)', r.E2==='L-', r.E2);
    check('E3 ドライブのみ変更→ドライブだけ(savedAtが後でも第36の性質)', r.E3==='-D', r.E3);
    check('E4 競合+ローカルが新しい→ローカルだけ', r.E4==='L-', r.E4);
    check('E5 競合+ドライブが新しい→ドライブだけ', r.E5==='-D', r.E5);
    check('E6 競合+完全同時刻→どちらにも付けない(両方には付けない)', r.E6==='--', r.E6);
    check('E7 簿記なし+ローカルが新しい→ローカルだけ', r.E7==='L-', r.E7);
    check('E8 簿記なし+ドライブが新しい→ドライブだけ', r.E8==='-D', r.E8);
  }

  // ---- 表F: 行アイコン(F1〜F6)+一括アイコン(F7〜F10) ----
  {
    const r=await p.evaluate(()=>{
      const origLogged=isGoogleLoggedIn, origAll=allMySetRows;
      const out={};
      const s=(st,sheetId)=>{ const row={id:9900,name:'標本',sheetId:sheetId===undefined?'SID':sheetId};
        mySetSheetStates[9900]=st; const i=mySetRowIcon(row)[0]; delete mySetSheetStates[9900]; return i; };
      isGoogleLoggedIn=()=>false; out.F1=s('ok');
      isGoogleLoggedIn=()=>true;
      out.F2=s('checking');
      out.F3a=s(undefined,null); out.F3b=s('missing');
      out.F4=s('ok'); out.F5=s('error'); out.F6=s(undefined);
      // 一括: allMySetRowsを標本行に差し替え
      const rows=(sts)=>sts.map((st,i)=>{ mySetSheetStates[9910+i]=st.state; return {id:9910+i,name:'x',sheetId:st.sheet===false?null:'SID'}; });
      const agg=(sts)=>{ allMySetRows=()=>rows(sts); const i=mySetStatusIcon()[0];
        sts.forEach((_,i2)=>delete mySetSheetStates[9910+i2]); return i; };
      isGoogleLoggedIn=()=>false; out.F7=agg([{state:'ok'}]);
      isGoogleLoggedIn=()=>true;
      out.F8=agg([{state:'ok'},{state:'ok'},{state:'ok'}]);
      out.F9=agg([{state:'ok'},{state:undefined},{state:'ok'}]);
      out.F10=agg([{state:'ok'},{state:'ok',sheet:false}]);
      isGoogleLoggedIn=origLogged; allMySetRows=origAll;
      return out;
    });
    check('F1 未ログイン→🈚️', r.F1==='🈚️', r.F1);
    check('F2 checking→🕛', r.F2==='🕛', r.F2);
    check('F3 sheetIdなし/missing→😢', r.F3a==='😢'&&r.F3b==='😢', r.F3a+r.F3b);
    check('F4 ok→👍', r.F4==='👍', r.F4);
    check('F5 error→❌', r.F5==='❌', r.F5);
    check('F6 stale/未確認→👎', r.F6==='👎', r.F6);
    check('F7 一括: 未ログイン→🈚️', r.F7==='🈚️', r.F7);
    check('F8 一括: 全行👍→👍', r.F8==='👍', r.F8);
    check('F9 一括: 1行でも👎(未確認)→👎', r.F9==='👎', r.F9);
    check('F10 一括: 1行でも😢→👎', r.F10==='👎', r.F10);
  }

  // ---- 表G: 行の「更新:」表示(G1〜G6) ----
  {
    const r=await p.evaluate(()=>{
      const T=(iso)=>new Date(iso).getTime();
      const html=(state,sheetIso,updatedAt)=>{
        const s={id:9901,updatedAt};
        mySetSheetStates[9901]=state;
        if(sheetIso) mySetSheetTimes[9901]=sheetIso; else delete mySetSheetTimes[9901];
        const h=mySetUpdatedHtml(s);
        delete mySetSheetStates[9901]; delete mySetSheetTimes[9901];
        return (h.includes('シート:')?'S':'-')+(h.includes('[New]')?'N':'-');
      };
      const UP=T('2026-08-23T12:00:00+09:00');
      const out={};
      out.G1=html('ok','2026-08-23T05:00:00.000Z',UP);          // ok: シート行なし
      out.G2=html('stale',null,UP);                              // stale+シート日時未取得
      out.G3=html('stale','2026-08-23T05:00:00.000Z',UP);       // シート14:00 JST > 端末12:00
      out.G4=html('stale','2026-08-23T01:00:00.000Z',UP);       // シート10:00 JST < 端末12:00
      out.G5=html('stale','2026-08-23T03:00:00.000Z',UP);       // 同時刻(12:00)
      out.G6=html('stale','2026-08-23T01:00:00.000Z',null);     // 端末の更新日時なし
      return out;
    });
    check('G1 ok行はシート行を併記しない', r.G1==='--', r.G1);
    check('G2 staleでもシート日時未取得なら併記しない', r.G2==='--', r.G2);
    check('G3 stale+シートが新しい→併記+[New]', r.G3==='SN', r.G3);
    check('G4 stale+シートが古い→併記のみ', r.G4==='S-', r.G4);
    check('G5 stale+同時刻→併記のみ([New]なし)', r.G5==='S-', r.G5);
    check('G6 stale+端末の更新日時なし→併記+[New]', r.G6==='SN', r.G6);
  }

  // ---- 表H: _mySetSyncVerdictの真理値表(H1〜H5) ----
  {
    const r=await p.evaluate(()=>{
      const T1='2026-08-23T01:00:00.000Z', T2='2026-08-23T02:00:00.000Z';
      return {
        H1:_mySetSyncVerdict({lastSyncSheetTime:null, localEdit:false}, T1),
        H2:_mySetSyncVerdict({lastSyncSheetTime:T1, localEdit:false}, T1),
        H3:_mySetSyncVerdict({lastSyncSheetTime:T1, localEdit:true}, T1),
        H4:_mySetSyncVerdict({lastSyncSheetTime:T1, localEdit:false}, T2),
        H5:_mySetSyncVerdict({lastSyncSheetTime:T1, localEdit:true}, T2),
      };
    });
    check('H1 同期記録なし→stale', r.H1==='stale', r.H1);
    check('H2 時刻一致+印なし→ok', r.H2==='ok', r.H2);
    check('H3 時刻一致+印あり→stale-local', r.H3==='stale-local', r.H3);
    check('H4 時刻不一致+印なし→stale', r.H4==='stale', r.H4);
    check('H5 時刻不一致+印あり→stale(時刻差が先)', r.H5==='stale', r.H5);
  }

  // ---- 表I: ボタンの単体分(I3/I4/I6a〜c。他は既存verify144/106が担当) ----
  {
    const r=await p.evaluate(async()=>{
      const out={};
      window.alert=()=>{}; const origConfirm=window.confirm;
      const origLogged=isGoogleLoggedIn; isGoogleLoggedIn=()=>true;   // ボタン群はログイン済みの世界の機械
      // I3: 追加(紐付け)直後の未確認は👎スタート
      const s3={id:9902,name:'標本',sheetId:'SID-NEW'};
      out.I3=mySetRowIcon(s3)[0];
      // I4: 解除の実関数(getSelectedMySetIdをスタブ)→sheetIdが消えて😢
      const s4={id:9903,name:'標本',sheetId:'SID',lastSyncSheetTime:'2026-08-23T01:00:00.000Z',data:{},checked:false};
      appState.mySets.push(s4);
      const origSel=getSelectedMySetId; getSelectedMySetId=()=>9903; window.confirm=()=>true;
      unlinkMySetSheet();
      out.I4=(s4.sheetId===null?'cleared+':'')+mySetRowIcon(s4)[0];
      getSelectedMySetId=origSel; appState.mySets.pop();
      // I6: 行アイコン押下(再確認)の3分岐(driveGetMetaをスタブ・保存/読込は実行しない)
      const origMeta=driveGetMeta;
      const T1='2026-08-23T01:00:00.000Z', T2='2026-08-23T02:00:00.000Z';
      const s6={id:9904,name:'標本',sheetId:'SID',lastSyncSheetTime:T1,localEdit:false};
      driveGetMeta=async()=>({modifiedTime:T1});
      await mySetRowStatusClick(s6); out.I6a=mySetSheetStates[9904];
      driveGetMeta=async()=>({modifiedTime:T2});
      await mySetRowStatusClick(s6); out.I6b=mySetSheetStates[9904];
      window.confirm=()=>false;   // 消失時の再作成はしない
      driveGetMeta=async()=>null;
      await mySetRowStatusClick(s6); out.I6c=mySetSheetStates[9904];
      delete mySetSheetStates[9904]; delete mySetSheetTimes[9904];
      driveGetMeta=origMeta; window.confirm=origConfirm; isGoogleLoggedIn=origLogged;
      return out;
    });
    check('I3 追加(紐付け)直後の未確認→👎スタート', r.I3==='👎', r.I3);
    check('I4 解除→sheetIdが消えて😢', r.I4==='cleared+😢', r.I4);
    check('I6a 再確認: 時刻一致→ok(👍)', r.I6a==='ok', r.I6a);
    check('I6b 再確認: 時刻不一致→stale(👎)', r.I6b==='stale', r.I6b);
    check('I6c 再確認: シート消失→missing(😢)', r.I6c==='missing', r.I6c);
  }

  check('E1x ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
