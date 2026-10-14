#!/usr/bin/env node
// 可視マップ 段2: 計算の道具(静的資産を作る側)。デッサン docs/dessin/dessin/05-kashimap.md 第7版「実装の段取り」段2。
// 推し山(data/mountains.json の索引番号)を中心に、範囲(km四方)の地理院DEMタイル(z15: dem5a→5b→5c、無ければ z14 dem_png)
// を読み、「地上1.5mに立った人から山頂が見えるか」を全画素で判定する。
// 判定: 山頂から放射状(R2=窓の縁の全画素へ光線)に、地球の丸み+大気差(k固定)の沈み込み d²/(2Reff) を引いた
// 見かけ高度角の最大値を更新しながら外へ歩く(1画素を光線ごとに1回)。アプリの統一可視判定(_visJudgeCore)と同じ式
// (e − d²·inv2R と直線の比較)で、除外規則(目的点側15m・観測点側10m)も同じ。
// 目的点側の除外は「山頂部」(山頂から summit-drop 以内の高さの画素の広がり)。--summit-mode region(既定)はその画素の地形を
// 遮蔽に数えない(中心も半径も要らない)。circle は山頂から一定半径の円(--excl-target。無指定なら山頂部の最遠距離から自動)。
// 出力(out/<id>-<range>km-z<z>-<canopy>[-<tag>]/): visible.bin(1bitの見える/見えない・行優先)・islands.json(島の索引)・
// outline.json(島の輪郭=外周+穴。画素の角の整数座標を間引いてポリライン符号で圧縮・アプリ用)・meta.json(計算条件)・preview.png(縮小画像)。
// --asset <dir> を付けると <dir>/<id>/<terrain|canopy>/<range>/ にアプリ用の3点(meta/islands/outline)を置き、<dir>/index.json を更新する。
// 使い方: node tools/kashimap/viewshed.js --id 368 --range 60 [--zoom 15] [--k 0.132] [--obs 1.5] [--concurrency 6]
//         [--check 2000] [--preview 1024] [--summit-mode region|circle] [--summit-drop 300] [--summit-search 3000] [--excl-target M]
//         [--tol 0] [--tag 名前] [--asset data/kashimap/v1] [--geojson true] [--cache tools/kashimap/cache] [--out tools/kashimap/out]
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const https = require('https');
const { URL } = require('url');

const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = (i + 1 < process.argv.length && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : 'true'; args[k] = v; } }
const HERE = __dirname;
const REPO = path.join(HERE, '..', '..');
const SORA = require(path.join(REPO, 'sora-constants.js'));   // 数の単一情報源(本体・ワーカーと同じ値)
const ID = String(args.id || '368');
const RANGE_KM = parseFloat(args.range || '60');
const Z = parseInt(args.zoom || '15', 10);
const K = args.k !== undefined ? parseFloat(args.k) : SORA.REFRACTION.K_STANDARD;   // 気差係数(既定=測量標準0.132。sora-constants.js)
const OBS_H = args.obs !== undefined ? parseFloat(args.obs) : SORA.OBSERVER.EYE_HEIGHT_M;
const CONC = parseInt(args.concurrency || '6', 10);
const CHECK_N = parseInt(args.check || '2000', 10);
const PREVIEW = parseInt(args.preview || '1024', 10);
const SUMMIT_MODE = String(args['summit-mode'] || 'region');   // region=山頂部の画素を遮蔽に数えない / circle=山頂から一定半径の円を除外
if (!['region', 'circle'].includes(SUMMIT_MODE)) { console.error('--summit-mode は region か circle'); process.exit(1); }
const DP_TOL = parseFloat(args.tol || '0');        // 輪郭の間引き(Douglas-Peucker)の許容値(画素)。既定0=間引かない(第151・依頼者指示: 正確な情報を。直線上の中間点だけ落とす)。1.0で頂点が約1/3(富士山60km: 328万→107万)
const TAG = args.tag ? '-' + String(args.tag).replace(/[^\w.-]/g, '_') : '';   // 出力フォルダの添え名(実験の区別)
const ASSET_DIR = args.asset ? path.resolve(args.asset) : null;              // アプリ用資産の置き場(例 data/kashimap/v1)
const WRITE_GEOJSON = args.geojson === 'true';                               // 確認用のGeoJSON(大きい。既定は書かない)
const PROBES = (args.probe || '').split(';').map(t => t.trim()).filter(Boolean).map(t => { const [lat, lon, name] = t.split(','); return { lat: +lat, lon: +lon, name: name || `${lat},${lon}` }; });   // 既知の展望地の見通しを1本ずつ歩いて報告
const CANOPY = args.canopy === 'true';      // 段2後半(樹冠)。今はfalse固定
const EXCL_TARGET_ARG = args['excl-target'] !== undefined ? parseFloat(args['excl-target']) : null;   // 目的点側の除外半径(m)。無指定=山頂部の広がりから自動
const SUMMIT_DROP_M = args['summit-drop'] !== undefined ? parseFloat(args['summit-drop']) : SORA.VISIBILITY.SUMMIT_BAND_M;   // 「山頂部」= 山頂からこの高さ以内で山頂につながる画素(山の体そのもの。他の山の山頂を含まない高さまで縮める)
const SUMMIT_SEARCH_M = args['summit-search'] !== undefined ? parseFloat(args['summit-search']) : SORA.VISIBILITY.SUMMIT_SEARCH_M;   // 山頂部を探す半径(m)
const CACHE = path.resolve(args.cache || path.join(HERE, 'cache'));
const OUT_ROOT = path.resolve(args.out || path.join(HERE, 'out'));
const R_EARTH = SORA.EARTH.HAVERSINE_RADIUS_M;   // 球の半径(本体のハバーサインと同じ値)
const EXCL_OBS_M = SORA.VISIBILITY.EXCLUDE_OBSERVER_M;   // 観測点側の除外半径(アプリの既定と同じ)
let EXCL_TGT_M = SORA.VISIBILITY.EXCLUDE_TARGET_M;                          // 目的点側の除外半径。アプリの既定は15m。山頂部の広がりで自動的に広げる(下のsummitInfo)
const UA = 'soranotsuji-dev kashimap viewshed (https://github.com/takeyosui15/soranotsuji-dev)';
const NODATA = SORA.DEM.GRID_NODATA;         // Uint16格子の「データ無し」。値=round((標高+100)×10)
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- 山データ ----------
const mdata = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'mountains.json'), 'utf8'));
const M = mdata.mountains.find(m => m.id === ID);
if (!M) { console.error('山が見つかりません: id=' + ID); process.exit(1); }
log(`対象: ${M.name}${M.peak ? '(' + M.peak + ')' : ''} 索引番号${M.id} ${M.elev}m (${M.lat}, ${M.lon}) 範囲${RANGE_KM}km四方 z${Z} k=${K} 観測者${OBS_H}m`);

