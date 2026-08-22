// 第117〜118ラウンド検証: v1.86.0への追補(リリース前) — ①可視判定ポップアップ注記の版数表記を削除
// ②全天儀の天体軌跡線をトーラス+背面破線3本重ねへ(_mwTrajCircle。第117=方位線と同じ0.0025R→
//   第118=依頼者指定でさらに2倍の0.005R=方位線の2倍。スマホでの見やすさ)
// ③ヘルプの可視判定2箇所を丸み+大気差込みへ更新+「:写真テクスチャ」ヘルプ項目と出典(GRUS/Landsat-8)
// ④地図ⓘの出典を「国土地理院(標高・写真)」へ。
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
const html = fs.readFileSync(path.join(path.dirname(target), 'index.html'), 'utf8');

// ---- V0: 版数ピン(最新の検証が持つ。第117〜118はリリース前の追補なので1.86.0のまま) ----
check('V0 版数ピン 1.86.0+Version Historyに第117/118の追補', /APP_VERSION = '1\.86\.0'/.test(src) && ((src.includes('⑥第117ラウンド') && src.includes('⑦第118ラウンド')) || !!process.argv[2]));

// ---- S1: ポップアップ注記に版数表記なし(リリースノートが持ち場=依頼者指摘)。
// noteの代入行そのものを検査する(Version Historyの経緯文が旧文言を引用しても引っかからない形) ----
check('S1 可視判定ポップアップの注記が版数なし',
  /const note = '\\n\\n※ 地球の丸みと大気差\(:大気差設定・気象値に連動\)を考慮した判定です';/.test(src));

// ---- S2: 全天儀軌跡の静的な形(トーラス=方位線と同じ0.0025R・旧_mwFrontBackLine廃止) ----
check('S2 _mwTrajCircle(トーラス0.005R=方位線の2倍+破線3本)+方位線は0.0025R+旧ヘルパー廃止',
  src.includes('function _mwTrajCircle') &&
  /TorusGeometry\(R \* Math\.cos\(decR\), 0\.005 \* _MW_R/.test(src) &&
  /方位線: 中心→天体[\s\S]{0,300}0\.0025 \* _MW_R/.test(src) &&
  !/function _mwFrontBackLine/.test(src));

// ---- H1: ヘルプ・出典の更新 ----
check('H1 ヘルプの旧「直線判定」記述の廃止+丸み+大気差の記述',
  !html.includes('地球曲率・屈折なし') && !html.includes('屈折・地球曲率は考慮していない') &&
  html.includes('地球の丸みと大気差を考慮</strong>します'));
check('H2 「:写真テクスチャ」ヘルプ項目+個別出所(GRUS/Landsat-8)+地図ⓘが標高・写真',
  html.includes('「全国最新写真 (シームレス)」を貼り付けます') &&
  html.includes('GRUS画像 (© Axelspace)') && html.includes('Landsat-8画像 (NASA/USGS)') &&
  src.includes('国土地理院(標高・写真)'));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof toggleMilkyWayInstrument==='function',{timeout:8000});
  await p.waitForTimeout(400);

  // T1: 全天儀の軌跡線の実測(太さ=方位線と同一・破線3本・原点保持=前面判定の基準が天球中心)
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      if(!appState.isMilkyWayActive) toggleMilkyWayInstrument();
      await new Promise(r=>setTimeout(r,1500));
      const out={};
      const grps=_mwBodiesObjGrp.children.filter(c=>c.isGroup);
      const tori=grps.map(g=>g.children.find(c=>c.isMesh&&c.geometry.type==='TorusGeometry')).filter(Boolean);
      out.trajN=tori.length;
      out.visN=appState.bodies.filter(b=>b.visible).length;
      out.tubeR=tori.length?tori[0].geometry.parameters.tube:null;
      out.allSameTube=tori.every(t=>t.geometry.parameters.tube===out.tubeR);
      // 方位線: 中心(原点)始点のTubeGeometry
      const azLines=_mwBodiesObjGrp.children.filter(c=>c.isMesh&&c.geometry.type==='TubeGeometry'&&
        c.geometry.parameters.path&&c.geometry.parameters.path.v1&&c.geometry.parameters.path.v1.length()<1e-9);
      out.azN=azLines.length;
      out.azR=azLines.length?azLines[0].geometry.parameters.radius:null;
      out.twice=out.tubeR!==null&&out.azR!==null&&Math.abs(out.tubeR-2*out.azR)<1e-12;   // 第118: 軌跡=方位線の2倍
      out.dash3=grps.every(g=>g.children.filter(c=>c.isLineLoop).length===3);
      out.originKept=tori.every(t=>t.position.length()<1e-12);   // ジオメトリ側をtranslate=前面判定の基準が天球中心のまま
      return out;
    });
    check('T1 軌跡=トーラス(表示天体ぶん)+太さが方位線の2倍(第118=依頼者指定)', r.trajN>0 && r.trajN===r.visN && r.allSameTube && r.azN>0 && r.twice, JSON.stringify(r));
    check('T2 背面破線3本重ね+メッシュ原点=天球中心(前面/背面判定の維持)', r.dash3 && r.originKept, JSON.stringify({dash3:r.dash3,origin:r.originKept}));
  }

  check('E1 ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
