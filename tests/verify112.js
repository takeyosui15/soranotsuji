// 第28ラウンド検証: 本体地図のMapLibre移行R4(機能群4=宙検索オーバーレイ)
// ?maplibre=1時の視界扇形+扇形標本点(雲量着色・ホバーツールチップ)・消去。
// フラグOFF(Leaflet)のオーバーレイはverify103が全て検証済みのため本検証はGL側に集中する。
// ローカルハーネス(vendor+Open-Meteoモック)。外部への実アクセスは行わない(route abort)。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };
(async()=>{
  // 版数ピンは最新のverify(現在は113)のみに置く(テスト方針)。ここでは存在だけ確認する
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    check('R0 APP_VERSIONが定義されている', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
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
  await p.waitForTimeout(600);

  // 宙検索を実行(Open-Meteoモック: 常に低20/中0/高0=雲量一定20%)
  await p.evaluate(async()=>{
    window.confirm=()=>true; window.alert=()=>{};
    const t0=new Date(); t0.setHours(0,0,0,0);
    const mk=(n)=>{ const time=[],low=[],mid=[],high=[],rh=[];
      for(let i=0;i<n;i++){ const d=new Date(t0.getTime()+i*3600e3); const p2=v=>('00'+v).slice(-2);
        time.push(`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}T${p2(d.getHours())}:00`);
        low.push(20); mid.push(0); high.push(0); rh.push(40); }
      return {hourly:{time,cloud_cover_low:low,cloud_cover_mid:mid,cloud_cover_high:high,relative_humidity_2m:rh}};};
    const __origFetch=window.fetch.bind(window);
    window.fetch=async(url,opt)=>{
      const u=typeof url==='string'?url:((url&&url.url)||String(url));
      if(u.includes('air-quality-api')||u.includes('archive-api'))
        return new Response(JSON.stringify({hourly:null}),{status:200,headers:{'Content-Type':'application/json'}});
      if(u.includes('api.open-meteo.com')){
        const nLoc=u.match(/latitude=([^&]*)/)[1].split(',').length;
        const body=JSON.stringify(nLoc>1?Array.from({length:nLoc},()=>mk(72)):mk(72));
        return new Response(body,{status:200,headers:{'Content-Type':'application/json'}});
      }
      return __origFetch(url,opt);
    };
    try{ indexedDB.deleteDatabase('soranotsuji-wx'); }catch(_){}
    _ssDbReady=null;
    appState.start={lat:35.30,lng:138.60,elev:500};
    appState.end={lat:35.3606,lng:138.7274,elev:3776};
    document.getElementById('input-ss-days').value='2';
    document.getElementById('sel-ss-preset').value='milkyway';
    await soraSearchRun();
  });
  await p.waitForTimeout(400);

  // R1c: 扇形+標本点がGLソースに入る(検索直後=行未選択・全点白)
  {
    const r=await p.evaluate(()=>{
      const fan=glMap.getSource('ss-fan')._data.features;
      const pts=glMap.getSource('ss-points')._data.features;
      const snap=_ssLast||null;
      const nExpected=snap?snap.points.length:-1;
      const ring=fan.length?fan[0].geometry.coordinates[0]:[];
      const closed=ring.length>2&&ring[0][0]===ring[ring.length-1][0]&&ring[0][1]===ring[ring.length-1][1];
      return { nFan: fan.length, ring: ring.length, closed, nPts: pts.length, nExpected,
               allWhite: pts.every(f=>f.properties.fill==='#ffffff'),
               tipOk: pts.every(f=>/格子 .+ \/ 重み /.test(f.properties.tip)),
               lyrs: ['ss-fan-fill','ss-fan-line','ss-point-circles'].every(id=>!!glMap.getLayer(id)) };
    });
    check('R1c 視界扇形(閉ポリゴン)+標本点が標本数と一致・全点白', r.nFan===1&&r.closed&&r.nPts===r.nExpected&&r.nPts>0&&r.allWhite&&r.tipOk&&r.lyrs,
      JSON.stringify({ring:r.ring,nPts:r.nPts,nExpected:r.nExpected}));
  }

  // R2c: 行クリックで標本点がその時刻の雲量で着色(雲20%一定→rgb(215,215,215))
  {
    const r=await p.evaluate(async()=>{
      const row=document.querySelector('#sorasearch-content tbody tr');
      row.click();
      await new Promise(res=>setTimeout(res,600));
      const pts=glMap.getSource('ss-points')._data.features;
      const fills=[...new Set(pts.map(f=>f.properties.fill))];
      const tipHasCloud=pts.every(f=>/雲 低20% 中0% 高0%/.test(f.properties.tip));
      return { fills: fills.join('|'), tipHasCloud, n: pts.length };
    });
    check('R2c 行選択で雲量20%の灰色着色+ツールチップに層別雲量', r.fills==='rgb(215,215,215)'&&r.tipHasCloud, JSON.stringify(r));
  }

  // R3c: 標本点ホバーでツールチップPopupが出る(実マウス)
  {
    const r=await p.evaluate(()=>{
      const f=glMap.getSource('ss-points')._data.features[0];
      const px=glMap.project(f.geometry.coordinates);
      return { x: px.x, y: px.y };
    });
    await p.mouse.move(r.x, r.y);
    await p.waitForTimeout(400);
    const tip=await p.evaluate(()=>{
      const el=document.querySelector('#map .maplibregl-popup-content');
      return el?el.textContent:'';
    });
    check('R3c ホバーで格子ツールチップ表示', /格子 .+ \/ 重み /.test(tip), tip.slice(0,50));
    await p.mouse.move(10, 10);
    await p.waitForTimeout(300);
    const gone=await p.evaluate(()=>!_glSsTipPopup);
    check('R3c マウスが離れるとツールチップが消える', gone);
  }

  // R4c: パネル✕で扇形/標本点が消える
  {
    const r=await p.evaluate(async()=>{
      closeSoraSearchPanel();
      await new Promise(res=>setTimeout(res,200));
      return { fan: glMap.getSource('ss-fan')._data.features.length,
               pts: glMap.getSource('ss-points')._data.features.length };
    });
    check('R4c パネルを閉じるとオーバーレイ消去', r.fan===0&&r.pts===0, JSON.stringify(r));
  }

  check('R5c フラグONでページエラーなし', errs.length===0, errs.slice(0,3).join(' | '));

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
