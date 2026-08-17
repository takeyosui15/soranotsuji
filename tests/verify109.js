// 第25ラウンド検証: 本体地図のMapLibre移行R1 — アダプタ+ベース地図/コントロール
// (手順4のLeaflet撤去後に保守: 旧フラグ?maplibre=0/1は無視され、常にMapLibre)
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
  // 版数ピンは最新のverify(現在は110)のみに置く(テスト方針)。ここでは存在だけ確認する
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    check('O0 APP_VERSIONが定義されている', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
  }
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });

  // ---- Part A: 旧フラグ?maplibre=0は無視される(手順4でLeaflet撤去済み) ----
  {
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(BASE+'/index.html?maplibre=0',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:8000});
    await p.waitForTimeout(400);
    const r=await p.evaluate(()=>({
      engine: mapAdapter.engine(),
      canvas: !!document.querySelector('#map .maplibregl-canvas'),
      noLeafletGlobal: typeof L==='undefined',
      noShadow: !document.getElementById('map-shadow'),
      maxZ: mapAdapter.getMaxZoom(),
    }));
    check('A1 ?maplibre=0でもMapLibre(Leafletグローバル/シャドウ無し)', r.engine==='maplibre'&&r.canvas&&r.noLeafletGlobal&&r.noShadow);
    check('A2 アダプタのgetMaxZoom=18(従来換算)', r.maxZ===18, `maxZ=${r.maxZ}`);
    const r2=await p.evaluate(()=>{
      mapAdapter.setView(34.5, 133.5, 11);
      const c=mapAdapter.getCenter();
      return { lat:c.lat, lng:c.lng, z:mapAdapter.getZoom() };
    });
    check('A3 adapter.setViewが地図を移動(従来ズーム単位)', Math.abs(r2.lat-34.5)<1e-6&&Math.abs(r2.lng-133.5)<1e-6&&Math.abs(r2.z-11)<1e-9);
    check('A4 ページエラーなし', errs.length===0, errs.slice(0,2).join(' | '));
    await p.close();
  }

  // ---- Part B: 既定(フラグ無し)=MapLibreの本検証 ----
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:8000});
  await p.waitForTimeout(600);

  // B1: MapLibre本体(移行バッジ/シャドウ地図は撤去済み=無いことを確認)
  {
    const r=await p.evaluate(()=>({
      engine: mapAdapter.engine(),
      canvas: !!document.querySelector('#map .maplibregl-canvas'),
      noBadge: !document.getElementById('gl-migration-badge'),
      noShadow: !document.getElementById('map-shadow'),
      layers: ['std','photo','pale','osm'].map(id=>glMap.getLayoutProperty('base-'+id,'visibility')).join(','),
    }));
    check('B1 MapLibre本体(バッジ/シャドウ撤去済み)', r.engine==='maplibre'&&r.canvas&&r.noBadge&&r.noShadow);
    check('B1 ベース4種(標準のみ可視)', r.layers==='visible,none,none,none', r.layers);
  }

  // B2: レイヤ切替コントロール(開閉+写真へ切替)
  {
    await p.click('#gl-layer-toggle');
    const opened=await p.evaluate(()=>!document.querySelector('.gl-layer-list').classList.contains('hidden'));
    await p.click('.gl-layer-list input[value="photo"]');
    const r=await p.evaluate(()=>['std','photo','pale','osm'].map(id=>glMap.getLayoutProperty('base-'+id,'visibility')).join(','));
    check('B2 レイヤ切替: リスト開閉+写真(地理院)へ切替', opened&&r==='none,visible,none,none', r);
    await p.click('.gl-layer-list input[value="std"]');
    await p.click('#gl-layer-toggle');   // 閉じる
  }

  // B3: ズーム値の換算(アプリ内部=Leaflet換算)とズームコントロール
  {
    const r=await p.evaluate(()=>({ ad: mapAdapter.getZoom(), gl: glMap.getZoom(), maxZ: mapAdapter.getMaxZoom() }));
    check('B3 ズーム換算(adapter=GL+1・maxZoom18)', Math.abs(r.ad-(r.gl+1))<1e-9&&r.maxZ===18, JSON.stringify(r));
    const z0=r.ad;
    await p.click('.maplibregl-ctrl-zoom-in');
    await p.waitForTimeout(700);
    const z1=await p.evaluate(()=>mapAdapter.getZoom());
    check('B3 ズームコントロール(+)で拡大', z1>z0, `z ${z0}→${z1}`);
  }

  // B4: パンコントロール(▶=東へ・▲=北へ)
  {
    const c0=await p.evaluate(()=>mapAdapter.getCenter());
    await p.click('#map-pan-right');
    await p.waitForTimeout(700);
    const c1=await p.evaluate(()=>mapAdapter.getCenter());
    await p.click('#map-pan-up');
    await p.waitForTimeout(700);
    const c2=await p.evaluate(()=>mapAdapter.getCenter());
    check('B4 パン: ▶で東へ・▲で北へ(半画面)', c1.lng>c0.lng&&Math.abs(c1.lat-c0.lat)<0.02&&c2.lat>c1.lat,
      `lng ${c0.lng.toFixed(3)}→${c1.lng.toFixed(3)}, lat ${c1.lat.toFixed(3)}→${c2.lat.toFixed(3)}`);
  }

  // B5: ダブルクリックで観測点移動(シングルでは動かない)
  {
    const before=await p.evaluate(()=>({ ...appState.start, mode:(appState.locMode='start', _mapDblClickMode) }));
    await p.mouse.click(500, 300);
    await p.waitForTimeout(500);
    const afterSingle=await p.evaluate(()=>({ lat:appState.start.lat, lng:appState.start.lng }));
    const exp=await p.evaluate(()=>{ const ll=glMap.unproject([500,300]); return { lat:ll.lat, lng:ll.lng }; });
    await p.mouse.dblclick(500, 300);
    await p.waitForFunction(pv=>Math.abs(appState.start.lat-pv.lat)>1e-9||Math.abs(appState.start.lng-pv.lng)>1e-9,
      {lat:before.lat,lng:before.lng},{timeout:5000}).catch(()=>{});
    const after=await p.evaluate(()=>({ lat:appState.start.lat, lng:appState.start.lng }));
    const singleKept = before.mode ? (afterSingle.lat===before.lat&&afterSingle.lng===before.lng) : true;
    check('B5 シングルクリックでは移動しない(PCモード)', singleKept);
    check('B5 ダブルクリックで観測点がクリック地点へ移動', Math.abs(after.lat-exp.lat)<0.002&&Math.abs(after.lng-exp.lng)<0.002,
      `start=(${after.lat.toFixed(4)},${after.lng.toFixed(4)}) exp=(${exp.lat.toFixed(4)},${exp.lng.toFixed(4)})`);
  }

  // B6: ⌖(選択中マーカーの中央表示)
  {
    await p.evaluate(()=>{ glMap.jumpTo({ center:[141.0,43.0], zoom:glMap.getZoom() }); });
    await p.click('#map-center-point');
    await p.waitForTimeout(700);
    const r=await p.evaluate(()=>({ c: mapAdapter.getCenter(), s: appState.start }));
    check('B6 ⌖で観測点が画面中央へ', Math.abs(r.c.lat-r.s.lat)<0.01&&Math.abs(r.c.lng-r.s.lng)<0.01,
      `center=(${r.c.lat.toFixed(3)},${r.c.lng.toFixed(3)}) start=(${r.s.lat.toFixed(3)},${r.s.lng.toFixed(3)})`);
  }

  // B7: 下部パネル表示中のrecenter(easeTo offsetの向き=地点が中心より上に来る)
  {
    const r=await p.evaluate(async()=>{
      const pnl=document.getElementById('tsujisearch-panel');
      pnl.classList.remove('hidden');
      recenterPointInView(appState.start, false);
      await new Promise(res=>setTimeout(res,300));
      const size=mapAdapter.getSize();
      const pt=mapAdapter.latLngToContainerPoint({lat:appState.start.lat,lng:appState.start.lng});
      pnl.classList.add('hidden');
      return { y: pt.y, half: size.y/2 };
    });
    check('B7 パネル併用時のrecenterで地点が中心より上', r.y < r.half - 20, `y=${Math.round(r.y)} half=${Math.round(r.half)}`);
  }

  // B8: 未移行機能の安全無効化(R2でマーカーはMapLibre側へ移行済み — 描画先の詳細検証はverify110)
  {
    const r=await p.evaluate(()=>{
      updateAll();
      return {
        glMarkers: document.querySelectorAll('#map .location-marker').length,
        tmPopup: _tmShowPixelPopup({lat:35,lng:138}),
      };
    });
    check('B8 updateAllがエラーなく走る(マーカーはGL側)+メッシュポップアップ抑止', r.glMarkers>=2&&r.tmPopup===false,
      `gl=${r.glMarkers}`);
  }

  // B9: adapter.setViewの往復(GL座標順/ズーム換算)。シャドウ地図の追従検証は手順4の撤去に伴い削除
  {
    const r=await p.evaluate(async()=>{
      mapAdapter.setView(36.2, 137.9, 12);
      await new Promise(res=>setTimeout(res,300));
      const c=glMap.getCenter();
      return { lat:c.lat, lng:c.lng, glz:glMap.getZoom(), adz:mapAdapter.getZoom() };
    });
    check('B9 adapter.setView(36.2,137.9,12)がGLに反映(zoom=GL11)', Math.abs(r.lat-36.2)<1e-6&&Math.abs(r.lng-137.9)<1e-6&&Math.abs(r.glz-11)<1e-9&&Math.abs(r.adz-12)<1e-9);
  }

  check('B10 フラグONでページエラーなし', errs.length===0, errs.slice(0,3).join(' | '));

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
