const { chromium } = require('playwright-core');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(name,ok,detail)=>{ console.log(`${ok?'PASS':'FAIL'} ${name}${detail?'  '+detail:''}`); ok?PASS++:FAIL++; };

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof toggleSoramado==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // T1: 基本(焦点距離24・File取得ボタン存在・輝面比のソース確認)
  {
    const r=await p.evaluate(()=>({
      focal: appState.soraFocal,
      btnT: !!document.getElementById('btn-tsuji-file'),
      btnM: !!document.getElementById('btn-tsujimesh-file'),
      csvHeader: downloadTsujiResultCsv.toString().includes("'月輝面比'"),
      detailHeader: _tmUpdateDetailList.toString().includes('月輝面比') && _tmUpdateDetailList.toString().includes('検索中心方位角差'),
      markSpec: _tmUpdateDetailList.toString().includes("'⭐︎'"),
    }));
    check('T1 focal default 24', r.focal===24, `focal=${r.focal}`);
    check('T1 File取得 buttons exist (辻検索/メッシュ)', r.btnT && r.btnM);
    check('T1 CSV header has 月輝面比', r.csvHeader);
    check('T1 detail list has new columns + ⭐︎ mark', r.detailHeader && r.markSpec);
  }

  // T2: 辻検索File取得のE2E(2日検索・CSV内容の検証)
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window._alerts=[]; window.alert=m=>window._alerts.push(String(m));
      // ダウンロードを捕捉
      let captured=null;
      const realCreate=URL.createObjectURL.bind(URL);
      URL.createObjectURL=(blob)=>{ captured=blob; return realCreate(blob); };
      appState.start={lat:36.2919,lng:137.7811,elev:1500};
      appState.startApiElev=1500; appState.startHeight=0;
      appState.end={lat:36.342,lng:137.647,elev:3180};
      appState.endApiElev=3180; appState.endHeight=0;
      appState.tsujiSearchBaseAz=290; appState.tsujiSearchBaseAlt=5;
      appState.tsujiSearchOffsetAz=0; appState.tsujiSearchOffsetAlt=0;
      appState.tsujiSearchToleranceAz=180; appState.tsujiSearchToleranceAlt=90;   // 必ずヒットする広さ
      appState.tsujiSearchDays=2;
      appState.tsujiMoonFilterEnabled=false; appState.tsujiAccuracyFilterEnabled=false;
      appState.tsujiElevationOption=false; appState.tsujiTimeFilter=false;
      appState.bodies.forEach(b=>b.visible=(b.id==='Moon'));
      await fileTsujiSearchCsv();
      URL.createObjectURL=realCreate;
      if(!captured) return {ok:false, alerts:window._alerts};
      const text=await captured.text();
      const lines=text.split('\r\n').filter(Boolean);
      const header=lines[0].split(',');
      const row=lines[1]?lines[1].split(','):[];
      const iIllum=header.indexOf('月輝面比');
      const iObsLat=header.indexOf('観測点緯度');
      const iTsujiId=header.indexOf('﻿辻検索ID')>=0?header.indexOf('﻿辻検索ID'):0;
      return { ok:true, rows:lines.length-1, headerLen:header.length, rowLen:row.length,
        illum:row[iIllum], obsLat:row[iObsLat], tsujiIdBlank:row[iTsujiId]==='',
        status:document.getElementById('tsujisearch-status').textContent };
    });
    check('T2 辻検索File取得 produces CSV rows', r.ok && r.rows>=1, r.ok?`rows=${r.rows}`:JSON.stringify(r.alerts));
    if(r.ok){
      check('T2 header/row column counts match', r.headerLen===r.rowLen && r.headerLen===66, `h=${r.headerLen} r=${r.rowLen}`);   // 第58ラウンド: 検索中心列で65→66
      check('T2 輝面比は%表記・辻検索IDは空白', /^\d+\.\d%$/.test(r.illum||'') && r.tsujiIdBlank, `illum=${r.illum}`);
      check('T2 観測点緯度=現在の観測点', (r.obsLat||'').startsWith('36.2919'), `lat=${r.obsLat}`);
    }
  }

  // T3: Myセットの4シート存在確認(欠けたタブの自動作成)
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window._alerts=[]; window.alert=m=>window._alerts.push(String(m));
      window.google={accounts:{oauth2:{initTokenClient:(cfg)=>({requestAccessToken:()=>cfg.callback({access_token:'fake',expires_in:3600})}),revoke:(t,cb)=>cb&&cb()}}};
      const gm={files:{},sheets:{},nextId:1,addSheetCalls:[]};
      const resp=(obj)=>({ok:true,status:200,json:async()=>obj,text:async()=>JSON.stringify(obj)});
      const realFetch=window.fetch;
      window.fetch=async(url,opt={})=>{
        const u=String(url);
        if(u.startsWith('https://www.googleapis.com/drive/v3/')){
          const path=u.slice('https://www.googleapis.com/drive/v3/'.length);
          if(path.startsWith('files?q=')) return resp({files:[]});
          if(path.startsWith('files?fields=id')){ const body=JSON.parse(opt.body); const id='gf'+gm.nextId++;
            gm.files[id]={id,name:body.name,trashed:false,modifiedTime:'2026-07-19T10:00:00.000Z'};
            if(body.mimeType==='application/vnd.google-apps.spreadsheet') gm.sheets[id]={'シート1':[]};
            return resp({id}); }
          const m=path.match(/^files\/([^?]+)\?/);
          if(m){ const f=gm.files[m[1]];
            if(!f) return {ok:false,status:404,json:async()=>({}),text:async()=>''};
            if((opt.method||'GET')==='PATCH'){ Object.assign(f,JSON.parse(opt.body)); }
            return resp(f); }
          return resp({});
        }
        if(u.startsWith('https://sheets.googleapis.com/v4/')){
          const path=u.slice('https://sheets.googleapis.com/v4/'.length);
          let m=path.match(/^spreadsheets\/([^/:?]+)\?fields=sheets/);
          if(m){ const st=gm.sheets[m[1]]||{};
            return resp({sheets:Object.keys(st).map(n=>({properties:{title:n}}))}); }
          m=path.match(/^spreadsheets\/([^/:?]+):batchUpdate/);
          if(m){ const body=JSON.parse(opt.body); const st=gm.sheets[m[1]]||(gm.sheets[m[1]]={});
            for(const rq of body.requests||[]){
              if(rq.updateSheetProperties){ const old=Object.keys(st)[0]; if(old!==undefined){ st[rq.updateSheetProperties.properties.title]=st[old]||[]; delete st[old]; } else st[rq.updateSheetProperties.properties.title]=[]; }
              if(rq.addSheet){ st[rq.addSheet.properties.title]=[]; gm.addSheetCalls.push(rq.addSheet.properties.title); }
            }
            return resp({}); }
          m=path.match(/^spreadsheets\/([^/]+)\/values:batchClear/);
          if(m){ const body=JSON.parse(opt.body); const st=gm.sheets[m[1]]||{};
            for(let rg of body.ranges||[]){ rg=rg.replace(/'/g,''); if(st[rg]) st[rg]=[]; }
            return resp({}); }
          m=path.match(/^spreadsheets\/([^/]+)\/values:batchUpdate/);
          if(m){ const body=JSON.parse(opt.body); const st=gm.sheets[m[1]]||(gm.sheets[m[1]]={});
            for(const d of body.data||[]){ const name=d.range.split('!')[0].replace(/'/g,''); st[name]=JSON.parse(JSON.stringify(d.values)); }
            return resp({}); }
          m=path.match(/^spreadsheets\/([^/]+)\/values:batchGet\?(.*)$/);
          if(m){ const st=gm.sheets[m[1]]||{};
            const names=[...m[2].matchAll(/ranges=([^&]+)/g)].map(x=>decodeURIComponent(x[1]).replace(/'/g,''));
            return resp({valueRanges:names.map(n=>({values:JSON.parse(JSON.stringify(st[n]||[]))}))}); }
          return resp({});
        }
        return realFetch(url,opt);
      };
      await googleLogin();
      await new Promise(r=>setTimeout(r,150));
      addMySetRow();
      const s=appState.mySets[0]; s.offline=true;
      const ok1=await mySetSaveToSheet(s,{quiet:true});
      // タブを2つ削除して読込 → 自動作成+初期状態
      delete gm.sheets[s.sheetId]['My観測点'];
      delete gm.sheets[s.sheetId]['My天体'];
      gm.addSheetCalls=[];
      const okLoad=await mySetLoadFromSheet(s,{quiet:true});
      const recreated=gm.addSheetCalls.slice();
      const obsSheet=gm.sheets[s.sheetId]['My観測点']||[];
      const initOk=obsSheet.length>=4 && String(obsSheet[0][0]).startsWith('#') && obsSheet[3][0]==='観測点ID';
      // タブを1つ削除して保存 → 自動作成+保存成功
      delete gm.sheets[s.sheetId]['My目的点'];
      gm.addSheetCalls=[];
      const okSave2=await mySetSaveToSheet(s,{quiet:true});
      const saveRecreated=gm.addSheetCalls.slice();
      window.fetch=realFetch;
      return { ok1, okLoad, recreated, initOk, okSave2, saveRecreated,
        loadedCounts:{obs:(s.data&&s.data.myObservations||[]).length} };
    });
    check('T3 load recreates missing tabs with initial state', r.okLoad && r.recreated.sort().join(',')==='My天体,My観測点' && r.initOk, JSON.stringify(r.recreated));
    check('T3 save recreates missing tab and succeeds', r.okSave2 && r.saveRecreated.join(',')==='My目的点');
    await p.evaluate(()=>localStorage.clear());
  }

  check('pageerrors none', errs.length===0, JSON.stringify(errs.slice(0,3)));
  await b.close();
  console.log(`\n==== TOTAL: PASS=${PASS} FAIL=${FAIL} ====`);
  process.exit(FAIL?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
