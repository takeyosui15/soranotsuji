// 第97ラウンド検証: v1.79.0
// ご確認フィードバックへの対応: ①ctrlのNowボタンの縦ラインずれ(46px固定でスペーサーと一致)
//   ②移動量の読みの文字サイズ(タイムゾーン表示と同じ継承サイズ)
//   ③宙検索(ss系)キーの発行を封鎖に連動(公開ビルド=発行しない/?forecast=1=発行する)
//   ④ご報告のあった「ショートカットに時刻・視高度が出ない」の再現確認(パネルを実際に開いて実測。
//     現行ビルドでは値が入ることの裏取り=キャッシュ起因の切り分け)。
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

// ---- V0: 版数の存在検査(版数ピンは最新のverify163へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.79.0の行がある', src.includes('Version 1.79.0 - ') || !!process.argv[2]);
check('V1 ssの発行は封鎖に連動する形', src.includes('if (inc.ss && FEATURE_FORECAST_ENABLED)'));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof toggleMilkyWayInstrument==='function',{timeout:8000});
  await p.waitForTimeout(600);

  // C1: Nowボタンの縦ライン(両ctrlともNow=46px=スペーサー幅。日付/時刻ピッカーの左端が揃う)
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      const meas=(nowId, spacerSel, dateId, timeId)=>{
        const now=document.getElementById(nowId);
        const spacer=document.querySelector(spacerSel);
        const d=document.getElementById(dateId), t=document.getElementById(timeId);
        return { now: now.offsetWidth, spacer: spacer.offsetWidth,
                 dLeft: d.getBoundingClientRect().left, tLeft: t.getBoundingClientRect().left };
      };
      // 全天儀を開いてctrlも開く
      toggleMilkyWayInstrument();
      document.getElementById('milkyway-ctrl-header').click();
      await new Promise(r=>setTimeout(r,400));
      const mw=meas('btn-mw-ctrl-now','#milkyway-ctrl-body .spacer-btn-now','mw-ctrl-date','mw-ctrl-time');
      document.getElementById('milkyway-ctrl-header').click();
      toggleMilkyWayInstrument();
      // 宙の窓を開いてctrlも開く
      toggleSoramado();
      document.getElementById('soramado-ctrl-header').click();
      await new Promise(r=>setTimeout(r,600));
      const sora=meas('btn-sora-ctrl-now','#soramado-ctrl-body .spacer-btn-now','sora-ctrl-date','sora-ctrl-time');
      // 移動量の読みの文字サイズ(タイムゾーン表示と同じ継承サイズ)
      const fs1=getComputedStyle(document.getElementById('sora-move-readout')).fontSize;
      const fs2=getComputedStyle(document.getElementById('tz-info-label-ctrl')).fontSize;
      document.getElementById('soramado-ctrl-header').click();
      toggleSoramado();
      await new Promise(r=>setTimeout(r,200));
      // 本家(日時情報メニュー)の基準: Nowボタン幅=スペーサー幅(メニューが畳まれていても読めるcomputed値で)
      const main={ now: getComputedStyle(document.getElementById('btn-now')).width,
                   spacer: getComputedStyle(document.querySelector('#sec-datetime .spacer-btn-now')).width };
      return { mw, sora, main, fs1, fs2 };
    });
    const ok=(m)=>m.now===46 && m.spacer===46 && Math.abs(m.dLeft-m.tLeft)<0.5;
    check('C1 本家のNow=スペーサー=46px(参照)', r.main.now==='46px'&&r.main.spacer==='46px', JSON.stringify(r.main));
    check('C1 全天儀ctrl: Now=46px・日付/時刻ピッカーの左端が一致(縦ラインが揃う)', ok(r.mw), JSON.stringify(r.mw));
    check('C1 宙の窓ctrl: Now=46px・日付/時刻ピッカーの左端が一致(縦ラインが揃う)', ok(r.sora), JSON.stringify(r.sora));
    check('C2 移動量の読みの文字サイズ=タイムゾーン表示と同じ', r.fs1===r.fs2, `${r.fs1} vs ${r.fs2}`);
  }

  // C3: 公開ビルドではss系キーを発行しない(full/他プロファイルとも)
  {
    const r=await p.evaluate(()=>{
      const full=buildCommonUrlParams('fixed');
      const keys=[...full.keys()].filter(k=>k.startsWith('ss'));
      return { ssKeys: keys, hasFw: full.has('fwFreq'), hasSora: full.has('soraFocal') };
    });
    check('C3 公開ビルドの位置情報URL(full)にss系キーが1つも無い(他のキーは従来どおり)',
      r.ssKeys.length===0&&r.hasFw&&r.hasSora, JSON.stringify(r));
  }

  // C4: ショートカットの時刻・視高度(パネルを実際に開いた状態での実測=ご報告の再現確認)
  {
    const r=await p.evaluate(async()=>{
      toggleMilkyWayInstrument();
      document.getElementById('milkyway-ctrl-header').click();
      await new Promise(r=>setTimeout(r,400));
      const txt=id=>document.getElementById(id).innerText;
      const mw={ t: txt('time-sunrise-mwctrl'), a: txt('alt-sunrise-mwctrl'), main: txt('time-sunrise') };
      document.getElementById('milkyway-ctrl-header').click();
      toggleMilkyWayInstrument();
      toggleSoramado();
      document.getElementById('soramado-ctrl-header').click();
      await new Promise(r=>setTimeout(r,600));
      const sora={ t: txt('time-sunrise-ctrl'), a: txt('alt-sunrise-ctrl') };
      document.getElementById('soramado-ctrl-header').click();
      toggleSoramado();
      await new Promise(r=>setTimeout(r,200));
      return { mw, sora };
    });
    check('C4 全天儀ctrlのショートカットに実時刻+視高度が入っている(開いた状態の実測)',
      r.mw.t!=='--:--'&&r.mw.t===r.mw.main&&r.mw.a!=='--', JSON.stringify(r.mw));
    check('C4 宙の窓ctrlのショートカットにも実時刻+視高度が入っている',
      r.sora.t!=='--:--'&&r.sora.a!=='--', JSON.stringify(r.sora));
  }

  check('E1 ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();

  // C5: ?forecast=1の開発時はss系キーを発行する(封鎖解除時の従来動作)
  {
    const ctx2=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
    await ctx2.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    const p2=await ctx2.newPage();
    await p2.goto(BASE+'/index.html?forecast=1',{waitUntil:'load'});
    await p2.waitForFunction(()=>typeof buildCommonUrlParams==='function',{timeout:8000});
    await p2.waitForTimeout(600);
    const r=await p2.evaluate(()=>{
      const full=buildCommonUrlParams('fixed');
      return { ss: full.has('ssPreset')&&full.has('ssStat'), n: [...full.keys()].filter(k=>k.startsWith('ss')).length };
    });
    await ctx2.close();
    check('C5 ?forecast=1ではss系キーを発行する(開発時の従来動作)', r.ss&&r.n>=20, JSON.stringify(r));
  }

  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
