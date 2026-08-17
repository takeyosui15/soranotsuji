// 第29ラウンド検証: 本体地図のMapLibre移行R5(機能群5=辻メッシュ。最重量)
// verify98と同じ合成メッシュ(4画素)で表示系を駆動する: メッシュ画像・金ドット・辻マーカー集合・
// 優辻ピン・ポップアップ・ホバー・表示切替・消去。(手順4のLeaflet撤去後に保守)
// ローカルハーネス(vendor)。外部への実アクセスは行わない(route abort)。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };

// 合成メッシュ(4画素)を組み立てるページ内スクリプト(両エンジン共通)
const SETUP=`(() => {
  const obs={lat:35.5,lng:138.8,elev:900};
  const lats=[35.501,35.502,35.503,35.504], lngs=[138.801,138.802,138.803,138.804];
  const scale=Math.pow(2,TSUJIMESH_ZOOM); const R=128/Math.PI;
  const gp=(lat,lng)=>({gx:Math.floor(128*(lng/180+1)*scale), gy:Math.floor((128-R*Math.atanh(Math.sin(lat*Math.PI/180)))*scale)});
  const gps=lats.map((la,i)=>gp(la,lngs[i]));
  const gxBase=Math.min(...gps.map(g=>g.gx))-2, gyBase=Math.min(...gps.map(g=>g.gy))-2;
  const W=Math.max(...gps.map(g=>g.gx-gxBase),...gps.map(g=>g.gy-gyBase))+3;
  const grid=new Int32Array(W*W);
  const gridPos=new Int32Array(4);   // pix→gridセルindex(辻マーカー集合の描画で使用)
  gps.forEach((g,i)=>{ const cell=(g.gy-gyBase)*W+(g.gx-gxBase); grid[cell]=i+1; gridPos[i]=cell; });
  const nw=_globalPixelToLatLng(gxBase,gyBase,TSUJIMESH_ZOOM);
  const se=_globalPixelToLatLng(gxBase+W,gyBase+W,TSUJIMESH_ZOOM);
  const t0=new Date(2026,6,19,10,0,0);
  const aobs=new Astronomy.Observer(obs.lat,obs.lng,obs.elev);
  const eq=Astronomy.Equator('Sun',t0,aobs,true,true);
  const hor=Astronomy.Horizon(t0,aobs,eq.ra,eq.dec,null);
  const dOff=[0.011,0.052,0.201,0.302];
  _tsujiMeshCalc={
    baseAz:Float64Array.from(dOff.map(d=>hor.azimuth+d)),
    baseAlt:Float64Array.from(dOff.map(()=>hor.altitude)),
    dE:new Float64Array(4), dN:new Float64Array(4), tanLat:Math.tan(obs.lat*Math.PI/180),
    offsetAz:0, offsetAlt:0, centerMode:'point',
    observerData:obs, refractionEnabled:false,
    grid, gridPos, gridW:W, gxBase, gyBase,
    bounds:{ west:nw.lng, east:se.lng, north:nw.lat, south:se.lat },
  };
  _tsujiMeshPix={ lat:lats, lng:lngs, elev:[900,910,920,930] };
  _tsujiMeshPixHeightUsed=1.5;
  const sun=appState.bodies.find(b=>b.id==='Sun');
  const mkRow=(pixIdx,times)=>({ body:sun, dateObj:new Date(times[0]),
    pixIdx:Uint32Array.from(pixIdx), pixTime:Float64Array.from(times),
    pixDist:Float32Array.from(pixIdx.map(i=>dOff[i])),
    azimuth:hor.azimuth, altitude:hor.altitude });
  _tsujiMeshRows=[ mkRow([2,0,1],[t0.getTime(),t0.getTime()+60e3,t0.getTime()+120e3]),
                   mkRow([1,3],[t0.getTime()+3600e3,t0.getTime()+3660e3]) ];
  _tsujiMeshSelIdx=0; _tsujiMeshRows[0].__sel=true;
  _tsujiMeshLayerVisible=true;
  // 辻時刻コントロールの状態(ホバー精細化 _tmRefinePixelTime は実運用でctrl初期化後に呼ばれる)
  _tmCtrlDay0=new Date(2026,6,19,0,0,0).getTime(); _tmCtrlFracMs=0;
  const sl=document.getElementById('tsujimesh-time-slider'); if(sl) sl.value=String(10*3600);
  window.confirm=()=>true; window.alert=()=>{};
  return { pix1:{lat:lats[1],lng:lngs[1]}, pix0:{lat:lats[0],lng:lngs[0]} };
})()`;

