// 第23ラウンド検証: 宙断面ビューの骨格(MapLibre GL JS初導入 — 地図全面移行計画の手順2。デッサン19)
// ローカルハーネス(vendor: maplibre-gl含む+Open-Meteoモック)。外部への実アクセスは行わない(route abort)。
// 地理院タイル(ラスタ/DEM)はabortされるが、MapLibreはタイル欠けを致命にしないため骨格の検証は可能。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };
(async()=>{
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    // 版数ピンは最新のverifyのみに置く運用(第24ラウンド〜。バージョン更新漏れは最新verifyが検知する)
    const html=fs.readFileSync(path.join(__dirname, '..', 'index.html'),'utf8');
    // 宙断面のボタン/パネルは第34ラウンドでforecast-features.htmlへ分離(封鎖UI)
    const ff=fs.readFileSync(path.join(__dirname, '..', 'forecast-features.html'),'utf8');
    check('D0 MapLibreタグ(index.html)+宙断面ボタン/パネル(forecast-features.html)', /maplibre-gl@[\d.]+\/dist\/maplibre-gl\.js/.test(html)&&ff.includes('btn-soradanmen')&&ff.includes('soradanmen-panel'));
  }
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html?forecast=1',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof toggleSoradanmen==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // Open-Meteoモック(全時刻: 低90/中80/高50%の曇天)
  await p.evaluate(()=>{
    window.confirm=()=>true; window.alert=()=>{};
    const t0=new Date(); t0.setHours(0,0,0,0);
    const __origFetch=window.fetch.bind(window);
    window.fetch=async(url,opt)=>{
      const u=typeof url==='string'?url:((url&&url.url)||String(url));
      const json=(o)=>new Response(JSON.stringify(o),{status:200,headers:{'Content-Type':'application/json'}});
      if(u.includes('air-quality-api')||u.includes('archive-api')||u.includes('cloud_cover_1000hPa')) return json({hourly:null});
      if(u.includes('api.open-meteo.com')){
        const nLoc=u.match(/latitude=([^&]*)/)[1].split(',').length;
        const time=[]; for(let i=0;i<72;i++){ const d=new Date(t0.getTime()+i*3600e3); const p2=v=>('00'+v).slice(-2);
          time.push(`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}T${p2(d.getHours())}:00`); }
        const mk=()=>({hourly:{time, cloud_cover_low:time.map(()=>90), cloud_cover_mid:time.map(()=>80),
                               cloud_cover_high:time.map(()=>50), relative_humidity_2m:time.map(()=>70)}});
        return json(nLoc>1?Array.from({length:nLoc},mk):mk());
      }
      return __origFetch(url,opt);   // 未知URL(ローカル資産/タイル)は元fetchへ(外部はroute abortで遮断)
    };
    try{ indexedDB.deleteDatabase('soranotsuji-wx'); }catch(_){}
    _ssDbReady=null;
    appState.start={lat:35.30,lng:138.60,elev:500};
    appState.end={lat:35.3606,lng:138.7274,elev:3776};
  });

  // D1: MapLibre読込+開く(全天儀を開いた状態から→排他で閉じる)
  {
    const r=await p.evaluate(()=>{
      toggleMilkyWayInstrument();   // 先に全天儀を開いておく
      const mwOpen=appState.isMilkyWayActive;
      toggleSoradanmen();
      return { maplibre:typeof maplibregl, mwOpen, mwClosedAfter:!appState.isMilkyWayActive,
               active:appState.isSoradanmenActive,
               panelShown:!document.getElementById('soradanmen-panel').classList.contains('hidden'),
               btnActive:document.getElementById('btn-soradanmen').classList.contains('active'),
               mapCreated:_sdMap!==null };
    });
    check('D1 MapLibre読込+宙断面が開く(ボタン/パネル/マップ生成)', r.maplibre==='object'&&r.active&&r.panelShown&&r.btnActive&&r.mapCreated);
    check('D1 排他: 全天儀→宙断面で全天儀が閉じる', r.mwOpen&&r.mwClosedAfter);
  }

  // D2: マップload後: terrain設定+雲スラブ(0.1°×9×9=81格子×3層=243面)+ステータス表示
  {
    await p.waitForFunction(()=>_sdMap&&_sdMap.loaded&&_sdMap.loaded()&&/面/.test(document.getElementById('soradanmen-status').textContent),{timeout:30000});
    const r=await p.evaluate(()=>{
      const src=_sdMap.getSource('clouds');
      const feats=(src&&src._data&&src._data.features)||[];
      const low=feats.filter(f=>f.properties.layer==='low');
      const layers=['base','cloud-low','cloud-mid','cloud-high'].every(id=>!!_sdMap.getLayer(id));
      return { terrain:!!_sdMap.getTerrain(), nFeats:feats.length, nLow:low.length,
               lowBase:low[0]&&low[0].properties.base, lowTop:low[0]&&low[0].properties.top,
               layers, pitch:Math.round(_sdMap.getPitch()),
               status:document.getElementById('soradanmen-status').textContent };
    });
    check('D2 terrain(地理院DEM変換)設定+レイヤ4種+pitch65', r.terrain&&r.layers&&r.pitch===65);
    check('D2 雲スラブ81格子×3層=243面(モック曇天・0.1°細分化)', r.nFeats===243&&r.nLow===81, `feats=${r.nFeats}`);
    check('D2 低層スラブ: base=600×1.2=720/top=(600+1400×0.9)×1.2=2232(厚み=雲量比例)', Math.round(r.lowBase)===720&&Math.round(r.lowTop)===2232, `${r.lowBase}/${r.lowTop}`);
    check('D2 ステータスに時刻+面数', /の雲/.test(r.status)&&/243面/.test(r.status), r.status);
  }

  // D3: 日時変更(時単位)で雲スラブが追従更新される
  {
    const r=await p.evaluate(async()=>{
      const key1=_sdLastDrawKey;
      appState.currentDate=new Date(appState.currentDate.getTime()+3600e3);
      syncUIFromState();   // 日時の直接変更はUIへ反映してからupdateAll(行クリックと同じ順序)
      updateAll();
      await new Promise(r=>setTimeout(r,200));
      const key2=_sdLastDrawKey;
      updateAll();   // 同時刻の再呼び出しでは変わらない
      await new Promise(r=>setTimeout(r,100));
      return { changed:key2!==key1&&key2!=='', stable:_sdLastDrawKey===key2 };
    });
    check('D3 日時+1時間で更新キーが変わり、同時刻では再更新しない', r.changed&&r.stable);
  }

  // D4: 閉じる(✕)でMapLibre破棄+逆方向の排他(宙断面→宙の窓で閉じる)
  {
    const r=await p.evaluate(()=>{
      document.getElementById('btn-soradanmen-close').click();
      const closed={ active:appState.isSoradanmenActive, mapGone:_sdMap===null,
                     hidden:document.getElementById('soradanmen-panel').classList.contains('hidden') };
      toggleSoradanmen();   // 再度開く
      const reopened=appState.isSoradanmenActive&&_sdMap!==null;
      toggleSoramado();     // 宙の窓を開く→宙断面が閉じる
      const excl={ sd:appState.isSoradanmenActive, sm:appState.isSoramadoActive, mapGone:_sdMap===null };
      closeSoramado();
      syncBottomPanels();
      return { closed, reopened, excl };
    });
    check('D4 ✕で閉じる(マップ破棄)→再度開ける', !r.closed.active&&r.closed.mapGone&&r.closed.hidden&&r.reopened);
    check('D4 排他: 宙断面→宙の窓で宙断面が閉じマップ破棄', !r.excl.sd&&r.excl.sm&&r.excl.mapGone);
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
