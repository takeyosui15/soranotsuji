// 中央寄せ画素チェッカー — ボタン内アイコン等の「見た目の中央ズレ」を画素で実測する再利用ツール
// (宙の辻 第33ラウンドのアイコン中心ズレ修正で手作りした画素実測の汎用化。ClaudeMederuU/tools/README.md参照)
//
// 使い方(CLI):  node ClaudeMederuU/tools/center-check.js <URL> <CSSセレクタ> [<CSSセレクタ>...]
//   各セレクタについて、(a)最初の子要素(svg/img等)の矩形中心と親の矩形中心のズレ、
//   (b)要素スクリーンショットの「インク重心」(不透明画素の重心)と幾何中心のズレ、を出力する。
//   どちらも±1.5px以内なら中央寄せOKの目安。
//
// 使い方(モジュール): const { measureCenters } = require('./center-check'); await measureCenters(page, ['#btn']);
//   (Playwrightのpageを渡す。verifyスクリプトへの組み込み用)

const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'];

/** ページ内で子要素中心のズレを測る(スクリーンショット不要の軽量版) */
async function measureChildOffsets(page, selectors) {
  return page.evaluate((sels) => sels.map(sel => {
    const el = document.querySelector(sel);
    if (!el) return { sel, ok: false, why: 'element not found' };
    const child = el.firstElementChild;
    if (!child) return { sel, ok: false, why: 'no child element' };
    const a = el.getBoundingClientRect(), c = child.getBoundingClientRect();
    const dx = (c.left + c.width / 2) - (a.left + a.width / 2);
    const dy = (c.top + c.height / 2) - (a.top + a.height / 2);
    return { sel, ok: Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5, dx: +dx.toFixed(2), dy: +dy.toFixed(2) };
  }), selectors);
}

/** 要素スクリーンショットのインク重心(不透明画素のアルファ加重重心)と幾何中心のズレを測る */
async function measureInkCentroid(page, selector) {
  const el = await page.$(selector);
  if (!el) return { sel: selector, ok: false, why: 'element not found' };
  const buf = await el.screenshot();
  // PNGのデコードはページ内のcanvasに任せる(依存ライブラリ不要)
  const b64 = buf.toString('base64');
  return page.evaluate(async ({ sel, b64 }) => {
    const img = new Image();
    await new Promise((ok, ng) => { img.onload = ok; img.onerror = ng; img.src = 'data:image/png;base64,' + b64; });
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    // 背景(四隅の多数色)と異なる画素を「インク」とみなし、その重心を取る
    const corner = [0, (cv.width - 1) * 4, (cv.height - 1) * cv.width * 4, (cv.width * cv.height - 1) * 4]
      .map(o => [d[o], d[o + 1], d[o + 2]]);
    const bg = corner[0];
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const o = (y * cv.width + x) * 4;
      const diff = Math.abs(d[o] - bg[0]) + Math.abs(d[o + 1] - bg[1]) + Math.abs(d[o + 2] - bg[2]);
      if (diff > 60) { sx += x; sy += y; n++; }
    }
    if (!n) return { sel, ok: false, why: 'no ink pixels' };
    const dx = sx / n - (cv.width - 1) / 2, dy = sy / n - (cv.height - 1) / 2;
    return { sel, ok: Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5, dx: +dx.toFixed(2), dy: +dy.toFixed(2), inkPx: n };
  }, { sel: selector, b64 });
}

/** まとめて測る(verify組み込み用の入口) */
async function measureCenters(page, selectors) {
  const child = await measureChildOffsets(page, selectors);
  const ink = [];
  for (const sel of selectors) ink.push(await measureInkCentroid(page, sel));
  return selectors.map((sel, i) => ({ sel, child: child[i], ink: ink[i] }));
}

module.exports = { measureChildOffsets, measureInkCentroid, measureCenters };

// ---- CLI ----
if (require.main === module) {
  (async () => {
    const [url, ...selectors] = process.argv.slice(2);
    if (!url || selectors.length === 0) {
      console.log('使い方: node ClaudeMederuU/tools/center-check.js <URL> <CSSセレクタ> [<CSSセレクタ>...]');
      process.exit(2);
    }
    const { chromium } = require('playwright-core');
    const b = await chromium.launch({ executablePath: EXE, headless: true, args: ARGS });
    const p = await b.newPage();
    await p.goto(url, { waitUntil: 'load' });
    await p.waitForTimeout(1500);
    const results = await measureCenters(p, selectors);
    let ng = 0;
    for (const r of results) {
      const ok = r.child.ok && (r.ink.ok || r.ink.why);   // インク側は測定不能時は子要素側のみで判定
      if (!ok) ng++;
      console.log(`${ok ? 'OK ' : 'NG '} ${r.sel}  child(dx=${r.child.dx},dy=${r.child.dy})  ink(${r.ink.ok !== undefined ? `dx=${r.ink.dx},dy=${r.ink.dy}` : r.ink.why})`);
    }
    await b.close();
    process.exit(ng ? 1 : 0);
  })().catch(e => { console.error('FATAL', e); process.exit(1); });
}
