// 第79ラウンド検証: v1.63.0
// ①非同期キャンセル監査の3修正(地点設定の追い越し防止・可視判定の内側await・宙断面の世代)
// ②宙の窓ctrlの白字化 ③月間フィルタ(3検索+My辻行+結果コントロール) ④地形の近傍z15ブースト
// ⑤タイムゾーン表示(日時情報メニュー先頭+日本以外の注記)
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

// ---- V0: 版数の存在検査(版数ピンは最新のverify147へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.63.0の行がある', src.includes('Version 1.63.0 - ') || !!process.argv[2]);

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const seen=[];
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {
    const u=route.request().url();
    if(!u.startsWith(BASE)) seen.push(u);
    u.startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof drawSoramado==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // A1: 地点設定の追い越し防止 — 遅い標高取得のクリックAより、後の速いクリックBが勝つ
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      const orig=window.getElevation;
      let call=0;
      window.getElevation=async()=>{ const me=++call; await new Promise(r=>setTimeout(r, me===1?300:10)); return 100+me; };
      const pA=applyMapPointAction({lat:35.10,lng:138.10});   // 遅い(300ms)
      await new Promise(r=>setTimeout(r,30));
      const pB=applyMapPointAction({lat:35.20,lng:138.20});   // 速い(10ms)
      await Promise.all([pA,pB]);
      const after={lat:appState.start.lat,lng:appState.start.lng};
      window.getElevation=orig;
      return after;
    });
    check('A1 地図連打: 古いクリックの標高取得が後から解決しても後のクリックが勝つ',
      r.lat===35.20&&r.lng===138.20, JSON.stringify(r));
  }

  // A2: 可視判定ポップアップの内側await中の切替でもポップアップは出ない(第78修正の同類穴)
  {
    const r=await p.evaluate(async()=>{
      const orig={ fA: window.fetchAllElevations, cPV: window.computePathVisibility };
      let popup=0;
      window.alert=()=>{ popup++; };
      window.fetchAllElevations=async()=>{};   // 取得は即完了
      window.computePathVisibility=async()=>{ await new Promise(r=>setTimeout(r,300)); return {visible:true}; };   // 判定中に切替できる遅さ
      toggleElevation();                        // ON → 取得完了 → showVisibilityResult(判定中)
      await new Promise(r=>setTimeout(r,50));
      toggleSoramado();                         // 判定の途中で宙の窓へ切替(世代が進む)
      await new Promise(r=>setTimeout(r,500));
      const cancelPopup=popup;
      toggleSoramado();                         // 後始末: 宙の窓を閉じる
      // 対照: 完走すればポップアップは出る
      window.computePathVisibility=async()=>({visible:true});
      toggleElevation();                        // ON
      await new Promise(r=>setTimeout(r,100));
      const donePopup=popup;
      toggleElevation();                        // OFF
      window.fetchAllElevations=orig.fA; window.computePathVisibility=orig.cPV;
      return { cancelPopup, donePopup };
    });
    check('A2 可視判定の判定中に切替→ポップアップなし・完走→1回', r.cancelPopup===0&&r.donePopup===1, JSON.stringify(r));
  }

  // C1: 宙の窓ctrlの白字化(取得状況・表示タイル数・ばらつき・:花火点(+))+金色見出しの維持
  {
    const r=await p.evaluate(()=>{
      const cs=id=>getComputedStyle(document.getElementById(id)).color;
      const lbl=document.querySelector('label[for="chk-sora-ctrl-fw-point"]');
      const gold=document.querySelector('label[for="chk-sora-ctrl-bldg"]');
      return { st:cs('sora-ctrl-bldg-status'), tiles:cs('sora-ctrl-bldg-tiles-val'), spread:cs('fw-ctrl-spread-label'),
               fwPoint:getComputedStyle(lbl).color, gold:getComputedStyle(gold).color };
    });
    const W='rgb(238, 238, 238)';
    check('C1 ctrlの取得状況/表示タイル数/ばらつき/:花火点(+)が白字', r.st===W&&r.tiles===W&&r.spread===W&&r.fwPoint===W, JSON.stringify(r));
    check('C1 金色のグループ見出しは維持', r.gold==='rgb(255, 215, 0)', r.gold);
  }

  // M1: 月間フィルタのUI存在+活性制御(辻検索/辻メッシュメニュー)
  {
    const r=await p.evaluate(()=>{
      const ids=['chk-tsuji-month-filter','chk-tsujimesh-month-filter'];
      for(let m=1;m<=12;m++){ ids.push(`chk-tsuji-month-${m}`); ids.push(`chk-tsujimesh-month-${m}`); }
      const missing=ids.filter(id=>!document.getElementById(id));
      const before=document.getElementById('chk-tsuji-month-3').disabled;
      const master=document.getElementById('chk-tsuji-month-filter');
      master.checked=true; master.dispatchEvent(new Event('change'));
      const after=document.getElementById('chk-tsuji-month-3').disabled;
      const st=appState.tsujiMonthFilter;
      master.checked=false; master.dispatchEvent(new Event('change'));
      return { missing:missing.join(','), before, after, st };
    });
    check('M1 月間フィルタ26要素(親2+月12×2)が存在', r.missing==='', r.missing);
    check('M1 親チェックで月チェックが活性化+appState反映', r.before===true&&r.after===false&&r.st===true, JSON.stringify(r));
  }

  // M2: 判定の真理値表(_monthFilterAllows)
  {
    const r=await p.evaluate(()=>{
      const F0={monthFilter:false};                          // 無効→絞らない
      const F1={monthFilter:true};                           // 有効・全て未チェック→絞らない
      const F8={monthFilter:true, month8:true};              // 8月のみ
      const F12={monthFilter:true, month1:true, month12:true};
      return {
        off: _monthFilterAllows(F0, 0),
        none: _monthFilterAllows(F1, 5),
        aug: _monthFilterAllows(F8, 7) && !_monthFilterAllows(F8, 6),   // 月インデックス7=8月
        wrap: _monthFilterAllows(F12, 0) && _monthFilterAllows(F12, 11) && !_monthFilterAllows(F12, 5),
      };
    });
    check('M2 判定: 無効/未チェック=絞らない・チェック月のみ通す', r.off&&r.none&&r.aug&&r.wrap, JSON.stringify(r));
  }

  // M3: My辻の行フォームに月間フィルタ(行を作って数える)
  {
    const r=await p.evaluate(()=>{
      window.confirm=()=>true;
      addMyTsujiRow();
      const rows=document.querySelectorAll('#mytsuji-list .mytsuji-month-filter');
      const months=document.querySelectorAll('#mytsuji-list [class*="mytsuji-month-"]:not(.mytsuji-month-filter)');
      const t=appState.myTsujiSearches[appState.myTsujiSearches.length-1];
      const hasFields=t.monthFilter===false&&t.month1===false&&t.month12===false;
      appState.myTsujiSearches.pop(); renderMyTsujiSearches(); saveAppState();   // 後始末(追加した行を消す)
      return { rowMaster:rows.length>=1, monthChecks:months.length>=12, hasFields };
    });
    check('M3 My辻行フォームに月間フィルタ+12ヶ月+行データに保存フィールド', r.rowMaster&&r.monthChecks&&r.hasFields, JSON.stringify(r));
  }

  // M4: 結果コントロール2面のDOM+全オフ初期値+行の絞り込み判定
  {
    const r=await p.evaluate(()=>{
      const ids=[];
      ['tsujires','tsujimeshres'].forEach(P=>{ ids.push(`chk-${P}-month-filter`); for(let m=1;m<=12;m++) ids.push(`chk-${P}-month-${m}`); });
      const missing=ids.filter(id=>!document.getElementById(id));
      const F=_resCtlAllOff();
      const allOff=F.monthFilter===false&&F.month1===false&&F.month12===false;
      // My辻結果の追加絞り込み判定に月間が効く
      const row={moonAge:10, time:new Date('2026-08-02T12:00:00+09:00'), symbol:'◎', elevationStatus:'OK'};
      const F8=Object.assign(_resCtlAllOff(), {monthFilter:true, month8:true});
      const F7=Object.assign(_resCtlAllOff(), {monthFilter:true, month7:true});
      return { missing:missing.join(','), allOff, pass8:_myTsujiResPass(row,F8), pass7:_myTsujiResPass(row,F7) };
    });
    check('M4 結果コントロール2面に月間26要素+全オフ初期値', r.missing===''&&r.allOff, r.missing);
    check('M4 My辻結果の追加絞り込みに月間が効く(8月の行: 8月指定=通る/7月指定=落ちる)', r.pass8===true&&r.pass7===false, JSON.stringify(r));
  }

  // T1: 地形の近傍z15ブースト — 広角90kmでz12(粗)とz15(DEM5A)の両方のタイルを要求する
  {
    seen.length=0;
    await p.evaluate(async()=>{
      appState.start={lat:35.7828,lng:139.1494,elev:929}; appState.startApiElev=929; appState.startHeight=0;
      appState.end={lat:35.3628,lng:138.7308,elev:3776}; appState.endApiElev=3776; appState.endHeight=0;
      appState.soraViewRange=90; appState.soraFocal=24; appState.soraSensorKey='fullframe';
      if(!appState.isSoramadoActive) toggleSoramado();
      await new Promise(r=>setTimeout(r,2500));
      toggleSoramado();
    });
    const demLow=seen.some(u=>/dem_png\/1[0-3]\//.test(u));
    const dem5a=seen.some(u=>/dem5a_png\/15\//.test(u));
    check('T1 広角90km: 遠方=粗ズーム+近傍8km=z15(DEM5A)の両方を要求(距離環の適応ズーム)', demLow&&dem5a,
      `low=${demLow} z15=${dem5a} 例: ${seen.filter(u=>u.includes('dem')).slice(0,2).join(' ')}`);
  }

  // T2: タイムゾーン表示(Asia/Tokyo)
  {
    const r=await p.evaluate(()=>document.getElementById('tz-info-label').textContent);
    check('T2 日時情報メニューに「タイムゾーン: Asia/Tokyo (UTC+09:00)」', r==='タイムゾーン: Asia/Tokyo (UTC+09:00)', r);
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();

  // ---- 別コンテキスト(Europe/Paris): TZ表示に「地名検索はOSMのみ」の注記 ----
  {
    const ctx2=await b.newContext({viewport:{width:900,height:900},timezoneId:'Europe/Paris'});
    await ctx2.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    const p2=await ctx2.newPage();
    await p2.goto(BASE+'/index.html',{waitUntil:'load'});
    await p2.waitForFunction(()=>typeof searchLocation==='function',{timeout:8000});
    await p2.waitForTimeout(500);
    const r=await p2.evaluate(()=>document.getElementById('tz-info-label').textContent);
    check('T2 TZ=Europe/Parisでは「地名検索はOSMのみ」の注記付き',
      r.startsWith('タイムゾーン: Europe/Paris (UTC+0')&&r.endsWith('地名検索はOSMのみ'), r);
    await ctx2.close();
  }

  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
