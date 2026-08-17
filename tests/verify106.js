// 第23ラウンド検証: MyセットにMy宙検索を追加(5シート構成) — 保存/読込/旧4シートの自動昇格/セット切り替え
// ローカルハーネス(vendor+Google Drive/Sheetsのインメモリエミュレータ)。外部への実アクセスは行わない。
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
  await p.waitForFunction(()=>typeof mySetSaveToSheet==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // Y1: 5シート構成の定義とシート行(My宙検索=リストCSVと同じ22列)
  {
    const r=await p.evaluate(()=>{
      const rows=_mySetSheetRows({ myTsujiSearches:[], myObservations:[], myTargets:[], myStars:[],
        mySoraSearches:[{id:1,name:'甲',obsId:1,tgtId:2,preset:'pearl',weights:null,days:5,interval:3,fan:30,range:20,checked:false,memo:'m'}] });
      const sheet=rows['My宙検索'];
      const header=sheet[3], data=sheet[4];
      return { names:MYSET_SHEET_NAMES.join(','), nSheets:Object.keys(rows).length,
               commentFirst:String(sheet[0][0]).startsWith('#'),
               headerOk:header.length===22&&header[0]==='宙検索ID'&&header[21]==='メモ',
               dataOk:data[0]===1&&data[4]==='パール(満月)'&&data[8]==='狙う'&&data[17]===5&&data[18]===3 };
    });
    check('Y1 MYSET_SHEET_NAMES=5シート(末尾My宙検索)', r.names==='My辻検索,My観測点,My目的点,My天体,My宙検索'&&r.nSheets===5, r.names);
    check('Y1 My宙検索シート行=コメント3行+22列ヘッダ+データ(プリセットはラベル表記)', r.commentFirst&&r.headerOk&&r.dataOk);
  }

  // Y2: Sheetsエミュレータで保存: 旧4シート構成の既存スプレッドシートにMy宙検索タブが自動追加される
  const setupResult=await p.evaluate(async()=>{
    window.confirm=()=>true; window._alerts=[]; window.alert=m=>window._alerts.push(String(m));
    window.google={accounts:{oauth2:{initTokenClient:(cfg)=>({requestAccessToken:()=>cfg.callback({access_token:'fake',expires_in:3600})}),revoke:(t,cb)=>cb&&cb()}}};
    const gm={files:{},sheets:{},nextId:1,addSheetCalls:[]};
    window.__gm=gm;
    const resp=(obj)=>({ok:true,status:200,json:async()=>obj,text:async()=>JSON.stringify(obj)});
    const realFetch=window.fetch;
    window.__realFetch=realFetch;
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
    // 旧4シート構成の既存スプレッドシートを直接用意(My宙検索タブなし)
    gm.files['legacy']={id:'legacy',name:'旧セット',trashed:false,modifiedTime:'2026-07-19T10:00:00.000Z'};
    gm.sheets['legacy']={'My辻検索':[],'My観測点':[],'My目的点':[],'My天体':[]};
    addMySetRow();
    const s=appState.mySets[0]; s.offline=true; s.sheetId='legacy'; s.name='旧セット';
    // 表示中の内容にMy宙検索2件(プリセット+カスタム)を用意して保存
    appState.myObservations=[{id:1,name:'甲',lat:35.3,lng:138.6,elev:500,height:0,memo:'',checked:false}];
    appState.myTargets=[{id:1,name:'富士',lat:35.3606,lng:138.7274,elev:3776,height:0,memo:'',checked:false}];
    appState.mySoraSearches=[
      {id:1,name:'甲×富士(天の川)',obsId:1,tgtId:1,preset:'milkyway',weights:null,days:11,interval:1,fan:24,range:null,checked:false,memo:''},
      {id:2,name:'カスタム狙い',obsId:1,tgtId:1,preset:'custom',
       weights:{wL:66,wM:55,wH:44,moon:'want',wMoon:33,unkai:'want',wUnkai:22,wLp:11,wTr:10,obj:'moon',wObj:99,
                bands:{night:true,twilight:true,ghbh:false,day:false}},
       days:7,interval:3,fan:30,range:15,checked:false,memo:'覚書'}];
    renderMySoraSearches();
    appState.mySetCurrentId=s.id;   // 表示中セット=ライブ内容を保存させる
    gm.addSheetCalls=[];
    const okSave=await mySetSaveToSheet(s,{quiet:true});
    const sheet=gm.sheets['legacy']['My宙検索']||[];
    return { okSave, added:gm.addSheetCalls.slice(), nRows:sheet.length,
             header22:(sheet[3]||[]).length===22, row1:(sheet[4]||[])[1], row2Preset:(sheet[5]||[])[4], row2WL:(sheet[5]||[])[5] };
  });
  check('Y2 旧4シートへの保存でMy宙検索タブが自動追加される', setupResult.okSave&&setupResult.added.join(',')==='My宙検索', JSON.stringify(setupResult.added));
  check('Y2 保存内容: コメント3行+ヘッダ22列+2行(カスタム行は重み値)', setupResult.nRows===6&&setupResult.header22&&setupResult.row1==='甲×富士(天の川)'&&setupResult.row2Preset==='カスタム'&&String(setupResult.row2WL)==='66', `rows=${setupResult.nRows}`);

  // Y3: 読込の往復(カスタム行の重み/時間帯/範囲が復元される。シートの末尾空セル落ちにも耐える)
  {
    const r=await p.evaluate(async()=>{
      const gm=window.__gm;
      const s=appState.mySets[0];
      // シート側の行末の空セルが落ちる挙動を再現(メモ空のプリセット行を21列に切り詰め)
      gm.sheets['legacy']['My宙検索'][4]=gm.sheets['legacy']['My宙検索'][4].slice(0,21);
      appState.mySoraSearches=[];   // 端末側を空にしてから読込
      renderMySoraSearches();
      const okLoad=await mySetLoadFromSheet(s,{quiet:true});
      const list=appState.mySoraSearches;
      const t2=list.find(t=>t.id===2);
      return { okLoad, n:list.length,
               t1ok:list.some(t=>t.id===1&&t.preset==='milkyway'&&t.weights===null&&t.range===null),
               t2ok:!!t2&&t2.preset==='custom'&&t2.weights.wL===66&&t2.weights.moon==='want'&&t2.weights.bands.twilight===true&&t2.days===7&&t2.interval===3&&t2.range===15&&t2.memo==='覚書',
               rendered:document.querySelectorAll('#mysora-list .mysora-name').length===2 };
    });
    check('Y3 読込往復: 2件復元(プリセット行=weights null/カスタム行=重み・時間帯・範囲・メモ)', r.okLoad&&r.n===2&&r.t1ok&&r.t2ok, JSON.stringify({n:r.n}));
    check('Y3 読込後にMy宙検索リストが再描画される', r.rendered);
  }

  // Y4: セット切り替え: スナップショットにMy宙検索が含まれ、旧形式(My宙検索なし)の適用も安全
  {
    const r=await p.evaluate(()=>{
      const snap=snapshotMySetData();
      const hasKey='mySoraSearches' in snap && snap.mySoraSearches.length===2;
      applyMySetData({ myTsujiSearches:[], myObservations:[], myTargets:[], myStars:[] });   // 旧スナップショット形
      const emptied=appState.mySoraSearches.length===0;
      applyMySetData(snap);
      const restored=appState.mySoraSearches.length===2&&appState.mySoraSearches[1].weights.wL===66;
      window.fetch=window.__realFetch;
      localStorage.clear();
      return { hasKey, emptied, restored };
    });
    check('Y4 スナップショットにMy宙検索+旧形式適用は空+再適用で復元', r.hasKey&&r.emptied&&r.restored);
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
