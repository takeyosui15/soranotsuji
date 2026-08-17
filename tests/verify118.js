// 第34ラウンド検証: 封鎖UIのindex.html物理削除(forecast-features.htmlへ分離)+コントロールボタンサイズ統一
// 既定ページ: 封鎖3機能の要素がDOMに一切存在しない(スロットのみ)・アプリは正常動作。
// ?forecast=1: fetch注入で5ブロックが完全復元され、メニュー配線も効く。
// あわせて左上コントロールの全ボタンが29px正方で統一されていることを実測する。
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
  // ソース検査
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    const html=fs.readFileSync(path.join(__dirname, '..', 'index.html'),'utf8');
    const ff=fs.readFileSync(path.join(__dirname, '..', 'forecast-features.html'),'utf8');
    // 版数ピンは最新のverify(現在は119)のみに置く(テスト方針)。ここでは存在だけ確認する
    check('X0 APP_VERSIONが定義されている', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
    const gone=['btn-ss-run','sec-sorasearch','sec-mysora','btn-soradanmen','sorasearch-panel','soradanmen-panel']
      .every(id=>!html.includes(`id="${id}"`));
    const slots=['sorasearch-panel','soradanmen-panel','soradanmen-btn','sorasearch-menu','mysora-menu']
      .every(nm=>html.includes(`id="ff-slot-${nm}"`));
    const ffHas=['btn-ss-run','sec-sorasearch','sec-mysora','btn-soradanmen','sorasearch-panel','soradanmen-panel']
      .every(id=>ff.includes(`id="${id}"`));
    check('X0 index.htmlに封鎖UIの要素なし+スロット5個', gone&&slots);
    check('X0 forecast-features.htmlに5ブロックが退避されている', ffHas&&(ff.match(/<template data-ff-slot=/g)||[]).length===5);
  }
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });

  // ---- 既定ページ(封鎖UIはDOMに無い) ----
  {
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(BASE+'/index.html',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:10000});
    await p.waitForTimeout(600);
    const r=await p.evaluate(()=>{
      updateAll();
      const gone=['btn-ss-run','sec-sorasearch','sec-mysora','btn-soradanmen','sorasearch-panel','soradanmen-panel']
        .every(id=>!document.getElementById(id));
      const slotsEmpty=['sorasearch-panel','soradanmen-panel','soradanmen-btn','sorasearch-menu','mysora-menu']
        .every(nm=>{ const s2=document.getElementById('ff-slot-'+nm); return !!s2&&s2.childElementCount===0; });
      return { gone, slotsEmpty, obs: document.querySelectorAll('#map .location-marker-observer').length };
    });
    check('X1 既定: 封鎖UIの要素がDOMに存在しない(空スロットのみ)+アプリ動作', r.gone&&r.slotsEmpty&&r.obs===1, JSON.stringify(r));

    // X2: 左上コントロールの全ボタンが29px正方で統一
    const r2=await p.evaluate(()=>{
      const els=[...document.querySelectorAll('.maplibregl-ctrl-top-left a, .maplibregl-ctrl-top-left button')];
      const sizes=els.map(el=>{ const cs=getComputedStyle(el); return cs.width+'x'+cs.height; });
      return { n: els.length, uniq: [...new Set(sizes)], };
    });
    check('X2 左上コントロールの全ボタンが同一サイズ(29px正方)', r2.n>=8&&r2.uniq.length===1&&r2.uniq[0]==='29px x 29px'.replace(' x ','x'),
      `n=${r2.n} sizes=${r2.uniq.join('|')}`);
    check('X3 既定ページエラーなし', errs.length===0, errs.slice(0,3).join(' | '));
    await p.close();
  }

  // ---- ?forecast=1(fetch注入で完全復元) ----
  {
    const p2=await ctx.newPage();
    const errs2=[]; p2.on('pageerror',e=>errs2.push(e.message));
    await p2.goto(BASE+'/index.html?forecast=1',{waitUntil:'load'});
    await p2.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:10000});
    await p2.waitForTimeout(600);
    const r=await p2.evaluate(async()=>{
      const back=['btn-ss-run','sec-sorasearch','sec-mysora','btn-soradanmen','sorasearch-panel','soradanmen-panel']
        .every(id=>!!document.getElementById(id));
      const wired=typeof document.getElementById('btn-ss-run').onclick==='function'&&
                  typeof document.getElementById('btn-soradanmen').onclick==='function';
      toggleSoradanmen();
      await new Promise(res=>setTimeout(res,600));
      const sdOpened=_sdMap!==null;
      toggleSoradanmen();
      const title=document.getElementById('btn-myset-switch').title;
      return { back, wired, sdOpened, titleHasMySora: /My宙検索/.test(title), sheets: MYSET_SHEET_NAMES.length };
    });
    check('X4 ?forecast=1: 5ブロックが注入復元+配線+宙断面が開く', r.back&&r.wired&&r.sdOpened, JSON.stringify(r));
    check('X4 ?forecast=1: Myセット説明にMy宙検索が戻る+5シート', r.titleHasMySora&&r.sheets===5);
    check('X5 ?forecast=1ページエラーなし', errs2.length===0, errs2.slice(0,2).join(' | '));
    await p2.close();
  }

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
