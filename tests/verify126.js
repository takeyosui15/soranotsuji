// 第41ラウンド検証: リファクタリングA(既定値の単一情報源化=APP_DEFAULTS)の挙動不変の表明。
// - 初期値のcharacterization: 初期状態のappStateスカラー161キーが凍結標本と完全一致
// - normalizeのcharacterization: 161キー×8種の崩れた値の正規化結果が凍結標本と完全一致
//   (既定値・正規化規則を意図的に変える時だけtests/dataの標本を更新する=変更が必ず目に見える)
// - APP_DEFAULTS表の内部整合(enumがdefを含む等)+旧h265移行+HTML入力欄の起動時上書きの実測
const fs = require('fs');
const path = require('path');
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// ---- N0: 版数ピン(最新のverifyに集約) ----
check('N0 APP_VERSIONが存在(版数ピンは最新のverifyに集約)', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) || !!process.argv[2]);
check('N0 Version Historyに最新版の行がある', /Version \d+\.\d+\.\d+ - /.test(src) || !!process.argv[2]);

// ---- N1: APP_DEFAULTS表の内部整合(静的) ----
{
  const i = src.indexOf('const APP_DEFAULTS = {');
  const j = src.indexOf('\n};', i);
  const block = src.slice(i, j);
  const bad = [];
  let count = 0;
  for (const m of block.matchAll(/(\w+): \{([^{}]*)\}/g)) {
    count++;
    const [_, key, body] = m;
    if (!/\bdef\s*:/.test(body)) bad.push(key + ':defなし');
    const en = body.match(/\benum\s*:\s*\[([^\]]*)\]/);
    const def = body.match(/\bdef\s*:\s*('[^']*'|[-\d.]+|true|false|null)/);
    if (en && def && !en[1].includes(def[1])) bad.push(key + ':enumにdefが無い');
    const mn = body.match(/\bmin\s*:\s*(-?[\d.]+)/), mx = body.match(/\bmax\s*:\s*(-?[\d.]+)/);
    if (mn && mx && parseFloat(mn[1]) > parseFloat(mx[1])) bad.push(key + ':min>max');
  }
  check('N1 APP_DEFAULTS表の内部整合(def必須・enum⊇def・min≦max)', bad.length === 0 && count >= 140,
    bad.join(', ') || `entries=${count}`);
}

// ============================================================
// ブラウザ検査: characterization(初期値+normalize挙動)の凍結標本一致
// ============================================================
(async () => {
  const { chromium } = require('playwright-core');
  const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const BASE='http://127.0.0.1:8099';
  const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1200,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });   // 初期状態で起動
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof normalizeAppState==='function'&&typeof glMap==='object'&&glMap!==null,{timeout:10000});
  await p.waitForTimeout(400);

  const goldenScalars = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'appstate-defaults.json'), 'utf8')).scalars;
  const goldenProbes = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'normalize-probes.json'), 'utf8')).probes;

  const r = await p.evaluate(({ goldenScalars }) => {
    // N2: 初期値スナップショット
    const scalars = {};
    for (const k of Object.keys(goldenScalars)) scalars[k] = appState[k];
    // N3: normalize挙動プローブ(採取スクリプトと同一手順)
    const SCENARIOS = { neg: -1e9, pos: 1e9, frac: 3.7, str: 'garbage', empty: '', nul: null, bfalse: false, btrue: true };
    const pristine = JSON.parse(JSON.stringify(scalars));
    const probes = {};
    for (const key of Object.keys(pristine)) {
      probes[key] = {};
      for (const [sn, sv] of Object.entries(SCENARIOS)) {
        Object.assign(appState, pristine);
        appState._loadedSchema = 2;
        appState[key] = sv;
        try { normalizeAppState(); probes[key][sn] = appState[key]; }
        catch (e) { probes[key][sn] = 'THROW:' + e.message; }
      }
    }
    Object.assign(appState, pristine);
    // N4: 旧h265の移行(列挙検査で潰されずh264へ)
    appState.soraExpFormat = 'h265';
    normalizeAppState();
    const h265 = appState.soraExpFormat;
    Object.assign(appState, pristine);
    normalizeAppState();
    // N5: HTML入力欄の起動時上書き(代表: 各メニューから1つずつ。HTMLのvalue属性は「飾り」の実測)
    const inputs = {
      'input-tsuji-az-tolerance': String(appState.tsujiSearchToleranceAz),
      'input-tsujimesh-days': String(appState.tsujiMeshDays),
      'input-tsuji-moon-base': String(appState.tsujiMoonBase),
    };
    const htmlCheck = {};
    for (const [id, expect] of Object.entries(inputs)) {
      const el = document.getElementById(id);
      htmlCheck[id] = el ? (el.value === expect ? 'OK' : `NG(${el.value}≠${expect})`) : 'NOEL';
    }
    return { scalars, probes, h265, htmlCheck };
  }, { goldenScalars });

  // N2: 初期値一致
  {
    const diffs = Object.keys(goldenScalars).filter(k => JSON.stringify(goldenScalars[k]) !== JSON.stringify(r.scalars[k]));
    check('N2 初期状態のappStateスカラーが凍結標本と一致(161キー)', diffs.length === 0,
      diffs.length ? '差分: ' + diffs.slice(0, 6).join(', ') : `keys=${Object.keys(goldenScalars).length}`);
  }
  // N3: normalize挙動一致
  {
    const diffs = [];
    for (const k of Object.keys(goldenProbes)) for (const sn of Object.keys(goldenProbes[k])) {
      if (JSON.stringify(goldenProbes[k][sn]) !== JSON.stringify((r.probes[k] || {})[sn])) diffs.push(k + '.' + sn);
    }
    check('N3 normalizeAppStateの挙動が凍結標本と一致(161キー×8シナリオ)', diffs.length === 0,
      diffs.length ? '差分: ' + diffs.slice(0, 6).join(', ') : '1288プローブ一致');
  }
  check('N4 旧h265選択はh264へ移行(列挙検査で既定へ潰されない)', r.h265 === 'h264', r.h265);
  check('N5 HTML入力欄は起動時にappStateの値で上書きされる(value属性は飾り)',
    Object.values(r.htmlCheck).every(v => v === 'OK'), JSON.stringify(r.htmlCheck));
  check('N6 ページエラーなし', errs.length===0, errs.slice(0,3).join(' | '));

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
