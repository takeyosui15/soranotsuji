// 開発ツール: ローカルglyphs(SDFフォントPBF)の生成 — 辻ライン時刻ラベルのsymbolレイヤ用
// 実行(まれ。フォント追加時のみ): NODE_PATH=<harness>/node_modules node tests/build-glyphs.js
//   → fonts/SoraSans/0-255.pbf を生成してリポジトリへコミットする(オフライン方針: 外部フォント配信に依存しない)
// 生成方式: ChromiumのcanvasでASCII 32〜126を太字24pxで描画→SDF化(TinySDF/fontnikと同じ
//   パラメータ: buffer=3, radius=8, cutoff=0.25)→mapboxのglyphs.protoでPBFエンコード。
//   ビットマップの元字形は実行環境のsans-serif(コンテナはDejaVu Sans。再配布可ライセンス)。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'];

const PAGE_FN = `(() => {
  const SIZE = 24, BUF = 3, RADIUS = 8, CUTOFF = 0.25;
  const INF = 1e20;
  // Felzenszwalb 1D距離変換(TinySDFと同一アルゴリズム)
  function edt1d(grid, offset, stride, length, f, v, z) {
    v[0] = 0; z[0] = -INF; z[1] = INF; f[0] = grid[offset];
    for (let q = 1, k = 0, s = 0; q < length; q++) {
      f[q] = grid[offset + q * stride];
      const q2 = q * q;
      do { const r = v[k]; s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2; } while (s <= z[k] && --k > -1);
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    for (let q = 0, k = 0; q < length; q++) {
      while (z[k + 1] < q) k++;
      const r = v[k];
      grid[offset + q * stride] = f[r] + (q - r) * (q - r);
    }
  }
  function edt(data, w, h, f, v, z) {
    for (let x = 0; x < w; x++) edt1d(data, x, w, h, f, v, z);
    for (let y = 0; y < h; y++) edt1d(data, y * w, 1, w, f, v, z);
  }
  // 1文字のSDFビットマップとメトリクスを作る
  function drawGlyph(ch) {
    const cv = document.createElement('canvas');
    const pad = SIZE;
    cv.width = SIZE * 3; cv.height = SIZE * 3;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.font = 'bold ' + SIZE + 'px sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000';
    const m = ctx.measureText(ch);
    const glyphAdvance = m.width;
    const asc = Math.ceil(m.actualBoundingBoxAscent || 0);
    const desc = Math.ceil(m.actualBoundingBoxDescent || 0);
    const gw = Math.ceil(m.actualBoundingBoxRight || glyphAdvance) + Math.ceil(m.actualBoundingBoxLeft || 0);
    const gh = asc + desc;
    if (gw === 0 || gh === 0) return { id: ch.charCodeAt(0), advance: Math.round(glyphAdvance), bitmap: null };
    ctx.fillText(ch, pad, pad + asc);
    const w = gw + 2 * BUF, h = gh + 2 * BUF;
    const img = ctx.getImageData(pad - BUF, pad - BUF, w, h).data;
    const n = w * h;
    const gridOuter = new Float64Array(n), gridInner = new Float64Array(n);
    const f = new Float64Array(Math.max(w, h)), vv = new Uint16Array(Math.max(w, h)), z = new Float64Array(Math.max(w, h) + 1);
    for (let i = 0; i < n; i++) {
      const a = img[i * 4 + 3] / 255;   // alpha被覆率
      gridOuter[i] = a === 1 ? 0 : a === 0 ? INF : Math.pow(Math.max(0, 0.5 - a), 2);
      gridInner[i] = a === 1 ? INF : a === 0 ? 0 : Math.pow(Math.max(0, a - 0.5), 2);
    }
    edt(gridOuter, w, h, f, vv, z);
    edt(gridInner, w, h, f, vv, z);
    const bitmap = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const d = Math.sqrt(gridOuter[i]) - Math.sqrt(gridInner[i]);
      bitmap[i] = Math.max(0, Math.min(255, Math.round(255 - 255 * (d / RADIUS + CUTOFF))));
    }
    // fontnik互換メトリクス: width/height=字形寸法(バッファ抜き)・top=ベースライン上の高さ-アセンダ基準20
    return { id: ch.charCodeAt(0), bitmap: Array.from(bitmap), width: gw, height: gh,
             left: 0, top: asc - 20, advance: Math.round(glyphAdvance) };
  }
  // ---- protobufエンコード(glyphs.proto: glyphs>stacks>glyphs) ----
  const out = [];
  const varint = (n) => { n = n >>> 0; do { let b = n & 0x7f; n >>>= 7; out.push(n ? b | 0x80 : b); } while (n); };
  const varintInto = (arr, n) => { n = n >>> 0; do { let b = n & 0x7f; n >>>= 7; arr.push(n ? b | 0x80 : b); } while (n); };
  const zigzag = (n) => (n << 1) ^ (n >> 31);
  const bytesField = (arr, field, bytes) => { varintInto(arr, (field << 3) | 2); varintInto(arr, bytes.length); for (const b of bytes) arr.push(b); };
  const strField = (arr, field, s) => bytesField(arr, field, Array.from(new TextEncoder().encode(s)));
  const uintField = (arr, field, n) => { varintInto(arr, (field << 3) | 0); varintInto(arr, n); };
  const sintField = (arr, field, n) => { varintInto(arr, (field << 3) | 0); varintInto(arr, zigzag(n)); };
  const glyphMsgs = [];
  for (let c = 32; c <= 126; c++) {
    const g = drawGlyph(String.fromCharCode(c));
    const gm = [];
    uintField(gm, 1, g.id);
    if (g.bitmap) bytesField(gm, 2, g.bitmap);
    uintField(gm, 3, g.width || 0);
    uintField(gm, 4, g.height || 0);
    sintField(gm, 5, g.left || 0);
    sintField(gm, 6, g.top || 0);
    uintField(gm, 7, g.advance);
    glyphMsgs.push(gm);
  }
  const stack = [];
  strField(stack, 1, 'SoraSans');
  strField(stack, 2, '0-255');
  for (const gm of glyphMsgs) bytesField(stack, 3, gm);
  bytesField(out, 1, stack);   // glyphs.stacks
  return btoa(String.fromCharCode.apply(null, out));
})()`;

(async () => {
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ARGS });
  const p = await b.newPage();
  const b64 = await p.evaluate(PAGE_FN);
  const buf = Buffer.from(b64, 'base64');
  const dir = path.join(__dirname, '..', 'fonts', 'SoraSans');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '0-255.pbf'), buf);
  console.log('wrote fonts/SoraSans/0-255.pbf', buf.length, 'bytes');
  await b.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
