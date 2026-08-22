// 第108→110ラウンド検証: v1.85.1 — 共有URLの不具合修正(第106調査・第107議論の案A改。
// 第110で版数をv1.86.0→v1.85.1へ付け直し=依頼者指摘「同じURLが意図どおりに開かれないのは不具合」)
//   ①位置情報URL(full)に辻検索条件51+辻メッシュ条件50+発行漏れ4キーを発行
//   ②復元のmode毎の適用ゲート廃止(URLに有るキーは常に適用=「発行は絞る、復元は絞らない」)
//   ③天体色/線種の常時発行+短縮辞書v19(既定値ペア)=既定のままのURLは変更したURLより短い(依頼者の採用条件)
//   ④2回訪問でURL値へ毎回戻る(第106の症状の解消)・訪問者の保存値は凍結で無傷(第37維持)
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

// ---- V0: 版数ピン(最新の検証が持つ) ----
check('V0 APP_VERSIONが存在(版数ピンはverify166へ移譲=第116ラウンド)', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに版の行がある', /Version \d+\.\d+\.\d+ - /.test(src) || !!process.argv[2]);

// ---- S1: 発行部の共用(静的検査: 検索条件の発行はヘルパー1箇所で、辻検索URLとfullの両方から呼ばれる) ----
check('S1 検索条件の発行ヘルパーを辻検索URLとfullが共用',
  src.includes('if (inc.tsujiCond) _emitTsujiSearchCondParams(params);') &&
  src.includes('if (inc.tsujiMeshCond) _emitTsujiMeshCondParams(params);') &&
  /copyTsujiSearchUrl[\s\S]{0,200}_emitTsujiSearchCondParams\(params\);/.test(src) &&
  /copyTsujiMeshUrl[\s\S]{0,200}_emitTsujiMeshCondParams\(params\);/.test(src));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const newCtx=async()=>{
    const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
    await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    return ctx;
  };

  // ---- 作者役: 条件を非既定にして位置情報URL(mode=preview・full)を生成 ----
  let urls=null;
  {
    const ctx=await newCtx(); const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(BASE+'/index.html',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof buildCommonUrlParams==='function',{timeout:8000});
    await p.waitForTimeout(400);
    urls=await p.evaluate(()=>{
      appState.tsujiSearchDays=180; appState.tsujiSearchOffsetAz=30;
      appState.smBldgTex=false; appState.soraLabelScale=150;   // 発行漏れだった4キーのうち2つを非既定に
      const mk=()=>{ const p2=buildCommonUrlParams('fixed'); p2.set('mode','preview'); return p2; };
      const closed=mk();   // 辻検索パネルは閉じたまま(自動実行なしの素の再訪検証用)
      appState.isTsujiSearchActive=true;
      const open=mk();     // パネルが開いた状態(パターン5=自動実行の検証用)
      const q=closed.toString();
      // ②の採用条件の常設化: 既定色と変更色の短縮URL長の比較(色以外は同一)
      const defEnc=encodeQueryParam(q);
      ['Sun','Moon','Venus','Vega','Sirius'].forEach((id,i)=>{ appState.bodies.find(x=>x.id===id).color='#10203'+i; });
      const chgEnc=encodeQueryParam(mk().toString());
      ['Sun','Moon','Venus','Vega','Sirius'].forEach(id=>{ const d=DEFAULT_BODIES.find(x=>x.id===id); appState.bodies.find(x=>x.id===id).color=d.color; });
      const u=location.origin+location.pathname+'?';
      return { closedUrl:u+q, openUrl:u+open.toString(), shortUrl:u+'query='+defEnc,
               hasCond:q.includes('tsujiSearchDays=180')&&q.includes('tsujiAzOffset=30')&&q.includes('tsujiMeshDays='),
               has4:q.includes('smBldgTex=false')&&q.includes('soraLabelScale=150')&&q.includes('soraGrayscale=')&&q.includes('smBldg='),
               body44:[...closed.keys()].filter(k=>k.startsWith('bodyColor')||k.startsWith('bodyDash')).length,
               soramadoNoCond:(()=>{ const s=buildCommonUrlParams('fixed','soramado').toString(); return !s.includes('tsujiSearchDays=')&&!s.includes('tsujiMeshDays='); })(),
               defLen:defEnc.length, chgLen:chgEnc.length, ver:defEnc.slice(0,4) };
    });
    check('U1 位置情報URL(full)に辻検索条件+辻メッシュ条件が乗る', urls.hasCond);
    check('U1 発行漏れだった4キー(soraGrayscale/soraLabelScale/smBldg/smBldgTex)も乗る(非既定値も反映)', urls.has4);
    check('U1 天体色/線種は常時44キー・宙の窓URL(soramado)には検索条件は乗らない(持ち場は発行側だけ)',
      urls.body44===44&&urls.soramadoNoCond, JSON.stringify({body44:urls.body44,soramadoNoCond:urls.soramadoNoCond}));
    check('U2 短縮URLはv19以降で、既定色は変更色より短い(依頼者の採用条件の常設化。最新版の等値ピンはverify125 M0)',
      /^~(19|[2-9]\d)~$/.test(urls.ver)&&urls.defLen<urls.chgLen, JSON.stringify({ver:urls.ver,def:urls.defLen,chg:urls.chgLen}));
    check('E1 発行側ページエラーなし', errs.length===0, errs.join(' | ').slice(0,200));
    await ctx.close();
  }

  // ---- 訪問者役A: 2回訪問の再現(第106の症状が消えたこと)+凍結の維持 ----
  {
    const ctx=await newCtx(); const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(urls.closedUrl,{waitUntil:'load'});
    await p.waitForFunction(()=>typeof appState==='object',{timeout:8000});
    await p.waitForTimeout(600);
    const v1=await p.evaluate(()=>({days:appState.tsujiSearchDays, off:appState.tsujiSearchOffsetAz, tex:appState.smBldgTex, label:appState.soraLabelScale}));
    check('R1 1回目の訪問で作者の検索条件が届く(days=180/offset=30。第106では届いていなかった)',
      v1.days===180&&v1.off===30&&v1.tex===false&&v1.label===150, JSON.stringify(v1));
    await p.evaluate(()=>{ appState.tsujiSearchDays=7; saveAppState(); });
    const ls1=await p.evaluate(()=>JSON.parse(localStorage.getItem('soranotsuji_app')).tsujiSearchDays);
    check('R1 訪問中の変更は保存されない(凍結キーは訪問前の値365で書き出し=第37の維持)', ls1===365, `ls=${ls1}`);
    await p.goto(urls.closedUrl,{waitUntil:'load'});
    await p.waitForFunction(()=>typeof appState==='object',{timeout:8000});
    await p.waitForTimeout(600);
    const v2=await p.evaluate(()=>({days:appState.tsujiSearchDays}));
    check('R1 2回目の訪問もURLの値で開く(days=180。第106の症状の解消)', v2.days===180, JSON.stringify(v2));
    await p.goto(urls.shortUrl,{waitUntil:'load'});
    await p.waitForFunction(()=>typeof appState==='object',{timeout:8000});
    await p.waitForTimeout(600);
    const v3=await p.evaluate(()=>({days:appState.tsujiSearchDays}));
    check('R1 短縮URL(?query=v19)でも同じ(days=180)', v3.days===180, JSON.stringify(v3));
    check('E1 訪問者Aページエラーなし', errs.length===0, errs.join(' | ').slice(0,200));
    await ctx.close();
  }

  // ---- 訪問者役B: パターン5(辻検索結果+他パネルの画面共有)=パネルキー由来の自動実行が作者の条件で走る ----
  {
    const ctx=await newCtx(); const p=await ctx.newPage();
    await p.goto(urls.openUrl,{waitUntil:'load'});
    await p.waitForFunction(()=>typeof appState==='object',{timeout:8000});
    await p.evaluate(()=>{ window._runCalled=false; startTsujiSearch=()=>{ window._runCalled=true; }; });   // 実検索は重いので呼び出しだけ確認
    await p.waitForTimeout(800);
    const r=await p.evaluate(()=>({run:window._runCalled, active:appState.isTsujiSearchActive, days:appState.tsujiSearchDays, off:appState.tsujiSearchOffsetAz}));
    check('R2 パネルが開いたURL→開いた側で検索が自動実行され、条件は作者の値(パターン5の成立)',
      r.run&&r.active&&r.days===180&&r.off===30, JSON.stringify(r));
    await ctx.close();
  }

  // ---- 訪問者役C: 天体色の再現(訪問者の変更色が既定色URLで毎回戻る)+保存値の保全 ----
  {
    const ctx=await newCtx(); const p=await ctx.newPage();
    await p.goto(BASE+'/index.html',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof appState==='object',{timeout:8000});
    await p.waitForTimeout(400);
    await p.evaluate(()=>{ appState.bodies.find(x=>x.id==='Sun').color='#0000FF'; saveAppState(); });
    await p.goto(urls.closedUrl,{waitUntil:'load'});
    await p.waitForFunction(()=>typeof appState==='object',{timeout:8000});
    await p.waitForTimeout(600);
    const c1=await p.evaluate(()=>({sun:appState.bodies.find(x=>x.id==='Sun').color,
      lsSun:(JSON.parse(localStorage.getItem('soranotsuji_app')).bodies.find(x=>x.id==='Sun')||{}).color,
      def:DEFAULT_BODIES.find(x=>x.id==='Sun').color}));
    check('R3 既定色URLで訪問者の変更色が既定へ戻る(常時発行の効果)+自分の保存色は無傷',
      c1.sun===c1.def&&c1.lsSun==='#0000FF', JSON.stringify(c1));
    await p.goto(urls.closedUrl,{waitUntil:'load'});
    await p.waitForFunction(()=>typeof appState==='object',{timeout:8000});
    await p.waitForTimeout(600);
    const c2=await p.evaluate(()=>({sun:appState.bodies.find(x=>x.id==='Sun').color, def:DEFAULT_BODIES.find(x=>x.id==='Sun').color}));
    check('R3 2回目の訪問でも既定色で開く', c2.sun===c2.def, JSON.stringify(c2));
    await ctx.close();
  }

  // ---- 訪問者役D: 旧URL互換(検索条件キーの無いmode=preview URLは検索条件に触らない=有るキーだけ適用) ----
  {
    const ctx=await newCtx(); const p=await ctx.newPage();
    await p.goto(BASE+'/index.html',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof appState==='object',{timeout:8000});
    await p.waitForTimeout(400);
    await p.evaluate(()=>{ appState.tsujiSearchDays=100; saveAppState(); });
    await p.goto(BASE+'/index.html?mode=preview&startLat=35.0&startLng=139.0',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof appState==='object',{timeout:8000});
    await p.waitForTimeout(600);
    const r=await p.evaluate(()=>({days:appState.tsujiSearchDays, lat:appState.start.lat}));
    check('R4 検索条件キーの無い旧形URLは条件に触らない(自分の100のまま。地点キーだけ適用)',
      r.days===100&&r.lat===35.0, JSON.stringify(r));
    await ctx.close();
  }

  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
