// 第88ラウンド検証: v1.72.0
// v16 URL第1弾: 大気差ON/OFF・気象3値・基本オプションのスカラー16キーを全URLへ追加。
//   発行(buildCommonUrlParams)・長いURLからの復元・短縮URLの往復・normalizeの丸めを実測。
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

// ---- V0: 版数の存在検査(版数ピンは最新のverify156へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.72.0の行がある', src.includes('Version 1.72.0 - ') || !!process.argv[2]);

const NEW_KEYS=['refractionEnabled','meteoP','meteoT','meteoL','baseOptMwBase','mwOffsetAngle',
  'mwShowBodies','mwShowBodyNames','mwShowConstFig','mwShowConstBounds','mwShowConstNames',
  'mwConstNameSort','elevExcludeEnabled','elevExcludeRadius','elevExcludeObsRadius','tsujiLineIncludeOffset'];

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});

  // U1+U3: 発行(16キーが全URLに乗る)と短縮URLの往復
  let shortUrl=null;
  {
    const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
    await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(BASE+'/index.html',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof buildCommonUrlParams==='function',{timeout:8000});
    await p.waitForTimeout(400);
    const r=await p.evaluate((keys)=>{
      // 既定値以外の状態を仕込んでから発行する(往復の確認用)
      appState.refractionEnabled=true;
      appState.meteo.p=990; appState.meteo.t=5; appState.meteo.l=0.0125;
      appState.baseOptMwBase='offset'; appState.mwOffsetAngle=-25;
      appState.mwShowConstFig=true; appState.mwConstNameSort='pos';
      appState.elevExcludeRadius=33; appState.tsujiLineIncludeOffset=false;
      const params=buildCommonUrlParams('fixed');
      params.set('mode', 'preview');   // 実URLと同じ形(copyLocationUrl相当。restoreFromUrlはmode必須)
      const all=keys.every(k=>params.has(k));
      const vals={ refr: params.get('refractionEnabled'), p: params.get('meteoP'),
                   mwB: params.get('baseOptMwBase'), ang: params.get('mwOffsetAngle'),
                   fig: params.get('mwShowConstFig'), rad: params.get('elevExcludeRadius'),
                   tl: params.get('tsujiLineIncludeOffset') };
      const short='?query='+encodeQueryParam(params.toString());
      return { all, vals, short };
    },NEW_KEYS);
    check('U1 発行URLに新16キーが全て乗り、値が状態どおり',
      r.all&&r.vals.refr==='true'&&r.vals.p==='990'&&r.vals.mwB==='offset'&&r.vals.ang==='-25'&&
      r.vals.fig==='true'&&r.vals.rad==='33'&&r.vals.tl==='false', JSON.stringify(r.vals));
    shortUrl=r.short;
    check('E1 発行側ページエラーなし', errs.length===0, errs.join(' | ').slice(0,200));
    await ctx.close();
  }

  // U3: 短縮URLで開き直すと新キーの状態が復元される
  {
    const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
    await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(BASE+'/index.html'+shortUrl,{waitUntil:'load'});
    await p.waitForFunction(()=>typeof drawSoramado==='function',{timeout:8000});
    await p.waitForTimeout(800);
    const r=await p.evaluate(()=>({
      refr: appState.refractionEnabled, p: appState.meteo.p, t: appState.meteo.t, l: appState.meteo.l,
      mwB: appState.baseOptMwBase, ang: appState.mwOffsetAngle, fig: appState.mwShowConstFig,
      sort: appState.mwConstNameSort, rad: appState.elevExcludeRadius, tl: appState.tsujiLineIncludeOffset,
      chkMw: document.getElementById('chk-baseopt-mw-enable').checked,        // :天の川オプション=オン(offset)
      dispAng: document.getElementById('input-baseopt-mw-offset').value,      // 収録符号そのまま(第93ラウンドで表示反転廃止)
      chkFig: document.getElementById('chk-baseopt-const-fig').checked,
      chkTl: document.getElementById('chk-baseopt-tsujiline-offset').checked,
      refrChk: document.getElementById('chk-refraction').checked }));
    check('U3 短縮URLの往復で新キーの状態が復元される(大気差true・気圧990・気温5・減率0.0125)',
      r.refr===true&&r.p===990&&r.t===5&&r.l===0.0125, JSON.stringify({refr:r.refr,p:r.p,t:r.t,l:r.l}));
    check('U3 基本オプション組も復元(offset/-25/星座線true/座標順/除外33/辻オフセット込みfalse)',
      r.mwB==='offset'&&r.ang===-25&&r.fig===true&&r.sort==='pos'&&r.rad===33&&r.tl===false, JSON.stringify(r));
    check('U3 UIにも映る(:天の川オプション=オン・角度-25(収録符号のまま)・星座線チェック・:辻オフセットオフ・大気差チェック)',
      r.chkMw===true&&r.dispAng==='-25'&&r.chkFig===true&&r.chkTl===false&&r.refrChk===true,
      JSON.stringify({chkMw:r.chkMw,dispAng:r.dispAng,chkFig:r.chkFig,chkTl:r.chkTl,refrChk:r.refrChk}));
    check('E2 復元側ページエラーなし', errs.length===0, errs.join(' | ').slice(0,200));
    await ctx.close();
  }

  // U4: 壊れた値の丸め(normalize)と長いURL直書きの復元
  {
    const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
    await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    const p=await ctx.newPage();
    await p.goto(BASE+'/index.html?mode=preview&baseOptMwBase=bogus&mwOffsetAngle=999&mwConstNameSort=zzz&refractionEnabled=true&meteoP=abc',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof drawSoramado==='function',{timeout:8000});
    await p.waitForTimeout(600);
    const r=await p.evaluate(()=>({
      mwB: appState.baseOptMwBase, ang: appState.mwOffsetAngle, sort: appState.mwConstNameSort,
      refr: appState.refractionEnabled, p: appState.meteo.p }));
    await ctx.close();
    check('U4 壊れた値は既定へ丸め(bogus→center・999→360・zzz→aiueo)、正しい値は活きる(大気差true・気圧はNaNガードで既定)',
      r.mwB==='center'&&r.ang===360&&r.sort==='aiueo'&&r.refr===true&&r.p===1013.25, JSON.stringify(r));
  }

  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
