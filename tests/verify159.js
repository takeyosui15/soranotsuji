// 第94ラウンド検証: v1.76.0
// まとめ確認への対応 第2陣: ①全天儀ctrlメニューも日時情報〜薄明メニューの完全な複製に
//   (TZ表示・Now・ショートカット4・月齢行・薄明ジャンプを追加=複製id末尾-mwctrl。
//    表示はsetTの3面書き込み・選択は_mirrorTimeJumpの3面連動)
//   ②宙の窓ctrl/全天儀ctrlの日の出〜月の入ショートカットの横幅を他の段と同じ360px中央寄せに
//   (全幅に伸びてコントロールの縦枠からはみ出していた修正)。
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

// ---- V0: 版数の存在検査(版数ピンは最新のverify160へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.76.0の行がある', src.includes('Version 1.76.0 - ') || !!process.argv[2]);

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof toggleMilkyWayInstrument==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // C1: 複製部品が揃っている(第94で足した分)
  {
    const r=await p.evaluate(()=>{
      const ids=['tz-info-label-mwctrl','btn-mw-ctrl-now',
        'jump-mwctrl-sunrise','jump-mwctrl-sunset','jump-mwctrl-moonrise','jump-mwctrl-moonset',
        'time-sunrise-mwctrl','alt-sunrise-mwctrl','time-moonset-mwctrl','alt-moonset-mwctrl',
        'btn-mw-ctrl-moon-prev','btn-mw-ctrl-moon-next','moon-age-input-mwctrl','moon-icon-mwctrl',
        'mw-ctrl-twilight'];
      const tw=document.querySelectorAll('#mw-ctrl-twilight input[name="time-jump-mwctrl"]').length;
      const grp=document.querySelectorAll('input[name="time-jump-mwctrl"]').length;
      return { all: ids.every(id=>document.getElementById(id)!==null),
               missing: ids.filter(id=>!document.getElementById(id)), tw, grp };
    });
    check('C1 複製部品15個(TZ/Now/ショートカット4+表示/月齢行/薄明ホスト)が存在', r.all, JSON.stringify(r.missing));
    check('C1 薄明ジャンプ14項目が生成され、ラジオグループは計18個(4+14)', r.tw===14&&r.grp===18, JSON.stringify({tw:r.tw,grp:r.grp}));
  }

  // C2: 並び順(日時情報メニューと同じ: TZ→日付→時刻→アニメ→スライダー→ショートカット→月齢→薄明→既存の表示天体)
  {
    const r=await p.evaluate(()=>{
      const row=id=>{ const el=document.getElementById(id); return el && (el.closest('.control-row')||el.closest('.shortcuts')||el); };
      const seq=[row('tz-info-label-mwctrl'), row('mw-ctrl-date'), row('mw-ctrl-time'),
        row('btn-mw-ctrl-speed-month'), row('input-mwctrl-time-slider'),
        document.querySelector('#milkyway-ctrl-body .shortcuts'), row('moon-age-input-mwctrl'),
        document.getElementById('mw-ctrl-twilight'), row('chk-mwctrl-bodies')];
      if (seq.some(x=>!x)) return { ok:false, why:'missing row' };
      const ordered=seq.every((el,i)=> i===0 ||
        (seq[i-1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
      return { ok: ordered };
    });
    check('C2 並び順がTZ→日付→時刻→アニメ→スライダー→ショートカット→月齢→薄明→表示天体', r.ok, JSON.stringify(r));
  }

  // C3: TZ表示が本家と一致+Nowボタン
  {
    const r=await p.evaluate(async()=>{
      const tz={ main: document.getElementById('tz-info-label').textContent,
                 mw: document.getElementById('tz-info-label-mwctrl').textContent };
      window.confirm=()=>true; window.alert=()=>{};
      appState.currentDate=new Date(2026,0,1,0,0,0);
      syncUIFromState(); updateAll();
      document.getElementById('btn-mw-ctrl-now').click();
      await new Promise(r=>setTimeout(r,100));
      return { tz, diffMs: Math.abs(appState.currentDate.getTime()-Date.now()) };
    });
    check('C3 TZ表示が本家と一致(Asia/Tokyo)', r.tz.main===r.tz.mw && r.tz.main.includes('Asia/Tokyo'), JSON.stringify(r.tz));
    check('C3 mwctrlのNow→現在日時へ(5秒以内)', r.diffMs<5000, JSON.stringify({diffMs:r.diffMs}));
  }

  // C4: ショートカット(表示が本家と一致・ジャンプ・選択の3面連動)
  {
    const r=await p.evaluate(async()=>{
      const txt=id=>document.getElementById(id).innerText;
      const dispOk = txt('time-sunrise-mwctrl')===txt('time-sunrise') && txt('time-sunrise')!=='--:--' &&
                     txt('alt-sunrise-mwctrl')===txt('alt-sunrise') &&
                     txt('time-moonset-mwctrl')===txt('time-moonset');
      document.getElementById('jump-mwctrl-sunrise').click();
      await new Promise(r=>setTimeout(r,100));
      const jumped = currentRiseSetData.sunrise && Math.abs(appState.currentDate.getTime()-currentRiseSetData.sunrise.getTime())<1000;
      const mainMirror = document.getElementById('jump-sunrise').checked;
      const soraMirror = document.getElementById('jump-ctrl-sunrise').checked;
      document.getElementById('jump-sunset').click();   // 本家側で選択
      await new Promise(r=>setTimeout(r,100));
      const mwMirror = document.getElementById('jump-mwctrl-sunset').checked;
      document.getElementById('jump-ctrl-moonrise').click();   // 宙の窓ctrl側で選択
      await new Promise(r=>setTimeout(r,100));
      const mwMirror2 = document.getElementById('jump-mwctrl-moonrise').checked;
      return { dispOk, jumped, mainMirror, soraMirror, mwMirror, mwMirror2 };
    });
    check('C4 表示が本家と一致し、mwctrl側ジャンプで日の出時刻へ+本家/宙の窓ctrlのラジオも選択',
      r.dispOk&&r.jumped&&r.mainMirror&&r.soraMirror, JSON.stringify(r));
    check('C4 本家側/宙の窓ctrl側の選択もmwctrl側に映る(3面相互連動)', r.mwMirror&&r.mwMirror2,
      JSON.stringify({mwMirror:r.mwMirror,mwMirror2:r.mwMirror2}));
  }

  // C5: 薄明ジャンプ(表示複製+ジャンプ+3面連動)
  {
    const r=await p.evaluate(async()=>{
      const txt=id=>document.getElementById(id).innerText;
      const dispOk = txt('time-astro-dawn-mwctrl')===txt('time-astro-dawn') && txt('time-astro-dawn')!=='--:--' &&
                     txt('time-higure-mwctrl')===txt('time-higure');
      const t0=appState.currentDate.getTime();
      document.getElementById('jump-mwctrl-astro_dawn').click();
      await new Promise(r=>setTimeout(r,150));
      const moved = appState.currentDate.getTime()!==t0;
      const mainMirror = document.getElementById('jump-astro_dawn') ? document.getElementById('jump-astro_dawn').checked
        : document.querySelector('input[name="time-jump"][value="astro_dawn"]').checked;
      const soraMirror = document.getElementById('jump-ctrl-astro_dawn').checked;
      return { dispOk, moved, mainMirror, soraMirror };
    });
    check('C5 薄明ジャンプの表示が本家と一致し、mwctrl側で天文薄明[始]へジャンプ+2面のラジオも選択',
      r.dispOk&&r.moved&&r.mainMirror&&r.soraMirror, JSON.stringify(r));
  }

  // C6: 月齢行(表示連動・▶︎で次の同月齢・入力でその月齢へ)
  {
    const r=await p.evaluate(async()=>{
      const disp = { v: document.getElementById('moon-age-input-mwctrl').value,
                     mv: document.getElementById('moon-age-input').value,
                     ic: document.getElementById('moon-icon-mwctrl').innerText,
                     mic: document.getElementById('moon-icon').innerText };
      const age0=appState.moonAge, t0=appState.currentDate.getTime();
      document.getElementById('btn-mw-ctrl-moon-next').click();
      await new Promise(r=>setTimeout(r,300));
      const days=(appState.currentDate.getTime()-t0)/86400000;
      const nextOk = days>25 && days<35 && Math.abs(appState.moonAge-age0)<0.5;
      const inp=document.getElementById('moon-age-input-mwctrl');
      inp.value='14.8'; inp.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,300));
      const jumpOk = Math.abs(appState.moonAge-14.8)<0.3;
      return { disp, nextOk, days:+days.toFixed(1), jumpOk, age:appState.moonAge };
    });
    check('C6 月齢の表示が本家と一致', r.disp.v===r.disp.mv&&r.disp.ic===r.disp.mic&&r.disp.v!=='', JSON.stringify(r.disp));
    check('C6 mwctrlの▶︎で次の同月齢(約29.5日先)・月齢入力14.8でその月齢へ', r.nextOk&&r.jumpOk, JSON.stringify({days:r.days,age:r.age}));
  }

  // C7: ショートカットの横幅(両ctrlとも他の段と同じ360px中央寄せに収まる=はみ出し修正)
  {
    const r=await p.evaluate(async()=>{
      const meas=()=>{
        const out={};
        for (const [key,sel] of [['sora','#soramado-ctrl-body'],['mw','#milkyway-ctrl-body']]) {
          const body=document.querySelector(sel);
          const sc=body.querySelector('.shortcuts');
          const row=body.querySelector('.control-row');
          out[key]={ w:sc.offsetWidth, rowW:row.offsetWidth, bodyW:body.clientWidth,
                     centered: Math.abs((sc.offsetLeft)-(row.offsetLeft))<2 };
        }
        return out;
      };
      // 全天儀を開いてctrlも開く
      toggleMilkyWayInstrument();
      document.getElementById('milkyway-ctrl-header').click();
      await new Promise(r=>setTimeout(r,400));
      const mwOpen=meas().mw;
      document.getElementById('milkyway-ctrl-header').click();
      toggleMilkyWayInstrument();
      // 宙の窓を開いてctrlも開く
      toggleSoramado();
      document.getElementById('soramado-ctrl-header').click();
      await new Promise(r=>setTimeout(r,600));
      const soraOpen=meas().sora;
      document.getElementById('soramado-ctrl-header').click();
      toggleSoramado();
      await new Promise(r=>setTimeout(r,200));
      return { mwOpen, soraOpen };
    });
    const ok=(m)=>m.bodyW>400 && m.w<=360 && m.w===m.rowW && m.centered;
    check('C7 全天儀ctrlのショートカット幅=他の段と同じ(360px以内・中央寄せ)', ok(r.mwOpen), JSON.stringify(r.mwOpen));
    check('C7 宙の窓ctrlのショートカット幅=他の段と同じ(360px以内・中央寄せ=はみ出し修正)', ok(r.soraOpen), JSON.stringify(r.soraOpen));
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
