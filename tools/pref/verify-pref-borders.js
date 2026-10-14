#!/usr/bin/env node
// data/pref/v1/pref-borders.json の指差し確認。
//   node tools/pref/verify-pref-borders.js [--data data/pref/v1/pref-borders.json] [--mountains data/mountains.json]
//                                           [--points 50000] [--seed 1] [--probe "lat,lon;lat,lon"] [--json]
// 1) アークを復号してリングを組み立て、点の内外判定(偶奇規則)と「最寄り県」(どの県にも入らない点は最寄りのリング辺で決める)を実装する。
// 2) data/mountains.json の全山岳を分類し、山岳の prefCode に含まれていれば正解とする。
//    最寄り県フォールバックに回った数、その最悪距離、不正解の上位10件(期待県の境界までの距離順)を出す。
// 3) 日本のbbox内の乱数点 N 個(既定 50,000)を分類して所要msを測る(島の画素を分類するコストの見積もり)。複数の県に入った点(重なり)の数も数える。
// 4) 県どうしの重なり: ある県だけが持つ海岸線アークの頂点が別の県の多角形に入っていないか(期待 0)。海岸線どうしは本来交わらないので、
//    間引いた弦が他県の陸を横切る/囲むなら必ず相手の頂点が入る=頂点の検査で足りる(狭い水道の島が隣県に飲まれる欠陥の見張り)。
// 5) --probe で任意の点(緯度,経度 の列)を分類して出す。
// 依存: Node 22 標準ライブラリのみ。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const argv = process.argv.slice(2);
function opt(name, dflt) { const i = argv.indexOf(name); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : dflt; }
const DATA = path.resolve(ROOT, opt('--data', 'data/pref/v1/pref-borders.json'));
const MOUNTAINS = path.resolve(ROOT, opt('--mountains', 'data/mountains.json'));
const NPOINTS = Number(opt('--points', '50000'));
const SEED = Number(opt('--seed', '1'));
const JSON_ONLY = argv.includes('--json');
const PROBE = opt('--probe', '');
const M_PER_DEG = 6371000 * Math.PI / 180;

// ---------- 復号 ----------
function decodePolyline5(s) {           // Google Encoded Polyline (lat,lng 順, 1e-5) → [x,y,x,y,...] 度
  const out = []; let i = 0, lat = 0, lng = 0;
  while (i < s.length) {
    for (let w = 0; w < 2; w++) {
      let r = 0, sh = 0, b;
      do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20);
      const v = (r & 1) ? ~(r >>> 1) : (r >>> 1);
      if (w === 0) lat += v; else lng += v;
    }
    out.push(lng / 1e5, lat / 1e5);
  }
  return Float64Array.from(out);
}
function decodeDelta(a) {               // [x0,y0,dx1,dy1,...] 1e-5度整数 → [x,y,...] 度
  const out = new Float64Array(a.length); let x = 0, y = 0;
  for (let i = 0; i < a.length; i += 2) { x += a[i]; y += a[i + 1]; out[i] = x / 1e5; out[i + 1] = y / 1e5; }
  return out;
}

function load(file) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const dec = doc.arcFormat === 'polyline5' ? decodePolyline5 : decodeDelta;
  const arcs = doc.arcs.map(dec);
  const arcOwners = arcs.map(() => []);
  const prefs = doc.prefs.map((p, pi) => {
    const rings = p.rings.map((refs) => {
      const parts = [];
      for (const ref of refs) {
        const idx = ref >= 0 ? ref : ~ref;
        if (!arcOwners[idx].includes(pi)) arcOwners[idx].push(pi);
        const a = arcs[idx];
        if (ref >= 0) parts.push(a);
        else { const r = new Float64Array(a.length); for (let i = 0, n = a.length; i < n; i += 2) { r[n - 2 - i] = a[i]; r[n - 1 - i] = a[i + 1]; } parts.push(r); }
      }
      let n = 0; for (const q of parts) n += q.length;
      const xy = new Float64Array(n); let o = 0;
      for (const q of parts) { xy.set(q, o); o += q.length; }
      let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      for (let i = 0; i < n; i += 2) { const x = xy[i], y = xy[i + 1]; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
      return { xy, minx, miny, maxx, maxy };
    });
    return { code: p.code, name: p.name, bbox: p.bbox, rings };
  });
  return { doc, arcs, arcOwners, prefs };
}

