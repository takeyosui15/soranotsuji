// 第93ラウンド検証: v1.75.0
// まとめ確認への対応 第1陣: ①オフセット中心角の±を内部値ごと新符号へ統一(表示反転の廃止+
//   スキーマ2→3の読み替え) ②検索記録は生のオフセット中心角 ③My辻行の初期値オフ
//   ④プレースホルダー変更+My観測点/My目的点のプラスコード対応 ⑤既定セット常時⭐️(verify153で検査)
//   ⑥移動ボタンの段構成(2段目=読み全幅・3段目=リセット/位置反映)。
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

// ---- V0: 版数の存在検査(版数ピンは最新のverify159へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.75.0の行がある', src.includes('Version 1.75.0 - ') || !!process.argv[2]);

// ---- V1: 静的な形 ----
check('V1 表示変換ヘルパー(_mwDispVal)は廃止済み(履歴コメントの記述は除く)', !/_mwDispVal\(/.test(src));
check('V1 銀経へ渡す時に反転(収録符号=時計回り正の統一)',
  (src.match(/galacticToEquatorial\(-ang, 0\)/g) || []).length === 2);
check('V1 CSV取込行の:天の川オプションもオフ', src.includes('mwOffsetEnabled: false,   // :天の川オプションのCSV列は未定義'));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});

  // S1: 符号の意味(新符号30 = 旧符号-30と同じ空の点)+入出力の素通し
  {
    const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
    await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(BASE+'/index.html',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof getMilkyWayBaseRaDec==='function',{timeout:8000});
    await p.waitForTimeout(600);
    const r=await p.evaluate(()=>{
      window.confirm=()=>true; window.alert=()=>{};
      appState.baseOptMwBase='offset'; appState.mwOffsetAngle=30;
      const got=getMilkyWayBaseRaDec();
      const exp=galacticToEquatorial(-30, 0);   // 銀経は逆回りなので-30が同じ点
      const semaOk=Math.abs(got.ra-exp.ra)<1e-12&&Math.abs(got.dec-exp.dec)<1e-12;
      const row=(()=>{ const g=_myTsujiMwRaDec({mwOffsetAngle:30, mwOffsetEnabled:true});
        return Math.abs(g.ra-exp.ra)<1e-12&&Math.abs(g.dec-exp.dec)<1e-12; })();
      // (検索記録が生値を収めることの検査はverify149のV1が持つ)
      return { semaOk, row };
    });
    check('S1 新符号30が旧符号-30と同じ空の点(基本オプション+My辻行の両関数)', r.semaOk&&r.row, JSON.stringify(r));

    // S6: My観測点の緯度経度欄でプラスコード(フルコード)
    const r2=await p.evaluate(async()=>{
      getElevation = async () => 42;
      appState.myObservations=[{ id:1, name:'テスト', lat:null, lng:null, elev:0, height:0, checked:false, memo:'' }];
      renderMyPointsList('obs');
      const inp=document.querySelector('.mypoint-latlng');
      const exp=_plusCodeDecode('8Q7XMQPJ+2V');
      inp.value='8Q7XMQPJ+2V';
      inp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      await new Promise(r=>setTimeout(r,200));
      const pt=appState.myObservations[0];
      const ok = Math.abs(pt.lat-exp.lat)<1e-9 && Math.abs(pt.lng-exp.lng)<1e-9 && pt.elev===42;
      const ph = inp.placeholder;
      appState.myObservations=[]; renderMyPointsList('obs');
      return { ok, ph };
    });
    check('S6 My観測点の緯度経度欄でプラスコード→復号セル中心が行に入る(標高も取得)', r2.ok, JSON.stringify(r2));
    check('S6 My点のプレースホルダーは「地名、Plus Code、緯度,経度」', r2.ph==='地名、Plus Code、緯度,経度', r2.ph);

    // S5: プレースホルダー(位置情報・花火)
    const r3=await p.evaluate(()=>({
      start: document.getElementById('input-start-latlng').placeholder,
      end: document.getElementById('input-end-latlng').placeholder,
      fw: document.getElementById('input-fw-latlng').placeholder,
      fwCtrl: document.getElementById('input-fw-ctrl-latlng').placeholder }));
    check('S5 プレースホルダー(観測点/目的点=「Plus Code、緯度,経度」・花火=「地名、Plus Code、緯度,経度」)',
      r3.start==='Plus Code、緯度,経度'&&r3.end==='Plus Code、緯度,経度'&&
      r3.fw==='地名、Plus Code、緯度,経度'&&r3.fwCtrl==='地名、Plus Code、緯度,経度', JSON.stringify(r3));

    // S8: 移動ボタンの段構成(2段目=読みのみの行・3段目=リセット/位置反映の行)
    const r4=await p.evaluate(()=>{
      const readoutRow=document.getElementById('sora-move-readout').closest('.control-row');
      const resetRow=document.getElementById('btn-sora-move-reset').closest('.control-row');
      return { readoutAlone: readoutRow.children.length===1,
               separate: readoutRow!==resetRow,
               readoutFirst: readoutRow.nextElementSibling===resetRow,
               resetPair: resetRow.contains(document.getElementById('btn-sora-move-apply')) };
    });
    check('S8 移動量の読みが専用の段(全幅)になり、次の段がリセット/位置反映',
      r4.readoutAlone&&r4.separate&&r4.readoutFirst&&r4.resetPair, JSON.stringify(r4));

    check('E1 ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
    await ctx.close();
  }

  // S2: スキーマ2→3の読み替え(旧符号の保存データが自動で新符号になる)
  {
    const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
    await ctx.addInitScript(() => {
      const saved = { appSchema: 2, baseOptMwBase: 'offset', mwOffsetAngle: -30,
        myTsujiSearches: [{ id: 1, name: '移行テスト', days: 365, bodyIds: 'MilkyWay', obsId: null, tgtId: null,
          baseAz: null, baseAlt: null, offsetAz: 0, offsetAlt: 0, toleranceAz: 15, toleranceAlt: 15,
          centerMode: 'point', mwOffsetAngle: 15, moonFilter: false, checked: false, memo: '' }],
        mySetHomeData: { myTsujiSearches: [{ id: 1, mwOffsetAngle: -45 }] },
        mySets: [{ id: 1, name: '控えセット', saveMode: 'save', offline: true, checked: false, updatedAt: null, memo: '',
          data: { myTsujiSearches: [{ id: 1, mwOffsetAngle: 20 }] } }] };
      localStorage.setItem('soranotsuji_app', JSON.stringify(saved));
    });
    await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(BASE+'/index.html',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof drawSoramado==='function',{timeout:8000});
    await p.waitForTimeout(600);
    const r=await p.evaluate(()=>({
      ang: appState.mwOffsetAngle, row: appState.myTsujiSearches[0] && appState.myTsujiSearches[0].mwOffsetAngle,
      home: appState.mySetHomeData.myTsujiSearches[0].mwOffsetAngle,
      setData: appState.mySets[0].data.myTsujiSearches[0].mwOffsetAngle,
      schema: appState._loadedSchema }));
    check('S2 スキーマ2の旧保存(-30・行15)が読み替えで新符号(30・行-15)へ・版数は3に',
      r.ang===30&&r.row===-15&&r.schema===3, JSON.stringify(r));
    check('S2c 非表示中セットのスナップショット(既定-45・Myセット20)も読み替え(45・-20)',
      r.home===45&&r.setData===-20, JSON.stringify(r));
    check('E2 移行でページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
    await ctx.close();
  }

  // S2b: スキーマ3の保存データは読み替えない(冪等)
  {
    const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
    await ctx.addInitScript(() => {
      localStorage.setItem('soranotsuji_app', JSON.stringify({ appSchema: 3, baseOptMwBase: 'offset', mwOffsetAngle: 30 }));
    });
    await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    const p=await ctx.newPage();
    await p.goto(BASE+'/index.html',{waitUntil:'load'});
    await p.waitForFunction(()=>typeof drawSoramado==='function',{timeout:8000});
    await p.waitForTimeout(400);
    const r=await p.evaluate(()=>({ ang: appState.mwOffsetAngle }));
    await ctx.close();
    check('S2b スキーマ3の保存(30)はそのまま(再反転しない=冪等)', r.ang===30, JSON.stringify(r));
  }

  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
