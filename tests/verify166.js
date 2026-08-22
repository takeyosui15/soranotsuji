// 第116ラウンド検証: v1.86.0 — 可視判定へ地球の丸み+大気差(第115調査の帰結・依頼者GO)+
// 標高グラフの見通し線の曲線化+宙の窓「:写真テクスチャ」+天体軌跡の大気差。
// J系の数値は第115ラウンドの実測(茶臼山292.5m→槍ヶ岳3180m=150.73km・遮蔽=碓氷峠北の
// 県境稜線1193.6m@60.2km)を凍結標本にした合成地形で、平面判定=見える/丸み込み=隠れる、を固定する。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');
const workerSrc = fs.readFileSync(path.join(path.dirname(target), 'tm-vis-worker.js'), 'utf8');

// ---- V0: 版数の形(第117でピンはverify167へ移譲=最新の検証が持つ) ----
check('V0 版数の形', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.86.0の行がある', src.includes('Version 1.86.0 - ') || !!process.argv[2]);

// ---- W1: 逐次判定とワーカー並列判定の式のパリティ(静的) ----
check('W1 沈み込み補正の比較式が本体とtm-vis-workerで同一(ビット一致の前提)',
  src.includes('if (e - d * d * inv2R > lineElev) {') && workerSrc.includes('if (e - d * d * inv2R > lineElev) {') &&
  src.includes('const lineElev = startTotal + (endTotal - endDrop - startTotal) * r;') &&
  workerSrc.includes('const lineElev = sTotal + (endTotal - endDrop - sTotal) * r;') &&
  src.includes("inv2R: visInv2R,"));

// ---- 静的: 案②/案③/おまけの配線 ----
check('S1 標高グラフの見通し線が曲線描画(rayElevAtKm)+ポップアップ注記が新文言',
  src.includes('const rayElevAtKm = (dKm) => {') &&
  src.includes('地球の丸みと大気差') && !src.includes('屈折・地球曲率は考慮していない'));
check('S2 写真テクスチャの配線(発行URL・ワーカー相乗り・頂点色の分岐・geomKey)',
  src.includes('xyz/seamlessphoto/') && src.includes('photoUrl: g.photoUrl') &&
  src.includes('appState.soraPhotoTex && s.rgb') &&
  /geomKey = `[^`]*soraPhotoTex[^`]*`/.test(src) &&
  fs.readFileSync(path.join(path.dirname(target), 'sora-terrain-worker.js'), 'utf8').includes('samplePhoto'));
check('S3 天体軌跡にマーカーと同じ大気差(+キャッシュ鍵に大気差設定)',
  src.includes('const hor = Astronomy.Horizon(t, observer, ra, dec, refr);') &&
  /_smTrajKey[\s\S]{0,400}/.test(src) && /const key = `\$\{centerMs\}[^`]*refractionEnabled[^`]*`/.test(src));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof _visJudgeCore==='function',{timeout:8000});
  await p.waitForTimeout(400);

  // J1/J2/J3: 茶臼山→槍ヶ岳の凍結標本(合成地形: 60.2kmに1193.6mの稜線・他は0m)
  {
    const r=await p.evaluate(()=>{
      const S={lat:36.378279,lng:139.326292}, E={lat:36.34217,lng:137.64744};
      const scale15=Math.pow(2,15), R128=128/Math.PI;
      const px2lng=(gx)=>(gx/scale15/128-1)*180;
      const px2lat=(gy)=>Math.atan(Math.sinh((128-gy/scale15)/R128))*180/Math.PI;
      const elevAt=(gx,gy)=>{
        const d=_geoDistM(S.lat,S.lng,px2lat(gy),px2lng(gx));
        return (d>59700&&d<60700)?1193.6:0;   // 碓氷峠北の県境稜線の帯
      };
      appState.refractionEnabled=true; appState.meteo={p:1013.25,t:15,l:0.0065};
      const curved=_visJudgeCore(S.lat,S.lng,294.0,E.lat,E.lng,3180,0,0,elevAt);
      const flat=_visJudgeCore(S.lat,S.lng,294.0,E.lat,E.lng,3180,0,0,elevAt,0);   // 補正0=旧来の直線判定
      appState.refractionEnabled=false;
      const noRefr=_visJudgeCore(S.lat,S.lng,294.0,E.lat,E.lng,3180,0,0,elevAt);
      const invOn=(appState.refractionEnabled=true, _visInv2Reff(S.lat,E.lat));
      appState.refractionEnabled=false;
      const invOff=_visInv2Reff(S.lat,E.lat);
      appState.refractionEnabled=true;
      return { curved, flat, noRefr, ratio:invOn/invOff };
    });
    check('J1 丸み+大気差込みでは隠れる(第115実測の凍結標本。遮蔽は約60.2km地点)',
      r.curved.visible===false && Math.abs(r.curved.blockingDist-60.2)<0.6, JSON.stringify(r.curved));
    check('J2 補正なし(旧来の直線判定=inv2R:0)なら同じ地形で見える(判定を変えたのは丸みの項)',
      r.flat.visible===true, JSON.stringify(r.flat));
    check('J3 大気差オフでも隠れる+実効地球は大気差オンで大きくなる(k連動: 比が1-k≒0.8台)',
      r.noRefr.visible===false && r.ratio>0.78 && r.ratio<0.9, `ratio=${r.ratio.toFixed(3)}`);
  }

  // T1: 写真テクスチャのUI・保存・URL往復
  {
    const r=await p.evaluate(()=>{
      const el=document.getElementById('chk-sora-phototex');
      const def=APP_DEFAULTS.soraPhotoTex && APP_DEFAULTS.soraPhotoTex.def===false;
      el.checked=true; el.dispatchEvent(new Event('change'));
      const on=appState.soraPhotoTex===true;
      const q=buildCommonUrlParams('fixed','soramado').toString();
      const emitted=q.includes('soraPhotoTex=true');
      el.checked=false; el.dispatchEvent(new Event('change'));
      const off=appState.soraPhotoTex===false;
      const enc=encodeQueryParam('soraPhotoTex=true&mode=preview');
      return { exists:!!el, def, on, emitted, off, ver:enc.slice(0,4),
               saved:JSON.parse(localStorage.getItem('soranotsuji_app')).soraPhotoTex===false };
    });
    check('T1 「:写真テクスチャ」チェック(初期値オフ)→appState/保存/URL発行(soramadoにも)が連動+辞書はv20',
      r.exists&&r.def&&r.on&&r.emitted&&r.off&&r.saved&&r.ver==='~20~', JSON.stringify(r));
  }

  // T2: URL復元(soraPhotoTex=trueのURLで開くと有効になる)
  {
    const p2=await ctx.newPage();
    await p2.goto(BASE+'/index.html?mode=preview&soraPhotoTex=true',{waitUntil:'load'});
    await p2.waitForFunction(()=>typeof appState==='object',{timeout:8000});
    await p2.waitForTimeout(400);
    const v=await p2.evaluate(()=>appState.soraPhotoTex);
    check('T2 URLのsoraPhotoTex=trueが復元される', v===true, String(v));
    await p2.close();
  }

  check('E1 ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
