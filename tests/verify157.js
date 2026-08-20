// 第91ラウンド検証: v1.74.0
// v16第2弾(叩き台承認済み): 組込天体の色/線種の天体毎キー(bodyColor<ID>/bodyDash<ID>)。
//   既定値のキーは省略・非表示天体も既定から変えていれば発行・復元の形検査・短縮URL(v17)往復。
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

// ---- V0: 版数の存在検査(版数ピンは最新のverify158へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.74.0の行がある', src.includes('Version 1.74.0 - ') || !!process.argv[2]);

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});

  // C1+C2: 発行と短縮URLの作成(第108ラウンドで常時発行へ意図更新: 既定値でも44キー全部を発行し、
  // 開いた側の変更色が残らないようにする。既定値は辞書v19のペアが1コードに畳む)
  let shortUrl=null, expColor=null;
  {
    const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
    await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(BASE+'/index.html',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof buildCommonUrlParams==='function',{timeout:8000});
    await p.waitForTimeout(400);
    const r=await p.evaluate(()=>{
      const bodyKeys=(params)=>[...params.keys()].filter(k=>k.startsWith('bodyColor')||k.startsWith('bodyDash'));
      const pBefore=buildCommonUrlParams('fixed');
      const before=bodyKeys(pBefore);   // 常時発行→全既定でも44キー
      const defVals={ sun: pBefore.get('bodyColorSun'), moon: pBefore.get('bodyDashMoon') };
      const sun=appState.bodies.find(x=>x.id==='Sun');
      const moon=appState.bodies.find(x=>x.id==='Moon');
      const venus=appState.bodies.find(x=>x.id==='Venus');   // 既定で非表示の天体
      sun.color='#123456'; moon.isDashed=true; venus.color='#ABCDEF';
      const params=buildCommonUrlParams('fixed');
      params.set('mode','preview');
      const after=bodyKeys(params);
      return { before, after, defVals,
               defMatch: defVals.sun===DEFAULT_BODIES.find(x=>x.id==='Sun').color && defVals.moon==='0',
               vals: { sun: params.get('bodyColorSun'), moon: params.get('bodyDashMoon'), venus: params.get('bodyColorVenus') },
               short: '?query='+encodeQueryParam(params.toString()),
               ver: encodeQueryParam('a=1').slice(0,4) };
    });
    check('C1 全て既定でも44キー全部が付く(常時発行=第108)+値は既定値', r.before.length===44&&r.defMatch, JSON.stringify({n:r.before.length,defVals:r.defVals}));
    check('C1 変えた天体は変更値で発行(太陽の色・月の線種・非表示の金星の色)+44キーのまま',
      r.after.length===44&&r.vals.sun==='#123456'&&r.vals.moon==='1'&&r.vals.venus==='#ABCDEF', JSON.stringify(r.vals));
    // 版数は17以上(v17=天体色/線種の辞書が入った版)。最新版の等値ピンはverify125のM0が持つ
    // (第96ラウンドでv18が積まれた際に版数非依存へ緩和=verify140 T1と同じ運用)
    check('C2 短縮URLはv17以降の辞書でエンコードされる', /^~(1[7-9]|[2-9]\d)~$/.test(r.ver), r.ver);
    shortUrl=r.short;
    check('E1 発行側ページエラーなし', errs.length===0, errs.join(' | ').slice(0,200));
    await ctx.close();
  }

  // C3: 短縮URLで開き直すと色/線種が復元される(既定のままの天体は既定のまま)
  {
    const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
    await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(BASE+'/index.html'+shortUrl,{waitUntil:'load'});
    await p.waitForFunction(()=>typeof drawSoramado==='function',{timeout:8000});
    await p.waitForTimeout(800);
    const r=await p.evaluate(()=>{
      const g=id=>appState.bodies.find(x=>x.id===id);
      return { sun: g('Sun').color, moon: g('Moon').isDashed, venus: g('Venus').color,
               mars: g('Mars').color, mw: g('MilkyWay').isDashed };   // 触っていない天体は既定のまま
    });
    check('C3 短縮URLの往復で色/線種が復元(太陽#123456・月=破線・金星#ABCDEF)・他は既定のまま',
      r.sun==='#123456'&&r.moon===true&&r.venus==='#ABCDEF'&&r.mars==='#FFA500'&&r.mw===false, JSON.stringify(r));
    check('E2 復元側ページエラーなし', errs.length===0, errs.join(' | ').slice(0,200));
    await ctx.close();
  }

  // C4: 復元の形検査(不正な色値・不正な線種値・未知IDは無視される)
  {
    const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
    await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(BASE+'/index.html?mode=preview&bodyColorMars=red&bodyDashSun=yes&bodyColorNotABody=%23112233&bodyDashVega=0',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof drawSoramado==='function',{timeout:8000});
    await p.waitForTimeout(600);
    const r=await p.evaluate(()=>{
      const g=id=>appState.bodies.find(x=>x.id===id);
      return { mars: g('Mars').color, sun: g('Sun').isDashed, vega: g('Vega').isDashed };
    });
    check('C4 不正な色値/線種値は無視・未知IDはエラーなし・正しい値(ベガ=実線化)は効く',
      r.mars==='#FFA500'&&r.sun===false&&r.vega===false, JSON.stringify(r));
    check('E3 不正値混在でもページエラーなし', errs.length===0, errs.join(' | ').slice(0,200));
    await ctx.close();
  }

  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
