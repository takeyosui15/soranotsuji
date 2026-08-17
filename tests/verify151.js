// 第84ラウンド検証: v1.68.0
// 怒号の項目9: 宙の窓ctrlメニューへ日時情報〜薄明メニューの丸ごと複製(+連動)。
//   既存の部分複製(日付/時刻ピッカー・薄明ジャンプ)に、TZ表示・Now・アニメーション4ボタン・
//   時刻スライダー・日の出/日の入/月の出/月の入ショートカット・月齢行を足して完成形。
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

// ---- V0: 版数の存在検査(版数ピンは最新のverify152へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.68.0の行がある', src.includes('Version 1.68.0 - ') || !!process.argv[2]);

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof toggleSoramado==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // C1: 複製部品が揃っている
  {
    const r=await p.evaluate(()=>{
      const ids=['tz-info-label-ctrl','btn-sora-ctrl-now',
        'btn-sora-ctrl-speed-month','btn-sora-ctrl-speed-day','btn-sora-ctrl-speed-hour','btn-sora-ctrl-speed-min',
        'input-sora-ctrl-time-slider',
        'jump-ctrl-sunrise','jump-ctrl-sunset','jump-ctrl-moonrise','jump-ctrl-moonset',
        'time-sunrise-ctrl','alt-sunrise-ctrl','time-moonset-ctrl','alt-moonset-ctrl',
        'btn-sora-ctrl-moon-prev','btn-sora-ctrl-moon-next','moon-age-input-ctrl','moon-icon-ctrl'];
      return { all: ids.every(id=>document.getElementById(id)!==null),
               missing: ids.filter(id=>!document.getElementById(id)) };
    });
    check('C1 複製部品19個(TZ/Now/速度4/スライダー/ショートカット4+表示/月齢行)が存在', r.all, JSON.stringify(r.missing));
  }

  // C2: タイムゾーン表示が本家と同じ
  {
    const r=await p.evaluate(()=>({
      main: document.getElementById('tz-info-label').textContent,
      ctrl: document.getElementById('tz-info-label-ctrl').textContent }));
    check('C2 TZ表示が本家と一致(Asia/Tokyo)', r.main===r.ctrl && r.main.includes('Asia/Tokyo'), JSON.stringify(r));
  }

  // C3: Nowボタン(現在日時へ)
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      appState.currentDate=new Date(2026,0,1,0,0,0);
      syncUIFromState(); updateAll();
      document.getElementById('btn-sora-ctrl-now').click();
      await new Promise(r=>setTimeout(r,100));
      return { diffMs: Math.abs(appState.currentDate.getTime()-Date.now()) };
    });
    check('C3 ctrlのNow→現在日時へ(5秒以内)', r.diffMs<5000, JSON.stringify(r));
  }

  // C4: アニメーションボタンの3面連動(押した面に関係なくアクティブが揃う)
  {
    const r=await p.evaluate(async()=>{
      const act=id=>document.getElementById(id).classList.contains('active');
      document.getElementById('btn-sora-ctrl-speed-min').click();   // ctrl側で開始
      const on={ main:act('btn-speed-min'), mw:act('btn-mw-ctrl-speed-min'), sora:act('btn-sora-ctrl-speed-min'),
                 moving:appState.isMoving, speed:appState.moveSpeed };
      document.getElementById('btn-sora-ctrl-speed-min').click();   // 同じボタンで停止
      const off={ main:act('btn-speed-min'), mw:act('btn-mw-ctrl-speed-min'), sora:act('btn-sora-ctrl-speed-min'),
                  moving:appState.isMoving };
      document.getElementById('btn-speed-hour').click();            // 本家側で開始(従来は複製が置いて行かれた向き)
      const on2={ mw:act('btn-mw-ctrl-speed-hour'), sora:act('btn-sora-ctrl-speed-hour') };
      document.getElementById('btn-speed-hour').click();            // 停止
      return { on, off, on2 };
    });
    check('C4 ctrl側で開始→3面点灯・停止→3面消灯', r.on.main&&r.on.mw&&r.on.sora&&r.on.moving&&r.on.speed==='min'&&
      !r.off.main&&!r.off.mw&&!r.off.sora&&!r.off.moving, JSON.stringify(r.on)+JSON.stringify(r.off));
    check('C4 本家側で開始しても複製2面が点灯(従来の穴の修正)', r.on2.mw&&r.on2.sora, JSON.stringify(r.on2));
  }

  // C5: 時刻スライダー3本の双方向連動
  {
    const r=await p.evaluate(async()=>{
      const sl=document.getElementById('input-sora-ctrl-time-slider');
      sl.value='130'; sl.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(r=>setTimeout(r,100));
      const t=appState.currentDate;
      const set={ h:t.getHours(), m:t.getMinutes(), s:t.getSeconds(),
                  main: document.getElementById('time-slider').value,
                  mw: document.getElementById('input-mwctrl-time-slider').value };
      addMinute(5);
      await new Promise(r=>setTimeout(r,100));
      return { set, after: sl.value };
    });
    check('C5 宙の窓ctrlスライダー130→2:10:00(本家/全天儀ctrlのスライダーも130)',
      r.set.h===2&&r.set.m===10&&r.set.s===0&&r.set.main==='130'&&r.set.mw==='130', JSON.stringify(r.set));
    check('C5 日時側+5分→宙の窓ctrlスライダーが135へ追従', r.after==='135', r.after);
  }

  // C6: ショートカット(表示が本家と一致・ジャンプ・選択の相互連動)
  {
    const r=await p.evaluate(async()=>{
      const txt=id=>document.getElementById(id).innerText;
      const dispOk = txt('time-sunrise-ctrl')===txt('time-sunrise') && txt('time-sunrise')!=='--:--' &&
                     txt('alt-sunrise-ctrl')===txt('alt-sunrise') &&
                     txt('time-moonset-ctrl')===txt('time-moonset');
      document.getElementById('jump-ctrl-sunrise').click();
      await new Promise(r=>setTimeout(r,100));
      const jumped = currentRiseSetData.sunrise && Math.abs(appState.currentDate.getTime()-currentRiseSetData.sunrise.getTime())<1000;
      const mainMirror = document.getElementById('jump-sunrise').checked;
      const mainSS=document.getElementById('jump-sunset');
      mainSS.click();
      await new Promise(r=>setTimeout(r,100));
      const ctrlMirror = document.getElementById('jump-ctrl-sunset').checked;
      return { dispOk, jumped, mainMirror, ctrlMirror };
    });
    check('C6 ショートカット表示が本家と一致し、ctrl側ジャンプで日の出時刻へ+本家ラジオも選択',
      r.dispOk&&r.jumped&&r.mainMirror, JSON.stringify(r));
    check('C6 本家側の選択がctrl側にも映る(相互連動)', r.ctrlMirror, JSON.stringify({ctrlMirror:r.ctrlMirror}));
  }

  // C7: 月齢行(表示連動・◀︎▶︎で前後の同月齢・入力でその月齢へ)
  {
    const r=await p.evaluate(async()=>{
      const disp = { v: document.getElementById('moon-age-input-ctrl').value,
                     mv: document.getElementById('moon-age-input').value,
                     ic: document.getElementById('moon-icon-ctrl').innerText,
                     mic: document.getElementById('moon-icon').innerText };
      const age0=appState.moonAge, t0=appState.currentDate.getTime();
      document.getElementById('btn-sora-ctrl-moon-next').click();
      await new Promise(r=>setTimeout(r,300));
      const days=(appState.currentDate.getTime()-t0)/86400000;
      const nextOk = days>25 && days<35 && Math.abs(appState.moonAge-age0)<0.5;
      const inp=document.getElementById('moon-age-input-ctrl');
      inp.value='14.8'; inp.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,300));
      const jumpOk = Math.abs(appState.moonAge-14.8)<0.3;
      return { disp, nextOk, days:+days.toFixed(1), jumpOk, age:appState.moonAge };
    });
    check('C7 月齢の表示が本家と一致', r.disp.v===r.disp.mv&&r.disp.ic===r.disp.mic&&r.disp.v!=='', JSON.stringify(r.disp));
    check('C7 ctrlの▶︎で次の同月齢(約29.5日先)・月齢入力14.8でその月齢へ', r.nextOk&&r.jumpOk, JSON.stringify({days:r.days,age:r.age}));
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
