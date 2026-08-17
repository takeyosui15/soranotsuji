// 第9ラウンド検証: 全天儀ctrl2〜4段目+最大化 / メッシュFile取得の全画素CSV / 🕛アニメ / 動画診断
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };
(async()=>{
  // V0: ソース監査 — ⏳が残っていないこと
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    check('V0 ⏳ eliminated from script.js', !src.includes('⏳'));
    // 版数ピンは最新のverifyのみに置く運用(第24ラウンド〜。バージョン更新漏れは最新verifyが検知する)
    check('V0 出力診断コードは削除済み(履歴コメント以外に無し)', !src.replace(/^[\s\S]*?\*\//,'').includes('出力診断'));
  }
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof toggleMilkyWayInstrument==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // V1: 全天儀ctrl 2〜4段目(前景/後景/透過・自由/水平/地軸・北奥/目的点前)
  {
    const r=await p.evaluate(async()=>{
      appState.start={lat:36.2919,lng:137.7811,elev:1500};
      appState.end={lat:35.3606,lng:138.7274,elev:3776};
      window.confirm=()=>true; window.alert=()=>{};
      if(!appState.isMilkyWayActive) toggleMilkyWayInstrument();
      await new Promise(r=>setTimeout(r,1200));
      const out={};
      // 存在と初期値
      const f=document.getElementById('chk-mwctrl-front'), bk=document.getElementById('chk-mwctrl-back'), th=document.getElementById('chk-mwctrl-through');
      const rFree=document.querySelector('input[name="mwctrl-rot"][value="free"]');
      const rHor=document.querySelector('input[name="mwctrl-rot"][value="horizontal"]');
      const rAxis=document.querySelector('input[name="mwctrl-rot"][value="axis"]');
      const nb=document.getElementById('chk-mwctrl-north-back'), tf=document.getElementById('chk-mwctrl-target-front');
      out.exists=!!(f&&bk&&th&&rFree&&rHor&&rAxis&&nb&&tf);
      out.defaults=f.checked&&bk.checked&&th.checked&&rHor.checked&&!rFree.checked&&!rAxis.checked&&!nb.checked&&!tf.checked;
      const rads=[...document.querySelectorAll('input[name="mwctrl-rot"]')].map(x=>x.value);
      out.radioOrder=rads.join(',')==='horizontal,axis,free';
      // 透過オフ → 不透明マテリアル
      th.checked=false; th.dispatchEvent(new Event('change'));
      out.opaque=_mwMaterial.transparent===false&&_mwMaterial.side===THREE.DoubleSide&&_mwMaterial.blending===THREE.NormalBlending&&_mwMaterial.depthWrite===true;
      th.checked=true; th.dispatchEvent(new Event('change'));
      out.transBack=_mwMaterial.transparent===true&&_mwMaterial.side===THREE.DoubleSide&&_mwMaterial.blending===THREE.AdditiveBlending;
      // 前景/後景オフ → クリップ面
      f.checked=false; f.dispatchEvent(new Event('change'));
      out.clip1=_mwRenderer.clippingPlanes.length===1;
      const n1=_mwRenderer.clippingPlanes[0]?_mwRenderer.clippingPlanes[0].normal:null;
      out.clipFrontNormal=n1?(Math.abs(n1.x-Math.cos(_MW_TILT))<1e-9&&Math.abs(n1.y+Math.sin(_MW_TILT))<1e-9&&Math.abs(n1.z)<1e-9):false;
      bk.checked=false; bk.dispatchEvent(new Event('change'));
      out.clip2=_mwRenderer.clippingPlanes.length===2;
      f.checked=true; f.dispatchEvent(new Event('change'));
      bk.checked=true; bk.dispatchEvent(new Event('change'));
      out.clip0=_mwRenderer.clippingPlanes.length===0;
      // 回転モードの切替
      rHor.checked=true; rHor.dispatchEvent(new Event('change'));
      out.modeHor=_mwRotMode==='horizontal';
      rAxis.checked=true; rAxis.dispatchEvent(new Event('change'));
      out.modeAxis=_mwRotMode==='axis';
      rFree.checked=true; rFree.dispatchEvent(new Event('change'));
      out.modeFree=_mwRotMode==='free';
      return out;
    });
    check('V1 2〜4段目の要素が存在', r.exists);
    check('V1 初期値(前景/後景/透過=オン・水平=オン)', r.defaults);
    check('V1 ラジオ順序=水平/地軸/自由', r.radioOrder);
    check('V1 透過オフ=不透明+深度書込の両面描画(外側から見た構図)', r.opaque);
    check('V1 透過オン=加算合成へ復帰', r.transBack);
    check('V1 前景オフ=クリップ面1(法線=視線方向)', r.clip1&&r.clipFrontNormal);
    check('V1 前景+後景オフ=クリップ面2 / 全オン=0', r.clip2&&r.clip0);
    check('V1 回転モード radio→_mwRotMode', r.modeHor&&r.modeAxis&&r.modeFree);
  }

  // V1b: 回転モードのドラッグ不変量と北奥/目的点前リセット
  {
    const r=await p.evaluate(async()=>{
      const out={};
      const cv=document.getElementById('milkyway-canvas');
      const rect=cv.getBoundingClientRect();
      const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
      const drag=(x0,y0,x1,y1)=>{
        cv.dispatchEvent(new PointerEvent('pointerdown',{pointerId:9,pointerType:'mouse',clientX:x0,clientY:y0,bubbles:true}));
        cv.dispatchEvent(new PointerEvent('pointermove',{pointerId:9,pointerType:'mouse',clientX:x1,clientY:y1,bubbles:true}));
        cv.dispatchEvent(new PointerEvent('pointerup',{pointerId:9,pointerType:'mouse',clientX:x1,clientY:y1,bubbles:true}));
      };
      const setMode=(v)=>{ const el=document.querySelector(`input[name="mwctrl-rot"][value="${v}"]`); el.checked=true; el.dispatchEvent(new Event('change')); };
      // 自由: ドラッグで回転する
      setMode('free');
      _mwWorld.quaternion.identity();
      const q0=_mwWorld.quaternion.clone();
      drag(cx,cy,cx+60,cy+40);
      out.freeRotates=q0.angleTo(_mwWorld.quaternion)>0.01;
      // 水平: 天頂軸が不変(横ドラッグ)・縦ドラッグは無効
      setMode('horizontal');
      const zen0=new THREE.Vector3(0,1,0).applyQuaternion(_mwWorld.quaternion);
      const qh0=_mwWorld.quaternion.clone();
      drag(cx,cy,cx+80,cy);
      const zen1=new THREE.Vector3(0,1,0).applyQuaternion(_mwWorld.quaternion);
      out.horRotated=qh0.angleTo(_mwWorld.quaternion)>0.01;
      out.horZenithFixed=zen0.angleTo(zen1)<1e-6;
      const qh1=_mwWorld.quaternion.clone();
      drag(cx,cy,cx,cy+80);   // 縦ドラッグ → 回転しない
      out.horVerticalNoop=qh1.angleTo(_mwWorld.quaternion)<1e-9;
      // 地軸: 天の北極軸が不変
      setMode('axis');
      const pole0=new THREE.Vector3(0,0,1).applyQuaternion(_mwGlobe.quaternion).applyQuaternion(_mwWorld.quaternion);
      const qa0=_mwWorld.quaternion.clone();
      drag(cx,cy,cx+80,cy);
      const pole1=new THREE.Vector3(0,0,1).applyQuaternion(_mwGlobe.quaternion).applyQuaternion(_mwWorld.quaternion);
      out.axisRotated=qa0.angleTo(_mwWorld.quaternion)>0.01;
      out.axisPoleFixed=pole0.angleTo(pole1)<1e-6;
      setMode('free');
      // 北奥: 初期姿勢(単位クォータニオン)へ + すぐオフ
      const nb=document.getElementById('chk-mwctrl-north-back');
      nb.checked=true; nb.dispatchEvent(new Event('change'));
      out.northIdentity=_mwWorld.quaternion.angleTo(new THREE.Quaternion())<1e-9;
      await new Promise(r=>setTimeout(r,400));
      out.northUnchecked=!nb.checked;
      // 目的点前: 方位azの水平方向が(-1,0,0)=手前を向く + すぐオフ
      const tf=document.getElementById('chk-mwctrl-target-front');
      tf.checked=true; tf.dispatchEvent(new Event('change'));
      const az=calculateBearing(appState.start.lat,appState.start.lng,appState.end.lat,appState.end.lng);
      const d=az*Math.PI/180;
      const v=new THREE.Vector3(Math.cos(d),0,Math.sin(d)).applyQuaternion(_mwWorld.quaternion);
      out.targetFront=v.distanceTo(new THREE.Vector3(-1,0,0))<1e-6;
      const zenT=new THREE.Vector3(0,1,0).applyQuaternion(_mwWorld.quaternion);
      out.targetUpright=zenT.distanceTo(new THREE.Vector3(0,1,0))<1e-6;
      await new Promise(r=>setTimeout(r,400));
      out.targetUnchecked=!tf.checked;
      _mwWorld.quaternion.identity(); _mwRender();
      return out;
    });
    check('V1b 自由モードでドラッグ回転', r.freeRotates);
    check('V1b 水平モード=天頂軸不変+回転あり', r.horRotated&&r.horZenithFixed);
    check('V1b 水平モードで縦ドラッグ無効', r.horVerticalNoop);
    check('V1b 地軸モード=天の北極軸不変+回転あり', r.axisRotated&&r.axisPoleFixed);
    check('V1b 北奥=初期姿勢+自動オフ', r.northIdentity&&r.northUnchecked);
    check('V1b 目的点前=目的点方位が手前+水平保持+自動オフ', r.targetFront&&r.targetUpright&&r.targetUnchecked);
  }

  // V1c: 透過オフの視覚検証 — テクスチャ球のみ描画してBackSideで可視(FrontSideでは内側構図になる)
  {
    const r=await p.evaluate(async()=>{
      const mesh=_mwGlobe.children[0];
      const hidden=[];
      _mwScene.traverse(o=>{ if((o.isMesh||o.isLine||o.isSprite)&&o!==mesh&&o.visible){hidden.push(o);o.visible=false;} });
      const count=()=>{ _mwRenderer.render(_mwScene,_mwCamera);
        const gl=_mwRenderer.getContext();
        const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;
        const px=new Uint8Array(w*h*4); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px);
        let n=0; for(let i=0;i<px.length;i+=40){ if(px[i]>18||px[i+1]>18||px[i+2]>22) n++; } return n; };
      const th=document.getElementById('chk-mwctrl-through');
      const fr=document.getElementById('chk-mwctrl-front');
      th.checked=false; th.dispatchEvent(new Event('change'));
      const opaqueVisible=count();
      fr.checked=false; fr.dispatchEvent(new Event('change'));   // 透過オフ+前景オフ=奥半球の内面が見える
      const opaqueBackOnly=count();
      fr.checked=true; fr.dispatchEvent(new Event('change'));
      th.checked=true; th.dispatchEvent(new Event('change'));
      const transVisible=count();
      hidden.forEach(o=>o.visible=true); _mwRender();
      return { opaqueVisible, opaqueBackOnly, transVisible };
    });
    check('V1c 透過オフでも球が可視(不透明の外側構図)', r.opaqueVisible>2000, `px=${r.opaqueVisible}`);
    check('V1c 透過オフ+前景オフ=奥半球の内面が可視(全消えしない)', r.opaqueBackOnly>2000, `px=${r.opaqueBackOnly}`);
    check('V1c 透過オンも可視(回帰)', r.transVisible>2000, `px=${r.transVisible}`);
  }

  // V2: 最大化ボタンとサイズ規則(通常2/3⇄辻検索1/3・最大化100%⇄66.67%)
  {
    const r=await p.evaluate(async()=>{
      const out={}; const H=window.innerHeight;
      const hOf=id=>document.getElementById(id).getBoundingClientRect().height;
      const near=(a,b)=>Math.abs(a-b)<8;
      out.btn=!!document.getElementById('btn-milkyway-max');
      // 通常+辻検索OFF: 2/3
      out.h23=near(hOf('milkyway-panel'),H*2/3);
      // 最大化: 100%
      document.getElementById('btn-milkyway-max').click();
      await new Promise(r=>setTimeout(r,100));
      out.maxClass=document.getElementById('milkyway-panel').classList.contains('maximized');
      out.h100=near(hOf('milkyway-panel'),H);
      out.btnActive=document.getElementById('btn-milkyway-max').classList.contains('active');
      // 最大化+ctrl開: 全天儀画面2/3・ctrl1/3
      document.getElementById('milkyway-ctrl-header').click();
      await new Promise(r=>setTimeout(r,150));
      out.ctrlThird=near(hOf('milkyway-ctrl'),H/3);
      // 最大化+辻検索ON: 上1/3=辻検索・下2/3=全天儀
      appState.isTsujiSearchActive=true;
      document.getElementById('tsujisearch-panel').classList.remove('hidden');
      syncBottomPanels();
      await new Promise(r=>setTimeout(r,100));
      const td=document.getElementById('tsujisearch-panel');
      out.tdMaxClass=td.classList.contains('with-milkyway-max');
      out.hMaxTsuji=near(hOf('milkyway-panel'),H*2/3);
      out.tdTop=near(td.getBoundingClientRect().bottom,H/3);
      // 最大化+辻検索ON+ctrl開: 1/2分割
      out.ctrlHalfMaxTsuji=near(hOf('milkyway-ctrl'),H*2/3/2);
      // 最大化解除+辻検索ON: 全天儀1/3・辻検索はその上
      document.getElementById('btn-milkyway-max').click();
      await new Promise(r=>setTimeout(r,100));
      out.h13=near(hOf('milkyway-panel'),H/3);
      out.tdAbove=near(td.getBoundingClientRect().bottom,H*2/3);
      out.tdMaxClassOff=!td.classList.contains('with-milkyway-max');
      // 非最大化+ctrl開: 1/2分割
      out.ctrlHalf=near(hOf('milkyway-ctrl'),H/3/2);
      // 後始末
      document.getElementById('milkyway-ctrl-header').click();
      appState.isTsujiSearchActive=false;
      document.getElementById('tsujisearch-panel').classList.add('hidden');
      syncBottomPanels();
      await new Promise(r=>setTimeout(r,100));
      return out;
    });
    check('V2 最大化ボタン存在', r.btn);
    check('V2 通常+辻検索OFF=2/3', r.h23);
    check('V2 最大化=100%+activeボタン', r.maxClass&&r.h100&&r.btnActive);
    check('V2 最大化+ctrl開=ctrl1/3', r.ctrlThird);
    check('V2 最大化+辻検索ON=全天儀2/3+辻検索上1/3+with-milkyway-max', r.tdMaxClass&&r.hMaxTsuji&&r.tdTop);
    check('V2 最大化+辻検索ON+ctrl開=1/2分割', r.ctrlHalfMaxTsuji);
    check('V2 解除+辻検索ON=全天儀1/3(辻検索は上)', r.h13&&r.tdAbove&&r.tdMaxClassOff);
    check('V2 非最大化+ctrl開=1/2分割', r.ctrlHalf);
  }

  // V3: 辻メッシュFile取得=全ヒット画素CSV(観測点ID=画素ID・行内精度昇順・同IDは同緯度経度)
  {
    const r=await p.evaluate(async()=>{
      const out={};
      // 合成メッシュ: 4画素。基準方向=時刻t0の太陽位置+画素毎のオフセット(精度角距離を制御)
      const obs={lat:35.5,lng:138.8,elev:900};
      const t0=new Date(2026,6,19,10,0,0);
      const aobs=new Astronomy.Observer(obs.lat,obs.lng,obs.elev);
      const eq=Astronomy.Equator('Sun',t0,aobs,true,true);
      const hor=Astronomy.Horizon(t0,aobs,eq.ra,eq.dec,null);
      const dOff=[0.011,0.052,0.201,0.302];   // 画素0..3の狙いの精度角距離
      const N=4;
      _tsujiMeshCalc={
        baseAz:Float64Array.from(dOff.map(d=>hor.azimuth+d)),
        baseAlt:Float64Array.from(dOff.map(()=>hor.altitude)),
        dE:new Float64Array(N), dN:new Float64Array(N), tanLat:Math.tan(obs.lat*Math.PI/180),
        offsetAz:0, offsetAlt:0, centerMode:'point',
        observerData:obs, refractionEnabled:false,
      };
      _tsujiMeshPix={
        lat:[35.501,35.502,35.503,35.504],
        lng:[138.801,138.802,138.803,138.804],
        elev:[900,910,920,930],
      };
      appState.startHeight=1.5;
      appState.end={lat:35.3606,lng:138.7274,elev:3776}; appState.endApiElev=3776; appState.endHeight=0;
      appState.tsujiMeshElevationOption=false;
      const sun=appState.bodies.find(b=>b.id==='Sun')||{id:'Sun',name:'太陽',color:'#fc0'};
      const mkRow=(pixIdx,times)=>({ body:sun, dateObj:new Date(times[0]),
        pixIdx:Uint32Array.from(pixIdx),
        pixTime:Float64Array.from(times),
        pixDist:Float32Array.from(pixIdx.map(i=>dOff[i])),
        azimuth:hor.azimuth, altitude:hor.altitude });
      // 行1: pixIdx順=[2,0,1]・辻時刻は 2→t0, 0→t0+60s, 1→t0+120s。
      // 日時順なら出力は 2,0,1。精度角距離順なら 0,1,2 になるので区別できる
      const rows=[ mkRow([2,0,1],[t0.getTime(),t0.getTime()+60e3,t0.getTime()+120e3]),
                   mkRow([1,3],[t0.getTime()+3600e3,t0.getTime()+3660e3]) ];
      // ダウンロードを横取りしてCSV本文を取得
      let captured=null;
      const origCreate=URL.createObjectURL, origClick=HTMLAnchorElement.prototype.click;
      URL.createObjectURL=(blob)=>{ captured=blob; return 'blob:test'; };
      HTMLAnchorElement.prototype.click=function(){};
      try { await _tmExportMeshRowsCsv(rows); }
      finally { URL.createObjectURL=origCreate; HTMLAnchorElement.prototype.click=origClick; }
      if(!captured) return {fail:'no blob'};
      const text=await captured.text();
      // 簡易CSVパーサ(引用対応)
      const parse=(line)=>{ const cells=[]; let cur='',q=false;
        for(let i=0;i<line.length;i++){ const c=line[i];
          if(q){ if(c==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=c; }
          else { if(c==='"') q=true; else if(c===','){cells.push(cur);cur='';} else cur+=c; } }
        cells.push(cur); return cells; };
      const lines=text.replace(/^﻿/,'').split('\r\n').filter(l=>l.length);
      const head=parse(lines[0]);
      const dataRows=lines.slice(1).map(parse);
      out.headCols=head.length;
      out.rowCount=dataRows.length;                       // 3+2=5行(全ヒット画素)
      out.colsMatch=dataRows.every(c=>c.length===head.length);
      const idI=head.indexOf('観測点ID'), latI=head.indexOf('観測点緯度'), lngI=head.indexOf('観測点経度');
      const distI=head.indexOf('精度角距離'), tcI=head.indexOf('時間帯'), ilI=head.indexOf('月輝面比');
      const symI=head.indexOf('精度記号');
      out.row1Ids=dataRows.slice(0,3).map(c=>c[idI]).join(',');   // 日時昇順 → 2,0,1
      const tI=head.indexOf('辻時刻'), dI=head.indexOf('日付');
      out.row1TimeAsc=(()=>{ const ts=dataRows.slice(0,3).map(c=>c[dI]+' '+c[tI]); return ts[0]<=ts[1]&&ts[1]<=ts[2]; })();
      out.row2Ids=dataRows.slice(3).map(c=>c[idI]).sort().join(',');   // {1,3}
      // 同ID(画素1)は同じ緯度経度(行1と行2にまたがる)
      const pix1=dataRows.filter(c=>c[idI]==='1');
      out.sharedIdRows=pix1.length;
      out.sharedIdSameLoc=pix1.length===2&&pix1[0][latI]===pix1[1][latI]&&pix1[0][lngI]===pix1[1][lngI];
      out.pix1Loc=pix1[0]?`${pix1[0][latI]}/${pix1[0][lngI]}`:'';
      out.tcFilled=dataRows.every(c=>c[tcI]&&c[tcI]!=='');
      out.illumPct=dataRows.every(c=>/%$/.test(c[ilI]));
      out.symFilled=dataRows.every(c=>c[symI]&&c[symI].length>0);
      out.status=document.getElementById('tsujimesh-status').textContent;
      // 先頭行=画素2(t0時点)の精度角距離が狙い値≈0.201°×cos(視高度)(方位角オフセットの球面距離)
      const d0=parseFloat(dataRows[0][distI]);
      out.dist0Near=Math.abs(d0-0.201*Math.cos(hor.altitude*Math.PI/180))<0.02;
      return out;
    });
    check('V3 CSV 66列', r.headCols===66, `cols=${r.headCols}`);   // 第58ラウンド: 検索中心列の追加で65→66
    check('V3 全ヒット画素=5行(3+2)', r.rowCount===5, `rows=${r.rowCount}`);
    check('V3 全行の列数一致', r.colsMatch);
    check('V3 行内は日時(日付+辻時刻)の昇順(ID 2,0,1)', r.row1Ids==='2,0,1'&&r.row1TimeAsc, r.row1Ids);
    check('V3 2行目の画素IDs={1,3}', r.row2Ids==='1,3', r.row2Ids);
    check('V3 同ID=同じ観測点緯度経度(行またぎ)', r.sharedIdRows===2&&r.sharedIdSameLoc, r.pix1Loc);
    check('V3 時間帯/月輝面比/精度記号が全行に入る', r.tcFilled&&r.illumPct&&r.symFilled);
    check('V3 先頭行(画素2)の精度角距離≈0.201°×cos(alt)', r.dist0Near);
    check('V3 完了ステータスにCSV出力完了', /CSV出力完了/.test(r.status), r.status);
  }

  // V4: 🕛アニメーション(ティッカーが文字盤を回す)
  {
    const r=await p.evaluate(async()=>{
      const span=document.createElement('span'); span.className='clock-anim'; span.textContent='🕛';
      document.body.appendChild(span);
      const glyphs=['🕛','🕧','🕐','🕜','🕑','🕝','🕒','🕞','🕓','🕟','🕔','🕠','🕕','🕡','🕖','🕢','🕗','🕣','🕘','🕤','🕙','🕥','🕚','🕦'];
      const seen=new Set();
      for(let i=0;i<6;i++){ await new Promise(r=>setTimeout(r,520)); seen.add(span.textContent); }
      span.remove();
      return { count:seen.size, allValid:[...seen].every(g=>glyphs.includes(g)) };
    });
    check('V4 🕛が回る(複数の文字盤を巡回)', r.count>=3&&r.allValid, `glyphs=${r.count}`);
  }

  // V5: downloadTsujiResultCsv(非同期化)の従来経路の回帰(事前計算なし=従来の日別計算)
  {
    const r=await p.evaluate(async()=>{
      const row={ tsuji:{id:'T1',name:'test',memo:'',baseAz:100,baseAlt:5,offsetAz:0,offsetAlt:0,centerMode:'point',mwOffsetAngle:0},
        obs:{id:'O1',name:'obs',lat:35.5,lng:138.8,elev:900,height:1.5,memo:''},
        tgt:{id:'G1',name:'tgt',lat:35.3606,lng:138.7274,elev:3776,height:0,memo:''},
        body:appState.bodies.find(b=>b.id==='Moon')||{id:'Moon',name:'月'},
        time:new Date(2026,6,20,21,30,0), azimuth:100.5, altitude:5.5, dist:0.02,
        symbol:'◎', moonAge:7.7, moonIcon:'🌓', moonIllum:55.5, timeCategory:'夜', elevationStatus:'-' };
      let captured=null;
      const origCreate=URL.createObjectURL, origClick=HTMLAnchorElement.prototype.click;
      URL.createObjectURL=(blob)=>{ captured=blob; return 'blob:test'; };
      HTMLAnchorElement.prototype.click=function(){};
      try { await downloadTsujiResultCsv([row],'t.csv'); }
      finally { URL.createObjectURL=origCreate; HTMLAnchorElement.prototype.click=origClick; }
      const text=await captured.text();
      const lines=text.replace(/^﻿/,'').split('\r\n').filter(l=>l.length);
      const nCols=lines[0].split(',').length;
      const sr=lines[1]&&lines[1].split(',');
      return { lines:lines.length, nCols, hasRise: sr&&/\d{2}:\d{2}:\d{2}/.test(sr[7]||'') };
    });
    check('V5 従来経路CSV(ヘッダ+1行・出没時刻計算あり)', r.lines===2&&r.nCols===66&&r.hasRise, JSON.stringify(r));   // 第58ラウンド: 検索中心列で65→66
  }

  // V6: 動画自己検証の新戻り値({ok,duration})
  {
    const r=await p.evaluate(async()=>{
      const cv=document.createElement('canvas'); cv.width=cv.height=64;
      const g=cv.getContext('2d'); g.fillStyle='#08f'; g.fillRect(0,0,64,64);
      const stream=cv.captureStream(20);
      const rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
      const chunks=[]; rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      const stopped=new Promise(res=>rec.onstop=res);
      rec.start(); await new Promise(r=>setTimeout(r,700)); rec.stop(); await stopped;
      let blob=new Blob(chunks,{type:'video/webm'});
      blob=await _fixWebmDuration(blob,700);
      const ok=await _soraVerifyBlobPlayable(blob);
      const bad=await _soraVerifyBlobPlayable(new Blob([new Uint8Array([1,2,3,4])],{type:'video/webm'}));
      return { okType:typeof ok==='boolean', ok, badOk:bad };
    });
    check('V6 自己検証がboolean復元(良品true・破損false)', r.okType&&r.ok===true&&r.badOk===false);
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
