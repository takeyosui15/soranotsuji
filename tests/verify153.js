// 第86ラウンド検証: v1.70.0
// 怒号の項目14: Myセットのフィルタ(テキスト[空白区切り=アンド]+対象チェック2個+トグル)と
//   お気に入り(☆/⭐️のアイコンリンク。⭐️はリストの上位に表示・配列の並びは変えない)。
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

// ---- V0: 版数の存在検査(版数ピンは最新のverify154へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.70.0の行がある', src.includes('Version 1.70.0 - ') || !!process.argv[2]);

// ---- V1: 静的な形(フィルタ状態の保存) ----
check('V1 フィルタ状態4キーが既定値表と保存に入っている',
  src.includes("mySetFilterText: { def: '' }") && src.includes('mySetFilterEnabled: appState.mySetFilterEnabled') &&
  src.includes("'mySetFilterEnabled'"));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof renderMySetList==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // M1: 部品の存在(フィルタ3段+お気に入りアイコン)
  {
    const r=await p.evaluate(()=>{
      renderMySetList();
      return {
        text: !!document.getElementById('input-myset-filter'),
        nameOn: document.getElementById('chk-myset-filter-name').checked,
        memoOn: document.getElementById('chk-myset-filter-memo').checked,
        btnOff: !document.getElementById('btn-myset-filter').classList.contains('active'),
        homeFav: document.querySelector('#myset-list .myset-fav-home') !== null,
        homeStar: document.querySelector('#myset-list .myset-fav-home')?.textContent   // 第93ラウンドから常時⭐️固定
      };
    });
    check('M1 フィルタ部品(テキスト+対象チェック2個既定オン+トグル既定オフ)と既定セットの常時⭐️がある',
      r.text&&r.nameOn&&r.memoOn&&r.btnOff&&r.homeFav&&r.homeStar==='⭐️', JSON.stringify(r));
  }

  // M2: お気に入りで表示順が上位へ(配列の並びは不変)・再タップで戻る
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      appState.mySets=[
        { id:1, name:'富士山の冬', memo:'ダイヤモンド', checked:false, saveMode:'save', offline:false },
        { id:2, name:'夏の天の川', memo:'銀河', checked:false, saveMode:'save', offline:false },
        { id:3, name:'テスト', memo:'富士 夏', checked:false, saveMode:'save', offline:false },
      ];
      renderMySetList();
      const order=()=>Array.from(document.querySelectorAll('#myset-list input[name="myset-select"]')).map(x=>+x.value);
      const before=order();
      document.querySelector('#myset-list .myset-fav[data-id="3"]').click();
      await new Promise(r=>setTimeout(r,50));
      const afterFav={ order: order(), star: document.querySelector('#myset-list .myset-fav[data-id="3"]').textContent,
                       arr: appState.mySets.map(s=>s.id).join(','), fav: appState.mySets[2].favorite };
      document.querySelector('#myset-list .myset-fav[data-id="3"]').click();
      await new Promise(r=>setTimeout(r,50));
      const back=order();
      return { before, afterFav, back };
    });
    check('M2 ⭐️でID:3が上位へ(0,3,1,2)・配列は1,2,3のまま・再タップで元に戻る',
      r.before.join(',')==='0,1,2,3'&&r.afterFav.order.join(',')==='0,3,1,2'&&r.afterFav.star==='⭐️'&&
      r.afterFav.arr==='1,2,3'&&r.afterFav.fav===true&&r.back.join(',')==='0,1,2,3', JSON.stringify(r));
  }

  // M3: フィルタ(アンド条件・対象チェック・トグル)
  {
    const r=await p.evaluate(async()=>{
      const order=()=>Array.from(document.querySelectorAll('#myset-list input[name="myset-select"]')).map(x=>+x.value);
      const fText=document.getElementById('input-myset-filter');
      document.getElementById('btn-myset-filter').click();   // オン
      fText.value='富士'; fText.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(r=>setTimeout(r,50));
      const hit1=order();   // 名前ヒット(1)+メモヒット(3)。既定のセットは非該当
      fText.value='富士 夏'; fText.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(r=>setTimeout(r,50));
      const hit2=order();   // アンドで3だけ
      const memoChk=document.getElementById('chk-myset-filter-memo');
      memoChk.checked=false; memoChk.dispatchEvent(new Event('change',{bubbles:true}));
      fText.value='富士'; fText.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(r=>setTimeout(r,50));
      const hit3=order();   // 名前だけ対象→1だけ
      document.getElementById('btn-myset-filter').click();   // オフ
      await new Promise(r=>setTimeout(r,50));
      const off=order();
      const btnOff=!document.getElementById('btn-myset-filter').classList.contains('active');
      // 後始末
      memoChk.checked=true; memoChk.dispatchEvent(new Event('change',{bubbles:true}));
      fText.value=''; fText.dispatchEvent(new Event('input',{bubbles:true}));
      appState.mySets=[]; renderMySetList();
      return { hit1, hit2, hit3, off, btnOff };
    });
    check('M3 「富士」→1と3・「富士 夏」(アンド)→3・メモ対象オフで「富士」→1',
      r.hit1.join(',')==='1,3'&&r.hit2.join(',')==='3'&&r.hit3.join(',')==='1', JSON.stringify(r));
    check('M3 トグルオフで全行(既定のセット含む)に戻る', r.off.join(',')==='0,1,2,3'&&r.btnOff, JSON.stringify({off:r.off}));
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
