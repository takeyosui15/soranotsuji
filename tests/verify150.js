// 第83ラウンド検証: v1.67.0
// 怒号の項目10: 宙の窓ctrlの観測点移動ボタン(1m単位のカメラプレビュー+位置反映/リセット)と
//   カメラ向きボタン(オフセット方位角/視高度を1°ずつ+カメラ反映/リセット)。
// 怒号の項目11: 全天儀ctrlの時刻スライダー(日時情報メニューの時刻スライダーと連動・分単位)。
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

// ---- V0: 版数の存在検査(版数ピンは最新のverify151へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.67.0の行がある', src.includes('Version 1.67.0 - ') || !!process.argv[2]);

// ---- V1: 静的な形(カメラの未確定移動が両方の描画経路に入っている) ----
// (第100ラウンドで元の形に復帰: 回転は「移動の向き」だけを回す仕様になり、カメラ位置・角度に関与しない)
check('V1 カメラ位置が未確定移動(_smObsNudge)を使う(通常描画+書き出しの2箇所)',
  (src.match(/_smCamera\.position\.set\(_smObsNudge\.e, _smObsNudge\.n, _smObsNudge\.u\)/g) || []).length === 2);
check('V1 lookAtがカメラ位置を補正する(通常+パノラマ×2経路=4箇所)',
  (src.match(/lookAt\(_smDir\((?:az|sAz), alt\)\.add\(_smCamera\.position\)\)/g) || []).length === 4);

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof toggleSoramado==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // B1: 部品が揃っている(移動6+リセット/位置反映+カメラ4+リセット/カメラ反映+読み+時刻スライダー)
  {
    const r=await p.evaluate(()=>{
      const ids=['btn-sora-move-left','btn-sora-move-back','btn-sora-move-down','btn-sora-move-up',
        'btn-sora-move-fwd','btn-sora-move-right','btn-sora-move-reset','btn-sora-move-apply',
        'btn-sora-cam-left','btn-sora-cam-down','btn-sora-cam-up','btn-sora-cam-right',
        'btn-sora-cam-reset','btn-sora-cam-apply','sora-move-readout','input-mwctrl-time-slider'];
      return { all: ids.every(id=>document.getElementById(id)!==null) };
    });
    check('B1 ボタン14個+移動量の読み+時刻スライダーが存在する', r.all, JSON.stringify(r));
  }

  // B2: 観測点移動のプレビュー(北向きで前/右/上→ENUに積み上がり・カメラだけ動き・位置情報は不変)
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      if(!appState.isSoramadoActive) toggleSoramado();
      await new Promise(r=>setTimeout(r,400));
      appState.soraBaseAz=0; appState.soraOffsetAz=0;   // 真北向き
      const lat0=appState.start.lat, lng0=appState.start.lng, h0=appState.startHeight;
      document.getElementById('btn-sora-move-fwd').click();     // 北+1m
      document.getElementById('btn-sora-move-right').click();   // 東+1m
      document.getElementById('btn-sora-move-up').click();      // 上+1m
      await new Promise(r=>setTimeout(r,100));
      return {
        nudge: {..._smObsNudge},
        cam: { x:+_smCamera.position.x.toFixed(6), y:+_smCamera.position.y.toFixed(6), z:+_smCamera.position.z.toFixed(6) },
        readout: document.getElementById('sora-move-readout').textContent,
        startUnchanged: appState.start.lat===lat0 && appState.start.lng===lng0 && appState.startHeight===h0
      };
    });
    const okN = Math.abs(r.nudge.e-1)<1e-9 && Math.abs(r.nudge.n-1)<1e-9 && r.nudge.u===1;
    check('B2 前/右/上の各1mがENUに積もり、カメラだけ(1,1,1)へ動き、位置情報は不変',
      okN && r.cam.x===1 && r.cam.y===1 && r.cam.z===1 && r.startUnchanged, JSON.stringify(r));
    // 第98ラウンドの意図更新: 読みの並びを移動ボタンと同順(上・前・右)へ(依頼者指定)
    check('B2 移動量の読み(上+1.0m 前+1.0m 右+1.0m)', r.readout==='移動中: 上+1.0m 前+1.0m 右+1.0m', r.readout);
  }

  // B3: リセットで移動が消える(読みも空・カメラも原点へ)
  {
    const r=await p.evaluate(async()=>{
      document.getElementById('btn-sora-move-reset').click();
      await new Promise(r=>setTimeout(r,100));
      return { nudge: {..._smObsNudge}, readout: document.getElementById('sora-move-readout').textContent,
               cam: { x:_smCamera.position.x, y:_smCamera.position.y, z:_smCamera.position.z } };
    });
    check('B3 リセット→移動0・読み空欄・カメラ原点', !r.nudge.e&&!r.nudge.n&&!r.nudge.u&&r.readout===''&&!r.cam.x&&!r.cam.y&&!r.cam.z, JSON.stringify(r));
  }

  // B4: 前後左右はカメラの向き基準(東向きで「前」→東へ1m)
  {
    const r=await p.evaluate(async()=>{
      appState.soraBaseAz=90; appState.soraOffsetAz=0;   // 真東向き
      document.getElementById('btn-sora-move-fwd').click();
      await new Promise(r=>setTimeout(r,50));
      const n={..._smObsNudge};
      document.getElementById('btn-sora-move-reset').click();
      return n;
    });
    check('B4 東向きの「前▲」は東へ1m(e≈1, n≈0)', Math.abs(r.e-1)<1e-9&&Math.abs(r.n)<1e-9, JSON.stringify(r));
  }

  // B5: 位置反映(緯度経度高さへ確定・地面標高は引き直し・基準方位角/視高度は新位置→目的点で再計算)
  {
    const r=await p.evaluate(async()=>{
      getElevation = async () => 123;   // 移動先の地面標高(モック)
      const lat0=appState.start.lat, lng0=appState.start.lng, h0=Number(appState.startHeight)||0;
      _smObsNudge = { e: 3, n: 4, u: 2 };
      await _smObsNudgeApply();
      const expLat = lat0 + 4/111320;
      const expLng = lng0 + 3/(111320*Math.cos(lat0*Math.PI/180));
      const expAz = calculateBearing(appState.start.lat, appState.start.lng, appState.end.lat, appState.end.lng);
      return {
        latOk: Math.abs(appState.start.lat-expLat)<1e-12, lngOk: Math.abs(appState.start.lng-expLng)<1e-12,
        apiElev: appState.startApiElev, height: appState.startHeight, elev: appState.start.elev,
        h0, nudge: {..._smObsNudge},
        baseAzOk: Math.abs(Number(appState.soraBaseAz)-expAz)<1e-9,
        readout: document.getElementById('sora-move-readout').textContent
      };
    });
    check('B5 位置反映: 緯度経度が3m東4m北へ・地面標高123へ引き直し・観測点高+2m・移動は0へ',
      r.latOk&&r.lngOk&&r.apiElev===123&&r.height===r.h0+2&&Math.abs(r.elev-(123+r.height))<1e-9&&
      !r.nudge.e&&!r.nudge.n&&!r.nudge.u&&r.readout==='', JSON.stringify(r));
    check('B5 基準方位角が新しい観測点→目的点で再計算されている', r.baseAzOk, JSON.stringify({baseAzOk:r.baseAzOk}));
  }

  // B6: カメラ向きボタン(即時反映・入力欄追従・リセットで押す前へ・カメラ反映で確定)
  {
    const r=await p.evaluate(async()=>{
      appState.soraOffsetAz=0; appState.soraOffsetAlt=0; _smCamNudgeBase=null; soraSyncUI();
      document.getElementById('btn-sora-cam-right').click();
      document.getElementById('btn-sora-cam-right').click();
      await new Promise(r=>setTimeout(r,50));
      const az2 = appState.soraOffsetAz;
      const shown = document.getElementById('input-sora-ctrl-offset-az').value;
      document.getElementById('btn-sora-cam-left').click();
      const az1 = appState.soraOffsetAz;
      document.getElementById('btn-sora-cam-reset').click();
      const azReset = appState.soraOffsetAz;
      document.getElementById('btn-sora-cam-up').click();
      const alt1 = appState.soraOffsetAlt;
      document.getElementById('btn-sora-cam-apply').click();
      document.getElementById('btn-sora-cam-reset').click();   // 確定後のリセットは効かない
      const altAfter = appState.soraOffsetAlt;
      return { az2, shown, az1, azReset, alt1, altAfter };
    });
    check('B6 📷右×2→+2°(入力欄2.0000)・📷左→+1°・リセット→0°',
      r.az2===2&&r.shown==='2.0000'&&r.az1===1&&r.azReset===0, JSON.stringify(r));
    check('B6 📷上→+1°をカメラ反映→以後のリセットで戻らない', r.alt1===1&&r.altAfter===1, JSON.stringify({alt1:r.alt1,after:r.altAfter}));
  }

  // B7: 全天儀ctrlの時刻スライダー(スライダー→日時・日時→スライダーの双方向)
  {
    const r=await p.evaluate(async()=>{
      const sl=document.getElementById('input-mwctrl-time-slider');
      sl.value='130'; sl.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(r=>setTimeout(r,100));
      const t=appState.currentDate;
      const set={ h:t.getHours(), m:t.getMinutes(), s:t.getSeconds(),
                  main: document.getElementById('time-slider').value,
                  timeInput: document.getElementById('time-input').value };
      addMinute(5);
      await new Promise(r=>setTimeout(r,100));
      return { set, after: sl.value };
    });
    check('B7 スライダー130→2:10:00(メインの時刻スライダー/時刻欄も追従)',
      r.set.h===2&&r.set.m===10&&r.set.s===0&&r.set.main==='130'&&r.set.timeInput==='02:10:00', JSON.stringify(r.set));
    check('B7 日時側を+5分→全天儀ctrlスライダーが135へ追従', r.after==='135', r.after);
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
