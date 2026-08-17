// 第32ラウンド検証: 地図全面移行計画 完了(手順4=Leaflet撤去)
// Leaflet本体(タグ/グローバルL/シャドウ地図)が完全に無いこと・アプリ一式が動くこと・
// _geoDistM(Leaflet互換Haversine)の数値一致・旧フラグの無視・コントロール地スタイルの移植。
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
  // ソース検査: leaflet参照がindex.html/script.jsに残っていない+版数ピン
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    const html=fs.readFileSync(path.join(__dirname, '..', 'index.html'),'utf8');
    // 版数ピンは最新のverify(現在は117)のみに置く(テスト方針)。ここでは存在だけ確認する
    check('V0 APP_VERSIONが定義されている', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
    check('V0 index.htmlにleafletのタグ参照なし', !/leaflet\.(js|css)|unpkg\.com\/leaflet/i.test(html));
    // コメント行(// / *)とVersion History(冒頭コメント)を除いた実コードにLeaflet APIが無いこと
    const codeLines=src.split('\n').filter(l=>{ const t=l.trim(); return !(t.startsWith('//')||t.startsWith('*')||t.startsWith('/*')||t.startsWith('Version ')); });
    const lRefs=codeLines.join('\n').match(/\bL\.(map|tileLayer|marker|circleMarker|polyline|polygon|layerGroup|divIcon|popup|tooltip|latLng|latLngBounds|imageOverlay|control|point|DomUtil|DomEvent|canvas|circle)\b/g)||[];
    check('V0 script.jsの実コードにLeaflet API(L.*)なし', lRefs.length===0, lRefs.slice(0,3).join(','));
  }
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html?forecast=1',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null&&glMap.isStyleLoaded&&glMap.isStyleLoaded(),{timeout:10000});
  await p.waitForTimeout(800);

  // V1: Leafletが実行環境に存在しない+MapLibre一式が動いている
  {
    const r=await p.evaluate(()=>{
      updateAll();
      return {
        noL: typeof L==='undefined',
        noShadow: !document.getElementById('map-shadow'),
        noLeafletDom: document.querySelectorAll('[class*="leaflet-"]').length===0,
        canvas: !!document.querySelector('#map .maplibregl-canvas'),
        obs: document.querySelectorAll('#map .location-marker-observer').length,
        dirN: glMap.getSource('dir-lines')._data.features.length,
        visCnt: appState.bodies.filter(b2=>b2.visible).length,
      };
    });
    check('V1 Leafletグローバル/シャドウ/leaflet-DOMが完全に無い', r.noL&&r.noShadow&&r.noLeafletDom, JSON.stringify(r));
    check('V1 MapLibreでマーカー/方位線が描画される', r.canvas&&r.obs===1&&r.dirN===r.visCnt&&r.dirN>=2);
  }

  // V2: _geoDistM=Leaflet互換Haversine(東京駅→大阪駅)の凍結値検証
  {
    const r=await p.evaluate(()=>{
      const d=_geoDistM(35.681236, 139.767125, 34.702485, 135.495951);
      // Leaflet CRS.Earth.distance(Haversine, R=6371000)と同式の凍結値: 403,058m
      // (式や半径をうっかり変えると従来の可視判定/距離表示の数値が変わるため回帰で固定する)
      return { d };
    });
    check('V2 _geoDistM: 東京→大阪 = 403.06km(Leaflet時代の凍結値)', Math.abs(r.d-403058)<100, `${Math.round(r.d)}m`);
  }

  // V3: 距離を使う表示(辻検索メニューの相手距離)が算出される
  {
    const r=await p.evaluate(()=>{
      appState.start={lat:35.30,lng:138.60,elev:500};
      appState.end={lat:35.3606,lng:138.7274,elev:3776};
      updateAll();
      const v=document.getElementById('input-tsuji-dist')?document.getElementById('input-tsuji-dist').value:null;
      const dist=_geoDistM(35.30,138.60,35.3606,138.7274);
      return { v, distKm: dist/1000 };
    });
    // 表示欄が存在すれば値が距離(km)と整合、無ければ距離計算だけ検証
    const okVal = r.v===null || Math.abs(parseFloat(r.v)-r.distKm)<0.5;
    check('V3 距離表示/計算がHaversineで整合(約13.3km)', okVal&&r.distKm>13&&r.distKm<14, `v=${r.v} d=${r.distKm.toFixed(2)}km`);
  }

  // V4: コントロールの地スタイル移植(.gl-bar): ズーム/⌖/パンのボタンが白背景で表示される
  {
    const r=await p.evaluate(()=>{
      const a=document.querySelector('.map-center-control a');
      const cs=a?getComputedStyle(a):null;
      const bar=document.querySelector('.gl-bar');
      return { hasBar: !!bar, bg: cs?cs.backgroundColor:'', w: cs?cs.width:'' };
    });
    check('V4 .gl-barスタイル移植(白背景29pxボタン。第34ラウンドでMapLibre標準と統一)', r.hasBar&&r.bg==='rgb(255, 255, 255)'&&r.w==='29px', JSON.stringify(r));
  }

  // V5: 一連の主要操作がエラーなく動く(地点移動→recenter→辻ライン→メッシュ合成→宙断面開閉)
  {
    const r=await p.evaluate(async()=>{
      appState.locMode='start';
      await applyMapPointAction({lat:36.0,lng:138.0});
      recenterPointInView(appState.start, false);
      appState.bodies.forEach(b2=>{ b2.visible=(b2.id==='Sun'); });
      appState.isDPActive=true;
      await updateDPLines();
      const dpN=glMap.getSource('dp-lines')._data.features.length;
      appState.isDPActive=false; updateAll();
      toggleSoradanmen();
      await new Promise(res=>setTimeout(res,1500));
      const sdOpen=_sdMap!==null;
      toggleSoradanmen();
      await new Promise(res=>setTimeout(res,300));
      return { dpN, sdOpen, sdClosed:_sdMap===null };
    });
    check('V5 主要操作の一連(地点移動/recenter/辻ライン/宙断面開閉)が動く', r.dpN>0&&r.sdOpen&&r.sdClosed, JSON.stringify(r));
  }

  check('V6 ページエラーなし', errs.length===0, errs.slice(0,3).join(' | '));

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
