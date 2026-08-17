// 第22ラウンド検証: 宙検索フェーズ3残り — AOD透明度/雲海度(気圧面)/上空風/ERA5統計
// ローカルハーネス(vendor+全APIモック)。外部への実アクセスは行わない(route abortで遮断)。
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
  }
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html?forecast=1',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof soraSearchRun==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // 全APIモックを常駐設置(3層雲量=快晴/AOD=0.5/気圧面=950hPaに雲頂570mの雲海/ERA5=夜間晴天率50%)
  await p.evaluate(()=>{
    window.confirm=()=>true; window.alert=()=>{};
    window.__calls={cloud:0,aod:0,pl:0,era5:0};
    const t0=new Date(); t0.setHours(0,0,0,0);
    const timeArr=(n,start)=>{ const a=[]; for(let i=0;i<n;i++){ const d=new Date((start||t0.getTime())+i*3600e3); const p2=v=>('00'+v).slice(-2);
      a.push(`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}T${p2(d.getHours())}:00`);} return a; };
    const GH={1000:110,975:340,950:570,925:800,900:1030,850:1500,800:2000,700:3000};
    const __origFetch=window.fetch.bind(window);
    window.fetch=async(url,opt)=>{
      const u=typeof url==='string'?url:((url&&url.url)||String(url));
      const json=(o)=>new Response(JSON.stringify(o),{status:200,headers:{'Content-Type':'application/json'}});
      if(u.includes('air-quality-api.open-meteo.com')){
        __calls.aod++;
        const time=timeArr(72);
        return json({hourly:{time, aerosol_optical_depth:time.map(()=>0.5)}});
      }
      if(u.includes('archive-api.open-meteo.com')){
        __calls.era5++;
        const m=/start_date=(\d{4})-(\d{2})-(\d{2})/.exec(u);
        const start=new Date(parseInt(m[1]),parseInt(m[2])-1,parseInt(m[3])).getTime();
        const time=timeArr(15*24,start);
        return json({hourly:{time, cloud_cover:time.map(t=>parseInt(t.slice(11,13))%2?80:10)}});   // 偶数時=晴(10%)
      }
      if(u.includes('api.open-meteo.com')&&u.includes('cloud_cover_1000hPa')){
        __calls.pl++;
        const time=timeArr(72);
        const h={time, wind_speed_300hPa:time.map(()=>30)};
        for(const l of [1000,975,950,925,900,850,800,700]){
          h[`cloud_cover_${l}hPa`]=time.map(()=>l===950?90:0);   // 950hPa(570m)に雲量90%=雲海
          h[`geopotential_height_${l}hPa`]=time.map(()=>GH[l]);
        }
        return json({hourly:h});
      }
      if(u.includes('api.open-meteo.com')){
        __calls.cloud++;
        const nLoc=u.match(/latitude=([^&]*)/)[1].split(',').length;
        const time=timeArr(72);
        const mk=()=>({hourly:{time, cloud_cover_low:time.map(()=>0), cloud_cover_mid:time.map(()=>0),
                               cloud_cover_high:time.map(()=>0), relative_humidity_2m:time.map(()=>40)}});
        return json(nLoc>1?Array.from({length:nLoc},mk):mk());
      }
      return __origFetch(url,opt);   // 未知URL(ローカル資産/タイル)は元fetchへ(外部はroute abortで遮断)
    };
  });

  // P1: 雲海度の推定(ssUnkaiHour)の性質
  {
    const r=await p.evaluate(()=>{
      const mkPl=(ccMap,ghMap)=>{ const timeIdx=new Map([['T',0]]); const cc={},gh={};
        for(const l of [1000,975,950,925,900,850,800,700]){ cc[l]=[ccMap[l]??0]; gh[l]=[ghMap?.[l]??{1000:110,975:340,950:570,925:800,900:1030,850:1500,800:2000,700:3000}[l]]; }
        return {timeIdx,cc,gh,wind300:[30]}; };
      const above=ssUnkaiHour(mkPl({950:90}),'T',1500);      // 観測点1500m > 雲頂570m → 雲海
      const below=ssUnkaiHour(mkPl({950:90}),'T',300);       // 観測点300m < 雲頂570m → 0
      const noCloud=ssUnkaiHour(mkPl({}),'T',1500);          // 低層雲なし → 0
      const none=ssUnkaiHour(null,'T',1500);                 // データなし → null
      return { above, below, noCloud, none };
    });
    check('P1 雲海: 観測点が雲頂より上=眼下雲量90%で雲海度90', r.above&&r.above.deg===90&&Math.round(r.above.top)===570, JSON.stringify(r.above));
    check('P1 雲海: 観測点が雲の中/低層雲なし=0・気圧面なし=null', r.below&&r.below.deg===0&&r.noCloud&&r.noCloud.deg===0&&r.none===null);
  }

  // P2: 因子の性質(AOD霞み・雲海の狙う/避ける)
  {
    const r=await p.evaluate(()=>{
      const mw=SS_PRESETS.milkyway, unkai=SS_PRESETS.unkai;
      const clearAgg={low:0,mid:0,high:0,rh:40};
      const noMoon={sunAlt:-30,moonAlt:-10,moonIllum:0,objAlt:30};
      const moonUp={sunAlt:-30,moonAlt:60,moonIllum:1,objAlt:30};
      return {
        aodClear: ssScoreParts(mw,clearAgg,noMoon,null,{aodNorm:0,unkai:null}).fTr,
        aodHazy:  ssScoreParts(mw,clearAgg,noMoon,null,{aodNorm:1,unkai:null}).fTr,
        noEnv:    ssScoreParts(mw,clearAgg,noMoon).fTr,                        // env省略=従来(湿度のみ)
        unkaiWant0:  ssScoreParts(unkai,clearAgg,moonUp,null,{aodNorm:0,unkai:0}).fUnkai,
        unkaiWant90: ssScoreParts(unkai,clearAgg,moonUp,null,{aodNorm:0,unkai:90}).fUnkai,
        unkaiAvoid:  ssScoreParts(mw,clearAgg,noMoon,null,{aodNorm:0,unkai:90}).fUnkai,   // 避ける=係数1(低層雲扱い)
      };
    });
    check('P2 透明度: AOD霞みで減点・AOD無しは従来(湿度のみ)', r.aodHazy<r.aodClear&&r.noEnv===r.aodClear, `clear=${r.aodClear} hazy=${r.aodHazy}`);
    check('P2 雲海: 狙うは雲海度で加点(0.1→0.91)・避けるは係数1', Math.abs(r.unkaiWant0-0.1)<1e-9&&Math.abs(r.unkaiWant90-0.91)<1e-9&&r.unkaiAvoid===1, `${r.unkaiWant0}/${r.unkaiWant90}`);
  }

  // P3: E2E(雲海×月夜プリセット): 雲海度/透明度列の実値+詳細の気圧面プロファイル/上空風/AOD
  {
    const r=await p.evaluate(async()=>{
      try{ indexedDB.deleteDatabase('soranotsuji-wx'); }catch(_){}
      _ssDbReady=null;
      appState.start={lat:36.00,lng:138.00,elev:1500};
      appState.end={lat:35.3606,lng:138.7274,elev:3776};
      document.getElementById('input-ss-days').value='3';
      document.getElementById('sel-ss-preset').value='unkai';
      document.getElementById('chk-ss-stat').checked=false;
      await soraSearchRun();
      const head=[...document.querySelectorAll('#sorasearch-content thead th')].map(t=>t.textContent);
      const rows=[...document.querySelectorAll('#sorasearch-content tbody tr')];
      const ui=head.indexOf('雲海度'), ti=head.indexOf('透明度');
      const row=rows[0];
      row.click();
      const detail=document.getElementById('sorasearch-detail-body').textContent;
      return { nRows:rows.length, unkaiCol:row.children[ui].textContent, trCol:row.children[ti].textContent,
               hasPl:/気圧面/.test(document.getElementById('sorasearch-detail-body').innerHTML)&&/950hPa/.test(detail),
               hasWind:/上空風\(300hPa\): 30\.0 m\/s/.test(detail), hasAod:/AOD 0\.50/.test(detail),
               calls:{...__calls} };
    });
    check('P3 雲海度列=90%・透明度列=0%(AOD0.5=霞み最大)', r.unkaiCol==='90%'&&r.trCol==='0%', `${r.unkaiCol}/${r.trCol}`);
    check('P3 詳細に気圧面プロファイル+上空風30m/s+AOD0.50', r.hasPl&&r.hasWind&&r.hasAod);
    check('P3 取得: 雲量1・AOD1・気圧面1コール(統計オフ)', r.calls.cloud===1&&r.calls.aod===1&&r.calls.pl===1&&r.calls.era5===0, JSON.stringify(r.calls));
  }

  // P4: 統計チェック: ERA5同時期±7日×10年の夜間晴天率が統計行として付く+キャッシュ
  {
    const r=await p.evaluate(async()=>{
      document.getElementById('chk-ss-stat').checked=true;
      const before={...__calls};
      await soraSearchRun();
      const after1={...__calls};
      const rows=[...document.querySelectorAll('#sorasearch-content tbody tr')];
      const last=rows[rows.length-1];
      const head=[...document.querySelectorAll('#sorasearch-content thead th')].map(t=>t.textContent);
      const ci=head.indexOf('信頼度'), si=head.indexOf('宙スコア');
      const conf=last.children[ci].textContent, rate=parseFloat(last.children[si].textContent), dateStr=last.children[0].textContent;
      const dtBefore=appState.currentDate.getTime();
      last.click();   // 統計行は日時移動しない
      const noMove=appState.currentDate.getTime()===dtBefore;
      await soraSearchRun();   // 2回目=年毎キャッシュでERA5コール0
      const after2={...__calls};
      return { conf, rate, dateStr, noMove, era5First:after1.era5-before.era5, era5Second:after2.era5-after1.era5 };
    });
    check('P4 統計行(信頼度=統計・±7日表記・晴天率50%)', r.conf==='統計'&&/±7日/.test(r.dateStr)&&Math.abs(r.rate-50)<3, `${r.conf} ${r.dateStr} ${r.rate}`);
    check('P4 ERA5=10年分10コール→2回目はキャッシュで0+統計行クリックは日時移動しない', r.era5First===10&&r.era5Second===0&&r.noMove, `1st=${r.era5First} 2nd=${r.era5Second}`);
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
