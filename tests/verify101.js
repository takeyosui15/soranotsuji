// 第19ラウンド検証: 宙検索の光害組み込み(フェーズ3前半) — 実アセット読込/参照/スコア因子/列表示
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
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html?forecast=1',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof soraSearchRun==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // L1: 実アセットの読み込みと参照(東京=明るい / 山間=暗い / 範囲外=null)
  {
    const r=await p.evaluate(async()=>{
      const ok=await ssLoadLp();
      const tokyo=ssLpSqm(35.68,139.76);        // 東京都心
      const yamanaka=ssLpSqm(36.30,137.60);     // 北アルプス山間
      const out=ssLpSqm(50.0,120.0);            // 範囲外
      return { ok, tokyo, yamanaka, out, meta:{w:_ssLpMeta.width,h:_ssLpMeta.height} };
    });
    check('L1 アセット読込(960×660)', r.ok&&r.meta.w===960&&r.meta.h===660, JSON.stringify(r.meta));
    check('L1 東京都心は明るい(SQM<19.5)・山間は暗い(SQM>20.5)・東京<山間', r.tokyo<19.5&&r.yamanaka>20.5&&r.tokyo<r.yamanaka, `tokyo=${r.tokyo&&r.tokyo.toFixed(2)} yama=${r.yamanaka&&r.yamanaka.toFixed(2)}`);
    check('L1 範囲外はnull', r.out===null);
  }

  // L2: 方向光害(扇形標本の重み付き平均)と因子の性質
  {
    const r=await p.evaluate(()=>{
      appState.start={lat:36.30,lng:137.60,elev:1500};
      appState.end={lat:35.3606,lng:138.7274,elev:3776};
      const pts=ssFanSamples(24,50);
      const dir=ssLpDirectional(pts);
      const mw=SS_PRESETS.milkyway, pearl=SS_PRESETS.pearl;
      const clearAgg={low:0,mid:0,high:0,rh:40};
      const noMoon={sunAlt:-30,moonAlt:-10,moonIllum:0,objAlt:30};
      const darkSky=ssScoreHour(mw,clearAgg,noMoon,{zen:22,dir:22});
      const citySky=ssScoreHour(mw,clearAgg,noMoon,{zen:16.5,dir:17});
      const noLp=ssScoreHour(mw,clearAgg,noMoon);                       // lp省略=従来どおり
      const pearlCity=ssScoreHour(pearl,clearAgg,{sunAlt:-30,moonAlt:60,moonIllum:1,objAlt:60},{zen:16.5,dir:17});
      return { dir, darkSky, citySky, noLp, pearlCity };
    });
    check('L2 方向光害が算出される(15〜22の範囲)', r.dir!==null&&r.dir>15&&r.dir<=22, `dir=${r.dir&&r.dir.toFixed(2)}`);
    check('L2 天の川: 暗い空=高得点・都市の空=大幅減点', r.darkSky>=90&&r.citySky<40&&r.citySky<r.darkSky, `dark=${r.darkSky} city=${r.citySky}`);
    check('L2 lp省略時は従来スコア(後方互換)', r.noLp===r.darkSky, `noLp=${r.noLp}`);
    check('L2 パール(光害重み0)は都市でも高得点', r.pearlCity>=90, `${r.pearlCity}`);
  }

  // L3: E2E(Open-Meteoモック): 列に光害(SQM)/方向光害が出る+スコアに反映
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      let fetchCalls=0;
      const t0=new Date(); t0.setHours(0,0,0,0);
      const mk=(n)=>{ const time=[],low=[],mid=[],high=[],rh=[];
        for(let i=0;i<n;i++){ const d=new Date(t0.getTime()+i*3600e3); const p2=v=>('00'+v).slice(-2);
          time.push(`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}T${p2(d.getHours())}:00`);
          low.push(0);mid.push(0);high.push(0);rh.push(40); }
        return {hourly:{time,cloud_cover_low:low,cloud_cover_mid:mid,cloud_cover_high:high,relative_humidity_2m:rh}};};
      const origFetch=window.fetch;
      window.fetch=async(url,opt)=>{
        const u=String(url);
        if(u.includes('api.open-meteo.com')){
          fetchCalls++;
          const nLoc=u.match(/latitude=([^&]*)/)[1].split(',').length;
          const body=JSON.stringify(nLoc>1?Array.from({length:nLoc},()=>mk(72)):mk(72));
          return new Response(body,{status:200,headers:{'Content-Type':'application/json'}});
        }
        return origFetch(url,opt);
      };
      try{
        try{ indexedDB.deleteDatabase('soranotsuji-wx'); }catch(_){}
        _ssDbReady=null;
        document.getElementById('input-ss-days').value='3';
        document.getElementById('sel-ss-preset').value='milkyway';
        await soraSearchRun();
        const head=[...document.querySelectorAll('#sorasearch-content thead th')].map(t=>t.textContent);
        const row=document.querySelector('#sorasearch-content tbody tr');
        const cells=row?[...row.children].map(c=>c.textContent):[];
        const lpI=head.indexOf('光害(SQM)'), dirI=head.indexOf('方向光害');
        return { headOk:lpI>=0&&dirI>=0, lpVal:cells[lpI], dirVal:cells[dirI], nCols:head.length };
      } finally { window.fetch=origFetch; }
    });
    check('L3 列に光害(SQM)/方向光害(18列)', r.headOk&&r.nCols===18, `cols=${r.nCols}`);
    check('L3 光害値が数値で表示される', /^\d+\.\d{2}$/.test(r.lpVal)&&/^\d+\.\d{2}$/.test(r.dirVal), `${r.lpVal}/${r.dirVal}`);
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
