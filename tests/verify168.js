// 第122ラウンド検証: v1.86.1 — ①天体儀の天の川オフセット点の逆回り修正(反転漏れ=第93の取り残し)
// ②名称修正「全天儀」→「天体儀」。
// B系の凍結標本は依頼者の基準そのもの: 「2026年夏至(6/21)の日の入時刻での天の川を、天体儀の
// 天頂から中心点に向かって見た時、時計回りのオフセット中心角を正とする」。
// 上から見て時計回り=方位角の増加なので、角度0→+30→+60でオフセット点の方位角が増えることを固定する。
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

// ---- V0: 版数ピン(最新の検証が持つ) ----
check('V0 版数ピン 1.86.1', /APP_VERSION = '1\.86\.1'/.test(src) && (src.includes('Version 1.86.1 - ') || !!process.argv[2]));

// ---- S1: オフセット点の位置が正典関数へ一本化(静的) ----
check('S1 天体儀のオフセット点がgetMilkyWayBaseRaDecへ一本化(生角度の銀経渡しが無い)',
  /const op = getMilkyWayBaseRaDec\(\);/.test(src) && !/galacticToEquatorial\(ang, 0\)/.test(src));

// ---- R1: 名称修正(Version History以外に「全天儀」が残っていない) ----
{
  const bad = src.split('\n').filter(l => l.includes('全天儀') && !l.startsWith('Version '));
  check('R1 script.jsの「全天儀」はVersion History行のみ(コード・文字列・コメントは天体儀)',
    bad.length===0, bad.slice(0,2).join(' | ').slice(0,200));
  check('R2 index.htmlに「全天儀」が無い+ボタン表記は「天体儀」',
    !html.includes('全天儀') && /<button id="btn-milkyway"[^>]*>天体儀<\/button>/.test(html));
}

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof getMilkyWayBaseRaDec==='function',{timeout:8000});
  await p.waitForTimeout(400);

  // B1/B2: 依頼者基準の凍結標本(夏至の日の入=既定観測点の東京タワーで18:59:56。
  // 依頼文の19:09:28は依頼者の観測点での日の入と解し、両時刻で符号が同じことも確認する)
  {
    const r=await p.evaluate(()=>{
      const obs=new Astronomy.Observer(appState.start.lat, appState.start.lng, appState.start.elev||0);
      const azAt=(t,ang)=>{ const eq=galacticToEquatorial(-ang,0); return Astronomy.Horizon(t,obs,eq.ra,eq.dec,'normal').azimuth; };
      const ss=Astronomy.SearchRiseSet('Sun', obs, -1, new Date('2026-06-21T00:00:00+09:00'), 1).date;
      const tB=new Date('2026-06-21T19:09:28+09:00');
      const seq=(t)=>[azAt(t,0),azAt(t,30),azAt(t,60)].map(a=>+a.toFixed(2));
      // 正典3関数の一致(検索=辻検索/辻メッシュ・軌跡=天体儀/宙の窓・My辻)
      appState.baseOptMwBase='offset'; appState.mwOffsetAngle=30;
      const a=getMilkyWayBaseRaDec(), b=getFixedStarRaDec('MilkyWay'), c=_myTsujiMwRaDec({mwOffsetEnabled:true,mwOffsetAngle:30});
      const agree=(a.ra===b.ra&&a.dec===b.dec&&a.ra===c.ra&&a.dec===c.dec);
      appState.baseOptMwBase='center'; appState.mwOffsetAngle=0;
      return { sunset:ss.toLocaleString('sv-SE',{timeZone:'Asia/Tokyo'}), atSunset:seq(ss), at190928:seq(tB), agree };
    });
    const cw=(s)=>s[0]<s[1]&&s[1]<s[2];
    check('B1 夏至の日の入(既定観測点18:59:56)で角度0→+30→+60の方位角が増加=天頂から見て時計回り',
      r.sunset.startsWith('2026-06-21 18:59')&&cw(r.atSunset)&&Math.abs(r.atSunset[0]-126.3)<1.0&&Math.abs(r.atSunset[1]-155.9)<1.5,
      JSON.stringify(r.atSunset));
    check('B1b 依頼文の19:09:28でも同じく時計回り(符号は時刻に依らない)', cw(r.at190928), JSON.stringify(r.at190928));
    check('B2 正典3関数(検索/軌跡/My辻)が同一のRA/Dec(全機能が同じ点を使う)', r.agree);
  }

  // B3: 天体儀のシーン実測 — オフセット点マーカー/方位線が軌跡の円周上+正典位置(修正の本体)
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      appState.baseOptMwBase='offset'; appState.mwOffsetAngle=30;
      if(!appState.isMilkyWayActive) toggleMilkyWayInstrument();
      await new Promise(r=>setTimeout(r,1500));
      const out={};
      const RR=_MW_R*1.006;
      // 正典位置(オフセット点)と、反転漏れ時代の誤位置
      const rd=getMilkyWayBaseRaDec(); const cv=_mwEquVec(rd.ra,rd.dec);
      const canon=new THREE.Vector3(cv[0]*RR,cv[1]*RR,cv[2]*RR);
      const wr=galacticToEquatorial(30,0); const wv=_mwEquVec(wr.ra,wr.dec);
      const wrong=new THREE.Vector3(wv[0]*RR,wv[1]*RR,wv[2]*RR);
      // シーンのオフセット点マーカー: _mwMwObjGrp内の天体色球(赤マーカー0xff3333以外のSphere)
      const spheres=[]; _mwMwObjGrp.traverse(c=>{ if(c.isMesh&&c.geometry.type==='SphereGeometry') spheres.push(c); });
      const opMk=spheres.find(s=>s.material.color.getHex()!==0xff3333);
      out.hasMarker=!!opMk;
      out.dCanon=opMk?+opMk.position.distanceTo(canon).toFixed(5):null;
      out.dWrong=opMk?+opMk.position.distanceTo(wrong).toFixed(5):null;
      // 軌跡の円周上に乗っているか(天の川の軌跡トーラス: 中心z=R sin(dec)・半径R cos(dec)の等赤緯円)
      const trajR=_MW_R*1.006;   // _mwUpdateBodiesのR
      const decR=rd.dec*Math.PI/180;
      out.onTraj=opMk?(Math.abs(opMk.position.z-trajR*Math.sin(decR))<1e-6&&
                       Math.abs(Math.hypot(opMk.position.x,opMk.position.y)-trajR*Math.cos(decR))<1e-6):false;
      appState.baseOptMwBase='center'; appState.mwOffsetAngle=0;
      return out;
    });
    check('B3 オフセット点マーカーが正典位置(距離≈0)で旧誤位置から離れ、軌跡の等赤緯円周上に乗る',
      r.hasMarker&&r.dCanon<1e-4&&r.dWrong>0.5&&r.onTraj, JSON.stringify(r));
  }

  check('E1 ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
