// 第31ラウンド検証: 辻ライン365の描画クラッシュ対策(Macの「エラーコード5」不具合修正)
// 実測規模(太陽827点/日+月581点/日×365日≈51万点)を合成データで再現し、
// 描画中に全再構築setDataが走らないこと(updateData増分+1秒スロットル)と結果の正しさを検証する。
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
  // 版数ピンは最新のverify(現在は116)のみに置く(テスト方針)。ここでは存在だけ確認する
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    check('U0 APP_VERSIONが定義されている', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
  }
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});   // 既定=MapLibre
  await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null&&glMap.isStyleLoaded&&glMap.isStyleLoaded(),{timeout:10000});
  await p.waitForTimeout(600);

  // U1: 実測規模の合成流し込み(365日×2天体・計約51万点)で全再構築setDataが走らない
  {
    const r=await p.evaluate(async()=>{
      const src=glMap.getSource('dp365-lines');
      let full=0, inc=0;
      const oSet=src.setData.bind(src), oUpd=src.updateData?src.updateData.bind(src):null;
      src.setData=(d)=>{ full++; return oSet(d); };
      if (oUpd) src.updateData=(d)=>{ inc++; return oUpd(d); };
      // 太陽827点/月581点(実測平均)の1日パスを365日分ずつ流し込む
      const mkDay=(dayIdx,n)=>{ const pts=[];
        for(let i=0;i<n;i++) pts.push({ lat:35+dayIdx*0.001+i*0.0001, lng:135+i*0.0005, az:90+i*0.01, dist:100000 });
        return pts; };
      const t0=performance.now();
      for(let d=0;d<365;d++){
        glDrawDP365Path(mkDay(d,827),'#ffcc00','Sun');
        glDrawDP365Path(mkDay(d,581),'#c0c0ff','Moon');
      }
      const buildMs=performance.now()-t0;
      await new Promise(res=>setTimeout(res,1500));   // trailingフラッシュ(1秒)を待つ
      const gd=src.getData?await src.getData():src._data;
      const nFeats=gd.features.length;
      let nPts=0; gd.features.forEach(f=>f.geometry.coordinates.forEach(line=>{ nPts+=line.length; }));
      const cacheFeats=(_glDp365Features.Sun||[]).length+(_glDp365Features.Moon||[]).length;
      return { hasUpd: !!oUpd, full, inc, nFeats, nPts, cacheFeats, buildMs: Math.round(buildMs),
               pending: _glDp365Pending.length };
    });
    check('U1 updateData増分のみで反映(全再構築setData=0回・増分1〜3回)', r.hasUpd&&r.full===0&&r.inc>=1&&r.inc<=3,
      `full=${r.full} inc=${r.inc} build=${r.buildMs}ms`);
    check('U1 730日分(51万点)が反映される(保留なし)', r.nFeats===730&&r.nPts===730*704&&r.cacheFeats===730&&r.pending===0,
      `feats=${r.nFeats} pts=${r.nPts}`);
  }

  // U2: 表示切替(太陽のみ)→全再構築1回で365日分・再表示730・全消去0
  {
    const r=await p.evaluate(async()=>{
      const src=glMap.getSource('dp365-lines');
      let full=0;
      const oSet=src.setData.bind(src);
      src.setData=(d)=>{ full++; return oSet(d); };
      const gd=async()=>{ const g=src.getData?await src.getData():src._data; return g.features.length; };
      _glDp365Visible=new Set(['Sun']);
      _glDp365Flush();
      const sunOnly=await gd();
      _glDp365Visible=new Set(['Sun','Moon']);
      _glDp365Flush();
      const both=await gd();
      clearAllDP365Layers();
      const cleared=await gd();
      return { full, sunOnly, both, cleared, cacheGone: Object.keys(_glDp365Features).length===0 };
    });
    check('U2 表示切替: 太陽のみ365→両方730→全消去0(切替毎に再構築1回ずつ)', r.full===3&&r.sunOnly===365&&r.both===730&&r.cleared===0&&r.cacheGone,
      JSON.stringify(r));
  }

  check('U3 51万点の流し込みでページエラーなし(クラッシュしない)', errs.length===0, errs.slice(0,3).join(' | '));

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
