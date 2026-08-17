// 第27ラウンド検証: 本体地図のMapLibre移行R3(機能群3=辻ライン/方位線)
// (手順4のLeaflet撤去後に保守: 旧フラグは無視され常にMapLibre)
// ローカルハーネス(vendor)。外部への実アクセスは行わない(route abort)。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };
(async()=>{
  // 版数ピンは最新のverify(現在は112)のみに置く(テスト方針)。ここでは存在だけ確認する
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    check('Q0 APP_VERSIONが定義されている', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
  }
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html?maplibre=1',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null&&glMap.isStyleLoaded&&glMap.isStyleLoaded(),{timeout:10000});
  await p.waitForTimeout(600);

  // Q1: 方位線 — 表示天体(既定: 太陽/月)の分がdir-linesソースに入り、始点=観測点
  {
    const r=await p.evaluate(()=>{
      updateAll();
      const src=glMap.getSource('dir-lines');
      const feats=src?src._data.features:[];
      const visCnt=appState.bodies.filter(b2=>b2.visible).length;
      const start0=feats.length?feats[0].geometry.coordinates[0]:null;
      return { n: feats.length, visCnt,
               colors: [...new Set(feats.map(f=>f.properties.color))].length,
               opOk: feats.every(f=>f.properties.opacity===0.3||f.properties.opacity===1.0),
               startOk: start0&&Math.abs(start0[1]-appState.start.lat)<1e-9&&Math.abs(start0[0]-appState.start.lng)<1e-9,
               lyr: !!glMap.getLayer('dir-solid')&&!!glMap.getLayer('dir-dashed') };
    });
    check('Q1 方位線: 表示天体数と一致・始点=観測点・不透明度{0.3,1.0}', r.n===r.visCnt&&r.n>=2&&r.startOk&&r.opOk&&r.lyr,
      JSON.stringify({n:r.n,visCnt:r.visCnt,colors:r.colors}));
  }

  // Q2: 辻ライン — 月のみ表示にして実行し、dash種別5種+時刻マーカーを確認
  {
    const r=await p.evaluate(async()=>{
      appState.bodies.forEach(b2=>{ b2.visible=(b2.id==='Moon'); });
      appState.isDPActive=true;
      await updateDPLines();
      await new Promise(res=>setTimeout(res,300));
      const src=glMap.getSource('dp-lines');
      const feats=src?src._data.features:[];
      const dashes=[...new Set(feats.map(f=>f.properties.dash))].sort();
      const timeFeats=glMap.getSource('dp-times')._data.features;
      const times=timeFeats.length;
      // 時刻ラベルは第36ラウンドでDOMマーカー→symbolレイヤ(labelプロパティ)へ
      const labels=timeFeats.filter(f=>/^\d{1,2}:\d{2}$/.test(f.properties.label||'')).length;
      const moonColor=appState.bodies.find(b2=>b2.id==='Moon').color;
      return { nf: feats.length, dashes: dashes.join(','), times, labels,
               lblLayer: !!glMap.getLayer('dp-time-labels'),
               colorOk: feats.every(f=>f.properties.color===moonColor),
               lyrs: ['solid','dot','dash','dashdot','dashdotdot'].every(k=>!!glMap.getLayer('dp-'+k)) };
    });
    check('Q2 辻ライン: dash5種(実線/点線/破線/一点鎖線/二点鎖線)+月色', /dash,dashdot,dashdotdot,dot,solid/.test(r.dashes)&&r.colorOk&&r.lyrs,
      `dashes=${r.dashes} nf=${r.nf}`);
    check('Q2 時刻マーカー: 5分毎の点全てにHH:MMラベル(symbolレイヤ)', r.times>0&&r.labels===r.times&&r.lblLayer, `times=${r.times} labels=${r.labels}`);
  }

  // Q3: 辻ラインOFFで消える(updateAllのelse経路)
  {
    const r=await p.evaluate(async()=>{
      appState.isDPActive=false;
      updateAll();
      await new Promise(res=>setTimeout(res,200));
      return { nf: glMap.getSource('dp-lines')._data.features.length,
               nt: glMap.getSource('dp-times')._data.features.length };
    });
    check('Q3 辻ラインOFFで線/時刻点(=ラベル)が全て消える', r.nf===0&&r.nt===0, JSON.stringify(r));
  }

  // Q4: 辻ライン365 — GL描画経路(1日=1 MultiLineString[第31Rでクラッシュ対策の増分更新化]・
  //     セグメント分割・逐次表示・表示切替・全消去)
  {
    const r=await p.evaluate(async()=>{
      const gd=async()=>{ const s=glMap.getSource('dp365-lines');
        return s.getData ? await s.getData() : s._data; };   // updateData後は_dataが古いためgetDataで読む
      const pts=[];
      // 方位が5°超で飛ぶ点を1つ入れて2セグメントに割れることを確認する
      for(let i=0;i<10;i++) pts.push({ lat:35+i*0.01, lng:138+i*0.01, az:100+(i>=5?10:0)+i*0.1, dist:50000 });
      glDrawDP365Path(pts, '#00c800', 'Moon');   // 先頭呼び出しは即時反映(leading)
      await new Promise(res=>setTimeout(res,300));
      const d1=await gd();
      const after=d1.features.length;
      const segs=after===1?d1.features[0].geometry.coordinates.length:0;
      // 表示切替: Moonを非表示にした状態のsync(=visibleから除外)
      _glDp365Visible=new Set();
      _glDp365Flush();
      await new Promise(res=>setTimeout(res,200));
      const hidden=(await gd()).features.length;
      // 再表示(キャッシュから)
      _glDp365Visible=new Set(['Moon']);
      _glDp365Flush();
      await new Promise(res=>setTimeout(res,200));
      const reshown=(await gd()).features.length;
      clearAllDP365Layers();
      await new Promise(res=>setTimeout(res,200));
      const cleared=(await gd()).features.length;
      return { after, segs, hidden, reshown, cleared, lyr: !!glMap.getLayer('dp365') };
    });
    check('Q4 辻ライン365: 1日=1feature(2セグメント)逐次表示→切替0→再表示→全消去', r.after===1&&r.segs===2&&r.hidden===0&&r.reshown===1&&r.cleared===0&&r.lyr,
      JSON.stringify(r));
  }

  // Q5: 旧フラグ?maplibre=0は無視される(手順4でLeaflet撤去済み) — 方位線はGLソースに出る
  {
    const p2=await ctx.newPage();
    const errs2=[]; p2.on('pageerror',e=>errs2.push(e.message));
    await p2.goto(BASE+'/index.html?maplibre=0',{waitUntil:'load'});
    await p2.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:8000});
    await p2.waitForTimeout(600);
    const r=await p2.evaluate(()=>{
      updateAll();
      return { n: glMap.getSource('dir-lines')._data.features.length,
               visCnt: appState.bodies.filter(b2=>b2.visible).length };
    });
    check('Q5 ?maplibre=0でも方位線はMapLibre(GLソース)', r.n===r.visCnt&&r.n>=2, JSON.stringify(r));
    check('Q5 ページエラーなし', errs2.length===0, errs2.slice(0,2).join(' | '));
    await p2.close();
  }

  check('Q6 フラグONでページエラーなし', errs.length===0, errs.slice(0,3).join(' | '));

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
