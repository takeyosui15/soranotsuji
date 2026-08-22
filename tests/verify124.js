// 第40ラウンド検証: ①地図レイヤー選択リストの縦4行化(スマホ横幅対策)
//                  ②URL短縮辞書の作り直し(v12: 「&キー名=」+「キー値」の2種規則+仮想の先頭&)
// 静的リント(L0〜L3)+ブラウザ検査(L4〜L7)。
// リントは壊した版での自己テスト付き(検出できないリンターは安心感だけを生む=第39ラウンドの学び)。
const fs = require('fs');
const path = require('path');
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// ---- コーデック一式をソースから抽出して実行(辞書配列と関数の実物を得る) ----
const begin = src.indexOf('const _QP_B64');
const end = src.indexOf('function buildBaseUrl');
const qp = {};
new Function('exports', src.slice(begin, end) +
  '\nexports.KEYS=_QP_KEYS_V12; exports.VALUES=_QP_VALUES_V12; exports.SEEDS12=_QP_SEEDS_V12; exports.SEEDS13=_QP_SEEDS_V13; exports.SEEDS14=_QP_SEEDS_V14; exports.SEEDS15=_QP_SEEDS_V15; exports.SEEDS16=_QP_SEEDS_V16; exports.SEEDS17=_QP_SEEDS_V17; exports.SEEDS18=_QP_SEEDS_V18; exports.SEEDS19=_QP_SEEDS_V19; exports.SEEDS20=_QP_SEEDS_V20;' +
  'exports.VERSIONS=_QP_SEED_VERSIONS; exports.PRIME_FROM=_QP_PRIME_FROM;' +
  'exports.enc=encodeQueryParam; exports.dec=decodeQueryParam;')(qp);

// ---- L0: APP_VERSIONの存在(版数ピンは最新のverifyに集約=現在はverify125) ----
check('L0 APP_VERSIONが存在(版数ピンは最新のverifyに集約)', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) || !!process.argv[2]);
check('L0 Version Historyに最新版の行がある', /Version \d+\.\d+\.\d+ - /.test(src) || !!process.argv[2]);

// ---- L1: v12辞書の2種規則(①「&キー名=」の元は裸のキー名 ②「キー値」は区切りを含まない) ----
const lintShape = (keys, values) => {
  const bad = [];
  for (const k of keys) if (!/^[A-Za-z][A-Za-z0-9]*$/.test(k)) bad.push('key:' + k);
  for (const v of values) if (/[&=]/.test(v)) bad.push('value:' + v);   // 「=値&」のような区切り付き値を禁止
  return bad;
};
{
  const bad = lintShape(qp.KEYS, qp.VALUES);
  check('L1 v12辞書が2種規則に従う(キー=裸の名前/値=区切りなし)', bad.length === 0, bad.join(', '));
  // シード合成の確認: SEEDS12 = KEYSを「&キー名=」化 + VALUESそのまま
  const expect = qp.KEYS.map(k => '&' + k + '=').concat(qp.VALUES);
  check('L1 _QP_SEEDS_V12の合成が「&キー名=」+「キー値」と一致',
    JSON.stringify(qp.SEEDS12) === JSON.stringify(expect), `seeds=${qp.SEEDS12.length}`);
  // 自己テスト: 区切り付き値(旧v11流)を混ぜた版を正しく検出できるか
  const det = lintShape(qp.KEYS, qp.VALUES.concat(['=true&']));
  check('L1 自己テスト: 壊した辞書(=true&混入)を検出できる', det.length === 1 && det[0] === 'value:=true&');
}