// ---------- タイル座標 ----------
const WORLD = 256 * Math.pow(2, Z);
const lonToX = lon => (lon + 180) / 360 * WORLD;
const latToY = lat => (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * WORLD;
const xToLon = x => x / WORLD * 360 - 180;
const yToLat = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / WORLD))) * 180 / Math.PI;
const MPP = SORA.metersPerPixel(M.lat, Z);   // 中心緯度での1画素(m)。窓の中で約±0.4%変わる(式は sora-constants.js)
const cxF = lonToX(M.lon), cyF = latToY(M.lat);
const halfPx = Math.ceil(RANGE_KM * 1000 / 2 / MPP);
const X0 = Math.floor(cxF) - halfPx, Y0 = Math.floor(cyF) - halfPx;
const W = 2 * halfPx + 1, H = W;
const CX = halfPx, CY = halfPx;              // 窓内の山頂画素
const TX0 = Math.floor(X0 / 256), TX1 = Math.floor((X0 + W - 1) / 256), TY0 = Math.floor(Y0 / 256), TY1 = Math.floor((Y0 + H - 1) / 256);
const NT = (TX1 - TX0 + 1) * (TY1 - TY0 + 1);
log(`窓: ${W}×${H}画素(1画素≈${MPP.toFixed(2)}m) タイル${TX1 - TX0 + 1}×${TY1 - TY0 + 1}=${NT}枚`);

