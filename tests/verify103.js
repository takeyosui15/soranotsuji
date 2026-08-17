// 第21ラウンド検証: 宙検索フェーズ2(本UI。デッサン18) — メニュー拡張/専用パネル/ソート/詳細/地図扇形/CSV/URL
// ローカルハーネス(vendor+Open-Meteoモック)で実行する。外部への実アクセスは行わない(route abortで遮断)。
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
  await ctx.route('**/*', route => {   // ローカル以外への実アクセスを遮断(テスト方針: ローカル完結)
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html?forecast=1',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof soraSearchRun==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // U1: メニューUIの拡張(File取得/カスタム/重み開閉/スライダー8+ラジオ+時間帯4+統計/対象のdisabled)
  {
    const r=await p.evaluate(()=>{
      const ids=['btn-ss-file','ss-weights-header','ss-weights','input-ss-wl','input-ss-wm','input-ss-wh','input-ss-wmoon',
                 'input-ss-wunkai','input-ss-wlp','input-ss-wtr','input-ss-wobj',
                 'chk-ss-band-night','chk-ss-band-twilight','chk-ss-band-ghbh','chk-ss-band-day','chk-ss-stat'];
      const missing=ids.filter(id=>!document.getElementById(id));
      const sel=document.getElementById('sel-ss-preset');
      const hiddenInit=document.getElementById('ss-weights').classList.contains('hidden');
      document.getElementById('ss-weights-header').click();
      const openAfter=!document.getElementById('ss-weights').classList.contains('hidden');
      const arrow=document.getElementById('ss-weights-arrow').textContent;
      return { missing:missing.join(','),
        customOpt:[...sel.options].some(o=>o.value==='custom'),
        moonRadios:document.querySelectorAll('input[name="ss-moon-mode"]').length,
        unkaiRadios:document.querySelectorAll('input[name="ss-unkai-mode"]').length,
        statEnabled:!document.getElementById('chk-ss-stat').disabled,   // フェーズ3で有効化
        hiddenInit, openAfter, arrow,
        bandInit:document.getElementById('chk-ss-band-night').checked&&!document.getElementById('chk-ss-band-twilight').checked&&!document.getElementById('chk-ss-band-ghbh').checked&&!document.getElementById('chk-ss-band-day').checked };
    });
    check('U1 メニュー16要素+カスタム選択肢+ラジオ2組', r.missing===''&&r.customOpt&&r.moonRadios===2&&r.unkaiRadios===2, r.missing);
    check('U1 重みセクション: 初期閉→タップで開(▲)', r.hiddenInit&&r.openAfter&&r.arrow==='▲');
    check('U1 統計チェック有効(フェーズ3)+時間帯初期値=夜のみ', r.statEnabled&&r.bandInit);
  }

  // U2: プリセット連動(選択→スライダー反映 / スライダー変更→カスタム / 再選択で復元)
  {
    const r=await p.evaluate(()=>{
      const sel=document.getElementById('sel-ss-preset');
      const fire=(el,type)=>el.dispatchEvent(new Event(type,{bubbles:true}));
      sel.value='stars'; fire(sel,'change');
      const stars={wl:appState.ssWL,wh:appState.ssWH,wmoon:appState.ssWMoon,wobj:appState.ssWObj,
                   dom:document.getElementById('input-ss-wobj').value, val:document.getElementById('ss-wobj-val').textContent};
      const sl=document.getElementById('input-ss-wl');
      sl.value='55'; fire(sl,'input');
      const afterSlide={preset:appState.ssPreset, selVal:sel.value, wl:appState.ssWL};
      sel.value='milkyway'; fire(sel,'change');
      const mw={wl:appState.ssWL,wm:appState.ssWM,wh:appState.ssWH,wmoon:appState.ssWMoon,wlp:appState.ssWLp,wobj:appState.ssWObj,
                night:appState.ssBandNight,ghbh:appState.ssBandGhbh};
      return { stars, afterSlide, mw };
    });
    check('U2 星景プリセット反映(雲高50/月50/対象80+DOM同期)', r.stars.wl===100&&r.stars.wh===50&&r.stars.wmoon===50&&r.stars.wobj===80&&r.stars.dom==='80'&&r.stars.val==='80', JSON.stringify(r.stars));
    check('U2 スライダー変更で自動カスタム', r.afterSlide.preset==='custom'&&r.afterSlide.selVal==='custom'&&r.afterSlide.wl===55);
    check('U2 天の川へ再選択で復元(100/85/40/80/70/60+夜のみ)', r.mw.wl===100&&r.mw.wm===85&&r.mw.wh===40&&r.mw.wmoon===80&&r.mw.wlp===70&&r.mw.wobj===60&&r.mw.night&&!r.mw.ghbh);
  }

  // U3: 検索E2E(Open-Meteoモック): 専用パネルに18列表示・辻検索パネルは使わない
  const mockAndRun=async(days)=>await p.evaluate(async(days)=>{
    window.confirm=()=>true; window.alert=()=>{};
    let fetchCalls=0;
    const t0=new Date(); t0.setHours(0,0,0,0);
    const mk=(n)=>{ const time=[],low=[],mid=[],high=[],rh=[];
      for(let i=0;i<n;i++){ const d=new Date(t0.getTime()+i*3600e3); const p2=v=>('00'+v).slice(-2);
        time.push(`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}T${p2(d.getHours())}:00`);
        const cloudy=(d.getDate()%2===0);   // 偶数日=曇り/奇数日=快晴
        low.push(cloudy?90:0); mid.push(cloudy?80:0); high.push(cloudy?50:10); rh.push(cloudy?95:45); }
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
      appState.start={lat:35.30,lng:138.60,elev:500};
      appState.end={lat:35.3606,lng:138.7274,elev:3776};
      document.getElementById('input-ss-days').value=String(days);
      document.getElementById('sel-ss-preset').value='milkyway';
      await soraSearchRun();
      return { fetchCalls };
    } finally { window.fetch=origFetch; }
  }, days);
  {
    await mockAndRun(3);
    const r=await p.evaluate(()=>{
      const head=[...document.querySelectorAll('#sorasearch-content thead th')].map(t=>t.textContent);
      const rows=[...document.querySelectorAll('#sorasearch-content tbody tr')];
      return {
        panelShown:!document.getElementById('sorasearch-panel').classList.contains('hidden')&&appState.isSoraSearchActive===true,
        tsujiHidden:document.getElementById('tsujisearch-panel').classList.contains('hidden'),
        title:document.getElementById('sorasearch-title').textContent,
        headJoin:head.join(','), nRows:rows.length,
        bandCol:rows.length?rows[0].children[3].textContent:'',
        detailHidden:document.getElementById('sorasearch-detail').classList.contains('hidden'),
        status:document.getElementById('ss-status').textContent };
    });
    const HEAD='日付,曜日,時刻,時間帯,宙スコア,晴天度,雲低,雲中,雲高,雲海度,透明度,月齢,月輝面比,月高度,光害(SQM),方向光害,対象高度,信頼度';
    check('U3 専用パネルに表示(辻検索パネルは不使用)', r.panelShown&&r.tsujiHidden&&/宙検索結果 \(天の川\)/.test(r.title), r.title);
    check('U3 結果リスト18列(デッサン18の列構成)', r.headJoin===HEAD, r.headJoin);
    check('U3 行あり+時間帯列=夜+詳細は未表示+件数ステータス', r.nRows>0&&r.bandCol==='夜'&&r.detailHidden&&/件/.test(r.status), `rows=${r.nRows} band=${r.bandCol}`);
  }

  // U4: 全列ソート(宙スコア列: 1回目昇順→2回目降順)
  {
    const r=await p.evaluate(()=>{
      const ths=[...document.querySelectorAll('#sorasearch-content thead th')];
      const si=ths.findIndex(t=>t.textContent.startsWith('宙スコア'));
      const score1st=()=>parseFloat(document.querySelector('#sorasearch-content tbody tr').children[si].textContent);
      const all=()=>[...document.querySelectorAll('#sorasearch-content tbody tr')].map(tr=>parseFloat(tr.children[si].textContent));
      const before=all();
      ths[si].click();
      const asc=score1st(), ascArrow=ths[si].textContent;
      ths[si].click();
      const desc=score1st(), descArrow=ths[si].textContent;
      return { min:Math.min(...before), max:Math.max(...before), asc, desc, ascArrow, descArrow };
    });
    check('U4 宙スコア列ソート(昇順▲→降順▼)', r.asc===r.min&&r.desc===r.max&&r.ascArrow.includes('▲')&&r.descArrow.includes('▼'), `asc=${r.asc} desc=${r.desc}`);
  }

  // U5: 行クリック(日時移動+選択ハイライト+詳細リスト+地図オーバーレイ)
  {
    const r=await p.evaluate(()=>{
      const row=document.querySelector('#sorasearch-content tbody tr');
      const dateText=row.children[0].textContent, timeText=row.children[2].textContent;
      row.click();
      const d=appState.currentDate;
      const p2=v=>('00'+v).slice(-2);
      const moved=`${d.getFullYear()}/${p2(d.getMonth()+1)}/${p2(d.getDate())}`===dateText&&`${p2(d.getHours())}:00`===timeText;
      const detail=document.getElementById('sorasearch-detail');
      const bodyTables=document.querySelectorAll('#sorasearch-detail-body table');
      const factorRows=bodyTables[0]?bodyTables[0].querySelectorAll('tbody tr').length:0;
      const sampleRows=bodyTables[1]?bodyTables[1].querySelectorAll('tbody tr').length:0;
      const fanFeats=glMap.getSource('ss-fan')._data.features;
      const ptFeats=glMap.getSource('ss-points')._data.features;
      return { moved,
        selected:row.classList.contains('selected'),
        detailShown:!detail.classList.contains('hidden')&&document.getElementById('sorasearch-panel').classList.contains('with-detail'),
        header:document.getElementById('sorasearch-detail-header').textContent,
        factorRows, sampleRows, nPoints:_ssLast.points.length,
        nLayers:fanFeats.length+ptFeats.length,
        hasFanPolygon:fanFeats.length===1&&fanFeats[0].geometry.type==='Polygon' };
    });
    check('U5 行クリックで日時移動+選択ハイライト', r.moved&&r.selected);
    check('U5 詳細リスト(因子7行+標本行=格子数+ヘッダに宙スコア)', r.detailShown&&r.factorRows===7&&r.sampleRows===r.nPoints&&/宙スコア/.test(r.header), `factor=${r.factorRows} sample=${r.sampleRows}/${r.nPoints}`);
    check('U5 地図オーバーレイ(扇形1+標本点N)', r.hasFanPolygon&&r.nLayers===1+r.nPoints, `layers=${r.nLayers} points=${r.nPoints}`);
  }

  // U6: 標本点の色(快晴日=白 / 曇天日=灰色)
  {
    const r=await p.evaluate(()=>{
      const rows=[...document.querySelectorAll('#sorasearch-content tbody tr')];
      const pick=(parity)=>rows.find(tr=>parseInt(tr.children[0].textContent.split('/')[2])%2===parity);
      const fills=()=>glMap.getSource('ss-points')._data.features.map(f=>f.properties.fill);
      const clearRow=pick(1), cloudyRow=pick(0);
      let clearFills=[], cloudyFills=[];
      if(clearRow){ clearRow.click(); clearFills=fills(); }
      if(cloudyRow){ cloudyRow.click(); cloudyFills=fills(); }
      // モックの快晴日は雲高10%なので cov=0.1 → g=235(ほぼ白)。曇天日は cov≒0.99 → g≒57(濃灰)
      const g=f=>{const m=/rgb\((\d+),/.exec(f);return m?parseInt(m[1]):-1;};
      return { clearOk:clearFills.length>0&&clearFills.every(f=>g(f)>=230),
               cloudyOk:cloudyFills.length>0&&cloudyFills.every(f=>g(f)<200),
               sample:`${clearFills[0]} / ${cloudyFills[0]}` };
    });
    check('U6 標本点の色: 快晴=ほぼ白・曇天=濃灰', r.clearOk&&r.cloudyOk, r.sample);
  }

  // U7: 排他(辻検索パネルを開く→宙検索が閉じる→再検索で戻る)
  {
    const r=await p.evaluate(async()=>{
      showTsujiPanelForMyTsuji('テスト');
      const afterTsuji={ ss:appState.isSoraSearchActive, ssHidden:document.getElementById('sorasearch-panel').classList.contains('hidden'),
                         layerCleared:glMap.getSource('ss-points')._data.features.length===0&&glMap.getSource('ss-fan')._data.features.length===0,
                         tsuji:appState.isTsujiSearchActive };
      // 再度宙検索(キャッシュヒットでモック不要)
      await soraSearchRun();
      const afterSora={ ss:appState.isSoraSearchActive, tsuji:appState.isTsujiSearchActive,
                        tsujiHidden:document.getElementById('tsujisearch-panel').classList.contains('hidden') };
      return { afterTsuji, afterSora };
    });
    check('U7 辻検索を開くと宙検索パネルが閉じ地図オーバーレイも消える', r.afterTsuji.tsuji&&!r.afterTsuji.ss&&r.afterTsuji.ssHidden&&r.afterTsuji.layerCleared);
    check('U7 宙検索を再実行すると辻検索が閉じて宙検索に戻る', r.afterSora.ss&&!r.afterSora.tsuji&&r.afterSora.tsujiHidden);
  }

  // U8: File取得CSV(18列+位置情報8+評価尺度12+検索条件6=44列・BOM・行数=リスト件数)
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      let blobText=null, fname=null;
      const origCreate=URL.createObjectURL, origClick=HTMLAnchorElement.prototype.click;
      URL.createObjectURL=(blob)=>{ blobText=blob; return 'blob:mock'; };
      HTMLAnchorElement.prototype.click=function(){ fname=this.download; };
      try{
        await fileSoraSearchCsv();
        // Blob.text()はUTF-8デコードでBOMを剥がすため、実バイト(EF BB BF)で判定する
        const buf=new Uint8Array(await blobText.arrayBuffer());
        const bomOk=buf[0]===0xEF&&buf[1]===0xBB&&buf[2]===0xBF;
        const text=new TextDecoder('utf-8').decode(buf);
        const lines=text.split('\r\n').filter(l=>l);
        const nRows=document.querySelectorAll('#sorasearch-content tbody tr').length;
        const header=(text.charCodeAt(0)===0xFEFF?lines[0].slice(1):lines[0]).split(',');
        const first=lines[1]?lines[1].split(','):[];
        return { bom:bomOk, nCols:header.length, nLines:lines.length, nRows,
                 fname, presetCol:first[header.indexOf('狙い')], wlCol:first[header.indexOf('雲低重み')],
                 gridCol:first[header.indexOf('標本格子数')], lastHead:header[header.length-1] };
      } finally { URL.createObjectURL=origCreate; HTMLAnchorElement.prototype.click=origClick; }
    });
    check('U8 CSV: BOM+44列+行数=リスト件数+ファイル名', r.bom&&r.nCols===44&&r.nLines===r.nRows+1&&/^soranotsuji-宙検索結果-.*\.csv$/.test(r.fname), `cols=${r.nCols} lines=${r.nLines} rows=${r.nRows}`);
    check('U8 CSV: 評価尺度と検索条件が入る(天の川/雲低100/格子数)', r.presetCol==='天の川'&&r.wlCol==='100'&&parseInt(r.gridCol)>0&&r.lastHead==='標本格子数', `${r.presetCol}/${r.wlCol}/${r.gridCol}`);
  }

  // U9: URL記憶(パラメータ付与+短縮URL v10往復)
  {
    const r=await p.evaluate(()=>{
      appState.ssPreset='custom'; appState.ssWL=77; appState.ssRange=45;
      const qs=buildCommonUrlParams(false).toString();
      const enc=encodeQueryParam(qs);
      const dec=decodeQueryParam(enc);
      const vm=/^~(\d+)~/.exec(enc);
      return { hasKeys:['ssPreset=custom','ssWL=77','ssRange=45','ssBandNight=','ssFan=','ssDays='].every(k=>qs.includes(k)),
               v10:!!vm&&parseInt(vm[1])>=10,   // v10以降(新機能で辞書版が増えても宙検索URLは読める)
               roundtrip:dec===qs };
    });
    check('U9 URLに宙検索の全項目+短縮URL辞書v10以降の往復', r.hasKeys&&r.v10&&r.roundtrip);
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
