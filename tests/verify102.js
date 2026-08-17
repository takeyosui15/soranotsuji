// 第20ラウンド検証: 実ネットワークE2E — 素のindex.html(CDN書き換え無し)+実Open-Meteo/実地理院/実光害アセットでの宙検索
//
// ※運用注意(2026-07-19決定のテスト方針): このスクリプトは相手側サーバーに実アクセスするため
//   **常用しない**。通常の検証はローカルハーネス(vendor+モック)で行い、これは問題発生時に
//   「ローカル環境との環境差かどうか」を切り分ける目的でのみ単発実行する。
//
// 前提(ネットワーク許可済みのClaude Codeクラウド環境で実行する場合):
//  1. リポジトリ直下を `python3 -m http.server 8099 --bind 127.0.0.1` で配信(vendor書き換え不要)
//  2. HTTPS_PROXY(エージェントプロキシ)経由の外部アクセスのため、Chromiumに以下が必要:
//     - プロキシCAをNSSストアへ登録: apt-get install libnss3-tools →
//       ca-bundle.crtをcsplitで分割し certutil -d sql:$HOME/.pki/nssdb -A -t "C,," で全て登録
//     - 起動引数 `--proxy-server=$HTTPS_PROXY` + `--proxy-bypass-list=<local>`(ローカルHTTPを直結に)
//     - 起動引数 `--ssl-version-max=tls1.2`(egressゲートウェイがChromiumのTLS1.3
//       ClientHelloをリセットするため。証明書検証は有効のまま。curl/node/opensslは1.3でも通る)
//  3. script.google.com(訪問カウンター)は意図的に不許可(本番カウンターを汚さないため)。
//     ERR_TUNNEL_CONNECTION_FAILED は想定内として除外する。
const { chromium } = require('playwright-core');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = 'http://127.0.0.1:8099';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--ssl-version-max=tls1.2', `--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=<local>'];
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };
(async () => {
  const b = await chromium.launch({
    executablePath: EXE, headless: true, args: ARGS,
  });
  const ctx = await b.newContext({ viewport: { width: 1000, height: 900 }, timezoneId: 'Asia/Tokyo' });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const netOk = new Map(), netFail = [];
  p.on('response', r => { const u = r.url(); if (!u.startsWith(BASE)) netOk.set(u, r.status()); });
  p.on('requestfailed', r => { const u = r.url(); if (!u.startsWith(BASE)) netFail.push(`${u} ${r.failure() && r.failure().errorText}`); });

  await p.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 60000 });
  await p.waitForFunction(() => typeof soraSearchRun === 'function', { timeout: 20000 });
  await p.waitForTimeout(2500);

  // R1: CDNライブラリが本物のCDNから読み込めた(書き換え無し)
  {
    const hosts = [...netOk.keys()];
    const hit = (s) => hosts.some(u => u.includes(s) && netOk.get(hosts.find(h => h === u)) === 200);
    check('R1 unpkg(Leaflet)', hit('unpkg.com'), hosts.filter(u => u.includes('unpkg')).map(u => netOk.get(u)).join(','));
    check('R1 jsDelivr(astronomy-engine等)', hit('cdn.jsdelivr.net'));
    check('R1 geographiclib(sourceforge)', hit('geographiclib.sourceforge.io'));
    const libs = await p.evaluate(() => ({ L: typeof L, Astronomy: typeof Astronomy, geod: typeof geodesic }));
    check('R1 ライブラリ実体(L/Astronomy/GeographicLib)', libs.L === 'object' && libs.Astronomy === 'object' && libs.geod === 'object', JSON.stringify(libs));
  }

  // R2: 地理院タイルが実サーバから取得できた
  {
    const gsi = [...netOk.entries()].filter(([u]) => u.includes('cyberjapandata.gsi.go.jp'));
    check('R2 地理院タイル取得(200あり)', gsi.some(([, s]) => s === 200), `count=${gsi.length}`);
  }

  // R3: 宙検索を実Open-Meteoで実行(モック無し)
  {
    const r = await p.evaluate(async () => {
      window.confirm = () => true; window.alert = () => { };
      appState.start = { lat: 35.30, lng: 138.60, elev: 500 };
      appState.end = { lat: 35.3606, lng: 138.7274, elev: 3776 };
      let omCalls = 0; const origFetch = window.fetch;
      window.fetch = async (u, o) => { if (String(u).includes('api.open-meteo.com')) omCalls++; return origFetch(u, o); };
      try { indexedDB.deleteDatabase('soranotsuji-wx'); } catch (_) { }
      _ssDbReady = null;
      document.getElementById('input-ss-days').value = '3';
      document.getElementById('sel-ss-preset').value = 'milkyway';
      const t0 = performance.now();
      await soraSearchRun();
      const ms = Math.round(performance.now() - t0);
      window.fetch = origFetch;
      const rows = [...document.querySelectorAll('#sorasearch-content tbody tr')];
      const head = [...document.querySelectorAll('#sorasearch-content thead th')].map(t => t.textContent);
      const si = head.indexOf('宙スコア'), lpI = head.indexOf('光害(SQM)'), dirI = head.indexOf('方向光害');
      const scores = rows.map(tr => parseFloat(tr.children[si].textContent)).filter(v => !isNaN(v));
      const lp = rows.length ? rows[0].children[lpI].textContent : '';
      const dir = rows.length ? rows[0].children[dirI].textContent : '';
      return {
        omCalls, ms, nRows: rows.length, status: document.getElementById('ss-status').textContent,
        title: document.getElementById('sorasearch-title').textContent,
        sMin: Math.min(...scores), sMax: Math.max(...scores), lp, dir,
      };
    });
    check('R3 実Open-Meteoで検索完了(行あり)', r.nRows > 0, `rows=${r.nRows} calls=${r.omCalls} ${r.ms}ms`);
    check('R3 宙検索結果タイトル+件数ステータス', /宙検索結果/.test(r.title) && /件/.test(r.status), r.status);
    check('R3 実応答スコアが0..100の範囲', r.sMin >= 0 && r.sMax <= 100, `min=${r.sMin} max=${r.sMax}`);
    check('R3 光害列に実SQM値(富士山麓)', /^\d\d\.\d/.test(r.lp) && /^\d\d\.\d/.test(r.dir), `lp=${r.lp} dir=${r.dir}`);
  }

  // R4: 2回目はIndexedDBキャッシュでコール0(実ネットワークでも同じ)
  {
    const r = await p.evaluate(async () => {
      let omCalls = 0; const origFetch = window.fetch;
      window.fetch = async (u, o) => { if (String(u).includes('api.open-meteo.com')) omCalls++; return origFetch(u, o); };
      await soraSearchRun();
      window.fetch = origFetch;
      return { omCalls, nRows: document.querySelectorAll('#sorasearch-content tbody tr').length };
    });
    check('R4 キャッシュヒットで実コール0', r.omCalls === 0 && r.nRows > 0, `calls=${r.omCalls} rows=${r.nRows}`);
  }

  // R5: 地理院の標高API・地名検索が実サーバで動く(位置情報メニューの実データ経路)
  {
    const r = await p.evaluate(async () => {
      const el = await (await fetch('https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=138.7274&lat=35.3606&outtype=JSON')).json();
      const ms = await (await fetch('https://msearch.gsi.go.jp/address-search/AddressSearch?q=' + encodeURIComponent('富士山'))).json();
      return { elev: el.elevation, n: Array.isArray(ms) ? ms.length : 0 };
    });
    check('R5 地理院標高API(富士山頂≒3776m)', Math.abs(r.elev - 3776) < 30, `elev=${r.elev}`);
    check('R5 地理院地名検索(候補あり)', r.n > 0, `candidates=${r.n}`);
  }

  const unexpected = netFail.filter(u => !u.includes('script.google.com'));
  check('E 外部リクエスト失敗なし(script.google.com=意図的不許可を除く)', unexpected.length === 0, unexpected.slice(0, 3).join(' | ') || `expected-blocked=${netFail.length}`);
  check('E ページエラーなし', errs.length === 0, errs.join(' | ').slice(0, 300));
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
