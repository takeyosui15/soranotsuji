// 第98ラウンド検証: v1.80.0
// ご確認フィードバック第2弾: ①移動量の読みの並び=移動ボタンと同順(上・前・右)
//   ②Myセット切り替え確認メッセージの「My宙検索」を封鎖に連動(公開=出さない/?forecast=1=出す)
//   ③無テクスチャビルの調査結果をヘルプへ記載(存在検査)。
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

// ---- V0: 版数の存在検査(版数ピンは最新のverify164へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.80.0の行がある', src.includes('Version 1.80.0 - ') || !!process.argv[2]);

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});

  // 公開ビルド側
  {
    const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
    await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(BASE+'/index.html',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof switchMySetDisplay==='function',{timeout:8000});
    await p.waitForTimeout(400);

    // R1: 読みの並び(上・前・右)
    const r1=await p.evaluate(()=>{
      appState.soraBaseAz=0; appState.soraOffsetAz=0;   // 北向き=前=北(n)
      _smObsNudge={ e:1, n:2, u:3 };
      _smObsNudgeReadout();
      const t=document.getElementById('sora-move-readout').textContent;
      _smObsNudge={ e:0, n:0, u:0 }; _smObsNudgeReadout();
      return t;
    });
    check('R1 移動量の読みが移動ボタンと同順(上→前→右)', r1==='移動中: 上+3.0m 前+2.0m 右+1.0m', r1);

    // M1: Myセット切り替えメッセージ(公開ビルド=My宙検索を出さない)
    const r2=await p.evaluate(async()=>{
      const msgs=[];
      const origC=window.confirm; window.confirm=m=>{ msgs.push(String(m)); return false; };   // メッセージだけ捕まえて中止
      const origA=window.alert; window.alert=()=>{};
      appState.mySets=[{id:1,name:'検査',saveMode:'save',offline:true,checked:false,updatedAt:null,memo:'',data:{myTsujiSearches:[]}}];
      renderMySetList();
      const radio=document.querySelector('input[name="myset-select"][value="1"]');
      if (radio) radio.checked=true;
      await switchMySetDisplay();
      window.confirm=origC; window.alert=origA;
      appState.mySets=[]; renderMySetList();
      return msgs;
    });
    check('M1 公開ビルドの切り替え確認に「My宙検索」が出ない(My天体まで)',
      r2.length===1&&!r2[0].includes('My宙検索')&&r2[0].includes('My天体を切り替えますか'), JSON.stringify(r2));

    // H1: ヘルプにテクスチャ整備状況の説明がある
    const r3=await p.evaluate(()=>document.body.innerHTML.includes('テクスチャの無いビルが混ざるのは元データの整備状況'));
    check('H1 ヘルプ(都市モードの節)に無テクスチャの説明がある', r3);

    check('E1 ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
    await ctx.close();
  }

  // ?forecast=1側: メッセージにMy宙検索が入る(従来動作)
  {
    const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
    await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    const p=await ctx.newPage();
    await p.goto(BASE+'/index.html?forecast=1',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof switchMySetDisplay==='function',{timeout:8000});
    await p.waitForTimeout(600);
    const r=await p.evaluate(async()=>{
      const msgs=[];
      window.confirm=m=>{ msgs.push(String(m)); return false; };
      window.alert=()=>{};
      appState.mySets=[{id:1,name:'検査',saveMode:'save',offline:true,checked:false,updatedAt:null,memo:'',data:{myTsujiSearches:[]}}];
      renderMySetList();
      const radio=document.querySelector('input[name="myset-select"][value="1"]');
      if (radio) radio.checked=true;
      await switchMySetDisplay();
      return msgs;
    });
    await ctx.close();
    check('M2 ?forecast=1の切り替え確認には「My宙検索」が入る(従来動作)',
      r.length===1&&r[0].includes('My宙検索'), JSON.stringify(r));
  }

  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
