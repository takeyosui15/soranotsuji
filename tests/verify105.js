// 第22ラウンド検証: 宙検索フェーズ4 — My宙検索メニュー(メニュー分割ポリシー: 宙検索=1組/My宙検索=複数組の一括)
// ローカルハーネス(vendor+Open-Meteoモック)。外部への実アクセスは行わない(route abortで遮断)。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };
(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html?forecast=1',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof runMySoraBatch==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // Open-Meteoモック(快晴・気圧面/AODは形式外→スキップさせる簡易版)
  await p.evaluate(()=>{
    window.confirm=()=>true; window.alert=()=>{};
    window.__cloudCalls=0;
    const t0=new Date(); t0.setHours(0,0,0,0);
    const __origFetch=window.fetch.bind(window);
    window.fetch=async(url,opt)=>{
      const u=typeof url==='string'?url:((url&&url.url)||String(url));
      const json=(o)=>new Response(JSON.stringify(o),{status:200,headers:{'Content-Type':'application/json'}});
      if(u.includes('air-quality-api')||u.includes('archive-api')) return json({hourly:null});
      if(u.includes('cloud_cover_1000hPa')) return json({hourly:null});
      if(u.includes('api.open-meteo.com')){
        __cloudCalls++;
        const nLoc=u.match(/latitude=([^&]*)/)[1].split(',').length;
        const time=[]; for(let i=0;i<72;i++){ const d=new Date(t0.getTime()+i*3600e3); const p2=v=>('00'+v).slice(-2);
          time.push(`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}T${p2(d.getHours())}:00`); }
        const mk=()=>({hourly:{time, cloud_cover_low:time.map(()=>0), cloud_cover_mid:time.map(()=>0),
                               cloud_cover_high:time.map(()=>0), relative_humidity_2m:time.map(()=>40)}});
        return json(nLoc>1?Array.from({length:nLoc},mk):mk());
      }
      return __origFetch(url,opt);   // 未知URL(ローカル資産/タイル)は元fetchへ(外部はroute abortで遮断)
    };
    try{ indexedDB.deleteDatabase('soranotsuji-wx'); }catch(_){}
    _ssDbReady=null;
  });

  // M1: メニューUI+宙検索取得(現在の観測点/目的点をMyリストへ自動作成して1件登録)
  {
    const r=await p.evaluate(()=>{
      const ids=['btn-mysora-toggle-all','btn-mysora-batch','btn-mysora-file','btn-mysora-get','btn-mysora-regall',
                 'mysora-error','mysora-list','btn-mysora-up','btn-mysora-down','btn-mysora-addrow','btn-mysora-delrow',
                 'btn-mysora-csv-import','btn-mysora-csv-append','btn-mysora-csv-export'];
      const missing=ids.filter(id=>!document.getElementById(id));
      appState.mySoraSearches=[]; appState.myObservations=[]; appState.myTargets=[];
      appState.start={lat:35.30,lng:138.60,elev:500}; appState.startApiElev=500; appState.startHeight=0;
      appState.end={lat:35.3606,lng:138.7274,elev:3776}; appState.endApiElev=3776; appState.endHeight=0;
      appState.ssPreset='milkyway';
      getMySoraFromSoraSearch();
      const t=appState.mySoraSearches[0];
      const rowShown=!!document.querySelector('#mysora-list .mysora-name');
      return { missing:missing.join(','), n:appState.mySoraSearches.length,
               obsCreated:appState.myObservations.length===1&&appState.myObservations[0].id===t.obsId,
               tgtCreated:appState.myTargets.length===1&&appState.myTargets[0].id===t.tgtId,
               preset:t.preset, weightsNull:t.weights===null, rowShown };
    });
    check('M1 メニュー14要素', r.missing==='', r.missing);
    check('M1 宙検索取得: My観測点/My目的点を自動作成して1件登録(プリセット行はweights=null)', r.n===1&&r.obsCreated&&r.tgtCreated&&r.preset==='milkyway'&&r.weightsNull&&r.rowShown);
  }

  // M2: リスト編集(名前変更・狙いをカスタムへ=現在のメニュー重みを取り込み)
  {
    const r=await p.evaluate(()=>{
      const fire=(el,type)=>el.dispatchEvent(new Event(type,{bubbles:true}));
      const nameEl=document.querySelector('#mysora-list .mysora-name');
      nameEl.value='富士山テスト'; fire(nameEl,'change');
      appState.ssWL=77;   // 現在のメニュー重み(カスタム取り込みの確認用)
      const selEl=document.querySelector('#mysora-list .mysora-preset');
      selEl.value='custom'; fire(selEl,'change');
      const t=appState.mySoraSearches[0];
      const daysEl=document.querySelector('#mysora-list .mysora-days');
      daysEl.value='3'; fire(daysEl,'change');
      return { name:t.name, preset:t.preset, wl:t.weights&&t.weights.wL, bands:t.weights&&t.weights.bands&&t.weights.bands.night, days:t.days };
    });
    check('M2 行編集: 名前・カスタム化(重み取り込みwL=77+時間帯)・期間3日', r.name==='富士山テスト'&&r.preset==='custom'&&r.wl===77&&r.bands===true&&r.days===3);
  }

  // M3: 一括計算(2件): 宙検索結果パネルに宙検索ID/名の2列付きで両行が出る
  {
    const r=await p.evaluate(async()=>{
      // 2件目: 別の観測点×同じ目的点(パール狙い)
      appState.myObservations.push({id:2,name:'乙観測点',lat:36.00,lng:138.00,elev:1000,height:0,memo:''});
      appState.mySoraSearches.push({id:2,name:'乙×富士(パール)',obsId:2,tgtId:appState.myTargets[0].id,
        preset:'pearl',weights:null,days:3,interval:1,fan:24,range:null,checked:false,memo:''});
      renderMySoraSearches();
      appState.mySoraSearches.forEach(t=>{ t.checked=true; });
      await runMySoraBatch(false);
      const head=[...document.querySelectorAll('#sorasearch-content thead th')].map(t=>t.textContent);
      const rows=[...document.querySelectorAll('#sorasearch-content tbody tr')];
      const idSet=new Set(rows.map(tr=>tr.children[0].textContent));
      const title=document.getElementById('sorasearch-title').textContent;
      // 行クリック: その行のスナップショット(検索時の観測点)で詳細+地図が出る
      const row2=rows.find(tr=>tr.children[0].textContent==='2');
      let detailOk=false, layerOk=false;
      if(row2){ row2.click();
        detailOk=!document.getElementById('sorasearch-detail').classList.contains('hidden');
        layerOk=glMap.getSource('ss-points')._data.features.length>0&&glMap.getSource('ss-fan')._data.features.length===1; }
      return { title, nCols:head.length, first2:head.slice(0,2).join(','), nRows:rows.length,
               bothIds:idSet.has('1')&&idSet.has('2'), detailOk, layerOk };
    });
    check('M3 一括結果: タイトル+20列(宙検索ID/宙検索名+18列)', /My宙検索一括/.test(r.title)&&r.nCols===20&&r.first2==='宙検索ID,宙検索名', `${r.nCols} ${r.first2}`);
    check('M3 両エントリの行が出る+行クリックで詳細/地図(行のスナップショット)', r.nRows>0&&r.bothIds&&r.detailOk&&r.layerOk, `rows=${r.nRows}`);
  }

  // M4: File取得(一括CSV): 51列(ID/名/メモ+観測点/目的点ID/名+18列+位置8+尺度12+条件6)
  {
    const r=await p.evaluate(async()=>{
      let blobObj=null, fname=null;
      const origCreate=URL.createObjectURL, origClick=HTMLAnchorElement.prototype.click;
      URL.createObjectURL=(blob)=>{ blobObj=blob; return 'blob:mock'; };
      HTMLAnchorElement.prototype.click=function(){ fname=this.download; };
      try{
        await runMySoraBatch(true);
        const buf=new Uint8Array(await blobObj.arrayBuffer());
        const bomOk=buf[0]===0xEF&&buf[1]===0xBB&&buf[2]===0xBF;
        const text=new TextDecoder('utf-8').decode(buf);
        const lines=text.split('\r\n').filter(l=>l);
        const header=lines[0].split(',');
        const nRows=document.querySelectorAll('#sorasearch-content tbody tr').length;
        const first=lines[1].split(',');
        return { bomOk, nCols:header.length, nLines:lines.length, nRows, fname,
                 h0:header[0], h3:header[3], firstId:first[0], obsName:first[4] };
      } finally { URL.createObjectURL=origCreate; HTMLAnchorElement.prototype.click=origClick; }
    });
    check('M4 一括CSV: BOM+51列+行数一致+ファイル名', r.bomOk&&r.nCols===51&&r.nLines===r.nRows+1&&/^soranotsuji-My宙検索結果-.*\.csv$/.test(r.fname), `cols=${r.nCols} lines=${r.nLines} rows=${r.nRows}`);
    check('M4 一括CSV: 先頭列=宙検索ID・観測点ID/名列あり', r.h0==='宙検索ID'&&r.h3==='観測点ID'&&(r.firstId==='1'||r.firstId==='2'), `${r.h0}/${r.h3}/${r.firstId}`);
  }

  // M5: リストCSVの書式(22列)と往復(カスタム行の重み・時間帯も復元)
  {
    const r=await p.evaluate(()=>{
      let blobObj=null;
      const origCreate=URL.createObjectURL, origClick=HTMLAnchorElement.prototype.click;
      URL.createObjectURL=(blob)=>{ blobObj=blob; return 'blob:mock'; };
      HTMLAnchorElement.prototype.click=function(){};
      try{ exportMySoraCsv(); } finally { URL.createObjectURL=origCreate; HTMLAnchorElement.prototype.click=origClick; }
      return blobObj.text().then(text=>{
        const lines=text.replace(/^﻿/,'').split('\r\n').filter(l=>l);
        const header=lines[0].split(',');
        const t1=parseMySoraCsvLine(lines[1].split(','), 2);   // ID:1(カスタム行)の往復
        const orig=appState.mySoraSearches.find(t=>t.id===1);
        return { nCols:header.length, ok1:!!t1&&t1.preset==='custom'&&t1.weights.wL===orig.weights.wL&&t1.weights.bands.night===orig.weights.bands.night&&t1.days===orig.days,
                 badPreset:parseMySoraCsvLine(['3','x','1','1','不明な狙い','0','0','0','避ける','0','避ける','0','0','0','天の川中心','0','夜','11','1','24','','m'], 99)===null };
      });
    });
    check('M5 リストCSV22列+カスタム行の往復(重み/時間帯/期間)+不正な狙いは拒否', r.nCols===22&&r.ok1&&r.badPreset, `cols=${r.nCols}`);
  }

  // M6: 一括選択トグル+全て登録の検証(参照切れエラー)
  {
    const r=await p.evaluate(()=>{
      document.getElementById('btn-mysora-toggle-all').click();   // 全てチェック済→全解除
      const allOff=appState.mySoraSearches.every(t=>!t.checked);
      document.getElementById('btn-mysora-toggle-all').click();   // →全チェック
      const allOn=appState.mySoraSearches.every(t=>t.checked);
      appState.mySoraSearches[1].obsId=999;   // 存在しない参照
      registerAllMySora();
      const err1=document.getElementById('mysora-error').textContent;
      appState.mySoraSearches[1].obsId=2;
      registerAllMySora();
      const err2=document.getElementById('mysora-error').textContent;
      return { allOff, allOn, hasErr:/観測点ID:999/.test(err1), cleared:err2==='' };
    });
    check('M6 一括選択トグル+全て登録の参照検証(999でエラー→修正でクリア)', r.allOff&&r.allOn&&r.hasErr&&r.cleared);
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
