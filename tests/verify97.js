const { chromium } = require('playwright-core');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };
(async()=>{
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
  // U1: 天体検索/登録メニュー
  {
    const r=await p.evaluate(()=>{
      const hdr=[...document.querySelectorAll('.section-header span')].map(s=>s.textContent).find(t=>t.includes('天体検索'));
      const sec=document.getElementById('sec-starsearch');
      const rows=[...sec.querySelectorAll('.control-row')];
      const regRowIdx=rows.findIndex(r=>r.querySelector('#btn-starsearch-reg'));
      const radecRowIdx=rows.findIndex(r=>r.querySelector('#input-starsearch-radec'));
      const radecLabel=rows[radecRowIdx]&&rows[radecRowIdx].querySelector('label');
      const searchLabel=rows[0]&&rows[0].querySelector('label');
      return { hdr, regLast: regRowIdx===rows.length-1 && regRowIdx>radecRowIdx,
        radecLabel: radecLabel&&radecLabel.textContent, searchLabel: searchLabel&&searchLabel.textContent };
    });
    check('U1 menu renamed 天体検索/登録', r.hdr==='天体検索/登録', r.hdr);
    check('U1 登録 button moved after 赤経赤緯', r.regLast);
    check('U1 labels 検索天体名:/赤経赤緯:', r.searchLabel==='検索天体名:' && r.radecLabel==='赤経赤緯:', `${r.searchLabel}/${r.radecLabel}`);
  }
  // U2: 全天儀ctrlメニュー
  {
    const r=await p.evaluate(async()=>{
      appState.start={lat:36.2919,lng:137.7811,elev:1500};
      window.confirm=()=>true; window.alert=()=>{};
      toggleMilkyWayInstrument();
      await new Promise(r=>setTimeout(r,1200));
      const viewH0=document.getElementById('milkyway-view').getBoundingClientRect().height;
      document.getElementById('milkyway-ctrl-header').click();
      await new Promise(r=>setTimeout(r,300));
      const open=!document.getElementById('milkyway-ctrl-body').classList.contains('hidden');
      const viewH1=document.getElementById('milkyway-view').getBoundingClientRect().height;
      // チェック連動: ctrl→state→基本オプション
      const c=document.getElementById('chk-mwctrl-const-fig');
      c.checked=true; c.dispatchEvent(new Event('change'));
      const linked= appState.mwShowConstFig===true && document.getElementById('chk-baseopt-const-fig').checked===true;
      c.checked=false; c.dispatchEvent(new Event('change'));
      // オフセットスライダー→state+基本オプション入力
      const sl=document.getElementById('input-mwctrl-mw-offset-slider');
      sl.value='45'; sl.dispatchEvent(new Event('input'));
      const off= appState.mwOffsetAngle===45 && document.getElementById('input-baseopt-mw-offset').value==='45'
        && document.getElementById('input-mwctrl-mw-offset').value==='45';
      appState.mwOffsetAngle=0; appState.baseOptMwBase='center'; applyMilkyWayBaseChange();
      // 日付ピッカー連動(state→ctrl)
      appState.currentDate=new Date('2026-08-01T12:34:56+09:00'); syncUIFromState();
      const dt= document.getElementById('mw-ctrl-date').value==='2026-08-01' && document.getElementById('mw-ctrl-time').value==='12:34:56';
      // 速度ボタン委譲
      document.getElementById('btn-mw-ctrl-speed-day').click();
      await new Promise(r=>setTimeout(r,100));
      const moving= appState.isMoving===true && appState.moveSpeed==='day';
      const mirrored= document.getElementById('btn-mw-ctrl-speed-day').classList.contains('active');
      document.getElementById('btn-mw-ctrl-speed-day').click();   // 停止
      await new Promise(r=>setTimeout(r,100));
      const stopped= !appState.isMoving;
      document.getElementById('milkyway-ctrl-header').click();
      await new Promise(r=>setTimeout(r,200));
      toggleMilkyWayInstrument();
      return { open, shrank: viewH1<viewH0-50, linked, off, dt, moving, mirrored, stopped };
    });
    check('U2 ctrl opens and splits view 1/2', r.open && r.shrank, JSON.stringify({open:r.open,shrank:r.shrank}));
    check('U2 checkbox linked to baseopt', r.linked);
    check('U2 offset slider linked (state+baseopt+text)', r.off);
    check('U2 date/time pickers mirror state', r.dt);
    check('U2 speed button delegates + mirrors + stops', r.moving && r.mirrored && r.stopped);
  }
  // U3: フレーム同期録画(requestFrame方式)で全コマ記録+再生可
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      appState.start={lat:36.2919,lng:137.7811,elev:1500};
      window._smSyntheticElev=()=>1000;
      if(!appState.isSoramadoActive) toggleSoramado();
      await new Promise(r=>setTimeout(r,1500));
      appState.soraMovShots=10; appState.soraMovFps=5; appState.soraMovInterval=60;
      const picked=soraExpPickMime('webm');
      const t0=performance.now();
      const blob=await new Promise(res=>{ _soraRecordMovVideo(picked, 320, 240, 'export', 'test', b=>res(b)); });
      const wallMs=performance.now()-t0;
      const durOf=(bb)=>new Promise(res=>{const v=document.createElement('video');v.preload='metadata';
        v.onloadedmetadata=()=>{res(v.duration);URL.revokeObjectURL(v.src);}; v.onerror=()=>res(-1); v.src=URL.createObjectURL(bb);});
      const dur=await durOf(blob);
      const playable=await _soraVerifyBlobPlayable(blob);
      toggleSoramado();
      return { size:blob?blob.size:0, dur, playable, wallMs:Math.round(wallMs), expected:10/5 };
    });
    // 10コマ/5fps → 媒体時間2秒(±40%)。壁時間はレンダ時間分だけ長くてよい
    check('U3 frame-sync recording playable + duration ≈ n/fps', r.size>0 && r.playable && r.dur>1.0 && r.dur<3.5, `dur=${typeof r.dur==='number'?r.dur.toFixed(2):r.dur}s wall=${r.wallMs}ms size=${r.size}`);
  }
  check('pageerrors none', errs.length===0, JSON.stringify(errs.slice(0,3)));
  await p.evaluate(()=>localStorage.clear());
  await b.close();
  console.log(`\n==== TOTAL: PASS=${PASS} FAIL=${FAIL} ====`);
  process.exit(FAIL?1:0);
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