// ---- L2: キー網羅(URLビルダーが出力する全キーが辞書のキー一覧にある) ----
function emitKeys() {
  const keys = new Set();
  for (const m of src.matchAll(/(?:params|urlParams)\.(?:set|append)\('(\w+)'/g)) keys.add(m[1]);
  // buildCommonUrlParams内の配列forEach(sora*/fw*/ss*の一括出力)
  const m = src.match(/function buildCommonUrlParams[\s\S]*?\n\}/);
  if (m) for (const a of m[0].matchAll(/\[((?:\s*'[^']+'\s*,?\n?)+)\]\s*\.forEach/g))
    for (const s of a[1].matchAll(/'([^']+)'/g)) keys.add(s[1]);
  // 全域の「['キー',…].forEach(k => params.set(k,」形の一括出力も拾う(第80ラウンド: 月間フィルタ。
  // 区切りを一意にした形(各繰り返しがカンマ始まり)でバックトラック爆発を避ける)
  for (const a of src.matchAll(/\[\s*('\w+'(?:\s*,\s*'\w+')*)\s*\]\.forEach\(\w+ => params\.set\(\w+,/g))
    for (const s of a[1].matchAll(/'([^']+)'/g)) keys.add(s[1]);
  return keys;
}
const EMIT = emitKeys();
const lintCoverage = (dictKeys) => [...EMIT].filter(k => !dictKeys.includes(k));
{
  // v14以降に追加されたキー(「&キー名=既定値」形シード)も辞書網羅の対象に含める
  // (第62ラウンド: 曜日フィルタ16キー / 第80ラウンド: 月間フィルタ26キー=v15 /
  //  第88ラウンド: 大気差・気象・基本オプション16キー=v16)
  const v14Keys = qp.SEEDS14.filter(x => !qp.SEEDS13.includes(x)).map(x => x.replace(/^&/, '').replace(/=.*$/, ''));
  const v15Keys = qp.SEEDS15.filter(x => !qp.SEEDS14.includes(x)).map(x => x.replace(/^&/, '').replace(/=.*$/, ''));
  const v16Keys = qp.SEEDS16.filter(x => !qp.SEEDS15.includes(x)).map(x => x.replace(/^&/, '').replace(/=.*$/, ''));
  const v17Keys = qp.SEEDS17.filter(x => !qp.SEEDS16.includes(x)).map(x => x.replace(/^&/, '').replace(/=.*$/, ''));
  const v18Keys = qp.SEEDS18.filter(x => !qp.SEEDS17.includes(x)).map(x => x.replace(/^&/, '').replace(/=.*$/, ''));
  const v19Keys = qp.SEEDS19.filter(x => !qp.SEEDS18.includes(x)).map(x => x.replace(/^&/, '').replace(/=.*$/, ''));
  const v20Keys = qp.SEEDS20.filter(x => !qp.SEEDS19.includes(x)).map(x => x.replace(/^&/, '').replace(/=.*$/, ''));
  const DICT_KEYS = qp.KEYS.concat(v14Keys, v15Keys, v16Keys, v17Keys, v18Keys, v19Keys, v20Keys);
  const missing = lintCoverage(DICT_KEYS);
  check('L2 URLビルダーが出力する全キーが辞書(v12キー+v14〜v20追加)にある(キー追加の入れ忘れ検知)',
    missing.length === 0, missing.length ? '辞書漏れ: ' + missing.join(', ') : `emit=${EMIT.size}keys v14=${v14Keys.length} v15=${v15Keys.length} v16=${v16Keys.length} v17=${v17Keys.length} v18=${v18Keys.length} v19=${v19Keys.length} v20=${v20Keys.length}`);
  const dead = DICT_KEYS.filter(k => !EMIT.has(k));
  check('L2 辞書に死にキー(どのビルダーも出力しないキー)がない', dead.length === 0, dead.join(', '));
  // 自己テスト: 辞書からキーを1つ削った版で漏れを検出できるか
  const det = lintCoverage(DICT_KEYS.filter(k => k !== 'fwLat'));
  check('L2 自己テスト: 辞書からfwLatを削った版を検出できる', det.length === 1 && det[0] === 'fwLat');
}

// ---- L3: 旧版の凍結(版数と旧辞書の存在)+旧v11短縮URLの復号(Node内で実行) ----
{
  check('L3 辞書はv12以降(旧版は凍結保管。最新版数の等値ピンは最新のverifyが持つ)',
    qp.VERSIONS.length >= 12 && qp.PRIME_FROM === 12, `versions=${qp.VERSIONS.length}`);
  // 第40ラウンド時点の実アプリで発行したv11短縮URL(凍結リグレッション)。
  // 旧辞書のシード列が1つでも変わるとこの復号が壊れる(発行済みURLを読む保証)。
  const legacy = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'qp-v11-sample.json'), 'utf8'));
  check('L3 発行済みv11短縮URLが復号できる(旧辞書の凍結保証)', qp.dec(legacy.short) === legacy.long,
    `short=${legacy.short.length}chars`);
  // 最新版の基本往復(仮想の先頭&: 先頭キーに&なしで往復一致)
  const s = 'mode=preview&dp=true&starId=Sun&starId=Moon';
  const e = qp.enc(s);
  check('L3 最新版の往復一致+版数プレフィックス', qp.dec(e) === s && e.startsWith(`~${qp.VERSIONS.length}~`), e.slice(0, 12));
  check('L3 空文字と壊れた入力の安全動作', qp.enc('') === '' && qp.dec('') === '' && qp.dec(`~${qp.VERSIONS.length + 1}~AAAA`) === null);
}

// ============================================================
// ここからブラウザ検査: レイヤーリスト縦4行+実ビルダーの短縮URL往復+URL復元
// ============================================================
(async () => {
  const { chromium } = require('playwright-core');
  const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const BASE='http://127.0.0.1:8099';
  const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Tokyo'});   // スマホ幅(iPhone級)
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:10000});
  await p.waitForTimeout(400);

  // L4: レイヤー選択リストが縦4行(スマホ幅で画面内に収まり、宙の辻パネルの下へ潜らない)
  {
    await p.click('#gl-layer-toggle');
    await p.waitForTimeout(200);
    const r = await p.evaluate(() => {
      const labels = [...document.querySelectorAll('.gl-layer-list label')].map(l => {
        const b = l.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y) };
      });
      const list = document.querySelector('.gl-layer-list').getBoundingClientRect();
      return { labels, right: Math.round(list.right), vw: window.innerWidth };
    });
    const sameX = r.labels.every(l => l.x === r.labels[0].x);
    const incY = r.labels.every((l, i) => i === 0 || l.y > r.labels[i - 1].y);
    // 第56ラウンドで「3D風ビル」チェックが加わり4行→5行(検査の狙い=縦積みで画面内、は不変)
    check('L4 レイヤーリストが縦5行(全ラベル同x・yが単調増加)',
      r.labels.length === 5 && sameX && incY, JSON.stringify(r.labels));
    check('L4 リストがスマホ幅の画面内に収まる(右端<画面幅)', r.right < r.vw, `right=${r.right} vw=${r.vw}`);
    await p.click('#gl-layer-toggle');   // 閉じて後続へ
  }

  // L5: 実ビルダーの短縮URLが「版数プレフィックス付き・復号すると長いURLと同一」
  {
    const r = await p.evaluate(() => {
      appState.currentDate = new Date(2026, 6, 22, 20, 30, 0);
      const grab = (fn) => {
        const saved = navigator.clipboard.writeText; const got = [];
        navigator.clipboard.writeText = (s) => { got.push(s); return Promise.resolve(); };
        const oa = window.alert; window.alert = () => {};
        try { fn(); } finally { navigator.clipboard.writeText = saved; window.alert = oa; }
        return got[0] || '';
      };
      const chk = document.getElementById('url-picker-short');
      const out = [];
      for (const [name, fn] of [
        ['loc', () => copyLocationUrl('fixed')], ['locNone', () => copyLocationUrl('none')],
        ['soramado', () => copySoramadoUrl('fixed')], ['tsuji', () => copyTsujiSearchUrl('fixed')],
        ['mesh', () => copyTsujiMeshUrl('fixed')]]) {
        chk.checked = false; const long = grab(fn).split('?')[1];
        chk.checked = true; const short = grab(fn).split('?query=')[1];
        const dec = decodeQueryParam(decodeURIComponent(short));
        out.push({ name, v12: /^~\d+~/.test(decodeURIComponent(short)), same: dec === long,
                   shortLen: short.length, longLen: long.length });
      }
      return out;
    });
    check('L5 短縮URLの5ケース(位置情報の日時あり/なし・宙の窓・辻検索・辻メッシュ)が復号で長いURLと一致',
      r.every(x => x.v12 && x.same), r.map(x => `${x.name}:${x.longLen}→${x.shortLen}`).join(' '));
  }

  // L6: 最新版の短縮URLでの復元(仮想の先頭&が復元系を壊さない end-to-end)
  {
    const q = 'date=20260101&time=120000&timeZone=%2B0900&startLat=34.56&startLng=135.43&dp=true&mode=preview';
    const e = qp.enc(q);
    const p2 = await ctx.newPage();
    const errs2 = []; p2.on('pageerror', er => errs2.push(er.message));
    await p2.goto(BASE + '/index.html?query=' + encodeURIComponent(e), { waitUntil: 'load' });
    await p2.waitForFunction(() => typeof appState === 'object', { timeout: 10000 });
    await p2.waitForTimeout(600);
    const r = await p2.evaluate(() => ({
      lat: appState.start.lat, lng: appState.start.lng, dp: appState.isDPActive,
      ymd: `${appState.currentDate.getFullYear()}${String(appState.currentDate.getMonth() + 1).padStart(2, '0')}${String(appState.currentDate.getDate()).padStart(2, '0')}`,
      hh: appState.currentDate.getHours(),
    }));
    check('L6 短縮URLから状態復元(観測点/日時/辻ライン)',
      r.lat === 34.56 && r.lng === 135.43 && r.dp === true && r.ymd === '20260101' && r.hh === 12,
      JSON.stringify(r));
    check('L6 短縮URL復元でページエラーなし', errs2.length === 0, errs2.slice(0, 3).join(' | '));
    await p2.close();
  }

  check('L7 ページエラーなし', errs.length===0, errs.slice(0,3).join(' | '));

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
