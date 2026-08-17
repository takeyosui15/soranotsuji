// 第33ラウンド検証: 予測系機能の一時封鎖(宙検索/My宙検索/宙断面)+地図ボタンのアイコン中心ズレ修正
// 既定ページ: 3機能のUIが非表示・実行ガード・Myセット4シート(My宙検索タブを作らない)・
// リリース対象(全天儀/辻メッシュ/宙の窓/Myセット)は表示。?forecast=1: 全て表示+5シート。
// あわせて⌖/レイヤ切替アイコンの中央寄せ(flex)を画素で検証する。
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
  // 版数ピンは最新のverify(現在は118)のみに置く(テスト方針)。ここでは存在だけ確認する
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    check('W0 APP_VERSIONが定義されている', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
  }
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });

  // ---- 既定ページ(封鎖) ----
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:10000});
  await p.waitForTimeout(600);

  // W1: 3機能のUIがDOMに存在しない(第34ラウンドでindex.htmlから物理削除。詳細検証はverify118)
  {
    const r=await p.evaluate(()=>({
      flag: FEATURE_FORECAST_ENABLED,
      gone: ['sec-sorasearch','sec-mysora','btn-soradanmen','sorasearch-panel','soradanmen-panel']
        .every(id=>!document.getElementById(id)),
      switchTitle: document.getElementById('btn-myset-switch').title,
    }));
    check('W1 宙検索/My宙検索/宙断面のUIがDOMに存在しない', !r.flag&&r.gone, JSON.stringify(r));
    check('W1 Myセット説明からMy宙検索が外れる', /My天体を切り替えます/.test(r.switchTitle)&&!/My宙検索/.test(r.switchTitle), r.switchTitle);
  }

  // W2: 実行ガード(直接呼び出しても動かない)+Myセット4シート
  {
    const r=await p.evaluate(async()=>{
      toggleSoradanmen();
      await new Promise(res=>setTimeout(res,400));
      const sdBlocked=_sdMap===null&&!appState.isSoradanmenActive;
      await soraSearchRun();
      const ssBlocked=!appState.isSoraSearchActive&&_ssLast===null;
      return { sdBlocked, ssBlocked, sheets: MYSET_SHEET_NAMES.join(','), n: MYSET_SHEET_NAMES.length };
    });
    check('W2 宙断面/宙検索は直接呼んでも実行されない', r.sdBlocked&&r.ssBlocked);
    check('W2 Myセットは4シート構成(My宙検索タブを作らない)', r.n===4&&r.sheets==='My辻検索,My観測点,My目的点,My天体', r.sheets);
  }

  // W3: リリース対象の入り口は表示されている(全天儀/辻メッシュ/宙の窓/Myセット/辻検索)
  {
    const r=await p.evaluate(()=>{
      const visible=(id)=>{ const el=document.getElementById(id); return !!el&&!el.classList.contains('hidden')&&getComputedStyle(el).display!=='none'; };
      return { mw: visible('btn-milkyway'), tm: visible('btn-tsujimesh'), sm: visible('btn-soramado'),
               myset: !!document.getElementById('btn-myset-switch'), tsuji: visible('btn-tsuji-search')||!!document.getElementById('sec-tsujisearch') };
    });
    check('W3 リリース対象(全天儀/辻メッシュ/宙の窓/Myセット)の入り口は表示', r.mw&&r.tm&&r.sm&&r.myset, JSON.stringify(r));
  }

  // W4: アイコン中心ズレ修正(⌖/レイヤ切替: flex中央寄せ+SVG中心=ボタン中心±1.5px)
  {
    const r=await p.evaluate(()=>{
      const test=(sel)=>{
        const a=document.querySelector(sel);
        if(!a) return { ok:false, why:'no el' };
        const cs=getComputedStyle(a);
        const svg=a.querySelector('svg');
        const ar=a.getBoundingClientRect(), sr=svg.getBoundingClientRect();
        const dx=Math.abs((sr.left+sr.width/2)-(ar.left+ar.width/2));
        const dy=Math.abs((sr.top+sr.height/2)-(ar.top+ar.height/2));
        return { ok: cs.display==='flex'&&dx<1.5&&dy<1.5, dx:+dx.toFixed(2), dy:+dy.toFixed(2), disp:cs.display };
      };
      return { center: test('#map-center-point'), layer: test('#gl-layer-toggle') };
    });
    check('W4 ⌖アイコンがボタン中央(flex・±1.5px)', r.center.ok, JSON.stringify(r.center));
    check('W4 レイヤ切替アイコンがボタン中央(flex・±1.5px)', r.layer.ok, JSON.stringify(r.layer));
  }

  check('W5 既定ページエラーなし', errs.length===0, errs.slice(0,3).join(' | '));
  await p.close();

  // ---- ?forecast=1(開発時の表示) ----
  {
    const p2=await ctx.newPage();
    const errs2=[]; p2.on('pageerror',e=>errs2.push(e.message));
    await p2.goto(BASE+'/index.html?forecast=1',{waitUntil:'load'});
    await p2.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:10000});
    await p2.waitForTimeout(600);
    const r=await p2.evaluate(async()=>{
      const shown=(id)=>{ const el=document.getElementById(id); return !!el&&!el.classList.contains('hidden'); };
      toggleSoradanmen();
      await new Promise(res=>setTimeout(res,600));
      const sdOpened=_sdMap!==null;
      toggleSoradanmen();
      return { flag: FEATURE_FORECAST_ENABLED, sora: shown('sec-sorasearch'), mysora: shown('sec-mysora'),
               sdBtn: shown('btn-soradanmen'), sheets: MYSET_SHEET_NAMES.length, sdOpened };
    });
    check('W6 ?forecast=1で3機能表示+5シート+宙断面が開く', r.flag&&r.sora&&r.mysora&&r.sdBtn&&r.sheets===5&&r.sdOpened, JSON.stringify(r));
    check('W6 ?forecast=1ページエラーなし', errs2.length===0, errs2.slice(0,2).join(' | '));
    await p2.close();
  }

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
