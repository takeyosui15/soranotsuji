// 配信先(開発サイト/本番)を本物のネットワークで開き、起動時の CSP違反・ページエラー・ライブラリ・ワーカー・通信先ホストを確かめる(第163)
// 使い方: NODE_PATH=<harness>/node_modules node tests/live-site-check.js [URL]   (既定は開発サイト。本番は https://soranotsuji.net/)
// 常用しない(実ネットワーク)。配った直後の確認用。CCR_PROXY_CA_SPKI は Claude の箱(出口プロキシ)でだけ要る。
let chromium; try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require('playwright-core')); }
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.argv[2] || 'https://takeyosui15.github.io/soranotsuji-dev/';
(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', ...(process.env.CCR_PROXY_CA_SPKI ? ['--ignore-certificate-errors-spki-list=' + process.env.CCR_PROXY_CA_SPKI] : [])] /* 箱の出口プロキシの CA(公開鍵)だけを信頼する(検証は切らない) */ });
  const ctx = await b.newContext({ viewport: { width: 1000, height: 900 }, timezoneId: 'Asia/Tokyo' });
  const p = await ctx.newPage();
  const errors = [], csp = [], hosts = new Map(), scripts = [];
  p.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  p.on('console', m => { const t = m.text(); if (/Content Security Policy|CSP違反/.test(t)) csp.push(t.slice(0, 200)); });
  p.on('request', r => { const u = new URL(r.url()); hosts.set(u.host, (hosts.get(u.host) || 0) + 1); if (r.resourceType() === 'script') scripts.push(u.host + u.pathname); });
  await p.goto(BASE, { waitUntil: 'load', timeout: 90000 });
  await p.waitForFunction(() => typeof appState !== 'undefined' && typeof setupUI === 'function', { timeout: 60000 });
  await p.waitForTimeout(6000);
  const u = await p.evaluate(async () => {
    const ver = document.getElementById('app-version') ? document.getElementById('app-version').textContent : null;
    const w = await new Promise(res => { try { const wk = new Worker('tsuji-search-worker.js'); const t = setTimeout(() => res('alive'), 2500); wk.onerror = e => { clearTimeout(t); res('error: ' + (e.message || '')); }; } catch (e) { res('throw: ' + e.message); } });
    return { ver, appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : null, csp: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'), maplibre: typeof maplibregl === 'object', three: window.THREE ? String(THREE.REVISION) : null, astro: typeof Astronomy === 'object', geod: typeof geodesic === 'object', qr: typeof qrcode === 'function', sources: (typeof glMap !== 'undefined' && glMap && glMap.getStyle) ? Object.keys(glMap.getStyle().sources).length : 0, inline: document.querySelectorAll('[onclick]').length, worker: w };
  });
  const scriptHosts = [...new Set(scripts.map(s => s.split('/')[0]))];
  console.log(JSON.stringify({ u, cspViolations: csp, pageErrors: errors, scriptHosts, hosts: Object.fromEntries(hosts) }, null, 1));
  await b.close();
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