// ---------- 内外判定(偶奇)。リングの辺を緯度の帯に分けておき、1点あたり帯の中の辺だけを見る(1リング数万辺でも速い) ----------
function indexRing(r) {
  const a = r.xy, n = a.length >> 1;
  const nb = Math.max(1, Math.min(2048, n >> 3));
  const bands = new Array(nb); for (let b = 0; b < nb; b++) bands[b] = [];
  const h = (r.maxy - r.miny) || 1e-12;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = a[2 * i + 1], yj = a[2 * j + 1];
    if (yi === yj) continue;                                   // 水平な辺は光線と交わらない
    const lo = yi < yj ? yi : yj, hi = yi < yj ? yj : yi;
    let b0 = Math.floor((lo - r.miny) / h * nb), b1 = Math.floor((hi - r.miny) / h * nb);
    if (b0 < 0) b0 = 0; if (b1 >= nb) b1 = nb - 1;
    for (let b = b0; b <= b1; b++) bands[b].push(i, j);
  }
  r.bands = bands; r.nb = nb; r.h = h;
}
function ringCrosses(r, x, y) {
  if (x < r.minx || x > r.maxx || y < r.miny || y > r.maxy) return false;
  if (!r.bands) indexRing(r);
  const a = r.xy; let b = Math.floor((y - r.miny) / r.h * r.nb); if (b >= r.nb) b = r.nb - 1; if (b < 0) b = 0;
  const es = r.bands[b]; let inside = false;
  for (let t = 0; t < es.length; t += 2) {
    const i = es[t], j = es[t + 1];
    const yi = a[2 * i + 1], yj = a[2 * j + 1];
    if ((yi > y) !== (yj > y)) {
      const xi = a[2 * i], xj = a[2 * j];
      if (x < xj + (y - yj) * (xi - xj) / (yi - yj)) inside = !inside;
    }
  }
  return inside;
}
function bboxOverlap(a, b) { return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]); }
function inPref(p, x, y) {
  const b = p.bbox; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) return false;
  let inside = false;
  for (const r of p.rings) if (ringCrosses(r, x, y)) inside = !inside;
  return inside;
}

