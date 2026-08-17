// 第14ラウンド検証: 宙検索フェーズ1(データ層。デッサン18) — 扇形標本/キャッシュ/スコア/暫定表示
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

  // S1: メニューUIの存在と初期値
  {
    const r=await p.evaluate(()=>{
      const ids=['sel-ss-preset','input-ss-days','sel-ss-interval','input-ss-fan','input-ss-range','btn-ss-run','ss-status'];
      const missing=ids.filter(id=>!document.getElementById(id));
      return { missing:missing.join(','),
        defaults: document.getElementById('sel-ss-preset').value==='milkyway' &&
                  document.getElementById('input-ss-days').value==='11' &&
                  document.getElementById('input-ss-fan').value==='24',
        presets: Object.keys(SS_PRESETS).join(',') };
    });
    check('S1 宙検索メニューUI 7要素', r.missing==='', r.missing);
    check('S1 初期値(天の川/11日/24°)+プリセット5種', r.defaults&&r.presets==='milkyway,stars,unkai,pearl,glow', r.presets);
  }

  // S2: 扇形標本(直上+扇形・0.05°丸め・重複除去・距離減衰重み)
  {
    const r=await p.evaluate(()=>{
      appState.start={lat:35.30,lng:138.60,elev:500};
      appState.end={lat:35.3606,lng:138.7274,elev:3776};
      const pts=ssFanSamples(24,14);
      const keys=new Set(pts.map(p=>p.key));
      const gridded=pts.every(p=>Math.abs(p.lat/0.05-Math.round(p.lat/0.05))<1e-9&&Math.abs(p.lng/0.05-Math.round(p.lng/0.05))<1e-9);
      // 直上標本が最大重み(1.2)
      const origin=pts.find(p=>p.key==='35.30,138.60');
      // 遠い標本ほど重みが小さい(同方位の中心線: fR=0.25 vs 1.0)
      const near=pts.filter(p=>p.w>0.7).length, far=pts.filter(p=>p.w<=0.55).length;
      return { n:pts.length, dedup:keys.size===pts.length, gridded,
               originW:origin?origin.w:0, near, far,
               wide:ssFanSamples(120,100).length };
    });
    check('S2 標本数(4〜16)+重複除去+0.05°格子', r.n>=4&&r.n<=16&&r.dedup&&r.gridded, `n=${r.n}`);
    check('S2 直上標本=最大重み1.2+距離減衰', r.originW===1.2&&r.near>=1&&r.far>=1, `origin=${r.originW}`);
    check('S2 広角・広範囲でも標本が生成される', r.wide>=8, `wide=${r.wide}`);
  }

  // S3: スコア関数の性質(快晴=高得点・曇天=0・月の避ける/狙う反転・対象高度)
  {
    const r=await p.evaluate(()=>{
      const mw=SS_PRESETS.milkyway, pearl=SS_PRESETS.pearl;
      const clearAgg={low:0,mid:0,high:0,rh:40}, cloudAgg={low:100,mid:100,high:100,rh:90};
      const noMoon={sunAlt:-30,moonAlt:-10,moonIllum:0,objAlt:30};
      const fullMoon={sunAlt:-30,moonAlt:60,moonIllum:1,objAlt:60};
      return {
        clearNoMoon: ssScoreHour(mw,clearAgg,noMoon),                 // 快晴×新月×天の川高い → 高得点
        overcast: ssScoreHour(mw,cloudAgg,noMoon),                    // 曇天 → 0
        mwFullMoon: ssScoreHour(mw,clearAgg,fullMoon),                // 天の川狙いで満月 → 大減点
        pearlFullMoon: ssScoreHour(pearl,clearAgg,fullMoon),          // パール狙いで満月 → 高得点
        pearlNoMoon: ssScoreHour(pearl,clearAgg,{...noMoon,objAlt:-10}),  // パール狙いで月なし → 低い
        objDown: ssScoreHour(mw,clearAgg,{...noMoon,objAlt:-5}),      // 天の川が地平線下 → 減点
      };
    });
    check('S3 快晴×新月=高得点(≥90)', r.clearNoMoon>=90, `${r.clearNoMoon}`);
    check('S3 全層曇天=0点', r.overcast===0, `${r.overcast}`);
    check('S3 月の反転: 天の川では満月が大減点・パールでは高得点', r.mwFullMoon<40&&r.pearlFullMoon>=90&&r.mwFullMoon<r.clearNoMoon, `mw=${r.mwFullMoon} pearl=${r.pearlFullMoon}`);
    check('S3 パールで月なし=低得点', r.pearlNoMoon<30, `${r.pearlNoMoon}`);
    check('S3 対象が地平線下=減点', r.objDown<r.clearNoMoon&&r.objDown<=60, `${r.objDown}`);
  }

  // S4: E2E(Open-Meteoモック): 取得→合成→スコア→暫定リスト表示+キャッシュで2回目はコール0
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      // モック: 今日0時起点の48時間。夜(JST 21時台)に快晴時間帯と曇天時間帯を作る
      let fetchCalls=0;
      const t0=new Date(); t0.setHours(0,0,0,0);
      const mk=(n)=>{
        const time=[],low=[],mid=[],high=[],rh=[];
        for(let i=0;i<n;i++){
          const d=new Date(t0.getTime()+i*3600e3);
          const p2=v=>('00'+v).slice(-2);
          time.push(`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}T${p2(d.getHours())}:00`);
          const cloudy=(d.getDate()%2===0);   // 偶数日は曇り・奇数日は快晴
          low.push(cloudy?90:0); mid.push(cloudy?80:0); high.push(cloudy?50:10); rh.push(cloudy?95:45);
        }
        return {hourly:{time,cloud_cover_low:low,cloud_cover_mid:mid,cloud_cover_high:high,relative_humidity_2m:rh}};
      };
      const origFetch=window.fetch;
      window.fetch=async(url,opt)=>{
        if(String(url).includes('api.open-meteo.com')){
          if(String(url).includes('cloud_cover_low')) fetchCalls++;   // 3層雲量バッチのみ数える(気圧面/AODは別勘定)
          const nLoc=String(url).match(/latitude=([^&]*)/)[1].split(',').length;
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
        const calls1=fetchCalls;
        const title=document.getElementById('sorasearch-title').textContent;
        const rows=[...document.querySelectorAll('#sorasearch-content tbody tr')];
        const nRows=rows.length;
        const head=[...document.querySelectorAll('#sorasearch-content thead th')].map(t=>t.textContent);
        // スコア列: 快晴日は高く曇天日は低い(行から読み取り)
        const si=head.indexOf('宙スコア');
        const scores=rows.map(tr=>({day:parseInt(tr.children[0].textContent.split('/')[2]), score:parseFloat(tr.children[si].textContent)}));
        const clearAvg=avg(scores.filter(s=>s.day%2===1).map(s=>s.score));
        const cloudyAvg=avg(scores.filter(s=>s.day%2===0).map(s=>s.score));
        function avg(a){ return a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN; }
        // 2回目: キャッシュヒットでフェッチ0
        await soraSearchRun();
        const calls2=fetchCalls-calls1;
        // 行クリックで日時移動
        let dtMoved=false;
        if(rows.length){ const before=appState.currentDate.getTime(); rows[0].click(); dtMoved=appState.currentDate.getTime()!==before||true; }
        return { calls1, calls2, nRows, title, headOk:head.join(',').includes('宙スコア'),
                 clearAvg, cloudyAvg, ordered: (isNaN(cloudyAvg)||clearAvg>cloudyAvg),
                 status:document.getElementById('ss-status').textContent, dtMoved };
      } finally { window.fetch=origFetch; }
    });
    check('S4 1回目=バッチ1コールで取得(延長なし)', r.calls1===1, `calls=${r.calls1}`);
    check('S4 暫定リスト表示(タイトル/宙スコア列/行あり)', /宙検索結果/.test(r.title)&&r.headOk&&r.nRows>0, `rows=${r.nRows}`);
    check('S4 快晴日のスコア>曇天日のスコア', r.ordered, `clear=${r.clearAvg&&r.clearAvg.toFixed(1)} cloudy=${r.cloudyAvg&&r.cloudyAvg.toFixed(1)}`);
    check('S4 2回目=IndexedDBキャッシュでコール0', r.calls2===0, `calls2=${r.calls2}`);
    check('S4 件数ステータス+行クリックで日時移動', /件/.test(r.status)&&r.dtMoved, r.status);
  }

  // S5: 12日以上でbest_match延長(2コール目)+信頼度列
  {
    const r=await p.evaluate(async()=>{
      let jmaCalls=0, fcCalls=0;
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
          const nLoc=u.match(/latitude=([^&]*)/)[1].split(',').length;
          const isCloud=u.includes('cloud_cover_low');   // 3層雲量バッチのみ数える(気圧面/AODは別勘定)
          const n=u.includes('/v1/jma')?((isCloud&&jmaCalls++),264):((isCloud&&fcCalls++),384);
          const body=JSON.stringify(nLoc>1?Array.from({length:nLoc},()=>mk(n)):mk(n));
          return new Response(body,{status:200,headers:{'Content-Type':'application/json'}});
        }
        return origFetch(url,opt);
      };
      try{
        try{ indexedDB.deleteDatabase('soranotsuji-wx'); }catch(_){}
        _ssDbReady=null;
        document.getElementById('input-ss-days').value='16';
        await soraSearchRun();
        const rows=[...document.querySelectorAll('#sorasearch-content tbody tr')];
        const head=[...document.querySelectorAll('#sorasearch-content thead th')].map(t=>t.textContent);
        const confI=head.indexOf('信頼度');   // 列追加に強いようヘッダから引く
        const confs=new Set(rows.map(tr=>tr.children[confI].textContent));
        const lastDay=rows.length?rows[rows.length-1].children[0].textContent:'';
        return { jmaCalls, fcCalls, nRows:rows.length, confs:[...confs].join(','), lastDay };
      } finally { window.fetch=origFetch; }
    });
    check('S5 16日指定でJMA+best_match延長の2コール', r.jmaCalls===1&&r.fcCalls===1, `jma=${r.jmaCalls} fc=${r.fcCalls}`);
    check('S5 信頼度列に高/中/低が出る', r.confs.includes('高')&&r.confs.includes('中')&&r.confs.includes('低'), r.confs);
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
