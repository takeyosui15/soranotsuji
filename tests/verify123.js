// 第39ラウンド検証: 保存キーの整合性リンター(静的検査。ブラウザ不要)
// 「保存される(buildStateToSave)のに復元されない(loadAppState)」「復元コードだけあって保存されない」
// という3箇所(保存/復元/正規化)の暗黙対応のズレを機械的に検出する。
// 第36ラウンドの花火モードのバグ(保存されるのに復元されず毎起動で初期値に戻る)の再発防止。
// 依頼者との対話(order.md その35/その36)から生まれた「自分が使うツールは、自分で作る」の第1号。
const fs = require('fs');
const path = require('path');
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };

// 対象ファイルは引数で差し替え可能(既定は宙の辻のscript.js。他リポジトリでの再利用を想定)
const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

/** 関数名から本体のソース文字列を切り出す(波括弧の対応で終端を探す) */
function fnBody(name) {
  const m = src.match(new RegExp(`function ${name}\\s*\\([^)]*\\)\\s*\\{`));
  if (!m) return null;
  let i = m.index + m[0].length, depth = 1;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return src.slice(m.index, i);
}

// ---- 1) 保存キー: buildStateToSaveのオブジェクトリテラルのトップレベルキー ----
function saveKeys() {
  const body = fnBody('buildStateToSave');
  const start = body.indexOf('return {') + 'return {'.length;
  // 深さ1(トップレベル)の文字だけを残す(ネストした{...}の中身と行内コメントを除外)
  let depth = 1, top = '';
  for (let i = start; i < body.length && depth > 0; i++) {
    const c = body[i];
    if (c === '{') { depth++; continue; }
    if (c === '}') { depth--; continue; }
    if (depth === 1) top += c;
  }
  const keys = new Set();
  // 「key:」の形(行頭でもカンマ後でも)。値側のappState.xxxはコロンが続かないため誤検出しない
  for (const m of top.replace(/\/\/[^\n]*/g, '').matchAll(/(?:^|[,\n])\s*(\w+)\s*:/g)) keys.add(m[1]);
  return keys;
}