// ---------- 最寄りアーク(STR詰めのR木) ----------
function buildTree(arcs) {
  const leaves = arcs.map((a, idx) => {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (let i = 0; i < a.length; i += 2) { const x = a[i], y = a[i + 1]; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
    return { minx, miny, maxx, maxy, idx, children: null };
  });
  const FAN = 16;
  let level = leaves;
  while (level.length > FAN) {
    level.sort((p, q) => (p.minx + p.maxx) - (q.minx + q.maxx));
    const nslab = Math.ceil(Math.sqrt(level.length / FAN));
    const per = Math.ceil(level.length / nslab);
    const next = [];
    for (let s = 0; s < level.length; s += per) {
      const slab = level.slice(s, s + per).sort((p, q) => (p.miny + p.maxy) - (q.miny + q.maxy));
      for (let k = 0; k < slab.length; k += FAN) {
        const ch = slab.slice(k, k + FAN);
        const nd = { minx: Infinity, miny: Infinity, maxx: -Infinity, maxy: -Infinity, idx: -1, children: ch };
        for (const c of ch) { if (c.minx < nd.minx) nd.minx = c.minx; if (c.maxx > nd.maxx) nd.maxx = c.maxx; if (c.miny < nd.miny) nd.miny = c.miny; if (c.maxy > nd.maxy) nd.maxy = c.maxy; }
        next.push(nd);
      }
    }
    level = next;
  }
  const root = { minx: Infinity, miny: Infinity, maxx: -Infinity, maxy: -Infinity, idx: -1, children: level };
  for (const c of level) { if (c.minx < root.minx) root.minx = c.minx; if (c.maxx > root.maxx) root.maxx = c.maxx; if (c.miny < root.miny) root.miny = c.miny; if (c.maxy > root.maxy) root.maxy = c.maxy; }
  return root;
}

function segDist2(a, x, y, kx, ky) {     // アーク内の全辺への最短距離の2乗(m^2)
  let best = Infinity;
  let px = (a[0] - x) * kx, py = (a[1] - y) * ky;
  for (let i = 2; i < a.length; i += 2) {
    const qx = (a[i] - x) * kx, qy = (a[i + 1] - y) * ky;
    const dx = qx - px, dy = qy - py, L2 = dx * dx + dy * dy;
    let d2;
    if (L2 === 0) d2 = px * px + py * py;
    else {
      let t = -(px * dx + py * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = px + t * dx, ey = py + t * dy; d2 = ex * ex + ey * ey;
    }
    if (d2 < best) best = d2;
    px = qx; py = qy;
  }
  return best;
}

// filter(arcIdx) が真のアークだけを対象に最寄りを探す。戻り: {d: m, idx}
function nearestArc(tree, arcs, x, y, filter) {
  const kx = M_PER_DEG * Math.cos(y * Math.PI / 180), ky = M_PER_DEG;
  let best = Infinity, bestIdx = -1;
  const bd2 = (n) => {
    const dx = (n.minx > x ? n.minx - x : x > n.maxx ? x - n.maxx : 0) * kx;
    const dy = (n.miny > y ? n.miny - y : y > n.maxy ? y - n.maxy : 0) * ky;
    return dx * dx + dy * dy;
  };
  const visit = (n) => {
    if (n.children === null) {
      if (filter && !filter(n.idx)) return;
      const d2 = segDist2(arcs[n.idx], x, y, kx, ky);
      if (d2 < best) { best = d2; bestIdx = n.idx; }
      return;
    }
    const order = n.children.map((c) => [bd2(c), c]).sort((p, q) => p[0] - q[0]);
    for (const [d2, c] of order) { if (d2 >= best) break; visit(c); }
  };
  visit(tree);
  return { d: Math.sqrt(best), idx: bestIdx };
}

// ---------- 分類 ----------
function makeClassifier(db) {
  const tree = buildTree(db.arcs);
  return function classify(lon, lat) {
    const hits = [];
    for (let i = 0; i < db.prefs.length; i++) if (inPref(db.prefs[i], lon, lat)) hits.push(i);
    if (hits.length === 1) return { pref: hits[0], method: 'pip', hits, dist: 0 };
    if (hits.length > 1) {   // 重なり(本来は無い=overlapCheckで0を確かめる)。自分のアーク(海岸線・県境)が最も近い県にする
      let best = hits[0], bd = Infinity;
      for (const h of hits) { const nr = nearestArc(tree, db.arcs, lon, lat, (idx) => db.arcOwners[idx].includes(h)); if (nr.d < bd) { bd = nr.d; best = h; } }
      return { pref: best, method: 'pip-tie', hits, dist: bd };
    }
    const nr = nearestArc(tree, db.arcs, lon, lat, null);
    const owners = db.arcOwners[nr.idx];
    return { pref: owners[0], method: 'nearest', hits: owners.slice(), dist: nr.d, tree };
  };
}

// ---------- 県どうしの重なり(期待 0) ----------
// N03の県境は隣県どうしで頂点が1つ多い/少ないことがあり(例: A-C と A-B-C)、その辺は共有辺にならず幅ゼロの「縫い目」として両県の海岸線アークに残る。
// 縫い目の頂点は相手の多角形の縁(数m以内)にあるので、相手県の自分のアークまでの距離が SEAM_M 以下なら縫い目として数え、それより深く入っているものだけを重なりとする。
const SEAM_M = 10;
function overlapCheck(db, tree) {
  const bad = []; const seams = []; let tested = 0; let worst = 0;
  for (let ai = 0; ai < db.prefs.length; ai++) {
    const A = db.prefs[ai];
    const others = db.prefs.map((p, i) => i).filter((i) => i !== ai && bboxOverlap(db.prefs[i].bbox, A.bbox));
    if (!others.length) continue;
    for (let idx = 0; idx < db.arcs.length; idx++) {
      if (db.arcOwners[idx].length !== 1 || db.arcOwners[idx][0] !== ai) continue;   // その県だけの海岸線アーク
      const a = db.arcs[idx];
      for (let i = 0; i < a.length; i += 2) {
        const x = a[i], y = a[i + 1]; tested++;
        for (const bi of others) {
          if (!inPref(db.prefs[bi], x, y)) continue;
          const nr = nearestArc(tree, db.arcs, x, y, (k) => db.arcOwners[k].includes(bi));   // 相手県の縁までの距離
          const rec = { pref: A.name, inside: db.prefs[bi].name, lat: y, lon: x, arc: idx, depth_m: Math.round(nr.d * 10) / 10 };
          if (nr.d > SEAM_M) { bad.push(rec); if (nr.d > worst) worst = nr.d; } else seams.push(rec);
          break;
        }
      }
    }
  }
  bad.sort((p, q) => q.depth_m - p.depth_m);
  return { tested, count: bad.length, worst_m: Math.round(worst * 10) / 10, seam_count: seams.length, seam_m: SEAM_M, samples: bad.slice(0, 10) };
}

function main() {
  const t0 = Date.now();
  const db = load(DATA);
  const tLoad = Date.now() - t0;
  const classify = makeClassifier(db);
  const tree = buildTree(db.arcs);
  const tBuild = Date.now() - t0 - tLoad;
  const nPoints = db.arcs.reduce((s, a) => s + a.length / 2, 0);
  const nRings = db.prefs.reduce((s, p) => s + p.rings.length, 0);
  const log = (s) => { if (!JSON_ONLY) console.log(s); };
  log(`data: ${DATA} (${fs.statSync(DATA).size} bytes, arcFormat=${db.doc.arcFormat}, arcs=${db.arcs.length}, points=${nPoints}, prefs=${db.prefs.length}, rings=${nRings}) load=${tLoad}ms build=${tBuild}ms`);

  // 1) 山岳
  const mj = JSON.parse(fs.readFileSync(MOUNTAINS, 'utf8'));
  const mountains = mj.mountains || mj;
  let ok = 0, fallback = 0, worst = 0, ambiguous = 0;
  const mismatches = [];
  const codeOf = (i) => Number(db.prefs[i].code);
  for (const m of mountains) {
    const r = classify(m.lon, m.lat);
    if (r.method === 'nearest') { fallback++; if (r.dist > worst) worst = r.dist; }
    if (r.method === 'pip' && r.hits.length > 1) ambiguous++;
    const expected = (m.prefCode || []).map(Number);
    if (expected.includes(codeOf(r.pref))) { ok++; continue; }
    // 期待県の境界までの距離(どれだけ深く別の県に入っているか)
    const expIdx = new Set(db.prefs.map((p, i) => i).filter((i) => expected.includes(codeOf(i))));
    const ne = nearestArc(tree, db.arcs, m.lon, m.lat, (idx) => db.arcOwners[idx].some((o) => expIdx.has(o)));
    mismatches.push({ name: m.name, lat: m.lat, lon: m.lon, expected: (m.pref || []).join('/'), expectedCode: expected,
      got: db.prefs[r.pref].name, gotCode: codeOf(r.pref), method: r.method,
      dist_to_expected_m: Math.round(ne.d), fallback_m: r.method === 'nearest' ? Math.round(r.dist) : 0 });
  }
  mismatches.sort((a, b) => b.dist_to_expected_m - a.dist_to_expected_m);
  const verify = { accuracy: Number((ok / mountains.length).toFixed(4)), n_mountains: mountains.length, n_ok: ok,
    fallback_count: fallback, worst_m: Math.round(worst), ambiguous_count: ambiguous, mismatch_count: mismatches.length,
    mismatches: mismatches.slice(0, 10) };
  log(`mountains: ${ok}/${mountains.length} ok (accuracy ${verify.accuracy}), fallback=${fallback} worst=${verify.worst_m}m ambiguous=${ambiguous} mismatches=${mismatches.length}`);
  for (const x of mismatches.slice(0, 10)) log(`  ${x.name} (${x.lat},${x.lon}) expected ${x.expected} got ${x.got} [${x.method}] dist_to_expected=${x.dist_to_expected_m}m`);

  // 2) 乱数点の所要時間(日本のbbox: 南鳥島・沖ノ鳥島・与那国島・択捉島を含む)
  let s = SEED >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const BB = [122.9, 20.4, 154.0, 45.6];
  const pts = new Float64Array(NPOINTS * 2);
  for (let i = 0; i < NPOINTS; i++) { pts[2 * i] = BB[0] + rnd() * (BB[2] - BB[0]); pts[2 * i + 1] = BB[1] + rnd() * (BB[3] - BB[1]); }
  const counts = new Map(); let nFb = 0, nAmb = 0;
  const t1 = process.hrtime.bigint();
  for (let i = 0; i < NPOINTS; i++) {
    const r = classify(pts[2 * i], pts[2 * i + 1]);
    if (r.method === 'nearest') nFb++;
    if (r.hits.length > 1 && r.method !== 'nearest') nAmb++;
    counts.set(r.pref, (counts.get(r.pref) || 0) + 1);
  }
  const ms = Number(process.hrtime.bigint() - t1) / 1e6;
  // 陸上の点だけの所要時間も測る(内外判定のみ)
  let landMs = null, nLand = 0;
  {
    const t2 = process.hrtime.bigint(); let hit = 0;
    for (let i = 0; i < NPOINTS; i++) { const x = pts[2 * i], y = pts[2 * i + 1]; for (const p of db.prefs) if (inPref(p, x, y)) { hit++; break; } }
    landMs = Number(process.hrtime.bigint() - t2) / 1e6; nLand = hit;
  }
  const timing = { n: NPOINTS, ms: Math.round(ms), fallback_count: nFb, ambiguous_count: nAmb, pip_only_ms: Math.round(landMs), land_points: nLand };
  log(`random ${NPOINTS} points in bbox ${JSON.stringify(BB)}: ${timing.ms}ms total (nearest fallback for ${nFb}, ambiguous ${nAmb}), pip-only pass ${timing.pip_only_ms}ms (${nLand} on land)`);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([i, c]) => `${db.prefs[i].name}:${c}`);
  log(`  most assigned: ${top.join(' ')}`);

  // 4) 県どうしの重なり(期待 0)
  const t3 = Date.now();
  const overlap = overlapCheck(db, tree); overlap.ms = Date.now() - t3;
  log(`overlap: ${overlap.count} coast vertices deeper than ${SEAM_M}m inside another prefecture (worst ${overlap.worst_m}m; seams within ${SEAM_M}m: ${overlap.seam_count}; tested ${overlap.tested}) ${overlap.ms}ms`);
  for (const b of overlap.samples) log(`  ${b.pref} vertex (${b.lat},${b.lon}) arc ${b.arc} is ${b.depth_m}m inside ${b.inside}`);
  // 5) 任意の点
  const probes = [];
  if (PROBE) {
    for (const q of PROBE.split(';')) {
      const [la, lo] = q.split(',').map(Number); if (!isFinite(la) || !isFinite(lo)) continue;
      const r = classify(lo, la);
      probes.push({ lat: la, lon: lo, pref: db.prefs[r.pref].name, method: r.method, hits: r.hits.map((i) => db.prefs[i].name), dist_m: Math.round(r.dist) });
      log(`probe (${la},${lo}) -> ${db.prefs[r.pref].name} [${r.method}${r.hits.length > 1 ? ' hits ' + r.hits.map((i) => db.prefs[i].name).join('/') : ''}${r.method === 'nearest' ? ' ' + Math.round(r.dist) + 'm' : ''}]`);
    }
  }
  const out = { data: path.relative(ROOT, DATA), bytes: fs.statSync(DATA).size, arcs: db.arcs.length, points: nPoints, rings: nRings, retrieved: db.doc.retrieved || null, topology_splits: (db.doc.stats || {}).topology_splits, verify, timing, overlap: { tested: overlap.tested, count: overlap.count, worst_m: overlap.worst_m, seam_count: overlap.seam_count, seam_m: overlap.seam_m, samples: overlap.samples, ms: overlap.ms }, probes };
  if (JSON_ONLY) console.log(JSON.stringify(out)); else console.log('JSON: ' + JSON.stringify(out));
}

if (require.main === module) main();
module.exports = { load, decodePolyline5, decodeDelta, inPref, ringCrosses, buildTree, nearestArc, makeClassifier, overlapCheck };   // 参照実装として他のスクリプトから使える
