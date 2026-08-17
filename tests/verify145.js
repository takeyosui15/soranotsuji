// 第78ラウンド検証: v1.62.0 怒号の修正 第1陣
// ①標高グラフのキャンセル(世代ガードを呼び出し元へ) ②センサーのモバイル項目削除+別名読み替え
// ③天体軌跡=基準日時±36時間の連続1本線 ④花火11種・各1値 ⑤GAS行探索のループ廃止(直接計算)
// ⑥地名検索のタイムゾーン分岐(日本以外はGSIを通らずOSMへ)
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

// ---- V0: 版数の存在検査(版数ピンは最新のverify146へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.62.0の行がある', src.includes('Version 1.62.0 - ') || !!process.argv[2]);

// ---- G: GAS findDateRow(行の直接計算)のユニットテスト(Node内・モックシート) ----
// gas_spredsheet.jsは読み込み時にGAS APIへ触れない(関数定義のみ)ため、Utilitiesだけモックして評価する
global.Utilities = { formatDate: (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` };
eval(fs.readFileSync(path.join(__dirname, '..', 'gas_spredsheet.js'), 'utf8'));

function mkSheet(year, days, opts = {}) {
  const shift = opts.shift || 0;   // 行ズレ(手動挿入相当。フォールバック試験用)
  let singleReads = 0, bulkReads = 0;
  const dateAt = (row) => {        // 実シートと同型: 3行目=1月1日のローカル日付
    const u = new Date(Date.UTC(year, 0, 1) + (row - 3 - shift) * 86400000);
    return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
  };
  return {
    getName: () => String(year),
    getLastRow: () => 2 + days + shift,
    getRange: (r, c, nr) => {
      if (nr !== undefined) { bulkReads++; const out = []; for (let i = 0; i < nr; i++) out.push([dateAt(r + i)]); return { getValues: () => out }; }
      singleReads++; return { getValue: () => dateAt(r) };
    },
    stats: () => ({ singleReads, bulkReads }),
  };
}
{
  const s = mkSheet(2026, 365);
  const row = findDateRow(s, '2026-08-14');   // 年初から226日目 → 行228
  check('G1 2026-08-14は行228に直接ヒット(全行走査なし・検証1セルのみ)',
    row === 228 && s.stats().bulkReads === 0 && s.stats().singleReads === 1, JSON.stringify({row, ...s.stats()}));
}
{
  const s = mkSheet(2024, 366);
  const row = findDateRow(s, '2024-12-31');   // 閏年366日目 → 行368
  check('G2 閏年2024-12-31は行368(Date.UTCの日数差で閏も正しい)', row === 368 && s.stats().bulkReads === 0, String(row));
}
{
  const s = mkSheet(2026, 365);
  check('G3 2026-01-01は行3(先頭)', findDateRow(s, '2026-01-01') === 3);
}
{
  const s = mkSheet(2026, 365);
  const row = findDateRow(s, '2025-12-31');   // 年違い(昨年) → 即-1(呼び出し側が昨年シートで引き直す)
  check('G4 年違いの日付は読み取りゼロで-1', row === -1 && s.stats().singleReads === 0 && s.stats().bulkReads === 0, JSON.stringify({row, ...s.stats()}));
}
{
  const s = mkSheet(2026, 365, { shift: 1 });   // 行が1つズレたシート(規約外)
  const row = findDateRow(s, '2026-08-14');     // 検証セル不一致 → 従来の全行走査で行229を見つける
  check('G5 規約外(行ズレ)シートは従来走査へフォールバックして正しい行', row === 229 && s.stats().bulkReads === 1, JSON.stringify({row, ...s.stats()}));
}

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});

  // ---- メインコンテキスト(Asia/Tokyo) ----
  const seen=[];   // 遮断前に試行URLを記録(E5のTZ分岐で使用)
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {
    const u=route.request().url();
    if(!u.startsWith(BASE)) seen.push(u);
    u.startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof drawSoramado==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // E1: 標高グラフのキャンセル — 完走なら可視判定ポップアップ1回・途中で宙の窓へ切替なら出ない
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      const orig={ fA: window.fetchAllElevations, sVR: window.showVisibilityResult };
      let popup=0;
      window.showVisibilityResult=async()=>{ popup++; };
      // (a) 完走: 即完了する取得に差し替え → ポップアップ1回
      window.fetchAllElevations=async()=>{};
      toggleElevation();                             // ON
      await new Promise(r=>setTimeout(r,120));
      const afterComplete=popup;
      toggleElevation();                             // OFF
      // (b) 途中キャンセル: 取得中(300ms)に宙の窓へ切替 → ポップアップは増えない
      window.fetchAllElevations=async(pts,cb,gen)=>{ await new Promise(r=>setTimeout(r,300)); };
      toggleElevation();                             // ON(取得中)
      await new Promise(r=>setTimeout(r,50));
      toggleSoramado();                              // 排他クローズ → toggleElevationのOFF側=世代が進む
      await new Promise(r=>setTimeout(r,500));       // 孤児の取得が解決するのを待つ
      const afterCancel=popup;
      const soraOpen=appState.isSoramadoActive, elevOpen=appState.isElevationActive;
      window.fetchAllElevations=orig.fA; window.showVisibilityResult=orig.sVR;
      return { afterComplete, afterCancel, soraOpen, elevOpen };
    });
    check('E1 完走時は可視判定ポップアップが1回出る', r.afterComplete===1, JSON.stringify(r));
    check('E1 途中で宙の窓へ切替たらポップアップは出ない(キャンセル有効)', r.afterCancel===1 && r.soraOpen && !r.elevOpen, JSON.stringify(r));
  }

  // E2: センサーのモバイル項目削除+別名読み替え
  {
    const r=await p.evaluate(()=>{
      const noMobile=!SORA_SENSORS.some(s=>/^(ip_|px_|xp_|ipod)/.test(s.key));
      const opts=document.querySelectorAll('#input-sora-sensor option').length;
      const map={};
      for(const k of ['ip_x_11','ip_12pm','ip_13','ip_pro48','ip_15_16','ip_se','px_8_9','xp_10']){
        appState.soraSensorKey=k; normalizeAppState(); map[k]=appState.soraSensorKey;
      }
      appState.soraSensorKey='zzz_unknown'; normalizeAppState(); const unknown=appState.soraSensorKey;
      appState.soraSensorKey='fullframe'; normalizeAppState();
      return { noMobile, opts, n:SORA_SENSORS.length, map, unknown };
    });
    check('E2 SORA_SENSORSにモバイル機種keyが無い(汎用型のみ)', r.noMobile && r.n===15, `n=${r.n}`);
    check('E2 リストの選択肢数=汎用型の数', r.opts===r.n, `opts=${r.opts}`);
    check('E2 旧keyは同寸/最寄りの汎用型へ読み替え(保存データ・URL互換)',
      r.map.ip_x_11==='type255'&&r.map.ip_12pm==='type17'&&r.map.ip_13==='type20'&&r.map.ip_pro48==='type128'&&
      r.map.ip_15_16==='type17'&&r.map.ip_se==='type30'&&r.map.px_8_9==='type128'&&r.map.xp_10==='type30',
      JSON.stringify(r.map));
    check('E2 未知keyは既定(fullframe)へ', r.unknown==='fullframe', r.unknown);
  }

  // E3: 天体軌跡=基準日時±36時間の連続1本線(正時丸めキャッシュ)
  {
    const r=await p.evaluate(async()=>{
      appState.currentDate=new Date('2026-08-02T12:10:00+09:00');   // 日時固定(時刻依存の揺れ防止)
      appState.bodies.forEach(bd=>bd.visible=(bd.id==='Sun'));      // 太陽1本に固定
      appState.soraTraj=true;
      if(!appState.isSoramadoActive) toggleSoramado();
      await new Promise(r=>setTimeout(r,1500));
      _smBuildTraj();
      const lines1=_smTrajGrp.children.length;
      const pts1=_smTrajGrp.children[0]?_smTrajGrp.children[0].geometry.getAttribute('position').count:0;
      const ref1=_smTrajGrp.children[0];
      // 正時丸め: 12:10→12:00 と 12:20→12:00 は同キー=再構築なし(参照が同じ)
      appState.currentDate=new Date('2026-08-02T12:20:00+09:00');
      _smBuildTraj();
      const sameRef=_smTrajGrp.children[0]===ref1;
      // 13:40→14:00 はキーが変わり再構築
      appState.currentDate=new Date('2026-08-02T13:40:00+09:00');
      _smBuildTraj();
      const rebuilt=_smTrajGrp.children[0]!==ref1;
      toggleSoramado();   // 後始末
      return { lines1, pts1, sameRef, rebuilt };
    });
    check('E3 軌跡は1天体1本の連続線(旧: 1日毎3本)', r.lines1===1, `lines=${r.lines1}`);
    check('E3 点数=±36時間を15分刻み(288区間=289点)', r.pts1===289, `pts=${r.pts1}`);
    check('E3 正時内の日時変更は再構築なし・正時をまたぐと再構築', r.sameRef && r.rebuilt, JSON.stringify(r));
  }

  // E4: 花火11種・各1値
  {
    const r=await p.evaluate(()=>{
      const keys=FW_SHELLS.map(s=>s.key).join(',');
      const single=FW_SHELLS.every(s=>typeof s.alt==='number'&&typeof s.dia==='number'&&s.altLo===undefined&&s.diaLo===undefined);
      const s40=FW_SHELLS.find(s=>s.key==='40'), s25=FW_SHELLS.find(s=>s.key==='2.5');
      appState.fwSize='20'; normalizeAppState(); const new20=appState.fwSize;   // 新keyは正規化を通る
      appState.fwSize='999'; normalizeAppState(); const bad=appState.fwSize;    // 不正keyは既定'10'へ
      const selN=document.querySelectorAll('#sel-fw-size option').length;
      const selNC=document.querySelectorAll('#sel-fw-ctrl-size option').length;
      return { keys, single, s40:`${s40.ball}/${s40.alt}/${s40.dia}`, s25:`${s25.ball}/${s25.alt}/${s25.dia}`, new20, bad, selN, selNC };
    });
    check('E4 号数は11種', r.keys==='2.5,3,4,5,6,7,8,10,20,30,40', r.keys);
    check('E4 開花高度/直径は各1値(lo/hi廃止)', r.single);
    check('E4 40号=114cm/750m/750m・2.5号=6.9cm/80m/50m', r.s40==='114/750/750'&&r.s25==='6.9/80/50', `${r.s40} ${r.s25}`);
    check('E4 新key(20号)は有効・不正keyは既定10号へ', r.new20==='20'&&r.bad==='10', `${r.new20}/${r.bad}`);
    check('E4 号数リストの選択肢は両メニューとも11個', r.selN===11&&r.selNC===11, `${r.selN}/${r.selNC}`);
  }

  // E5: 地名検索のタイムゾーン分岐 — 日本(Asia/Tokyo)はGSI優先のまま
  {
    seen.length=0;
    await p.evaluate(async()=>{ try{ await searchLocation('東京タワー'); }catch(_){} });
    const gsiTried=seen.some(u=>u.includes('msearch.gsi.go.jp'));
    check('E5 TZ=Asia/TokyoはGSI(msearch)を最初に試す(従来どおり)', gsiTried, seen.slice(0,2).join(' '));
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();

  // ---- 別コンテキスト(Europe/Paris): GSIを通らずOSMへ直行 ----
  {
    const seen2=[];
    const ctx2=await b.newContext({viewport:{width:900,height:900},timezoneId:'Europe/Paris'});
    await ctx2.route('**/*', route => {
      const u=route.request().url();
      if(!u.startsWith(BASE)) seen2.push(u);
      u.startsWith(BASE) ? route.continue() : route.abort();
    });
    const p2=await ctx2.newPage();
    await p2.goto(BASE+'/index.html',{waitUntil:'load'});
    await p2.waitForFunction(()=>typeof searchLocation==='function',{timeout:8000});
    await p2.waitForTimeout(500);
    seen2.length=0;
    await p2.evaluate(async()=>{ try{ await searchLocation('Paris'); }catch(_){} });
    const gsi2=seen2.some(u=>u.includes('msearch.gsi.go.jp'));
    const osm2=seen2.some(u=>u.includes('nominatim.openstreetmap.org'));
    check('E5 TZ=Europe/ParisはGSIを通らずOSMへ直行', !gsi2 && osm2, seen2.slice(0,3).join(' '));
    await ctx2.close();
  }

  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