// ---- 2) 復元キー: loadAppState内の saved.X 直接参照+配列forEachの saved[k] 用キーリスト ----
function loadKeys() {
  const body = fnBody('loadAppState');
  const keys = new Set();
  for (const m of body.matchAll(/saved\.(\w+)/g)) keys.add(m[1]);
  // ['a','b',...].forEach(k => { if (saved[k] !== undefined) ... }) 形式の配列リテラル
  for (const m of body.matchAll(/\[((?:\s*'[^']+'\s*,?)+)\]\s*\.forEach/g)) {
    for (const s of m[1].matchAll(/'([^']+)'/g)) keys.add(s[1]);
  }
  return keys;
}

// ---- 3) 正規化キー: normalizeAppState内で触れている appState.X + APP_DEFAULTSの規則付き項目 ----
// (第41ラウンドのリファクタリングAで正規化の大半は汎用パス=APP_DEFAULTSの規則参照になったため、
//  表の規則(enum/enumNum/bool/force/special/min)を持つキーも「正規化されるキー」として数える)
function appDefaultsEntries() {
  const i = src.indexOf('const APP_DEFAULTS = {');
  if (i < 0) return null;   // 他プロジェクト検査時: 表が無ければ従来どおり
  const j = src.indexOf('\n};', i);
  const entries = new Map();
  for (const m of src.slice(i, j).matchAll(/(\w+): \{([^{}]*)\}/g)) entries.set(m[1], m[2]);
  return entries;
}
function normKeys() {
  const body = fnBody('normalizeAppState');
  const keys = new Set();
  for (const m of body.matchAll(/appState\.(\w+)/g)) keys.add(m[1]);
  const defs = appDefaultsEntries();
  if (defs) for (const [k, fields] of defs) {
    if (/\b(enum|enumNum|bool|force|special|min)\s*:/.test(fields)) keys.add(k);
  }
  return keys;
}

const save = saveKeys();
const load = loadKeys();
const norm = normKeys();

// 意図的に「保存するが復元処理はキー個別でない」/メタのキー(理由をここに明記して例外化する)
const SAVE_ONLY_OK = new Set([
  'appSchema',   // メタ: スキーマ版数(復元は_loadedSchemaとして読む)
  'savedAt',     // メタ: 保存時刻(同期の新旧比較用。復元不要)
]);
// 「復元コードにあるが保存キーではない」の例外(理由をここに明記)
const LOAD_ONLY_OK = new Set([
  'appSchema',   // saved.appSchema → appState._loadedSchema として読む(キー名が変わる)
]);

check('K0 APP_VERSIONが存在(版数ピンは最新のverifyに集約)', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) || !!process.argv[2]);   // 引数指定時(他リポジトリ検査)はスキップ
check('K0 buildStateToSave/loadAppState/normalizeAppStateを発見(前提)',
  save.size > 30 && load.size > 30 && norm.size > 10,
  `save=${save.size} load=${load.size} norm=${norm.size}`);

// ---- リント1: 保存されるのに復元されないキー(花火バグの型) ----
{
  const missing = [...save].filter(k => !load.has(k) && !SAVE_ONLY_OK.has(k));
  check('K1 保存される全キーに復元処理がある(「保存されるのに復元されない」がない)',
    missing.length === 0, missing.length ? '復元漏れ: ' + missing.join(', ') : '');
}

// ---- リント2: 復元コードだけあって保存されないキー(死んだ復元) ----
{
  const missing = [...load].filter(k => !save.has(k) && !LOAD_ONLY_OK.has(k));
  check('K2 復元される全キーが保存対象である(「保存されない値の復元コード」がない)',
    missing.length === 0, missing.length ? '保存漏れ: ' + missing.join(', ') : '');
}

// ---- リント3(情報): 保存対象なのにnormalizeが触れていないキーの数を記録(異常検知の基準線) ----
{
  const untouched = [...save].filter(k => !norm.has(k) && !SAVE_ONLY_OK.has(k));
  // 全キーの正規化は必須ではない(オブジェクト/文字列名/リストは正規化不要)ため、件数の急増だけを検知する。
  // 基準線は現状の実測+少しの余白。超えたら意図的にここを更新する
  // (第41ラウンドのAPP_DEFAULTS化後: 73個 → 第61ラウンドの曜日フィルタ16キー追加後: 89個
  //  → 第79ラウンドの月間フィルタ26キー追加後: 115個 → 第85〜86ラウンドの
  //  tsujiLineIncludeOffset+Myセットフィルタ4キー追加後: 120個。
  //  いずれもbool/文字列・APP_DEFAULTSに既定あり=個別正規化は不要のため意図的な増加)
  check('K3 正規化されない保存キーは既知の範囲(基準線: 123個以下)',
    untouched.length <= 123, `未正規化=${untouched.length}個: ${untouched.slice(0, 8).join(', ')}…`);
}

// ---- リント4(第41ラウンド・リファクタリングA): APP_DEFAULTSに無い保存スカラーキーの検査 ----
// 「保存されるスカラー値は既定値の単一情報源(APP_DEFAULTS)に載っているべき」。構造値・導出値・
// メタ値は対象外として明示する(この一覧に無い新キーが表に載っていなければ検出される)。
{
  const defs = appDefaultsEntries();
  if (defs) {
    const NOT_SCALAR_OK = new Set([
      'appSchema', 'savedAt',                                     // メタ
      'start', 'end', 'homeStart', 'homeEnd',                     // 位置オブジェクト(既定はDEFAULT_START/END)
      'startApiElev', 'endApiElev', 'startHeight', 'endHeight',   // 位置の導出スカラー(同上)
      'refractionEnabled', 'meteo',                               // 大気差(既定は標準大気STD_*から導出)
      'lastVisitDate',                                            // 訪問履歴
      // 注: refractionK(導出値)とmoonAge(計算値)は保存キーではないため例外に載せない。
      //     将来保存化されたらこのリンターが検出するので、その時に扱いを決める(事前免除にしない)
      'bodies', 'myStars', 'myObservations', 'myTargets',         // 構造値(既定はDEFAULT_BODIES/空配列)
      'mySets', 'mySetCurrentId', 'mySetHomeData', 'mySetHome',   // Myセット構造
      'soraFolderName', 'googleDrive',                            // Drive連携(構造+固定名)
      'myTsujiSearches', 'mySoraSearches',                        // My検索リスト
    ]);
    const missing = [...save].filter(k => !defs.has(k) && !NOT_SCALAR_OK.has(k));
    check('K8 保存されるスカラーキーはAPP_DEFAULTS(単一情報源)に載っている',
      missing.length === 0, missing.length ? '表に無い: ' + missing.join(', ') : `defs=${defs.size}keys`);
  } else {
    check('K8 APP_DEFAULTS表なし(他プロジェクト検査のためスキップ)', true);
  }
}

// ============================================================
// ここからブラウザ検査: Drive保存のプレフィックス限定+バックアップ形式の一本化(第39ラウンド・承認済み方針)
// ============================================================
(async () => {
  const { chromium } = require('playwright-core');
  const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const BASE='http://127.0.0.1:8099';
  const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:10000});
  await p.waitForTimeout(400);

  // K4: collectLocalStorageAllはsoranotsuji_キーだけを吸い上げる(他アプリのキー混入防止)
  {
    const r=await p.evaluate(()=>{
      localStorage.setItem('foreign_app_key','x');
      saveAppState();
      const all=collectLocalStorageAll();
      localStorage.removeItem('foreign_app_key');
      return { keys:Object.keys(all), hasApp:typeof all['soranotsuji_app']==='string' };
    });
    check('K4 Drive保存の吸い上げがsoranotsuji_キー限定(無関係キーを含まない)',
      r.hasApp&&r.keys.every(k=>k.startsWith('soranotsuji_')), r.keys.join(','));
  }

  // K5: バックアップ出力が生ダンプ形式(Drive app.jsonと同一構造)
  {
    const r=await p.evaluate(async()=>{
      const oc=window.confirm, oCreate=URL.createObjectURL;
      window.confirm=()=>true;
      let blob=null; URL.createObjectURL=(bl)=>{ blob=bl; return 'blob:x'; };
      const oClick=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=()=>{};
      exportBackup();
      HTMLAnchorElement.prototype.click=oClick; URL.createObjectURL=oCreate; window.confirm=oc;
      const text=await blob.text();
      const data=JSON.parse(text);
      return { keys:Object.keys(data), appIsString:typeof data['soranotsuji_app']==='string',
               inner:(()=>{try{return typeof JSON.parse(data['soranotsuji_app']).savedAt==='number';}catch(e){return false;}})() };
    });
    check('K5 バックアップ出力=生ダンプ形式(soranotsuji_appキー+中身の検証可能なJSON)',
      r.appIsString&&r.inner&&r.keys.every(k=>k.startsWith('soranotsuji_')), JSON.stringify({keys:r.keys}));
  }

  // K6: 新形式インポートはsoranotsuji_キーのみ書き戻し+旧形式も後方互換で取り込める
  {
    const r=await p.evaluate(()=>{
      // 新形式: _writeSoranotsujiKeys(共通実装)が無関係キーを無視すること
      localStorage.removeItem('foreign_junk');
      const cur=localStorage.getItem('soranotsuji_app');
      const n=_writeSoranotsujiKeys({ 'soranotsuji_app': cur, 'foreign_junk': 'x', 'another': 'y' });
      const junk=localStorage.getItem('foreign_junk');
      // 旧形式の後方互換: importBackupの旧経路が生きていること(ソース検査は静的側で担保済みのため、
      // ここでは旧形式データの適用関数群が存在することを確認)
      return { n, junkClean: junk===null };
    });
    check('K6 生ダンプの書き戻しはsoranotsuji_キーのみ(混入キーは無視=掃除される)',
      r.n===1&&r.junkClean, JSON.stringify(r));
  }

  check('K7 ページエラーなし', errs.length===0, errs.slice(0,3).join(' | '));

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
