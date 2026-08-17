// 第24ラウンド検証: 宙断面ビューの肉付け(デッサン19の旧未決①〜④) — 最大化/積み上げ・細メッシュ・時間スライダー・輪切りモード
// ローカルハーネス(vendor+Open-Meteo/気圧面モック)。外部への実アクセスは行わない(route abort)。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };
(async()=>{
  // 版数ピンは最新のverify(現在は109)のみに置く(テスト方針)。ここでは存在だけ確認する
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    check('N0 APP_VERSIONが定義されている', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
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

  // モック: 3層雲量=時刻の偶奇で0%/60%交互(補間の検証用)・気圧面16面=500hPa(5600m)のみ80%
  await p.evaluate(()=>{
    window.confirm=()=>true; window.alert=()=>{};
    window.__plCalls=0;
    const t0=new Date(); t0.setHours(0,0,0,0);
    const timeArr=()=>{ const a=[]; for(let i=0;i<72;i++){ const d=new Date(t0.getTime()+i*3600e3); const p2=v=>('00'+v).slice(-2);
      a.push(`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}T${p2(d.getHours())}:00`);} return a; };
    const GH={1000:110,975:340,950:570,925:800,900:1030,850:1500,800:2000,700:3000,600:4200,500:5600,400:7200,300:9200,250:10400,200:11800,150:13600,100:16200};
    const __origFetch=window.fetch.bind(window);
    window.fetch=async(url,opt)=>{
      const u=typeof url==='string'?url:((url&&url.url)||String(url));
      const json=(o)=>new Response(JSON.stringify(o),{status:200,headers:{'Content-Type':'application/json'}});
      if(u.includes('air-quality-api')||u.includes('archive-api')) return json({hourly:null});
      if(u.includes('api.open-meteo.com')&&u.includes('cloud_cover_1000hPa')){
        window.__plCalls++;
        const time=timeArr();
        const nLoc=u.match(/latitude=([^&]*)/)[1].split(',').length;
        const mk=()=>{ const h={time};
          for(const l of [1000,975,950,925,900,850,800,700,600,500,400,300,250,200,150,100]){
            h[`cloud_cover_${l}hPa`]=time.map(()=>l===500?80:0);   // 500hPa(5600m)だけ雲量80%
            h[`geopotential_height_${l}hPa`]=time.map(()=>GH[l]); }
          return {hourly:h}; };
        return json(nLoc>1?Array.from({length:nLoc},mk):mk());
      }
      if(u.includes('api.open-meteo.com')){
        const nLoc=u.match(/latitude=([^&]*)/)[1].split(',').length;
        const time=timeArr();
        const mk=()=>({hourly:{time, cloud_cover_low:time.map((t,i)=>i%2?60:0), cloud_cover_mid:time.map(()=>0),
                               cloud_cover_high:time.map(()=>0), relative_humidity_2m:time.map(()=>40)}});
        return json(nLoc>1?Array.from({length:nLoc},mk):mk());
      }
      return __origFetch(url,opt);   // 未知URL(ローカル資産/タイル)は元fetchへ(外部はroute abortで遮断)
    };
    try{ indexedDB.deleteDatabase('soranotsuji-wx'); }catch(_){}
    _ssDbReady=null;
    appState.start={lat:35.30,lng:138.60,elev:500};
    appState.end={lat:35.3606,lng:138.7274,elev:3776};
  });

  // N1: UI(⛶/モードラジオ/スライダー/▶/凡例)+開いてマップ生成
  {
    const r=await p.evaluate(()=>{
      const ids=['btn-soradanmen-max','btn-sd-play','sd-time-slider','sd-time-label','sd-legend'];
      const missing=ids.filter(id=>!document.getElementById(id));
      const modeRadios=document.querySelectorAll('input[name="sd-mode"]').length;
      toggleSoradanmen();
      return { missing:missing.join(','), modeRadios, mapCreated:_sdMap!==null,
               sliderMax:document.getElementById('sd-time-slider').max, sliderStep:document.getElementById('sd-time-slider').step };
    });
    check('N1 肉付けUI5要素+モードラジオ2', r.missing===''&&r.modeRadios===2&&r.mapCreated, r.missing);
    check('N1 スライダー=+12時間(720分)・10分刻み', r.sliderMax==='720'&&r.sliderStep==='10');
  }
  await p.waitForFunction(()=>_sdMap&&/面|枚/.test(document.getElementById('soradanmen-status').textContent),{timeout:30000});

  // N2: 細メッシュ(0.1°×9×9=81格子)+補間: 偶数時0%/奇数時60% → +30分で30%(30%以上の閾値上)
  {
    const r=await p.evaluate(async()=>{
      // 基準時刻の偶奇に合わせ、偶数時(low=0%)に日時を合わせる
      const d=new Date(appState.currentDate); d.setMinutes(0,0,0);
      const t0=new Date(); t0.setHours(0,0,0,0);
      const hourIdx=Math.round((d.getTime()-t0.getTime())/3600e3);
      if(hourIdx%2===1){ appState.currentDate=new Date(d.getTime()+3600e3); syncUIFromState(); updateAll(); await new Promise(r=>setTimeout(r,150)); }
      const slider=document.getElementById('sd-time-slider');
      const fire=(el,type)=>el.dispatchEvent(new Event(type,{bubbles:true}));
      slider.value='0'; fire(slider,'input');   // 偶数時ちょうど: low=0% → 0面
      await new Promise(r=>setTimeout(r,100));
      const at0=(_sdMap.getSource('clouds')._data.features||[]).length;
      slider.value='30'; fire(slider,'input');  // +30分: 0%→60%の中間=30% → 閾値30%以上で81面
      await new Promise(r=>setTimeout(r,100));
      const at30=(_sdMap.getSource('clouds')._data.features||[]);
      const covs=new Set(at30.map(f=>Math.round(f.properties.cov)));
      slider.value='60'; fire(slider,'input');  // +60分: 奇数時ちょうど=60%
      await new Promise(r=>setTimeout(r,100));
      const at60=(_sdMap.getSource('clouds')._data.features||[]);
      return { nPoints:_sdClouds.points.length, at0, n30:at30.length, cov30:[...covs].join(','),
               cov60:at60.length?Math.round(at60[0].properties.cov):-1,
               label:document.getElementById('sd-time-label').textContent };
    });
    check('N2 細メッシュ0.1°×9×9=81格子', r.nPoints===81, `points=${r.nPoints}`);
    check('N2 補間: 0分=0面 → +30分=81面(雲量30%=0と60の中間) → +60分=雲量60%', r.at0===0&&r.n30===81&&r.cov30==='30'&&r.cov60===60, `${r.at0}/${r.n30}/cov=${r.cov30}/${r.cov60}`);
    check('N2 時刻ラベル(+0:30形式)', /\+0:30|\+1:00/.test(r.label), r.label);
  }

  // N3: ▶アニメーション(500ms毎+10分)と停止
  {
    const r=await p.evaluate(async()=>{
      const slider=document.getElementById('sd-time-slider');
      const fire=(el,type)=>el.dispatchEvent(new Event(type,{bubbles:true}));
      slider.value='0'; fire(slider,'input');
      const play=document.getElementById('btn-sd-play');
      play.click();
      const playing=play.textContent==='⏸';
      await new Promise(r=>setTimeout(r,2600));   // 数tick(ヘッドレスの描画負荷でtickが延びる場合がある)
      const advanced=_sdOffsetMin>=20;
      play.click();
      const stopped=play.textContent==='▶'&&_sdPlayTimer===null;
      const at=_sdOffsetMin;
      await new Promise(r=>setTimeout(r,600));
      return { playing, advanced, stopped, frozen:_sdOffsetMin===at };
    });
    check('N3 ▶で+10分/500msのアニメーション→⏸で停止', r.playing&&r.advanced&&r.stopped&&r.frozen, JSON.stringify(r));
  }

  // N4: 輪切りモード: 16面取得(0.2°×5×5)・500hPa(5600m)の薄板が気象庁配色で出る+凡例
  {
    const r=await p.evaluate(async()=>{
      const slices=document.querySelector('input[name="sd-mode"][value="slices"]');
      slices.checked=true; slices.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,400));
      const feats=(_sdMap.getSource('slices')._data.features||[]);
      const clouds=(_sdMap.getSource('clouds')._data.features||[]);
      const f0=feats[0]||{properties:{}};
      const legend=document.getElementById('sd-legend');
      return { plCalls:window.__plCalls, nPoints:_sdSlices.points.length, nFeats:feats.length, cloudsCleared:clouds.length===0,
               level:f0.properties.level, color:f0.properties.color,
               base:Math.round(f0.properties.base||0), top:Math.round(f0.properties.top||0),
               legendShown:!legend.classList.contains('hidden')&&/凡例/.test(legend.textContent),
               status:document.getElementById('soradanmen-status').textContent };
    });
    check('N4 輪切り: 気圧面16面を1コールで取得(0.2°×5×5=25格子)+3層スラブはクリア', r.plCalls===1&&r.nPoints===25&&r.cloudsCleared, `calls=${r.plCalls} points=${r.nPoints}`);
    check('N4 500hPa(5600m)の薄板25枚: 雲量80%=黄(#ffe600。70〜85%帯)・実高度±120m×1.2', r.nFeats===25&&r.level===500&&r.color==='#ffe600'&&r.base===Math.round((5600-120)*1.2)&&r.top===Math.round((5600+120)*1.2), `${r.nFeats}/${r.level}/${r.color}/${r.base}-${r.top}`);
    check('N4 凡例(気象庁降水配色6段)+ステータスに枚数', r.legendShown&&/25枚/.test(r.status), r.status);
  }

  // N5: 最大化+結果パネル併用の積み上げ規則
  {
    const r=await p.evaluate(()=>{
      const pnl=document.getElementById('soradanmen-panel');
      document.getElementById('btn-soradanmen-max').click();
      const maxOn=pnl.classList.contains('maximized');
      // 宙検索結果パネルを開く(排他: 宙断面は下部パネルだが結果パネルとは併用可)
      openSoraSearchPanel();
      const withTsuji=pnl.classList.contains('with-tsuji');
      const ssP=document.getElementById('sorasearch-panel');
      const ssUp=ssP.classList.contains('with-soradanmen')&&ssP.classList.contains('with-soradanmen-max');
      document.getElementById('btn-soradanmen-max').click();   // 最大化解除
      const ssUp2=ssP.classList.contains('with-soradanmen')&&!ssP.classList.contains('with-soradanmen-max');
      closeSoraSearchPanel();
      const withTsujiOff=!pnl.classList.contains('with-tsuji');
      return { maxOn, withTsuji, ssUp, ssUp2, withTsujiOff };
    });
    check('N5 最大化+宙検索結果併用: 宙断面with-tsuji+結果パネルが上へ(max=66.67%/通常=33.33%)', r.maxOn&&r.withTsuji&&r.ssUp&&r.ssUp2&&r.withTsujiOff);
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
