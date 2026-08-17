// 第26ラウンド検証: 本体地図のMapLibre移行R2(機能群2=マーカー/ポップアップ)
// (手順4のLeaflet撤去後に保守: 旧フラグは無視され常にMapLibre)
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
  // 版数ピンは最新のverify(現在は111)のみに置く(テスト方針)。ここでは存在だけ確認する
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    check('P0 APP_VERSIONが定義されている', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
  }
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html?maplibre=1',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null&&glMap.isStyleLoaded&&glMap.isStyleLoaded(),{timeout:10000});
  await p.waitForTimeout(600);

  // P1: 観測点/目的点マーカーが可視地図(MapLibre)に出る+シャドウには残らない
  {
    const r=await p.evaluate(()=>{
      updateAll();
      return {
        glObs: document.querySelectorAll('#map .location-marker-observer').length,
        glTgt: document.querySelectorAll('#map .location-marker-target').length,
        shadowMk: document.querySelectorAll('#map-shadow .location-marker').length,
        groups: Object.keys(_glMarkerGroups).join(','),
        locCnt: (_glMarkerGroups.location||[]).length,
      };
    });
    check('P1 観測点(青)/目的点(赤)マーカーがMapLibre側に各1', r.glObs===1&&r.glTgt===1&&r.locCnt===2, JSON.stringify(r));
    check('P1 シャドウ地図に位置マーカーが残らない', r.shadowMk===0, `shadow=${r.shadowMk}`);
  }

  // P2: 2本線(破線=見かけ直線・実線=大圏)のソース/レイヤ
  {
    const r=await p.evaluate(()=>{
      const src=glMap.getSource('location-lines');
      const d=src&&src._data;
      return {
        has: !!src,
        kinds: d?d.features.map(f=>f.properties.kind).sort().join(','):'',
        gcPts: d?(d.features.find(f=>f.properties.kind==='gc')||{geometry:{coordinates:[]}}).geometry.coordinates.length:0,
        lyr: !!glMap.getLayer('loc-line-mercator')&&!!glMap.getLayer('loc-line-gc'),
      };
    });
    check('P2 観測点-目的点の2本線(大圏101点+破線)', r.has&&r.kinds==='gc,mercator'&&r.gcPts===101&&r.lyr, JSON.stringify(r));
  }

  // P3: マーカークリックでポップアップ(内容=位置情報)
  {
    const r=await p.evaluate(async()=>{
      const mk=_glMarkerGroups.location[0];
      mk.togglePopup();
      await new Promise(res=>setTimeout(res,200));
      const el=document.querySelector('#map .maplibregl-popup-content');
      const txt=el?el.textContent:'';
      const open=mk.getPopup().isOpen();
      mapAdapter.closePopup();
      await new Promise(res=>setTimeout(res,100));
      const closed=!mk.getPopup().isOpen();
      return { open, txt: txt.slice(0,60), closed };
    });
    check('P3 観測点ポップアップ表示(緯度/経度/標高/相手距離)', r.open&&/観測点/.test(r.txt)&&/緯度/.test(r.txt), r.txt);
    check('P3 mapAdapter.closePopupで閉じる', r.closed);
  }

  // P4: My観測点/My目的点マーカー+クリックで観測点/目的点へ適用
  {
    const r=await p.evaluate(async()=>{
      appState.myObservations=[{id:1,name:'テスト観測点',lat:35.1,lng:138.1,elev:100,height:2}];
      appState.myTargets=[{id:1,name:'テスト目的点',lat:35.2,lng:138.2,elev:200,height:0}];
      updateMyPointMarkers();
      const cnt={
        myobs: document.querySelectorAll('#map .location-marker-myobs').length,
        mytgt: document.querySelectorAll('#map .location-marker-mytgt').length,
      };
      // My観測点マーカーのクリック→観測点が置き換わる+locMode=start
      appState.locMode='end';
      _glMarkerGroups.mypoint[0].getElement().dispatchEvent(new MouseEvent('click',{bubbles:true}));
      await new Promise(res=>setTimeout(res,300));
      return { ...cnt, sLat: appState.start.lat, sElev: appState.start.elev, mode: appState.locMode,
               h: appState.startHeight };
    });
    check('P4 My観測点(緑)/My目的点(橙)マーカー各1', r.myobs===1&&r.mytgt===1);
    check('P4 My観測点クリックで観測点に適用(標高+高さ・モード切替)', Math.abs(r.sLat-35.1)<1e-9&&r.sElev===102&&r.h===2&&r.mode==='start',
      JSON.stringify(r));
  }

  // P5: 🎆打ち上げ点マーカー+ばらつき範囲円
  {
    const r=await p.evaluate(()=>{
      appState.fwEnabled=true; appState.fwLat=35.3; appState.fwLng=138.3; appState.fwRadius=100;
      _fwMapKey='';
      fwUpdateMapMarker();
      const circ=glMap.getSource('fw-circle');
      const ring=circ&&circ._data.features.length?circ._data.features[0].geometry.coordinates[0]:[];
      // 半径100m≒緯度0.0009°: リング上の点と中心の緯度差の最大で確認
      const maxDLat=ring.length?Math.max(...ring.map(c=>Math.abs(c[1]-35.3))):0;
      return { fw: document.querySelectorAll('#map .fw-map-icon').length, pts: ring.length,
               okR: maxDLat>0.0008&&maxDLat<0.001 };
    });
    check('P5 🎆マーカー+範囲円(65点リング・半径100m相当)', r.fw===1&&r.pts===65&&r.okR, JSON.stringify(r));
    const r2=await p.evaluate(()=>{
      appState.fwEnabled=false; _fwMapKey='x'; fwUpdateMapMarker();
      const circ=glMap.getSource('fw-circle');
      return { fw: document.querySelectorAll('#map .fw-map-icon').length, feats: circ._data.features.length };
    });
    check('P5 花火OFFでマーカー/円が消える', r2.fw===0&&r2.feats===0);
  }

  // P6: 観測点移動(ダブルクリック)でマーカー/線が追従する
  {
    const r=await p.evaluate(async()=>{
      const before=document.querySelector('#map .location-marker-observer').closest('.maplibregl-marker').style.transform;
      appState.locMode='start';
      await applyMapPointAction({lat:36.0,lng:139.0});
      await new Promise(res=>setTimeout(res,300));
      const after=document.querySelector('#map .location-marker-observer').closest('.maplibregl-marker').style.transform;
      const src=glMap.getSource('location-lines');
      const merc=src._data.features.find(f=>f.properties.kind==='mercator').geometry.coordinates[0];
      return { moved: before!==after, lineStart: merc, sLat: appState.start.lat };
    });
    check('P6 地点移動でマーカーと線が追従', r.moved&&Math.abs(r.lineStart[1]-36.0)<1e-9&&Math.abs(r.lineStart[0]-139.0)<1e-9&&r.sLat===36.0,
      JSON.stringify(r.lineStart));
  }

  // P7: 旧フラグ?maplibre=0は無視される(手順4でLeaflet撤去済み) — マーカーはMapLibreに出る
  {
    const p2=await ctx.newPage();
    const errs2=[]; p2.on('pageerror',e=>errs2.push(e.message));
    await p2.goto(BASE+'/index.html?maplibre=0',{waitUntil:'load'});
    await p2.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:8000});
    await p2.waitForTimeout(600);
    const r=await p2.evaluate(()=>{
      updateAll();
      return {
        engine: mapAdapter.engine(),
        glObs: document.querySelectorAll('#map .location-marker-observer').length,
        noLeaflet: typeof L==='undefined',
      };
    });
    check('P7 ?maplibre=0でもMapLibreマーカー(Leaflet撤去済み)', r.engine==='maplibre'&&r.glObs===1&&r.noLeaflet, JSON.stringify(r));
    check('P7 ページエラーなし', errs2.length===0, errs2.slice(0,2).join(' | '));
    await p2.close();
  }

  check('P8 フラグONでページエラーなし', errs.length===0, errs.slice(0,3).join(' | '));

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