(async()=>{
  // 版数ピンは最新のverify(現在は114)のみに置く(テスト方針)。ここでは存在だけ確認する
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    check('S0 APP_VERSIONが定義されている', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
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
  await p.evaluate(SETUP);
  await p.evaluate(()=>{ glMap.jumpTo({ center:[138.8025,35.5025], zoom:_glZoom(15) }); });
  await p.waitForTimeout(400);

  // S1: メッシュ画像(件数グラデーション)がcanvasソースへ**同期で**反映・白索引の構築
  //     (第36ラウンドでtoBlob+objectURLの非同期パイプラインを標準canvasソースへ置換=待ち不要)
  {
    const r=await p.evaluate(()=>{
      drawTsujiMeshMarkers();
      const lyrVis=glMap.getLayoutProperty('tm-mesh-img','visibility');   // 同期でvisibleになる
      const srcType=glMap.getSource('tm-mesh-img').serialize().type;
      const srcCoords=glMap.getSource('tm-mesh-img').coordinates;
      const desc=_tmBuildGradientOverlay();   // 記述子の四隅=bounds(変換関数の検証)
      const B=_tsujiMeshCalc.bounds;
      const okDesc=desc&&Math.abs(desc.coordinates[0][0]-B.west)<1e-9&&Math.abs(desc.coordinates[0][1]-B.north)<1e-9&&
                   Math.abs(desc.coordinates[2][0]-B.east)<1e-9&&Math.abs(desc.coordinates[2][1]-B.south)<1e-9;
      const okSrc=srcCoords&&Math.abs(srcCoords[0][0]-B.west)<1e-6&&Math.abs(srcCoords[0][1]-B.north)<1e-6;
      const whiteHits=[0,1,2,3].filter(px=>_tsujiMeshWhiteRow[px]>=0).length;
      return { lyrVis, whiteHits, okDesc, okSrc, srcType, srcCoords: JSON.stringify(srcCoords&&srcCoords[0]),
               shown: _tmLayerShown('mesh') };
    });
    check('S1 メッシュ画像が同期でvisible(canvasソース)・四隅=bounds・白索引4画素',
      r.lyrVis==='visible'&&r.okDesc&&r.okSrc&&r.srcType==='canvas'&&r.whiteHits===4&&r.shown, JSON.stringify(r));
  }

  // S2: 表示切替(チェックボックス相当)OFF→ONで**再描画なしに**復帰する
  //     (旧テストはONの後に手動でdrawTsujiMeshMarkers()を呼んでいてスマホ不具合(2)を見逃した)
  {
    const r=await p.evaluate(()=>{
      _tsujiMeshLayerVisible=false; applyTsujiMeshLayerVisibility();
      const off={ mesh:glMap.getLayoutProperty('tm-mesh-img','visibility'), shown:_tmLayerShown('mesh') };
      _tsujiMeshLayerVisible=true; applyTsujiMeshLayerVisibility();   // 再描画は呼ばない
      const on={ mesh:glMap.getLayoutProperty('tm-mesh-img','visibility'), shown:_tmLayerShown('mesh') };
      return { off, on };
    });
    check('S2 表示OFF→none/ON→visible(再描画なしで復帰=不具合(2)の回帰)', r.off.mesh==='none'&&r.off.shown===false&&r.on.mesh==='visible'&&r.on.shown===true,
      JSON.stringify(r));
  }

  // S3: 金ドット(選択行のヒット画素)+実マウスクリックで観測点設定(一般クリックへは流れない)
  {
    const r=await p.evaluate(()=>{
      updateTsujiMeshGoldMarkers();
      const feats=glMap.getSource('tm-gold-dots-src')._data.features;
      const px=glMap.project([_tsujiMeshPix.lng[2],_tsujiMeshPix.lat[2]]);   // 行0の先頭=pix2
      return { n: feats.length, x:px.x, y:px.y, dists: feats.map(f=>+f.properties.dist.toFixed(3)).join(',') };
    });
    check('S3 金ドット=選択行の3画素', r.n===3, `n=${r.n} dists=${r.dists}`);
    // circleが実際にその座標へ描画されるまで待つ(描画完了前にクリックするとヒットしないフレーク対策)
    await p.evaluate(()=>glMap.triggerRepaint());
    await p.waitForFunction((pt)=>glMap.queryRenderedFeatures([pt.x,pt.y],{layers:['tm-gold-dots']}).length>0,
      {x:r.x,y:r.y},{timeout:10000});
    await p.mouse.click(r.x, r.y);
    await p.waitForTimeout(500);
    const r2=await p.evaluate(()=>({
      sLat: appState.start.lat, sLng: appState.start.lng, sElev: appState.start.elev,
      apiElev: appState.startApiElev, h: appState.startHeight,
      noPopup: _glTmPopup===null }));
    check('S3 金ドットクリックで観測点=画素2(標高920+1.5)・画素ポップアップは出ない',
      Math.abs(r2.sLat-35.503)<1e-9&&Math.abs(r2.sLng-138.803)<1e-9&&r2.sElev===921.5&&r2.apiElev===920&&r2.h===1.5&&r2.noPopup,
      JSON.stringify(r2));
  }

  // S4: 辻マーカー集合(天体色画像)+優辻ピン+ピンのポップアップ→内容クリックで観測点移動
  {
    const r=await p.evaluate(async()=>{
      const perPix=new Map([[0,0.011],[2,0.201]]);
      drawTsujiMeshGoldSet(perPix,{pix:0,dist:0.011,timeMs:Date.now?undefined:0, ...( {timeMs:_tsujiMeshRows[0].pixTime[1]} )});
      // canvasソースは同期反映(第36ラウンド)
      const goldVis=glMap.getLayoutProperty('tm-gold-img','visibility');
      const pin=document.querySelectorAll('#map .location-marker-tsujigold').length;
      // ピンクリック→ポップアップ
      _glMarkerGroups.tmpin[0].getElement().dispatchEvent(new MouseEvent('click',{bubbles:true}));
      await new Promise(res=>setTimeout(res,300));
      const pop=document.querySelector('#map .maplibregl-popup-content');
      const popTxt=pop?pop.textContent:'';
      // 内容ブロックのクリックで観測点=画素0へ
      const blk=pop?pop.querySelector('.tm-popup-block'):null;
      if(blk) blk.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      await new Promise(res=>setTimeout(res,400));
      return { goldVis, pin, popTxt: popTxt.slice(0,30), sLat: appState.start.lat,
               popClosed: _glTmPopup===null, goldSetKept: _tsujiMeshGoldSet!==null };
    });
    check('S4 辻マーカー画像visible+優辻ピン1本', r.goldVis==='visible'&&r.pin===1);
    check('S4 ピンのポップアップ(優辻マーカー)→内容クリックで観測点=画素0+閉', /優辻マーカー/.test(r.popTxt)&&Math.abs(r.sLat-35.501)<1e-9&&r.popClosed,
      JSON.stringify({popTxt:r.popTxt,sLat:r.sLat}));
  }

  // S5: 画素の実マウスクリックでメッシュポップアップ(件数)+詳細リスト固定→閉で解除
  // (S4の観測点設定で金ドットが再生成されるため、行選択を外してドットを消してから画素クリックする)
  {
    await p.evaluate(()=>{ _tsujiMeshSelIdx=-1; updateTsujiMeshGoldMarkers(); _glTmHideTip(); if(_glTmPopup)_glTmPopup.remove(); });
    await p.mouse.move(50, 50);
    await p.waitForTimeout(300);
    const px=await p.evaluate(()=>{ const q=glMap.project([_tsujiMeshPix.lng[1],_tsujiMeshPix.lat[1]]); return {x:q.x,y:q.y}; });
    await p.mouse.click(px.x, px.y);
    await p.waitForTimeout(500);
    const r=await p.evaluate(()=>{
      const txt=_glTmPopup?_glTmPopup.getElement().textContent:'';
      return { txt, locked: _tmDetailLockPopup!==null };
    });
    check('S5 画素クリックでメッシュマーカー(N件)ポップアップ+詳細リスト固定', /メッシュマーカー\(\d+件\)/.test(r.txt)&&r.locked, r.txt.slice(0,24));
    const r2=await p.evaluate(async()=>{
      if(_glTmPopup) _glTmPopup.remove();
      await new Promise(res=>setTimeout(res,200));
      return { unlocked: _tmDetailLockPopup===null };
    });
    check('S5 ポップアップを閉じると固定解除', r2.unlocked);
  }

  // S6: ホバーツールチップ(辻マーカー集合の画素=精細化内容/null=消える)
  {
    const r=await p.evaluate(async()=>{
      _tsujiMeshSelIdx=0;   // S5で外した行選択を戻す
      // 集合はS5のドット表示切替でnull化される(第36ラウンド: 古い集合の持ち越しを廃止)ため描き直す
      drawTsujiMeshGoldSet(new Map([[0,0.011],[2,0.201]]),{pix:0,dist:0.011,timeMs:_tsujiMeshRows[0].pixTime[1]});
      if(_glTmPopup)_glTmPopup.remove();
      handleTsujiMeshGoldHover({lat:_tsujiMeshPix.lat[0],lng:_tsujiMeshPix.lng[0]});
      await new Promise(res=>setTimeout(res,200));
      const tip1=_glTmHoverTip?_glTmHoverTip.getElement().textContent:'';
      handleTsujiMeshGoldHover(null);
      await new Promise(res=>setTimeout(res,100));
      return { tip1: tip1.slice(0,30), gone: _glTmHoverTip===null };
    });
    check('S6 ホバーで辻マーカー(対象精度)ツールチップ→nullで消える', /辻マーカー/.test(r.tip1)&&r.gone, r.tip1);
  }

  // S7: 消去(clearTsujiMeshMarkers)で画像/金ドット/ピンが全て消える
  {
    const r=await p.evaluate(async()=>{
      clearTsujiMeshMarkers();
      await new Promise(res=>setTimeout(res,200));
      return { mesh: glMap.getLayoutProperty('tm-mesh-img','visibility'),
               gold: glMap.getLayoutProperty('tm-gold-img','visibility'),
               dots: glMap.getSource('tm-gold-dots-src')._data.features.length,
               pin: document.querySelectorAll('#map .location-marker-tsujigold').length };
    });
    check('S7 消去で画像none+金ドット0+ピン0', r.mesh==='none'&&r.gold==='none'&&r.dots===0&&r.pin===0, JSON.stringify(r));
  }

  check('S8 フラグONでページエラーなし', errs.length===0, errs.slice(0,3).join(' | '));

  // S9: 旧フラグ?maplibre=0は無視される(手順4でLeaflet撤去済み) — メッシュ描画はMapLibreで動く
  {
    const p2=await ctx.newPage();
    const errs2=[]; p2.on('pageerror',e=>errs2.push(e.message));
    await p2.goto(BASE+'/index.html?maplibre=0',{waitUntil:'load'});
    await p2.waitForFunction(()=>typeof glMap==='object'&&glMap!==null&&glMap.isStyleLoaded&&glMap.isStyleLoaded(),{timeout:10000});
    await p2.waitForTimeout(400);
    await p2.evaluate(SETUP);
    const r=await p2.evaluate(async()=>{
      drawTsujiMeshMarkers();
      updateTsujiMeshGoldMarkers();
      // canvasソースは同期反映(第36ラウンド。旧toBlob時代の反映待ちは不要になった)
      return { meshVis: glMap.getLayoutProperty('tm-mesh-img','visibility'),
               dots: glMap.getSource('tm-gold-dots-src')._data.features.length,
               popupOk: _tmShowPixelPopup({lat:_tsujiMeshPix.lat[1],lng:_tsujiMeshPix.lng[1]}),
               glPopup: !!document.querySelector('#map .maplibregl-popup-content'),
               noLeaflet: typeof L==='undefined' };
    });
    check('S9 ?maplibre=0でもメッシュ描画/金ドット/ポップアップはMapLibreで動く', r.meshVis==='visible'&&r.dots===3&&r.popupOk&&r.glPopup&&r.noLeaflet,
      JSON.stringify(r));
    check('S9 ページエラーなし', errs2.length===0, errs2.slice(0,2).join(' | '));
    await p2.close();
  }

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
