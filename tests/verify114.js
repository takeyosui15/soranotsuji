// 第30ラウンド検証: 本体地図のMapLibre移行R6(既定切替)
// (手順4のLeaflet撤去後に保守: ?maplibre=0/1はどちらも無視され常にMapLibre)
// 既定=MapLibre・バッジ無し・リロード間の状態保持・共有URLにフラグが乗らないこと。
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
  // 版数ピンは最新のverify(現在は115)のみに置く(テスト方針)。ここでは存在だけ確認する
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    check('T0 APP_VERSIONが定義されている', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
  }
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });

  // T1: 既定(フラグ無し)=MapLibre+マーカー/コントロール表示+バッジ無し
  {
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(BASE+'/index.html',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:10000});
    await p.waitForTimeout(800);
    const r=await p.evaluate(()=>({
      engine: mapAdapter.engine(),
      canvas: !!document.querySelector('#map .maplibregl-canvas'),
      obs: document.querySelectorAll('#map .location-marker-observer').length,
      noBadge: !document.getElementById('gl-migration-badge'),
      controls: !!document.getElementById('map-center-point')&&!!document.getElementById('map-pan-up')&&!!document.getElementById('gl-layer-toggle'),
      noShadow: !document.getElementById('map-shadow'),   // シャドウ地図は手順4で撤去済み
    }));
    check('T1 既定=MapLibre(マーカー/コントロール表示・バッジ/シャドウ無し)', r.engine==='maplibre'&&r.canvas&&r.obs===1&&r.noBadge&&r.controls&&r.noShadow,
      JSON.stringify(r));
    check('T1 既定ページエラーなし', errs.length===0, errs.slice(0,2).join(' | '));

    // T2: 旧フラグ?maplibre=0は無視される(Leaflet撤去済み)+設定した観測点をリロードで引き継ぐ
    await p.evaluate(async()=>{ appState.locMode='start'; await applyMapPointAction({lat:36.6,lng:137.2}); });
    await p.waitForTimeout(400);
    await p.goto(BASE+'/index.html?maplibre=0',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:8000});
    await p.waitForTimeout(400);
    const r2=await p.evaluate(()=>({
      engine: mapAdapter.engine(),
      noLeaflet: typeof L==='undefined',
      sLat: appState.start.lat, sLng: appState.start.lng,
    }));
    check('T2 ?maplibre=0は無視されMapLibre+観測点を引き継ぐ(Leafletグローバル無し)',
      r2.engine==='maplibre'&&r2.noLeaflet&&Math.abs(r2.sLat-36.6)<1e-9&&Math.abs(r2.sLng-137.2)<1e-9, JSON.stringify(r2));

    // T3: さらに動かした位置が既定(フラグ無し)へも引き継がれる
    await p.evaluate(async()=>{ appState.locMode='start'; await applyMapPointAction({lat:34.7,lng:135.5}); });
    await p.waitForTimeout(400);
    await p.goto(BASE+'/index.html',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:10000});
    await p.waitForTimeout(600);
    const r3=await p.evaluate(()=>({ engine: mapAdapter.engine(), sLat: appState.start.lat, sLng: appState.start.lng }));
    check('T3 既定リロードでも位置を引き継ぐ', r3.engine==='maplibre'&&Math.abs(r3.sLat-34.7)<1e-9&&Math.abs(r3.sLng-135.5)<1e-9,
      JSON.stringify({sLat:r3.sLat,sLng:r3.sLng}));

    // T4: 共有URL(URL取得)にmaplibreフラグが乗らない(既定で開けばMapLibre)
    const r4=await p.evaluate(()=>{
      const params=buildCommonUrlParams('fixed');
      const url=buildShareUrl?String(buildShareUrl(params)):('?'+params.toString());
      return { hasFlag: /maplibre/.test(url), hasStart: /startLat|query=/.test(url) };
    });
    check('T4 共有URLにmaplibreフラグが乗らない', !r4.hasFlag&&r4.hasStart, JSON.stringify(r4));

    // T5: ?maplibre=1(旧明示フラグ)も無視されてMapLibre
    await p.goto(BASE+'/index.html?maplibre=1',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:10000});
    const r5=await p.evaluate(()=>mapAdapter.engine());
    check('T5 ?maplibre=1も無視されてMapLibre', r5==='maplibre');
    await p.close();
  }

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