// ---------- PNG ----------
function pngDecode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
  let pos = 8, w = 0, h = 0, ct = 0, bd = 0; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString('ascii', pos + 4, pos + 8); const body = buf.subarray(pos + 8, pos + 8 + len); pos += 12 + len;
    if (type === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); bd = body[8]; ct = body[9]; if (body[12] !== 0) throw new Error('interlaced'); }
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
  }
  if (bd !== 8) throw new Error('bitdepth ' + bd);
  const ch = { 2: 3, 6: 4, 0: 1, 4: 2, 3: 1 }[ct];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch; const out = Buffer.alloc(w * h * ch); let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++]; const o = y * stride; const po = o - stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[p + i]; const a = i >= ch ? out[o + i - ch] : 0; const b = y > 0 ? out[po + i] : 0; const c = (y > 0 && i >= ch) ? out[po + i - ch] : 0;
      let v;
      if (f === 0) v = x; else if (f === 1) v = x + a; else if (f === 2) v = x + b; else if (f === 3) v = x + ((a + b) >> 1);
      else { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v = x + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)); }
      out[o + i] = v & 255;
    }
    p += stride;
  }
  return { w, h, ch, data: out, ct };
}
function pngEncodeRGB(w, h, rgb) {
  const stride = w * 3; const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const crcTable = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); crcTable[n] = c; }
  const crc = b => { let c = -1; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, body) => { const len = Buffer.alloc(4); len.writeUInt32BE(body.length); const tb = Buffer.concat([Buffer.from(type, 'ascii'), body]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(tb)); return Buffer.concat([len, tb, cc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- タイル取得(キャッシュ・フォールバック・並列数の上限) ----------
function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const done = (res) => { if (res.statusCode === 404) { res.resume(); return resolve(null); } if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' ' + url)); } const bufs = []; res.on('data', d => bufs.push(d)); res.on('end', () => resolve(Buffer.concat(bufs))); res.on('error', reject); };
    if (proxy) {
      // 環境のプロキシ(CONNECT)経由。証明書検証はそのまま(NODE_EXTRA_CA_CERTS等は環境が設定)
      const pu = new URL(proxy); const http = require('http');
      const req = http.request({ host: pu.hostname, port: pu.port, method: 'CONNECT', path: `${u.hostname}:443`, headers: pu.username ? { 'Proxy-Authorization': 'Basic ' + Buffer.from(decodeURIComponent(pu.username) + ':' + decodeURIComponent(pu.password)).toString('base64') } : {} });
      req.on('connect', (res, socket) => {
        if (res.statusCode !== 200) return reject(new Error('proxy CONNECT ' + res.statusCode));
        const r2 = https.request({ host: u.hostname, path: u.pathname + u.search, method: 'GET', headers: { 'User-Agent': UA }, socket, agent: false, servername: u.hostname }, done);
        r2.on('error', reject); r2.end();
      });
      req.on('error', reject); req.end();
    } else {
      const r = https.request({ host: u.hostname, path: u.pathname + u.search, method: 'GET', headers: { 'User-Agent': UA } }, done);
      r.on('error', reject); r.end();
    }
  });
}
async function fetchTileCached(kind, z, x, y) {
  const dir = path.join(CACHE, kind, String(z), String(x)); const fn = path.join(dir, y + '.png'); const miss = path.join(dir, y + '.404');
  if (fs.existsSync(fn)) return fs.readFileSync(fn);
  if (fs.existsSync(miss)) return null;
  fs.mkdirSync(dir, { recursive: true });
  let buf = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { buf = await fetchBuf(`${SORA.DEM.GSI_TILE_BASE}${kind}/${z}/${x}/${y}.png`); break; }
    catch (e) { if (attempt === 2) throw e; await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); }
  }
  if (buf) fs.writeFileSync(fn, buf); else fs.writeFileSync(miss, '');
  return buf;
}
const grid = new Uint16Array(W * H).fill(NODATA);
const stats = { fetched: 0, cached: 0, from5a: 0, from5b: 0, from5c: 0, from14: 0, filled: 0, missing: 0 };
// 標高タイルの源(窓のズームごと。順に試し、画素ごとに無い所を次の源で埋める=第154。前はタイルが在れば次の源を見ず、5Aの測量範囲の縁でタイルの形の穴が残っていた)
const SOURCES = Z >= 15 ? [{ kind: 'dem5a_png', z: 15 }, { kind: 'dem5b_png', z: 15 }, { kind: 'dem5c_png', z: 15 }, { kind: 'dem_png', z: 14 }] : [{ kind: 'dem_png', z: Z }];
function decodeElevInto(png, tx, ty, zt, clip) {
  // タイル(zt)の画素を窓の格子へ。zt=Z-1 のときは2倍に引き伸ばす(最近傍)。既に値のある画素は上書きしない。
  // clip=書き込む窓の範囲(zのタイル1枚分。z-1の親タイルを隣のタイルの分まで書いて、後から来る隣の5A/5B/5Cを塞がないため。第153)
  const scale = Math.pow(2, Z - zt);
  const { w, ch, data } = png;
  const originX = tx * 256 * scale - X0, originY = ty * 256 * scale - Y0;
  const cx0 = Math.max(0, clip ? clip.x0 : 0), cy0 = Math.max(0, clip ? clip.y0 : 0), cx1 = Math.min(W - 1, clip ? clip.x1 : W - 1), cy1 = Math.min(H - 1, clip ? clip.y1 : H - 1);
  for (let py = 0; py < 256; py++) {
    const gy0 = originY + py * scale; if (gy0 + scale - 1 < cy0 || gy0 > cy1) continue;
    for (let px = 0; px < 256; px++) {
      const gx0 = originX + px * scale; if (gx0 + scale - 1 < cx0 || gx0 > cx1) continue;
      const o = (py * w + px) * ch; let v = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2];
      if (v === 0x800000) continue;
      if (v > 0x800000) v -= 0x1000000;
      const code = Math.round((v * 0.01 + 100) * 10);
      if (code < 0 || code >= NODATA) continue;
      for (let sy = 0; sy < scale; sy++) {
        const gy = gy0 + sy; if (gy < cy0 || gy > cy1) continue;
        for (let sx = 0; sx < scale; sx++) {
          const gx = gx0 + sx; if (gx < cx0 || gx > cx1) continue;
          const gi = gy * W + gx; if (grid[gi] === NODATA) grid[gi] = code;
        }
      }
    }
  }
}
async function loadTiles() {
  const jobs = [];
  for (let ty = TY0; ty <= TY1; ty++) for (let tx = TX0; tx <= TX1; tx++) jobs.push([tx, ty]);
  let next = 0, doneN = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const [tx, ty] = jobs[next++];
      const clip = { x0: tx * 256 - X0, y0: ty * 256 - Y0, x1: tx * 256 + 255 - X0, y1: ty * 256 + 255 - Y0 };   // このタイル1枚分だけ書く
      const holes = () => { let n = 0; for (let y = Math.max(0, clip.y0); y <= Math.min(H - 1, clip.y1); y++) { const o = y * W; for (let x = Math.max(0, clip.x0); x <= Math.min(W - 1, clip.x1); x++) if (grid[o + x] === NODATA) n++; } return n; };
      let first = null, nSrc = 0;
      for (const s of SOURCES) {
        const f = Math.pow(2, Z - s.z), x = Math.floor(tx / f), y = Math.floor(ty / f);   // 粗い源は親タイルの番号
        const buf = await fetchTileCached(s.kind, s.z, x, y);
        if (!buf) continue;
        decodeElevInto(pngDecode(buf), x, y, s.z, clip); nSrc++; if (!first) first = s;
        if (holes() === 0) break;   // 穴が無くなったら次の源は要らない
      }
      if (first) { stats[first.kind === 'dem_png' ? 'from14' : 'from' + first.kind.slice(3, 5)]++; if (nSrc > 1) stats.filled++; } else stats.missing++;
      doneN++; if (doneN % 100 === 0 || doneN === jobs.length) log(`タイル ${doneN}/${jobs.length}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONC, jobs.length) }, worker));
}

// ---------- 視域計算(R2: 山頂から窓の縁の全画素へ光線) ----------
/** 山頂の標高と「山頂部の広がり」。目的点は1画素だが、火口の縁(富士山)や山頂の平らな部分では、その1点が
 *  縁や隣の画素に隠れて「見えない」になる(アプリと同じ式でも同じ)。そこで、山頂から SUMMIT_DROP_M 以内の高さの画素が
 *  山頂から最も遠い距離を「山頂部の広がり」とし、その範囲の地形は遮蔽に数えない(アプリの目的点側除外15mの一般化)。
 *  山頂標高は3×3画素の最大(画素の中心が最高点から少しずれる分の補正)。 */
function summitInfo() {
  let hS = -Infinity;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = grid[(CY + dy) * W + (CX + dx)]; if (c !== NODATA) hS = Math.max(hS, c / 10 - 100); }
  if (hS === -Infinity) hS = M.elev;
  const rPx = Math.ceil(SUMMIT_SEARCH_M / MPP); const bw = 2 * rPx + 1;
  // 探索の箱の中にある「別の山」(山リストの山頂。索引番号の親番号が同じ峰=同じ山の別峰は除く)。山頂部にこれらを含めない
  const baseId = String(M.id).split('-')[0];
  const others = mdata.mountains.filter(o => o.id !== M.id && String(o.id).split('-')[0] !== baseId)
    .map(o => ({ name: o.name, elev: o.elev, bx: Math.floor(lonToX(o.lon)) - X0 - CX + rPx, by: Math.floor(latToY(o.lat)) - Y0 - CY + rPx }))
    .filter(o => o.bx >= 0 && o.by >= 0 && o.bx < bw && o.by < bw && Math.hypot(o.bx - rPx, o.by - rPx) * MPP <= SUMMIT_SEARCH_M);
  const elevBox = new Float32Array(bw * bw).fill(-Infinity);
  for (let dy = -rPx; dy <= rPx; dy++) for (let dx = -rPx; dx <= rPx; dx++) {
    const x = CX + dx, y = CY + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const c = grid[y * W + x]; if (c === NODATA) continue;
    if (Math.sqrt(dx * dx + dy * dy) * MPP > SUMMIT_SEARCH_M) continue;
    elevBox[(dy + rPx) * bw + (dx + rPx)] = c / 10 - 100;
  }
  // 帯(山頂からdrop以内の高さ)のうち山頂につながる部分(8近傍)を取る。山頂につながらない帯(離れた隣の峰)は含めない
  const bandOf = (drop) => {
    const keep = new Uint8Array(bw * bw); const stack = [rPx * bw + rPx]; keep[stack[0]] = 1; let n = 0;
    while (stack.length) {
      const i = stack.pop(); n++; const x = i % bw, y = (i - x) / bw;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= bw || ny >= bw) continue;
        const j = ny * bw + nx; if (!keep[j] && elevBox[j] >= hS - drop) { keep[j] = 1; stack.push(j); }
      }
    }
    return { keep, n };
  };
  const hasOther = (keep) => others.find(o => keep[o.by * bw + o.bx] === 1) || null;
  let drop = SUMMIT_DROP_M, band = bandOf(drop); const blocker = hasOther(band.keep);
  if (blocker) {   // 別の山の山頂を含んでしまう→含まない最大の高さまで二分探索で縮める
    let lo = 0, hi = drop;
    for (let it = 0; it < 12; it++) { const mid = (lo + hi) / 2; if (hasOther(bandOf(mid).keep)) hi = mid; else lo = mid; }
    drop = Math.floor(lo); band = bandOf(drop);
    log(`山頂部: 帯 −${SUMMIT_DROP_M}m では別の山「${blocker.name}」(${blocker.elev}m)の山頂を含むため、−${drop}m に縮めた`);
  }
  const capBox = band.keep; let far = 0, nCap = 0;
  for (let i = 0; i < capBox.length; i++) { if (!capBox[i]) continue; const x = i % bw, y = (i - x) / bw; const dM = Math.hypot(x - rPx, y - rPx) * MPP; nCap++; if (dM > far) far = dM; }
  const dropUsed = drop;
  const auto = Math.max(15, Math.ceil(far));
  // circle: 除外半径=指定値か山頂部の最遠距離(自動)。region: 半径は最小の15m(アプリと同じ)+山頂部の画素そのもの
  const exclTargetM = EXCL_TARGET_ARG !== null ? EXCL_TARGET_ARG : (SUMMIT_MODE === 'circle' ? auto : 15);
  return { hS, capPx: nCap, capFarM: +far.toFixed(1), exclTargetM, exclAuto: EXCL_TARGET_ARG === null, rPx, bw, capBox, dropUsed, others: others.map(o => o.name) };
}
let _SI = null;
/** 目的点側の除外: その画素の地形を遮蔽に数えないか。circle=山頂からEXCL_TGT_M以内 / region=それに加えて山頂部の画素(高さの帯) */
function isExcludedTarget(px, py, dM) {
  if (dM <= EXCL_TGT_M) return true;
  if (SUMMIT_MODE !== 'region' || !_SI) return false;
  const bx = px - CX + _SI.rPx, by = py - CY + _SI.rPx;
  if (bx < 0 || by < 0 || bx >= _SI.bw || by >= _SI.bw) return false;
  return _SI.capBox[by * _SI.bw + bx] === 1;
}
/** 大円と縮尺のヘルパー(第156・ワーカーの geodesicHelpers と同じ): rowScale[y]=その行の1画素の長さ/中心の1画素の長さ、bend(ex,ey)=大円の弦からの反り(画素。弦に直交する単位ベクトルと4δ) */
let _geoCache = null;
function geodesicHelpers() {
  if (_geoCache) return _geoCache;
  const D2R = Math.PI / 180;
  const yToLat = (y) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / WORLD))) * 180 / Math.PI, xToLon = (x) => x / WORLD * 360 - 180;
  const lat0 = yToLat(Y0 + CY + 0.5), lon0 = xToLon(X0 + CX + 0.5), c0 = Math.cos(lat0 * D2R);
  const rowScale = new Float64Array(H);
  for (let y = 0; y < H; y++) rowScale[y] = Math.cos(yToLat(Y0 + y + 0.5) * D2R) / c0;
  const p0 = [Math.cos(lat0 * D2R) * Math.cos(lon0 * D2R), Math.cos(lat0 * D2R) * Math.sin(lon0 * D2R), Math.sin(lat0 * D2R)];
  const bend = (ex, ey) => {
    const dx = ex - CX, dy = ey - CY; const len = Math.sqrt(dx * dx + dy * dy); if (len < 2) return { nx: 0, ny: 0, amp: 0 };
    const lat1 = yToLat(Y0 + ey + 0.5), lon1 = xToLon(X0 + ex + 0.5);
    const p1 = [Math.cos(lat1 * D2R) * Math.cos(lon1 * D2R), Math.cos(lat1 * D2R) * Math.sin(lon1 * D2R), Math.sin(lat1 * D2R)];
    const m = [p0[0] + p1[0], p0[1] + p1[1], p0[2] + p1[2]]; const mn = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);
    const mlat = Math.asin(m[2] / mn) / D2R, mlon = Math.atan2(m[1], m[0]) / D2R;
    const mx = lonToX(mlon) - X0 - 0.5, my = latToY(mlat) - Y0 - 0.5;
    const ox = mx - (CX + dx / 2), oy = my - (CY + dy / 2);
    const nx = -dy / len, ny = dx / len; const delta = ox * nx + oy * ny;
    return { nx, ny, amp: 4 * delta };
  };
  _geoCache = { rowScale, bend }; return _geoCache;
}
function computeViewshed(hS) {
  const visible = new Uint8Array(W * H);           // 1=見える 0=見えない/データ無し 2=山頂
  const inv2R = (1 - K) / (2 * R_EARTH);           // 1/(2·Reff), Reff = R/(1−k)
  const exclObsPx = Math.ceil(EXCL_OBS_M / MPP);
  const maxSteps = 2 * halfPx + 2;
  const thetaT = new Float64Array(maxSteps);        // 光線上の地形の見かけ高度角(手前から)
  const prefix = new Float64Array(maxSteps);        // 手前までの最大(除外画素を除く)
  let raysDone = 0;
  const geo = geodesicHelpers();   // 第156: 光線は大円に沿わせ(放物線近似)、距離は行ごとの縮尺を積算(ワーカーと同じ)
  const walk = (ex, ey) => {
    const dx = ex - CX, dy = ey - CY; const steps = Math.max(Math.abs(dx), Math.abs(dy)); if (steps === 0) return;
    const sx = dx / steps, sy = dy / steps; const stepM = Math.sqrt(sx * sx + sy * sy) * MPP;
    const bend = geo.bend(ex, ey); const len = Math.sqrt(dx * dx + dy * dy); const xMajor = Math.abs(dx) >= Math.abs(dy);
    const bowMinor = xMajor ? bend.amp * len / dx : -bend.amp * len / dy;   // 反りは副軸だけ(主軸は1画素ずつ。ワーカーと同じ)
    let runMax = -Infinity, dM = 0;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, f = t * (1 - t);
      let px = xMajor ? CX + Math.round(sx * s) : Math.round(CX + sx * s + bowMinor * f);
      let py = xMajor ? Math.round(CY + sy * s + bowMinor * f) : CY + Math.round(sy * s);
      if (px < 0) px = 0; else if (px >= W) px = W - 1;
      if (py < 0) py = 0; else if (py >= H) py = H - 1;
      const gi = py * W + px; const code = grid[gi];
      dM += stepM * geo.rowScale[py];
      let th;
      if (code !== NODATA) {
        const h = code / 10 - 100; const drop = dM * dM * inv2R;
        th = (h - drop - hS) / dM;                                   // 地形の見かけ高度角(山頂から)
        const thP = (h + OBS_H - drop - hS) / dM;                   // 観測者(地上+OBS_H)の見かけ高度角
        // 手前の地形の最大(観測者側の除外=直前exclObsPx画素を除く。目的点側の除外=山頂部/除外半径の画素はprefixに入れない)
        const refIdx = s - 1 - exclObsPx;
        const ref = refIdx >= 1 ? prefix[refIdx] : -Infinity;
        if (thP >= ref) visible[gi] = 1;
      } else th = (-dM * dM * inv2R - hS) / dM;                      // データ無し(海)は海面0mとして遮る(第156・ワーカーと同じ)。見える画素にはしない
      thetaT[s] = th;
      if (!isExcludedTarget(px, py, dM)) runMax = Math.max(runMax, th);
      prefix[s] = runMax;
    }
    raysDone++;
  };
  for (let x = 0; x < W; x++) { walk(x, 0); walk(x, H - 1); }
  for (let y = 1; y < H - 1; y++) { walk(0, y); walk(W - 1, y); }
  visible[CY * W + CX] = 2;
  let nVis = 0; for (let i = 0; i < visible.length; i++) if (visible[i] === 1) nVis++;
  return { visible, nVis, rays: raysDone };
}

/** 1地点の見通しを山頂から歩いて報告する(答えの検算用): 見える/見えないと、遮った画素(山頂からの距離・標高・見かけ高度角) */
function probeRay(lat, lon, hS) {
  const px = Math.floor(lonToX(lon)) - X0, py = Math.floor(latToY(lat)) - Y0;
  if (px < 0 || py < 0 || px >= W || py >= H) return { out: true };
  const inv2R = (1 - K) / (2 * R_EARTH); const exclObsPx = Math.ceil(EXCL_OBS_M / MPP);
  const dx = px - CX, dy = py - CY; const steps = Math.max(Math.abs(dx), Math.abs(dy)); const sx = dx / steps, sy = dy / steps;
  const geo = geodesicHelpers(); const bend = geo.bend(px, py); const len = Math.sqrt(dx * dx + dy * dy); const xMajor = Math.abs(dx) >= Math.abs(dy); const bowMinor = xMajor ? bend.amp * len / dx : -bend.amp * len / dy; const stepM = Math.sqrt(sx * sx + sy * sy) * MPP;   // 第156: 大円(反りは副軸だけ)+行ごとの縮尺(computeViewshedと同じ歩き方)
  const at = (s2) => { const t = s2 / steps, f = t * (1 - t); let qx = xMajor ? CX + Math.round(sx * s2) : Math.round(CX + sx * s2 + bowMinor * f), qy = xMajor ? Math.round(CY + sy * s2 + bowMinor * f) : CY + Math.round(sy * s2); if (qx < 0) qx = 0; else if (qx >= W) qx = W - 1; if (qy < 0) qy = 0; else if (qy >= H) qy = H - 1; return [qx, qy]; };
  const th = new Float64Array(steps + 1); const excl = new Uint8Array(steps + 1); const dist = new Float64Array(steps + 1); let runMax = -Infinity, argMax = -1, dAcc = 0;
  const prefixMax = new Float64Array(steps + 1), prefixArg = new Int32Array(steps + 1);
  for (let s2 = 1; s2 <= steps; s2++) {
    const [qx, qy] = at(s2); const code = grid[qy * W + qx]; dAcc += stepM * geo.rowScale[qy]; const dM = dAcc; dist[s2] = dM;
    th[s2] = ((code === NODATA ? 0 : code / 10 - 100) - dM * dM * inv2R - hS) / dM;   // データ無し(海)は海面0m
    excl[s2] = isExcludedTarget(qx, qy, dM) ? 1 : 0;
    if (!excl[s2] && th[s2] > runMax) { runMax = th[s2]; argMax = s2; }
    prefixMax[s2] = runMax; prefixArg[s2] = argMax;
  }
  const code = grid[py * W + px]; if (code === NODATA) return { nodata: true };
  const dM = dist[steps]; const h = code / 10 - 100;
  const thP = (h + OBS_H - dM * dM * inv2R - hS) / dM; const refIdx = steps - 1 - exclObsPx; const ref = refIdx >= 1 ? prefixMax[refIdx] : -Infinity; const arg = refIdx >= 1 ? prefixArg[refIdx] : -1;
  const blk = arg > 0 ? (([qx, qy]) => ({ qx, qy }))(at(arg)) : null;
  const bc = blk ? grid[blk.qy * W + blk.qx] : null; const blkD = blk ? dist[arg] : null; const blkH = blk ? (bc === NODATA ? 0 : bc / 10 - 100) : null;   // 遮る画素が海(データ無し)なら海面0m(第156のレビュー: 65535を標高に復号していた)
  return { visible: thP >= ref, distKm: dM / 1000, h, thP, ref, blkD, blkH, gridVisible: visible_[py * W + px] === 1 };
}
let visible_ = null;

// ---------- 島(8近傍の連結成分。行の連(run)の合併で省メモリ) ----------
function labelIslands(visible) {
  const runs = [];          // [y, x0, x1, parent]
  const rowStart = new Int32Array(H + 1);
  for (let y = 0; y < H; y++) {
    rowStart[y] = runs.length; const o = y * W;
    for (let x = 0; x < W; x++) {
      if (visible[o + x] === 1) { const x0 = x; while (x + 1 < W && visible[o + x + 1] === 1) x++; runs.push([y, x0, x, runs.length]); }
    }
  }
  rowStart[H] = runs.length;
  const find = i => { while (runs[i][3] !== i) { runs[i][3] = runs[runs[i][3]][3]; i = runs[i][3]; } return i; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) runs[b][3] = a; };
  for (let y = 1; y < H; y++) {
    let j = rowStart[y - 1]; const jEnd = rowStart[y];
    for (let i = rowStart[y]; i < rowStart[y + 1]; i++) {
      const r = runs[i];
      while (j < jEnd && runs[j][2] < r[1] - 1) j++;
      for (let k = j; k < jEnd && runs[k][1] <= r[2] + 1; k++) union(i, k);
    }
  }
  const comp = new Map();   // root -> {px, sx, sy, minx, miny, maxx, maxy, runs:[]}
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i]; const root = find(i); let c = comp.get(root);
    if (!c) { c = { px: 0, sx: 0, sy: 0, minx: r[1], maxx: r[2], miny: r[0], maxy: r[0], runs: [] }; comp.set(root, c); }
    const n = r[2] - r[1] + 1; c.px += n; c.sx += (r[1] + r[2]) / 2 * n; c.sy += r[0] * n;
    if (r[1] < c.minx) c.minx = r[1]; if (r[2] > c.maxx) c.maxx = r[2]; if (r[0] < c.miny) c.miny = r[0]; if (r[0] > c.maxy) c.maxy = r[0];
    c.runs.push(i);
  }
  const islands = [];
  for (const c of comp.values()) {
    const cx = c.sx / c.px, cy = c.sy / c.px;
    // 代表点=重心に一番近い画素(必ず島の中)
    let best = null, bd = Infinity;
    for (const ri of c.runs) { const r = runs[ri]; const x = Math.min(Math.max(Math.round(cx), r[1]), r[2]); const d = (x - cx) * (x - cx) + (r[0] - cy) * (r[0] - cy); if (d < bd) { bd = d; best = [x, r[0]]; } }
    islands.push({ px: c.px, cx, cy, rep: best, bbox: [c.minx, c.miny, c.maxx, c.maxy], runs: c.runs });
  }
  // 項番=代表点を北から南(同じなら東から西)に並べた固定番号(Q2)。北=小さいy、東=大きいx
  islands.sort((a, b) => (a.rep[1] - b.rep[1]) || (b.rep[0] - a.rep[0]));
  islands.forEach((isl, i) => { isl.no = i + 1; });
  return { runs, islands, rowStart };
}
// ---------- 島の輪郭(外周+穴)。境界の辺を全部たどる ----------
// 画素の角を頂点にした格子の上で、「見える」と「見えない(データ無し・山頂を含む)」の境の辺を、内側(見える)を右に見て進む。
// 分岐(斜めに接する画素の角)では左折を優先する=前景は8連結(labelIslandsと同じ)・穴は4連結。
// 水平の辺を上の行から左から順に走査し、未通過の辺から環を1つずつ起こす(出発点は環の最上段の左端なので、出発点に戻ったら閉じる)。
// 環の符号付き面積(y下向きの座標)は外周が正・穴が負。島ごとの合計が画素数と一致することを自己検査に使う。
function extractRings(visible, runs, rowStart, runIsland, nIslands) {
  const hSeen = new Uint8Array(Math.ceil(W * (H + 1) / 8));   // 水平辺(x, L): 画素(x,L-1)と(x,L)の間。L∈[0,H]
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H && visible[y * W + x] === 1) ? 1 : 0;
  const hGet = (x, L) => { const i = L * W + x; return (hSeen[i >> 3] >> (i & 7)) & 1; };
  const hSet = (x, L) => { const i = L * W + x; hSeen[i >> 3] |= 1 << (i & 7); };
  const rightPix = (d, vx, vy) => d === 0 ? at(vx, vy) : d === 1 ? at(vx - 1, vy) : d === 2 ? at(vx - 1, vy - 1) : at(vx, vy - 1);
  const leftPix = (d, vx, vy) => d === 0 ? at(vx, vy - 1) : d === 1 ? at(vx, vy) : d === 2 ? at(vx - 1, vy) : at(vx - 1, vy - 1);
  const dxs = [1, 0, -1, 0], dys = [0, 1, 0, -1];   // 0=東 1=南 2=西 3=北
  const islandOfPixel = (x, y) => { let lo = rowStart[y], hi = rowStart[y + 1] - 1; while (lo <= hi) { const mid = (lo + hi) >> 1; const r = runs[mid]; if (x < r[1]) hi = mid - 1; else if (x > r[2]) lo = mid + 1; else return runIsland[mid]; } return -1; };
  const rings = Array.from({ length: nIslands }, () => []);
  let nEdges = 0, nRings = 0, nVerts = 0;
  const trace = (sx, sy, dir0) => {
    const ring = [[sx, sy]]; let x = sx, y = sy, dir = dir0;
    for (;;) {
      if (dir === 0) hSet(x, y); else if (dir === 2) hSet(x - 1, y);   // 水平辺を通過済みに(走査で二度起こさない)
      nEdges++;
      x += dxs[dir]; y += dys[dir];
      if (x === sx && y === sy) break;
      const dl = (dir + 3) % 4, dr = (dir + 1) % 4, prev = dir;
      if (rightPix(dl, x, y) === 1 && leftPix(dl, x, y) === 0) dir = dl;
      else if (rightPix(dir, x, y) === 1 && leftPix(dir, x, y) === 0) { /* 直進 */ }
      else if (rightPix(dr, x, y) === 1 && leftPix(dr, x, y) === 0) dir = dr;
      else dir = (dir + 2) % 4;   // 行き止まり(1画素幅の突起)
      if (dir !== prev) ring.push([x, y]);   // 向きが変わる頂点だけ残す(直線上の中間点は落とす)
    }
    return ring;
  };
  for (let L = 0; L <= H; L++) {
    for (let x = 0; x < W; x++) {
      const below = at(x, L), above = at(x, L - 1);
      if (below === above || hGet(x, L)) continue;
      let ring, isl;
      if (below) { ring = trace(x, L, 0); isl = islandOfPixel(x, L); }          // 上辺=外周か穴の上端(内側は下)。東へ
      else { ring = trace(x + 1, L, 2); isl = islandOfPixel(x, L - 1); }        // 下辺=穴の上端(内側は上)。西へ
      if (isl < 0) throw new Error(`輪郭の帰属が取れません (${x},${L})`);
      rings[isl].push(ring); nRings++; nVerts += ring.length;
    }
  }
  return { rings, nEdges, nRings, nVerts };
}
/** 符号付き面積(y下向き。外周が正・穴が負)。閉路(最後と最初を結ぶ) */
function ringArea(r) { let a = 0; for (let i = 0, n = r.length; i < n; i++) { const p = r[i], q = r[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
/** Douglas-Peucker(閉路。先頭を固定して一周を折れ線とみなす)。3点未満になる時は元のまま */
function dpSimplify(pts, tol) {
  const n = pts.length; if (n <= 4 || tol <= 0) return pts;
  const keep = new Uint8Array(n + 1); keep[0] = 1; keep[n] = 1;
  const P = i => pts[i % n]; const tol2 = tol * tol; const stack = [[0, n]];
  while (stack.length) {
    const [a, b] = stack.pop(); if (b - a < 2) continue;
    const ax = P(a)[0], ay = P(a)[1], dx = P(b)[0] - ax, dy = P(b)[1] - ay, len2 = dx * dx + dy * dy;
    let maxD = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const px = P(i)[0] - ax, py = P(i)[1] - ay; let d;
      if (len2 === 0) d = px * px + py * py; else { const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2)); const ex = px - t * dx, ey = py - t * dy; d = ex * ex + ey * ey; }
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol2) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
  return out.length >= 3 ? out : pts;
}
/** 整数のポリライン符号(Googleのpolyline符号と同じ5bit可変長+63・座標の倍率なし)。先頭は絶対値・以降は差分 */
function encodeIntPolyline(pts) {
  let s = '', px = 0, py = 0;
  const enc = v => { let r = ''; v = v < 0 ? ~(v << 1) : (v << 1); while (v >= 0x20) { r += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return r + String.fromCharCode(v + 63); };
  for (const [x, y] of pts) { s += enc(x - px) + enc(y - py); px = x; py = y; }
  return s;
}

// ---------- 答え合わせ(アプリの _visJudgeCore と同じ歩き方で標本画素を判定) ----------
function judgeLikeApp(px, py, hS, inv2R) {
  // 第157: アプリ(_visJudgeCore / tm-vis-worker)と同じく、経路は大円(区間SEGの両端を球面補間・中は画素座標の直線)・標高データ無し(海)は海面0mとして遮る
  const scale15 = Math.pow(2, 15), R128 = 128 / Math.PI;
  const gpy15At = (lat) => (128 - R128 * Math.atanh(Math.sin(lat * Math.PI / 180))) * scale15;
  const gpx15At = (lng) => 128 * (lng / 180 + 1) * scale15;
  let lastGx = -1, lastGy = -1;
  const elevAt = (gx15, gy15) => {   // z15の世界画素→窓の格子(zoomがZの格子へ換算)。窓の外=undefined・データ無し(海)=null。除外判定のため画素位置も控える
    const f = Math.pow(2, Z - 15); const gx = Math.floor(gx15 * f) - X0, gy = Math.floor(gy15 * f) - Y0;
    if (gx < 0 || gy < 0 || gx >= W || gy >= H) return undefined; lastGx = gx; lastGy = gy; const c = grid[gy * W + gx]; return c === NODATA ? null : c / 10 - 100;
  };
  const sLat = yToLat(Y0 + py + 0.5), sLng = xToLon(X0 + px + 0.5);
  const c0 = grid[py * W + px]; if (c0 === NODATA) return null;
  const startTotal = c0 / 10 - 100 + OBS_H;
  const endLat = yToLat(Y0 + CY + 0.5), endLng = xToLon(X0 + CX + 0.5), endTotal = hS;
  const distM = SORA.haversineDistanceM(sLat, sLng, endLat, endLng);
  const stepM = SORA.metersPerPixel(sLat, 15) / 2;
  const steps = Math.max(2, Math.ceil(distM / stepM));
  const path = SORA.greatCirclePath(sLat, sLng, endLat, endLng);
  const SEG = SORA.VISIBILITY.PATH_CHUNK;
  const endDrop = distM * distM * inv2R;
  for (let j0 = 1; j0 < steps; j0 += SEG) {
    const j1 = Math.min(j0 + SEG - 1, steps - 1);
    const pA = path.at(j0 / steps), pB = (j1 > j0) ? path.at(j1 / steps) : pA;
    const gxA = gpx15At(pA.lng), gyA = gpy15At(pA.lat);
    const dgx = (j1 > j0) ? (gpx15At(pB.lng) - gxA) / (j1 - j0) : 0;
    const dgy = (j1 > j0) ? (gpy15At(pB.lat) - gyA) / (j1 - j0) : 0;
    for (let j = j0; j <= j1; j++) {
      let e = elevAt((gxA + dgx * (j - j0)) | 0, (gyA + dgy * (j - j0)) | 0);
      if (e === undefined) continue; if (e === null) e = 0;
      const r = j / steps, d = distM * r; const lineElev = startTotal + (endTotal - endDrop - startTotal) * r;
      if (e - d * d * inv2R > lineElev) { if (isExcludedTarget(lastGx, lastGy, distM * (1 - r))) continue; if (d <= EXCL_OBS_M) continue; return false; }
    }
  }
  return true;
}

// ---------- メイン ----------
(async () => {
  const t0 = Date.now();
  await loadTiles();
  let nData = 0; for (let i = 0; i < grid.length; i++) if (grid[i] !== NODATA) nData++;
  log(`タイル取得完了: 5A ${stats.from5a} 5B ${stats.from5b} 5C ${stats.from5c} z14 ${stats.from14} 無し ${stats.missing}(次の源で穴埋めしたタイル ${stats.filled})。データ画素 ${nData}/${W * H}`);
  const t1 = Date.now();
  const SI = summitInfo(); _SI = SI; const hS = SI.hS; EXCL_TGT_M = SI.exclTargetM;
  log(`山頂: DEM標高 ${hS}m(一覧 ${M.elev}m) 山頂部(−${SI.dropUsed}m以内で山頂につながる画素・探索${SUMMIT_SEARCH_M}m)の広がり ${SI.capFarM}m(${SI.capPx}画素) → 除外=${SUMMIT_MODE === 'region' ? `山頂部の画素そのもの+半径${EXCL_TGT_M}m` : `半径${EXCL_TGT_M}m${SI.exclAuto ? '(自動)' : '(指定)'}の円`}`);
  const { visible, nVis, rays } = computeViewshed(hS); visible_ = visible;
  const t2 = Date.now();
  for (const pr of PROBES) {
    const r = probeRay(pr.lat, pr.lon, hS);
    if (r.out) log(`  検算 ${pr.name}: 窓の外`); else if (r.nodata) log(`  検算 ${pr.name}: 標高データ無し`);
    else log(`  検算 ${pr.name}: ${r.visible ? '見える' : '見えない'}(格子=${r.gridVisible ? '見える' : '見えない'}) 距離${r.distKm.toFixed(1)}km 標高${r.h.toFixed(0)}m 観測者の見かけ角${r.thP.toFixed(4)} 手前の最大${isFinite(r.ref) ? r.ref.toFixed(4) : '-'}` + (r.blkD !== null ? ` (山頂から${r.blkD.toFixed(0)}m・標高${r.blkH.toFixed(0)}mの画素)` : ''));
  }
  log(`視域計算: 光線${rays}本 見える画素 ${nVis} (${(100 * nVis / Math.max(1, nData)).toFixed(2)}%)  ${((t2 - t1) / 1000).toFixed(1)}s`);
  const { runs, islands, rowStart } = labelIslands(visible);
  const runIsland = new Int32Array(runs.length);
  islands.forEach((isl, i) => { for (const ri of isl.runs) runIsland[ri] = i; });
  const t3 = Date.now();
  log(`島: ${islands.length}個 (最大 ${Math.max(...islands.map(i => i.px))}画素)  ${((t3 - t2) / 1000).toFixed(1)}s`);
  // 輪郭(外周+穴)を全島で取り、面積の自己検査(環の符号付き面積の合計=画素数)をしてから間引く
  const RG = extractRings(visible, runs, rowStart, runIsland, islands.length);
  let areaNg = 0, nHoles = 0;
  islands.forEach((isl, i) => {
    const rs = RG.rings[i]; let sum = 0, holes = 0;
    for (const r of rs) { const a = ringArea(r); sum += a; if (a < 0) holes++; }
    isl.holes = holes; nHoles += holes;
    if (Math.round(sum) !== isl.px) { areaNg++; if (areaNg <= 5) log(`  面積不一致: 島${isl.no} 画素${isl.px} 環の面積${sum} 環${rs.length}`); }
    // 外周を先頭に(符号付き面積が最大の環)
    rs.sort((a, b) => ringArea(b) - ringArea(a));
  });
  if (areaNg) throw new Error(`輪郭の自己検査に失敗: ${areaNg}島で面積が合いません`);
  let nVertsDp = 0;
  const ringsDp = RG.rings.map(rs => rs.map(r => { const d = dpSimplify(r, DP_TOL); nVertsDp += d.length; return d; }));
  const t4 = Date.now();
  log(`輪郭: 辺${RG.nEdges} 環${RG.nRings}(穴${nHoles}) 頂点${RG.nVerts}→間引き(${DP_TOL}px)後${nVertsDp} 自己検査OK  ${((t4 - t3) / 1000).toFixed(1)}s`);
  // 答え合わせ
  let agree = 0, checked = 0, disagreeVis = 0, disagreeInv = 0;
  if (CHECK_N > 0) {
    const inv2R = (1 - K) / (2 * R_EARTH); let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    while (checked < CHECK_N) {
      const px = Math.floor(rnd() * W), py = Math.floor(rnd() * H); if (px === CX && py === CY) continue;
      const v = visible[py * W + px]; if (grid[py * W + px] === NODATA) continue;
      const ref = judgeLikeApp(px, py, hS, inv2R); if (ref === null) continue;
      checked++; if ((v === 1) === ref) agree++; else if (v === 1) disagreeVis++; else disagreeInv++;
    }
    log(`答え合わせ(アプリと同じ歩き方・${checked}画素): 一致 ${agree} (${(100 * agree / checked).toFixed(2)}%) 道具だけ見える ${disagreeVis} アプリだけ見える ${disagreeInv}`);
  }
  // 出力
  const outDir = path.join(OUT_ROOT, `${ID}-${RANGE_KM}km-z${Z}-${CANOPY ? 'canopy' : 'terrain'}${TAG}`);
  fs.mkdirSync(outDir, { recursive: true });
  const bits = Buffer.alloc(Math.ceil(W * H / 8));
  for (let i = 0; i < visible.length; i++) if (visible[i] === 1) bits[i >> 3] |= (128 >> (i & 7));
  fs.writeFileSync(path.join(outDir, 'visible.bin'), bits);
  const pxArea = MPP * MPP;
  const distKm = (isl) => Math.hypot(isl.rep[0] - CX, isl.rep[1] - CY) * MPP / 1000;
  const idx = islands.map(i => ({ no: i.no, px: i.px, holes: i.holes, area_km2: +(i.px * pxArea / 1e6).toFixed(4), rep: [+yToLat(Y0 + i.rep[1] + 0.5).toFixed(6), +xToLon(X0 + i.rep[0] + 0.5).toFixed(6)],
    bbox: [+xToLon(X0 + i.bbox[0]).toFixed(6), +yToLat(Y0 + i.bbox[3] + 1).toFixed(6), +xToLon(X0 + i.bbox[2] + 1).toFixed(6), +yToLat(Y0 + i.bbox[1]).toFixed(6)], dist_km: +distKm(i).toFixed(2) }));
  fs.writeFileSync(path.join(outDir, 'islands.json'), JSON.stringify({ mountain: { id: M.id, name: M.name }, count: idx.length, islands: idx }));
  // アプリ用の輪郭 outline.json: 画素の角の整数座標(窓の左上=0,0)。島ごとに [項番, 画素数, 外周, 穴, 穴, ...](各環はポリライン符号)
  const outline = { v: 2, id: M.id, name: M.name, range_km: RANGE_KM, zoom: Z, canopy: CANOPY, x0: X0, y0: Y0, w: W, h: H, tol_px: DP_TOL,
    islands: islands.map((isl, i) => [isl.no, isl.px].concat(ringsDp[i].map(encodeIntPolyline))) };
  fs.writeFileSync(path.join(outDir, 'outline.json'), JSON.stringify(outline));
  if (WRITE_GEOJSON) {
    const toLL = r => r.concat([r[0]]).map(([bx, by]) => [+xToLon(X0 + bx).toFixed(6), +yToLat(Y0 + by).toFixed(6)]);
    const feats = islands.map((isl, i) => ({ type: 'Feature', properties: { no: isl.no, px: isl.px, area_km2: +(isl.px * pxArea / 1e6).toFixed(4), dist_km: +distKm(isl).toFixed(2), holes: isl.holes },
      geometry: { type: 'Polygon', coordinates: ringsDp[i].map(toLL) } }));
    fs.writeFileSync(path.join(outDir, 'islands.geojson'), JSON.stringify({ type: 'FeatureCollection', features: feats }));
  }
  // プレビュー(縮小): 見える割合を金色の濃さに。山頂は赤
  if (PREVIEW > 0) {
    const S = Math.max(1, Math.ceil(W / PREVIEW)); const pw = Math.ceil(W / S), ph = Math.ceil(H / S); const rgb = Buffer.alloc(pw * ph * 3);
    const cnt = new Uint32Array(pw * ph), tot = new Uint32Array(pw * ph);
    for (let y = 0; y < H; y++) { const oy = Math.floor(y / S) * pw; for (let x = 0; x < W; x++) { const gi = y * W + x; const pi = oy + Math.floor(x / S); if (grid[gi] !== NODATA) tot[pi]++; if (visible[gi] === 1) cnt[pi]++; } }
    for (let i = 0; i < pw * ph; i++) { const f = tot[i] ? cnt[i] / tot[i] : 0; const base = tot[i] ? 40 : 15; rgb[i * 3] = Math.round(base + (255 - base) * f); rgb[i * 3 + 1] = Math.round(base + (215 - base) * f); rgb[i * 3 + 2] = Math.round(base * (1 - f)); }
    const spx = Math.floor(CX / S), spy = Math.floor(CY / S);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = spx + dx, y = spy + dy; if (x >= 0 && y >= 0 && x < pw && y < ph) { const i = (y * pw + x) * 3; rgb[i] = 255; rgb[i + 1] = 40; rgb[i + 2] = 40; } }
    fs.writeFileSync(path.join(outDir, 'preview.png'), pngEncodeRGB(pw, ph, rgb));
  }
  const meta = { tool: 'tools/kashimap/viewshed.js', version: 2, generated: new Date().toISOString(), mountain: { id: M.id, name: M.name, peak: M.peak, elev_list: M.elev, elev_dem: hS, lat: M.lat, lon: M.lon },
    range_km: RANGE_KM, zoom: Z, canopy: CANOPY, buildings: false, observer_h_m: OBS_H, k: K, earth_radius_m: R_EARTH, reff_m: R_EARTH / (1 - K),
    summit_mode: SUMMIT_MODE, summit_area: { drop_m: SI.dropUsed, drop_requested_m: SUMMIT_DROP_M, search_m: SUMMIT_SEARCH_M, px: SI.capPx, far_m: SI.capFarM, other_peaks_in_search: SI.others, how: `山頂から${SI.dropUsed}m以内の高さで山頂につながる画素(探索半径${SUMMIT_SEARCH_M}m。別の山の山頂を含まない高さまで)` },
    excl_target_m: EXCL_TGT_M, excl_target_how: SUMMIT_MODE === 'region' ? `山頂部の画素そのもの(中心・半径なし)+半径${EXCL_TGT_M}m(アプリの既定と同じ最小値)` : (SI.exclAuto ? `自動: 山頂部の最遠距離${SI.capFarM}m(最小15m)の円` : '指定値の円'), summit_elev_how: '3×3画素のDEM最大', excl_observer_m: EXCL_OBS_M,
    grid: { w: W, h: H, x0: X0, y0: Y0, mpp_center: +MPP.toFixed(4), note: '1画素の大きさは中心緯度の値で一定とした(窓の中で約±0.4%の差)' },
    dem: { sources: Z >= 15 ? 'cyberjapandata.gsi.go.jp dem5a_png/dem5b_png/dem5c_png(z15)→dem_png(z14, 最近傍で2倍)。画素ごとに無い所を次の源で埋める' : `cyberjapandata.gsi.go.jp dem_png(z${Z}, DEM10B)`, tiles: NT, from5a: stats.from5a, from5b: stats.from5b, from5c: stats.from5c, from14: stats.from14, filled_from_next: stats.filled, missing: stats.missing, data_px: nData },
    method: 'R2: 山頂から窓の縁の全画素へ光線(大円に沿う。距離は行ごとの縮尺の積算)。見かけ高度角=(h−d²/(2Reff)−hS)/d の最大を更新。観測者=地上+observer_h。除外=目的点側(山頂部・上記)・観測点側10m(式と観測点側はアプリの統一可視判定と同じ。目的点側はアプリの15mを山頂部へ一般化)',
    outline: { tol_px: DP_TOL, edges: RG.nEdges, rings: RG.nRings, holes: nHoles, vertices_raw: RG.nVerts, vertices: nVertsDp, encoding: 'outline.json: 島ごとに[項番,画素数,外周,穴…]。各環は画素の角の整数座標(窓の左上が0,0)を先頭=絶対・以降=差分でGoogle polyline符号(倍率なし)' },
    result: { visible_px: nVis, visible_km2: +(nVis * pxArea / 1e6).toFixed(3), islands: islands.length, rays, check: { n: checked, agree, agree_pct: checked ? +(100 * agree / checked).toFixed(2) : null, tool_only_visible: disagreeVis, app_only_visible: disagreeInv } },
    timing_s: { tiles: +((t1 - t0) / 1000).toFixed(1), viewshed: +((t2 - t1) / 1000).toFixed(1), islands: +((t3 - t2) / 1000).toFixed(1), outline: +((t4 - t3) / 1000).toFixed(1), total: +((Date.now() - t0) / 1000).toFixed(1) },
    attribution: '国土地理院 標高タイル(DEM5A/5B/5C/10B)を加工して作成。日本の主な山岳標高(国土地理院)を加工して作成' };
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 1));
  const osz = fs.statSync(path.join(outDir, 'outline.json')).size;
  log(`出力: ${outDir} (visible.bin ${(bits.length / 1e6).toFixed(1)}MB, islands ${idx.length}, outline.json ${(osz / 1e6).toFixed(2)}MB)  合計 ${meta.timing_s.total}s`);
  // アプリ用資産: <asset>/<id>/<terrain|canopy>/<range>/{meta,islands,outline}.json と索引 index.json(山リストの「島の数」「静的」列の元)
  if (ASSET_DIR) {
    const kind = CANOPY ? 'canopy' : 'terrain';
    const ad = path.join(ASSET_DIR, ID, kind, String(RANGE_KM));
    fs.mkdirSync(ad, { recursive: true });
    for (const f of ['meta.json', 'islands.json', 'outline.json']) fs.copyFileSync(path.join(outDir, f), path.join(ad, f));
    const ip = path.join(ASSET_DIR, 'index.json');
    let index = { v: 1, mountains: {} };
    try { index = JSON.parse(fs.readFileSync(ip, 'utf8')); } catch (_) { /* 初回 */ }
    const ent = index.mountains[ID] || (index.mountains[ID] = { name: M.name, terrain: [], canopy: [], islands: {} });
    ent.name = M.name; ent[kind] = ent[kind] || []; ent.islands = ent.islands || {};
    if (!ent[kind].includes(RANGE_KM)) { ent[kind].push(RANGE_KM); ent[kind].sort((a, b) => a - b); }
    ent.islands[`${kind}:${RANGE_KM}`] = islands.length;
    ent.sizes = ent.sizes || {}; ent.sizes[`${kind}:${RANGE_KM}`] = ['meta.json', 'islands.json', 'outline.json'].reduce((a, f) => a + fs.statSync(path.join(ad, f)).size, 0);   // 山リストの「サイズ」列の元(第156)
    ent.zooms = ent.zooms || {}; ent.zooms[`${kind}:${RANGE_KM}`] = Z;   // 山リストの「ズーム」列の元(第157)
    index.generated = new Date().toISOString();
    index.attribution = meta.attribution;
    fs.writeFileSync(ip, JSON.stringify(index, null, 1));
    log(`資産: ${ad} と ${ip} を更新`);
  }
})().catch(e => { console.error('ERROR', e); process.exit(1); });
