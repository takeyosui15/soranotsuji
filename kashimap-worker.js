// 可視マップ その場計算のワーカー(位置情報メニューの「目的点で計算」「My目的点で計算」)。
// 静的資産を作る道具 tools/kashimap/viewshed.js と同じ計算(R2: 目的点から窓の縁の全画素へ光線を伸ばし、地球の丸み+大気差の
// 沈み込み d²/(2Reff) を引いた見かけ高度角の最大を更新しながら外へ歩く)をブラウザのワーカーで行い、同じ形の資産
// (meta・islands・outline)を返す。式はアプリの統一可視判定(_visJudgeCore)と同じ(e − d²·inv2R と直線の比較)。
// 窓のズーム(解像度)は範囲で変える(z15=1画素≈4m…z11=約62m。メインスレッドの _kmZoomForRange)。
// 標高タイルはここで取り(z15: dem5a→5b→5c→dem_png[z14を2倍] / z14以下: そのズームの dem_png)、端末(IndexedDB: soranotsuji-kashimap / tiles)に
// 貯めて次の計算では取りに行かない(「標高タイルを削除」でまとめて消せる)。
// 1枚のタイルの中で無効(データ無し)の画素は次の源で埋める(画素ごとの穴埋め。5Aの測量範囲の縁で、タイルの形の穴が結果に出ないように)。
// 取得は同時4本・1枚15秒の上限・3回まで再試行・失敗が続いたら中止・枚数の上限(安全弁)。
// 目的点側の除外=山頂部(アプリと同じ規則: 基準の標高=目的点のDEM[3×3画素の最大]と目的点の標高の高い方・帯の高さ以内で
// 目的点につながる画素・別の山[山リスト]の山頂を含む時は含まない高さまで縮める・目的点が山頂でない時は帯なし)+半径 exclTgtM。
// 観測点側=半径 exclObsM。観測者は地上 obsH(m)。
// 計算中は見える画素の経過(縮小した格子)を preview で送り、地図に経過表示できる。
// メッセージ: {type:'compute', job} → {type:'progress', phase, done, total} / {type:'preview', …} … → {type:'done', meta, islands, outline[, bits]} / {type:'error', message}
// job = { id, name, lat, lon, elevGround(目的点の標高。構造物の高さは含めない), heightM(構造物の高さ), rangeKm, zoom(窓のズーム。既定15),
//         inv2R(1/(2·Reff)), k, obsH, exclTgtM, exclObsM, bandM(山頂部の帯。0=使わない), searchM, upM,
//         peaks[{id,name,elev,lat,lon,d}](探索半径内の山リストの山頂), maxTiles, grid?(テスト用の合成標高=Uint16の窓の格子。あればタイルを取らない),
//         returnBits?(見える/見えないの1bit列も返す), preview?(経過表示を送る。既定true) }
'use strict';

importScripts('sora-constants.js');   // 数の単一情報源(地球・標高タイルの符号・日本域・1画素の長さ・既定値)。本体・道具と同じ値
const NODATA = SORA.DEM.GRID_NODATA;  // Uint16格子の「データ無し」。値=round((標高+100)×10)(0.1m刻み・−100m〜)
const TILE_URL = (kind, z, x, y) => `${SORA.DEM.GSI_TILE_BASE}${kind}/${z}/${x}/${y}.png`;
const FETCH_TIMEOUT_MS = 15000;       // 1枚の取得の上限(応答が返らない接続で永久待ちにならないように)
const FETCH_CONCURRENCY = 4;          // 同時に取る枚数(地図タイルの読み込みを邪魔しないよう控えめに)
const FETCH_RETRIES = 3;              // 1枚あたりの試行回数(通信の失敗・5xx・429は間を置いてやり直す)
const MAX_NET_ERRORS = 30;            // 取得の失敗(再試行の後も)がこれだけ続いたら中止(安全弁)
const GSI_BBOX = SORA.DEM.JAPAN_BBOX;   // 地理院のDEMは日本域のみ(アプリと同じ範囲。値は sora-constants.js)
const PREVIEW_MAX = 512;              // 経過表示の格子の一辺(画素)
/** 大きな配列の確保(第156): Chromeは1本のArrayBufferを約2GB(2^31−2MiB)までしか確保できず、700kmのz13の格子(Uint16・約4.0GB)は new Uint16Array で RangeError になる。
 *  失敗したら WebAssembly.Memory(最大4GiB=65,536ページ。ページ割り当て器で確保されるので上の上限に掛からない)の上に同じ型の配列を作る。forceWasm はテスト用 */
function allocArray(Ctor, n, forceWasm) {
    if (!forceWasm) { try { return new Ctor(n); } catch (e) { if (!(e instanceof RangeError)) throw e; } }
    const bytes = n * Ctor.BYTES_PER_ELEMENT, pages = Math.ceil(bytes / 65536);
    if (typeof WebAssembly === 'undefined' || !WebAssembly.Memory || pages > 65536) throw new RangeError(`配列が大きすぎます(${(bytes / 1073741824).toFixed(2)}GB。この範囲と解像度はブラウザで確保できません)`);
    const mem = new WebAssembly.Memory({ initial: pages, maximum: pages });
    return new Ctor(mem.buffer, 0, n);
}

const post = (phase, done, total, note) => self.postMessage({ type: 'progress', phase, done, total, note });
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** 窓のズームごとの標高タイルの源(順に試し、画素ごとに無い所を次の源で埋める) */
function sourcesFor(Z) {
    if (Z >= 15) return [{ kind: 'dem5a_png', z: 15 }, { kind: 'dem5b_png', z: 15 }, { kind: 'dem5c_png', z: 15 }, { kind: 'dem_png', z: 14 }];
    return [{ kind: 'dem_png', z: Z }];   // z14以下はDEM10B(dem_png)がそのズームにある
}

// ---------- 窓(ズームZの画素格子)。アプリ側の _kmWindow と同じ式 ----------
function windowGeom(lat, lon, rangeKm, Z) {
    const WORLD = 256 * Math.pow(2, Z);
    const lonToX = (ln) => (ln + 180) / 360 * WORLD;
    const latToY = (lt) => (1 - Math.log(Math.tan(lt * Math.PI / 180) + 1 / Math.cos(lt * Math.PI / 180)) / Math.PI) / 2 * WORLD;
    const MPP = SORA.metersPerPixel(lat, Z);   // 中心緯度での1画素(m)。窓の中で少し変わる(48km四方で約±0.4%)。式は sora-constants.js(本体の _kmWindow と同じ)
    const halfPx = Math.ceil(rangeKm * 1000 / 2 / MPP);
    const X0 = Math.floor(lonToX(lon)) - halfPx, Y0 = Math.floor(latToY(lat)) - halfPx;
    const W = 2 * halfPx + 1;
    return { Z, WORLD, X0, Y0, W, H: W, CX: halfPx, CY: halfPx, MPP, lonToX, latToY,
             xToLon: (x) => x / WORLD * 360 - 180, yToLat: (y) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / WORLD))) * 180 / Math.PI };
}

/** 大円と縮尺のヘルパー(computeViewshed用): rowScale[y]=その行の1画素の長さ/中心の1画素の長さ、bend(ex,ey)=中心から(ex,ey)への大円の弦からの反り(画素。弦に直交する単位ベクトルと4δ) */
function geodesicHelpers(G) {
    const { W, H, CX, CY, X0, Y0 } = G;
    const D2R = Math.PI / 180;
    const lat0 = G.yToLat(Y0 + CY + 0.5), lon0 = G.xToLon(X0 + CX + 0.5), c0 = Math.cos(lat0 * D2R);
    const rowScale = new Float64Array(H);
    for (let y = 0; y < H; y++) rowScale[y] = Math.cos(G.yToLat(Y0 + y + 0.5) * D2R) / c0;
    const p0 = [Math.cos(lat0 * D2R) * Math.cos(lon0 * D2R), Math.cos(lat0 * D2R) * Math.sin(lon0 * D2R), Math.sin(lat0 * D2R)];
    const bend = (ex, ey) => {
        const dx = ex - CX, dy = ey - CY; const len = Math.sqrt(dx * dx + dy * dy); if (len < 2) return { nx: 0, ny: 0, amp: 0 };
        const lat1 = G.yToLat(Y0 + ey + 0.5), lon1 = G.xToLon(X0 + ex + 0.5);
        const p1 = [Math.cos(lat1 * D2R) * Math.cos(lon1 * D2R), Math.cos(lat1 * D2R) * Math.sin(lon1 * D2R), Math.sin(lat1 * D2R)];
        const m = [p0[0] + p1[0], p0[1] + p1[1], p0[2] + p1[2]]; const mn = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);   // 大円の中点(弦の中点を球面へ射影)
        const mlat = Math.asin(m[2] / mn) / D2R, mlon = Math.atan2(m[1], m[0]) / D2R;
        const mx = G.lonToX(mlon) - X0 - 0.5, my = G.latToY(mlat) - Y0 - 0.5;   // 画素座標(中心画素の中心を基準)
        const ox = mx - (CX + dx / 2), oy = my - (CY + dy / 2);                     // 弦の中点からのずれ
        const nx = -dy / len, ny = dx / len; const delta = ox * nx + oy * ny;      // 弦に直交する成分
        return { nx, ny, amp: 4 * delta };
    };
    return { rowScale, bend };
}

// ---------- 標高タイル(取得・端末の店・復号) ----------
let _dbP = null;
function openDb() {
    if (_dbP) return _dbP;
    _dbP = new Promise((ok) => {
        try {
            const req = indexedDB.open('soranotsuji-kashimap');   // 版はメインスレッドが管理する(ここでは今ある版をそのまま開く)
            req.onsuccess = () => { const db = req.result; ok(db.objectStoreNames.contains('tiles') ? db : null); };
            req.onerror = () => ok(null);
            req.onblocked = () => ok(null);
        } catch (e) { ok(null); }
    });
    return _dbP;
}
function idbGet(db, key) {
    return new Promise((ok) => { try { const r = db.transaction('tiles', 'readonly').objectStore('tiles').get(key); r.onsuccess = () => ok(r.result); r.onerror = () => ok(undefined); } catch (e) { ok(undefined); } });
}
function idbPut(db, rec) {
    return new Promise((ok) => { try { const tx = db.transaction('tiles', 'readwrite'); tx.objectStore('tiles').put(rec); tx.oncomplete = () => ok(true); tx.onerror = () => ok(false); tx.onabort = () => ok(false); } catch (e) { ok(false); } });
}
function tileOutsideJapan(z, x, y) {
    const n = Math.pow(2, z);
    const lngW = x / n * 360 - 180, lngE = (x + 1) / n * 360 - 180;
    const latN = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
    const latS = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;
    return latN < GSI_BBOX.latMin || latS > GSI_BBOX.latMax || lngE < GSI_BBOX.lngMin || lngW > GSI_BBOX.lngMax;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
/** タイル1枚のPNGバイト列(端末の店→無ければ取得して店へ)。404(海・範囲外)は null(店にも「無し」を残す)。通信の失敗・5xx・429は間を置いて3回まで */
async function fetchTile(kind, z, x, y, st) {
    if (tileOutsideJapan(z, x, y)) return null;
    const key = `${kind}/${z}/${x}/${y}`;
    const db = await openDb();
    if (db) { const rec = await idbGet(db, key); if (rec && !(rec.miss && (Date.now() - (Number(rec.savedAt) || 0)) >= SORA.TILE_STORE.MISS_TTL_MS)) { st.cached++; return rec.miss ? null : rec.buf; } }   // 古い「無し」の印(30日)は取り直す(第158)
    let lastErr = null;
    for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
        const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
        try {
            const res = await fetch(TILE_URL(kind, z, x, y), { signal: ctl.signal, mode: 'cors', priority: 'low' });   // 地図タイルより低い優先度で
            if (res.status === 404) { st.fetched++; if (db) await idbPut(db, { key, kind, z, x, y, size: 0, miss: true, savedAt: Date.now() }); return null; }
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const buf = await res.arrayBuffer(); st.fetched++; st.bytes += buf.byteLength; if (attempt > 1) st.retried++;
            if (db) await idbPut(db, { key, kind, z, x, y, size: buf.byteLength, buf, savedAt: Date.now() });
            return buf;
        } catch (e) {
            lastErr = e;
            if (attempt < FETCH_RETRIES) await sleep(500 * attempt);
        } finally { clearTimeout(timer); }
    }
    throw lastErr || new Error('取得に失敗');
}
/** PNG→RGBA(ブラウザの復号器。OffscreenCanvasが要る) */
async function decodeTile(buf) {
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') throw new Error('このブラウザでは標高タイルを読めません(OffscreenCanvas非対応)');
    const bmp = await createImageBitmap(new Blob([buf], { type: 'image/png' }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const w = bmp.width, h = bmp.height;
    const cv = new OffscreenCanvas(w, h); const c = cv.getContext('2d', { willReadFrequently: true });
    c.drawImage(bmp, 0, 0); const d = c.getImageData(0, 0, w, h); bmp.close();
    return { w, h, data: d.data };
}
/** タイルの画素を窓の格子へ(地理院の標高PNG: x=2^16R+2^8G+B, x<2^23→x·0.01m, x>2^23→(x−2^24)·0.01m, x=2^23→無効)。
 *  zt<Z の時は 2^(Z−zt) 倍に引き伸ばす(最近傍)。clip=書き込む窓の範囲(窓のズームのタイル1枚分。親タイルを隣のタイルの分まで書かない)。
 *  既に値のある画素は上書きしない(=無い所だけ次の源で埋まる) */
function decodeElevInto(grid, G, png, tx, ty, zt, clip) {
    const scale = Math.pow(2, G.Z - zt); const { w, data } = png; const { X0, Y0, W, H } = G;
    const originX = tx * 256 * scale - X0, originY = ty * 256 * scale - Y0;
    const cx0 = Math.max(0, clip ? clip.x0 : 0), cy0 = Math.max(0, clip ? clip.y0 : 0), cx1 = Math.min(W - 1, clip ? clip.x1 : W - 1), cy1 = Math.min(H - 1, clip ? clip.y1 : H - 1);
    for (let py = 0; py < png.h; py++) {
        const gy0 = originY + py * scale; if (gy0 + scale - 1 < cy0 || gy0 > cy1) continue;
        for (let px = 0; px < w; px++) {
            const gx0 = originX + px * scale; if (gx0 + scale - 1 < cx0 || gx0 > cx1) continue;
            const o = (py * w + px) * 4; let v = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2];
            if (v === SORA.DEM.GSI_INVALID_CODE) continue;
            if (v > SORA.DEM.GSI_INVALID_CODE) v -= SORA.DEM.GSI_CODE_WRAP;
            const code = Math.round((v * SORA.DEM.GSI_UNIT_M + SORA.DEM.GRID_OFFSET_M) * SORA.DEM.GRID_SCALE);
            if (code < 0 || code >= NODATA) continue;
            for (let sy = 0; sy < scale; sy++) {
                const gy = gy0 + sy; if (gy < cy0 || gy > cy1) continue;
                for (let sx = 0; sx < scale; sx++) { const gx = gx0 + sx; if (gx < cx0 || gx > cx1) continue; const gi = gy * W + gx; if (grid[gi] === NODATA) grid[gi] = code; }
            }
        }
    }
}
async function loadTiles(job, grid, G) {
    const st = { fetched: 0, cached: 0, retried: 0, bytes: 0, from5a: 0, from5b: 0, from5c: 0, from10b: 0, filled: 0, missing: 0, errors: 0 };
    const { X0, Y0, W, H, Z } = G;
    const sources = sourcesFor(Z);
    const TX0 = Math.floor(X0 / 256), TX1 = Math.floor((X0 + W - 1) / 256), TY0 = Math.floor(Y0 / 256), TY1 = Math.floor((Y0 + H - 1) / 256);
    const jobs = [];
    const cxT = (X0 + G.CX) / 256, cyT = (Y0 + G.CY) / 256;
    for (let ty = TY0; ty <= TY1; ty++) for (let tx = TX0; tx <= TX1; tx++) jobs.push([tx, ty]);
    jobs.sort((a, b) => (Math.hypot(a[0] + 0.5 - cxT, a[1] + 0.5 - cyT) - Math.hypot(b[0] + 0.5 - cxT, b[1] + 0.5 - cyT)));   // 目的点に近い順
    const maxTiles = job.maxTiles || 4000;
    if (jobs.length > maxTiles) throw new Error(`標高タイルが多すぎます(${jobs.length}枚。上限${maxTiles}枚)`);
    st.tiles = jobs.length;
    const pngCache = new Map();   // 親タイル(窓より粗いズーム)の復号結果(子タイルで使い回す)
    let next = 0, done = 0, consecutiveErr = 0;
    const holes = (clip) => {   // そのタイルの範囲に残っている「データ無し」の画素数
        let n = 0;
        for (let y = Math.max(0, clip.y0); y <= Math.min(H - 1, clip.y1); y++) { const o = y * W; for (let x = Math.max(0, clip.x0); x <= Math.min(W - 1, clip.x1); x++) if (grid[o + x] === NODATA) n++; }
        return n;
    };
    const one = async (tx, ty) => {
        const clip = { x0: tx * 256 - X0, y0: ty * 256 - Y0, x1: tx * 256 + 255 - X0, y1: ty * 256 + 255 - Y0 };
        let first = null, nSrc = 0;
        for (const s of sources) {
            const f = Math.pow(2, Z - s.z), x = Math.floor(tx / f), y = Math.floor(ty / f);   // 粗い源は親タイルの番号
            let buf;
            try { buf = await fetchTile(s.kind, s.z, x, y, st); consecutiveErr = 0; }
            catch (e) { st.errors++; consecutiveErr++; if (consecutiveErr >= MAX_NET_ERRORS) throw new Error(`標高タイルの取得に失敗が続くため中止しました(${e && e.message ? e.message : e})`); continue; }
            if (!buf) continue;
            let png;
            if (s.z < Z) { const k = s.z + ':' + x + ',' + y; png = pngCache.get(k); if (!png) { png = await decodeTile(buf); pngCache.set(k, png); if (pngCache.size > 64) pngCache.delete(pngCache.keys().next().value); } }
            else png = await decodeTile(buf);
            decodeElevInto(grid, G, png, x, y, s.z, clip);
            nSrc++; if (!first) first = s;
            if (holes(clip) === 0) break;   // 穴が無くなったら次の源は要らない
        }
        if (first) { st[first.kind === 'dem_png' ? 'from10b' : 'from' + first.kind.slice(3, 5)]++; if (nSrc > 1) st.filled++; } else st.missing++;
    };
    const runner = async () => {
        while (next < jobs.length) {
            const [tx, ty] = jobs[next++];
            await one(tx, ty);
            done++;
            if (done % 5 === 0 || done === jobs.length) post('tiles', done, jobs.length);
        }
    };
    post('tiles', 0, jobs.length);
    await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, jobs.length) }, runner));
    return st;
}

// ---------- 山頂部(アプリの _visSummitBand と同じ規則) ----------
function summitBand(job, grid, G) {
    const { W, H, CX, CY, MPP } = G;
    let hDem = -Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = CX + dx, y = CY + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const c = grid[y * W + x]; if (c !== NODATA) hDem = Math.max(hDem, c / 10 - 100);
    }
    const gElev = (job.elevGround !== null && job.elevGround !== undefined && isFinite(+job.elevGround)) ? +job.elevGround : null;
    if (hDem === -Infinity && gElev === null) throw new Error('目的点の標高データがありません');
    const hT = Math.max(hDem, gElev === null ? -Infinity : gElev);   // 基準の標高=DEMと目的点の標高の高い方
    const base = { hT, hDem: hDem === -Infinity ? null : hDem };
    if (!(job.bandM > 0)) return { ...base, none: true, off: true, reason: '山頂部オフ(目的点側の除外半径だけ)' };
    const searchM = job.searchM || 3000;
    const rPx = Math.ceil(searchM / MPP), bw = 2 * rPx + 1;
    const elevBox = new Float32Array(bw * bw).fill(NaN);
    const r2 = (searchM / MPP) * (searchM / MPP);
    for (let by = 0; by < bw; by++) {
        const dy = by - rPx; const half = Math.floor(Math.sqrt(Math.max(0, r2 - dy * dy))); const y = CY + dy; if (y < 0 || y >= H) continue;
        for (let bx = Math.max(0, rPx - half); bx <= Math.min(bw - 1, rPx + half); bx++) {
            const x = CX + bx - rPx; if (x < 0 || x >= W) continue;
            const c = grid[y * W + x]; if (c !== NODATA) elevBox[by * bw + bx] = c / 10 - 100;
        }
    }
    // 別の山(山リストの山頂)。目的点自身(60m以内、または500m以内で山頂の標高が基準+100m以内)と同じ索引番号の親番号の峰は除く
    const inBox = (job.peaks || []).map(p => ({ ...p, bx: Math.floor(G.lonToX(p.lon)) - G.X0 - CX + rPx, by: Math.floor(G.latToY(p.lat)) - G.Y0 - CY + rPx }))
        .filter(p => p.bx >= 0 && p.by >= 0 && p.bx < bw && p.by < bw && Math.hypot(p.bx - rPx, p.by - rPx) * MPP <= searchM);
    const selfPeak = inBox.filter(m => m.d <= 60 || (m.d <= 500 && (m.elev === null || m.elev === undefined || m.elev - hT <= 100))).sort((a, b) => a.d - b.d)[0];
    const selfBase = selfPeak ? String(selfPeak.id).split('-')[0] : null;
    const others = inBox.filter(m => !(selfPeak && m.id === selfPeak.id) && !(selfBase && String(m.id).split('-')[0] === selfBase));
    const keepBuf = new Uint8Array(bw * bw), stackBuf = new Int32Array(bw * bw);
    let bandMax = -Infinity;
    const bandOf = (drop) => {
        const keep = keepBuf; keep.fill(0); let sp = 0; stackBuf[sp++] = rPx * bw + rPx; keep[rPx * bw + rPx] = 1; bandMax = hT;
        const thr = hT - drop;
        while (sp) {
            const i = stackBuf[--sp]; const x = i % bw, y = (i - x) / bw;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= bw || ny >= bw) continue;
                const j = ny * bw + nx; const e = elevBox[j];
                if (!keep[j] && e >= thr) { keep[j] = 1; stackBuf[sp++] = j; if (e > bandMax) bandMax = e; }
            }
        }
        return keep;
    };
    const hasOther = (keep) => others.find(o => keep[o.by * bw + o.bx] === 1) || null;
    let drop = job.bandM, keep = bandOf(drop); const blocker = hasOther(keep);
    if (blocker) {
        if (hasOther(bandOf(0))) return { ...base, none: true, reason: `山頂部なし(別の山「${blocker.name}」が目的点より高くつながっている=目的点はその山の山腹)` };
        let lo = 0, hi = drop;
        while (hi - lo >= 1) { const mid = (lo + hi) / 2; if (hasOther(bandOf(mid))) hi = mid; else lo = mid; }
        drop = Math.floor(lo); keep = bandOf(drop);
        if (hasOther(keep)) return { ...base, none: true, reason: `山頂部なし(別の山「${blocker.name}」を含まない帯が取れない)` };
    }
    if (bandMax > hT + (job.upM || 100)) return { ...base, none: true, reason: `山頂部なし(目的点より${Math.round(bandMax - hT)}m高い地形がつながっている=目的点は山頂ではない)` };
    let px = 0, far2 = 0;
    for (let i = 0; i < bw * bw; i++) { if (!keep[i]) continue; px++; const x = i % bw, y = (i - x) / bw; const d2 = (x - rPx) * (x - rPx) + (y - rPx) * (y - rPx); if (d2 > far2) far2 = d2; }
    return { ...base, none: false, keep: keep.slice(), rPx, bw, dropUsed: drop, dropRequested: job.bandM, px, farM: Math.round(Math.sqrt(far2) * MPP), others: others.map(o => o.name), shrunkBy: blocker ? blocker.name : null };
}

// ---------- 視域計算(R2: 目的点から窓の縁の全画素へ光線)。経過(縮小格子)を途中で送る ----------
function computeViewshed(grid, G, hS, inv2R, obsH, exclTgtM, exclObsM, band, wantPreview) {
    const { W, H, CX, CY, MPP } = G;
    const visible = allocArray(Uint8Array, W * H);   // 1=見える 0=見えない/データ無し 2=目的点(2GB超はWebAssembly.Memoryの上に)
    const exclObsPx = Math.ceil(exclObsM / MPP);
    const prefix = new Float64Array(Math.max(W, H) + 2);   // 手前までの見かけ高度角の最大(除外画素を除く)
    const bandOn = !!(band && !band.none && band.keep);
    const bw = bandOn ? band.bw : 0, rPx = bandOn ? band.rPx : 0, keep = bandOn ? band.keep : null;
    const isExcl = (px, py, dM) => {
        if (dM <= exclTgtM) return true;
        if (!bandOn) return false;
        const bx = px - CX + rPx, by = py - CY + rPx;
        if (bx < 0 || by < 0 || bx >= bw || by >= bw) return false;
        return keep[by * bw + bx] === 1;
    };
    // 経過表示: 見える画素の数をS×Sのセルごとに数える(PREVIEW_MAX四方以下)
    const S = Math.max(1, Math.ceil(Math.max(W, H) / PREVIEW_MAX)); const pw = Math.ceil(W / S), ph = Math.ceil(H / S);
    const prev = wantPreview ? new Uint16Array(pw * ph) : null;
    let rays = 0; const total = 2 * W + 2 * Math.max(0, H - 2);
    const every = Math.max(256, Math.floor(total / 48));
    const sendPreview = () => {
        const out = new Uint8Array(pw * ph); const full = S * S;
        for (let i = 0; i < out.length; i++) out[i] = Math.min(255, Math.round(255 * prev[i] / full));
        self.postMessage({ type: 'preview', pw, ph, S, x0: G.X0, y0: G.Y0, w: W, h: H, zoom: G.Z, done: rays, total, data: out }, [out.buffer]);
    };
    // 大円と縮尺(第156・依頼者の正確性の確認依頼): 光線はメルカトル画素空間の直線(航程線)ではなく、目的点と縁の画素を結ぶ大円(視線が通る鉛直面)に沿わせる。
    // 弦に対する大円の反りは、端点の測地線の中点(球面の線形補間)と弦の中点のずれを測り、放物線 4·δ·t(1−t) で近似する(東西261kmで約950m=数十画素。南北は0)。
    // 距離はメルカトルの縮尺が緯度で変わる(1画素=MPP·cos(lat)/cos(lat0))ので、行ごとの縮尺を光線に沿って積算する(南北261kmで約±1.5%=沈み込み100〜200m)。
    const geo = geodesicHelpers(G);
    const walk = (ex, ey) => {
        const dx = ex - CX, dy = ey - CY; const steps = Math.max(Math.abs(dx), Math.abs(dy)); if (steps === 0) return;
        const sx = dx / steps, sy = dy / steps; const stepM = Math.sqrt(sx * sx + sy * sy) * MPP;
        // 反りは副軸のずれだけに効かせる(主軸は1画素ずつ厳密に進める)。弦に直交する反り δ·4f を、主軸の座標を保ったまま副軸へ射影すると amp·len/dx(主軸がx)・−amp·len/dy(主軸がy)。
        // 両軸をずらすと主軸が2画素飛ぶ歩があり、飛ばされた画素がどの光線にも標本されず「見えない」のまま残る(第156のレビューで検出・修正)
        const bend = geo.bend(ex, ey); const len = Math.sqrt(dx * dx + dy * dy); const xMajor = Math.abs(dx) >= Math.abs(dy);
        const bowMinor = xMajor ? bend.amp * len / dx : -bend.amp * len / dy;
        let runMax = -Infinity, dM = 0;
        for (let s = 1; s <= steps; s++) {
            const t = s / steps, f = t * (1 - t);
            let px = xMajor ? CX + Math.round(sx * s) : Math.round(CX + sx * s + bowMinor * f);
            let py = xMajor ? Math.round(CY + sy * s + bowMinor * f) : CY + Math.round(sy * s);
            if (px < 0) px = 0; else if (px >= W) px = W - 1;
            if (py < 0) py = 0; else if (py >= H) py = H - 1;
            const gi = py * W + px; const code = grid[gi];
            dM += stepM * geo.rowScale[py];                      // 大円に沿った距離(行ごとの縮尺を積算)
            let th;
            if (code !== NODATA) {
                const h = code / 10 - 100; const drop = dM * dM * inv2R;
                th = (h - drop - hS) / dM;                       // 地形の見かけ高度角(目的点から)
                const thP = (h + obsH - drop - hS) / dM;         // 観測者(地上+obsH)の見かけ高度角
                const refIdx = s - 1 - exclObsPx;                // 観測点側の除外=直前 exclObsPx 画素を除く
                const ref = refIdx >= 1 ? prefix[refIdx] : -Infinity;
                if (thP >= ref && visible[gi] !== 1) { visible[gi] = 1; if (prev) prev[((py / S) | 0) * pw + ((px / S) | 0)]++; }
            } else th = (-dM * dM * inv2R - hS) / dM;            // データ無し(海・標高タイルの無い所)は海面0mとして遮る(第156: 遠い海越しで光線が海面の下を通るのに「見える」になっていた)。見える画素にはしない
            if (!isExcl(px, py, dM)) runMax = Math.max(runMax, th);   // 目的点側の除外(山頂部・除外半径)の画素は手前の最大に入れない
            prefix[s] = runMax;
        }
        rays++;
        if ((rays & 511) === 0) post('rays', rays, total);
        if (prev && rays % every === 0) sendPreview();
    };
    for (let x = 0; x < W; x++) { walk(x, 0); walk(x, H - 1); }
    for (let y = 1; y < H - 1; y++) { walk(0, y); walk(W - 1, y); }
    visible[CY * W + CX] = 2;
    let nVis = 0; for (let i = 0; i < visible.length; i++) if (visible[i] === 1) nVis++;
    post('rays', total, total);
    if (prev) sendPreview();
    return { visible, nVis, rays };
}

// ---------- 島(8近傍の連結成分。行の連(run)の合併。連は型付き配列で持つ) ----------
function labelIslands(visible, G) {
    const { W, H } = G;
    let cap = 1 << 16; let rY = new Int32Array(cap), rX0 = new Int32Array(cap), rX1 = new Int32Array(cap), par = new Int32Array(cap); let nr = 0;
    const grow = (a) => { const b = new Int32Array(cap); b.set(a); return b; };
    const rowStart = new Int32Array(H + 1);
    for (let y = 0; y < H; y++) {
        rowStart[y] = nr; const o = y * W;
        for (let x = 0; x < W; x++) {
            if (visible[o + x] !== 1) continue;
            const x0 = x; while (x + 1 < W && visible[o + x + 1] === 1) x++;
            if (nr === cap) { cap *= 2; rY = grow(rY); rX0 = grow(rX0); rX1 = grow(rX1); par = grow(par); }
            rY[nr] = y; rX0[nr] = x0; rX1[nr] = x; par[nr] = nr; nr++;
        }
    }
    rowStart[H] = nr;
    const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    const union = (a, b) => { a = find(a); b = find(b); if (a !== b) par[b] = a; };
    for (let y = 1; y < H; y++) {
        let j = rowStart[y - 1]; const jEnd = rowStart[y];
        for (let i = rowStart[y]; i < rowStart[y + 1]; i++) {
            const x0 = rX0[i], x1 = rX1[i];
            while (j < jEnd && rX1[j] < x0 - 1) j++;
            for (let k = j; k < jEnd && rX0[k] <= x1 + 1; k++) union(i, k);
        }
    }
    const compOf = new Int32Array(nr); const comps = []; const rootIdx = new Map();
    for (let i = 0; i < nr; i++) {
        const r = find(i); let ci = rootIdx.get(r);
        if (ci === undefined) { ci = comps.length; rootIdx.set(r, ci); comps.push({ px: 0, sx: 0, sy: 0, minx: rX0[i], maxx: rX1[i], miny: rY[i], maxy: rY[i] }); }
        compOf[i] = ci; const c = comps[ci]; const n = rX1[i] - rX0[i] + 1;
        c.px += n; c.sx += (rX0[i] + rX1[i]) / 2 * n; c.sy += rY[i] * n;
        if (rX0[i] < c.minx) c.minx = rX0[i]; if (rX1[i] > c.maxx) c.maxx = rX1[i]; if (rY[i] < c.miny) c.miny = rY[i]; if (rY[i] > c.maxy) c.maxy = rY[i];
    }
    // 代表点=重心にいちばん近い画素(必ず島の中)
    const bestD = new Float64Array(comps.length).fill(Infinity), repX = new Int32Array(comps.length), repY = new Int32Array(comps.length);
    for (let i = 0; i < nr; i++) {
        const ci = compOf[i], c = comps[ci]; const cx = c.sx / c.px, cy = c.sy / c.px;
        const x = Math.min(Math.max(Math.round(cx), rX0[i]), rX1[i]); const d = (x - cx) * (x - cx) + (rY[i] - cy) * (rY[i] - cy);
        if (d < bestD[ci]) { bestD[ci] = d; repX[ci] = x; repY[ci] = rY[i]; }
    }
    const islands = comps.map((c, ci) => ({ ci, px: c.px, rep: [repX[ci], repY[ci]], bbox: [c.minx, c.miny, c.maxx, c.maxy] }));
    // 項番=代表点を北から南(同じなら東から西)に並べた固定番号。北=小さいy、東=大きいx
    islands.sort((a, b) => (a.rep[1] - b.rep[1]) || (b.rep[0] - a.rep[0]));
    islands.forEach((isl, i) => { isl.no = i + 1; });
    const islandIdx = new Int32Array(comps.length); islands.forEach((isl, i) => { islandIdx[isl.ci] = i; });
    const runIsland = new Int32Array(nr); for (let i = 0; i < nr; i++) runIsland[i] = islandIdx[compOf[i]];
    return { islands, rowStart, rX0, rX1, runIsland, nr };
}
// ---------- 島の輪郭(外周+穴)。境界の辺を全部たどる(道具の extractRings と同じ規則: 内側を右に見て進み、分岐は左折優先=前景8連結・穴4連結) ----------
// 環は画素の角の整数座標を [x0,y0,x1,y1,…] の平らな配列で持つ(向きが変わる頂点だけ。閉じない)
function extractRings(visible, G, L) {
    const { W, H } = G; const { rowStart, rX0, rX1, runIsland, islands } = L;
    const hSeen = new Uint8Array(Math.ceil(W * (H + 1) / 8));
    const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H && visible[y * W + x] === 1) ? 1 : 0;
    const hGet = (x, Lv) => { const i = Lv * W + x; const b = Math.floor(i / 8); return (hSeen[b] >> (i - b * 8)) & 1; };   // 添字は2^31を超えうる(700kmのz13)のでビット演算で割らない
    const hSet = (x, Lv) => { const i = Lv * W + x; const b = Math.floor(i / 8); hSeen[b] |= 1 << (i - b * 8); };
    const rightPix = (d, vx, vy) => d === 0 ? at(vx, vy) : d === 1 ? at(vx - 1, vy) : d === 2 ? at(vx - 1, vy - 1) : at(vx, vy - 1);
    const leftPix = (d, vx, vy) => d === 0 ? at(vx, vy - 1) : d === 1 ? at(vx, vy) : d === 2 ? at(vx - 1, vy) : at(vx - 1, vy - 1);
    const dxs = [1, 0, -1, 0], dys = [0, 1, 0, -1];
    const islandOfPixel = (x, y) => { let lo = rowStart[y], hi = rowStart[y + 1] - 1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (x < rX0[mid]) hi = mid - 1; else if (x > rX1[mid]) lo = mid + 1; else return runIsland[mid]; } return -1; };
    const rings = Array.from({ length: islands.length }, () => []);
    let nEdges = 0, nRings = 0, nVerts = 0;
    const trace = (sx, sy, dir0) => {
        const ring = [sx, sy]; let x = sx, y = sy, dir = dir0;
        for (;;) {
            if (dir === 0) hSet(x, y); else if (dir === 2) hSet(x - 1, y);
            nEdges++;
            x += dxs[dir]; y += dys[dir];
            if (x === sx && y === sy) break;
            const dl = (dir + 3) % 4, dr = (dir + 1) % 4, prevDir = dir;
            if (rightPix(dl, x, y) === 1 && leftPix(dl, x, y) === 0) dir = dl;
            else if (rightPix(dir, x, y) === 1 && leftPix(dir, x, y) === 0) { /* 直進 */ }
            else if (rightPix(dr, x, y) === 1 && leftPix(dr, x, y) === 0) dir = dr;
            else dir = (dir + 2) % 4;
            if (dir !== prevDir) ring.push(x, y);
        }
        return ring;
    };
    for (let Lv = 0; Lv <= H; Lv++) {
        for (let x = 0; x < W; x++) {
            const below = at(x, Lv), above = at(x, Lv - 1);
            if (below === above || hGet(x, Lv)) continue;
            let ring, isl;
            if (below) { ring = trace(x, Lv, 0); isl = islandOfPixel(x, Lv); }
            else { ring = trace(x + 1, Lv, 2); isl = islandOfPixel(x, Lv - 1); }
            if (isl < 0) throw new Error(`輪郭の帰属が取れません (${x},${Lv})`);
            rings[isl].push(ring); nRings++; nVerts += ring.length / 2;
        }
        if ((Lv & 1023) === 1023) post('outline', Lv, H);
    }
    return { rings, nEdges, nRings, nVerts };
}
/** 符号付き面積(y下向き。外周が正・穴が負)。閉路 */
function ringArea(r) { let a = 0; const n = r.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += r[i * 2] * r[j * 2 + 1] - r[j * 2] * r[i * 2 + 1]; } return a / 2; }
/** 整数のポリライン符号(Googleのpolyline符号と同じ5bit可変長+63・座標の倍率なし)。先頭は絶対値・以降は差分 */
function encodeIntPolyline(r) {
    let s = '', px = 0, py = 0;
    const enc = (v) => { let o = ''; v = v < 0 ? ~(v << 1) : (v << 1); while (v >= 0x20) { o += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return o + String.fromCharCode(v + 63); };
    for (let i = 0; i < r.length; i += 2) { const x = r[i], y = r[i + 1]; s += enc(x - px) + enc(y - py); px = x; py = y; }
    return s;
}

// ---------- 本体 ----------
async function compute(job) {
    const t0 = now();
    const Z = Math.min(15, Math.max(8, Math.round(+job.zoom || 15)));
    const G = windowGeom(job.lat, job.lon, job.rangeKm, Z);
    const { W, H, CX, CY, MPP, X0, Y0 } = G;
    let grid, st;
    if (job.grid) {
        grid = job.grid instanceof Uint16Array ? job.grid : new Uint16Array(job.grid);
        if (grid.length !== W * H) throw new Error('合成標高の格子の大きさが窓と合いません');
        st = { fetched: 0, cached: 0, retried: 0, bytes: 0, from5a: 0, from5b: 0, from5c: 0, from10b: 0, filled: 0, missing: 0, errors: 0, tiles: 0, synthetic: true };
    } else {
        grid = allocArray(Uint16Array, W * H, !!job.forceWasm).fill(NODATA);   // 700kmのz13(約4GB)はWebAssembly.Memoryの上に(allocArray)
        st = await loadTiles(job, grid, G);
    }
    let nData = 0; for (let i = 0; i < grid.length; i++) if (grid[i] !== NODATA) nData++;
    if (!nData) throw new Error('標高データがありません(日本域の外か、標高タイルが取れませんでした)');
    const t1 = now();
    post('summit', 0, 1);
    const band = summitBand(job, grid, G);
    const gElev = (job.elevGround !== null && job.elevGround !== undefined && isFinite(+job.elevGround)) ? +job.elevGround : null;
    const heightM = isFinite(+job.heightM) ? +job.heightM : 0;
    const hS = (gElev !== null ? gElev : band.hDem) + heightM;   // 光線の目的点の高さ=目的点の標高+構造物の高さ(アプリの判定の目的点の高さと同じ)
    const inv2R = +job.inv2R;
    const exclTgtM = isFinite(+job.exclTgtM) ? +job.exclTgtM : SORA.VISIBILITY.EXCLUDE_TARGET_M, exclObsM = isFinite(+job.exclObsM) ? +job.exclObsM : SORA.VISIBILITY.EXCLUDE_OBSERVER_M, obsH = isFinite(+job.obsH) ? +job.obsH : SORA.OBSERVER.EYE_HEIGHT_M;   // 既定値は sora-constants.js(本体は常に明示して渡す)
    const { visible, nVis, rays } = computeViewshed(grid, G, hS, inv2R, obsH, exclTgtM, exclObsM, band, job.preview !== false);
    const t2 = now();
    post('islands', 0, 1);
    const L = labelIslands(visible, G);
    const t3 = now();
    const RG = extractRings(visible, G, L);
    let areaNg = 0, nHoles = 0;
    L.islands.forEach((isl, i) => {
        const rs = RG.rings[i]; let sum = 0, holes = 0;
        for (const r of rs) { const a = ringArea(r); sum += a; if (a < 0) holes++; }
        isl.holes = holes; nHoles += holes;
        if (Math.round(sum) !== isl.px) areaNg++;
        rs.sort((a, b) => ringArea(b) - ringArea(a));   // 外周(面積が正で最大)を先頭に
    });
    if (areaNg) throw new Error(`輪郭の自己検査に失敗: ${areaNg}島で面積が合いません`);
    const t4 = now();
    post('encode', 0, 1);
    const pxArea = MPP * MPP;
    const distKm = (isl) => Math.hypot(isl.rep[0] - CX, isl.rep[1] - CY) * MPP / 1000;
    const idx = L.islands.map(i => ({ no: i.no, px: i.px, holes: i.holes, area_km2: +(i.px * pxArea / 1e6).toFixed(4),
        rep: [+G.yToLat(Y0 + i.rep[1] + 0.5).toFixed(6), +G.xToLon(X0 + i.rep[0] + 0.5).toFixed(6)],
        bbox: [+G.xToLon(X0 + i.bbox[0]).toFixed(6), +G.yToLat(Y0 + i.bbox[3] + 1).toFixed(6), +G.xToLon(X0 + i.bbox[2] + 1).toFixed(6), +G.yToLat(Y0 + i.bbox[1]).toFixed(6)], dist_km: +distKm(i).toFixed(2) }));
    const mountain = { id: job.id, name: job.name, peak: null, elev_list: gElev, elev_dem: band.hDem, height_m: heightM, lat: job.lat, lon: job.lon };
    const islandsObj = { mountain: { id: job.id, name: job.name }, count: idx.length, islands: idx };
    const outline = { v: 2, id: job.id, name: job.name, range_km: job.rangeKm, zoom: Z, canopy: false, x0: X0, y0: Y0, w: W, h: H, tol_px: 0,
        islands: L.islands.map((isl, i) => [isl.no, isl.px].concat(RG.rings[i].map(encodeIntPolyline))) };
    const k = isFinite(+job.k) ? +job.k : null;
    const srcText = st.synthetic ? 'synthetic(テスト用の合成標高)' : (Z >= 15 ? 'cyberjapandata.gsi.go.jp dem5a_png/dem5b_png/dem5c_png(z15)→dem_png(z14, 最近傍で2倍)。画素ごとに無い所を次の源で埋める。端末の店(IndexedDB tiles)を優先' : `cyberjapandata.gsi.go.jp dem_png(z${Z}, DEM10B)。端末の店(IndexedDB tiles)を優先`);
    const meta = { tool: 'kashimap-worker.js', version: 2, generated: new Date().toISOString(), mountain,
        range_km: job.rangeKm, zoom: Z, canopy: false, buildings: false, observer_h_m: obsH, k, earth_radius_m: (k !== null ? +((1 - k) / (2 * inv2R)).toFixed(1) : null), reff_m: +(1 / (2 * inv2R)).toFixed(1),   // earth_radius_m=実際に使った局所半径(=(1−k)·Reff)
        summit_mode: band.none ? (band.off ? 'off' : 'none') : 'region',
        summit_area: { drop_m: band.none ? 0 : band.dropUsed, drop_requested_m: job.bandM || 0, search_m: job.searchM || 3000, px: band.none ? 0 : band.px, far_m: band.none ? 0 : band.farM,
            other_peaks_in_search: band.none ? [] : band.others, shrunk_by: band.none ? null : band.shrunkBy, none_reason: band.none ? band.reason : null,
            summit_elev_basis_m: band.hT, summit_elev_dem_m: band.hDem, target_total_m: hS,
            how: band.none ? band.reason : `目的点の基準の標高(DEMと目的点の標高の高い方)から${band.dropUsed}m以内の高さで目的点につながる画素(探索半径${job.searchM || 3000}m。別の山の山頂を含まない高さまで)` },
        excl_target_m: exclTgtM, excl_target_how: band.none ? `半径${exclTgtM}mの円` : `山頂部の画素そのもの+半径${exclTgtM}m`, summit_elev_how: 'DEM(3×3画素の最大)と目的点の標高の高い方', excl_observer_m: exclObsM,
        grid: { w: W, h: H, x0: X0, y0: Y0, zoom: Z, mpp_center: +MPP.toFixed(4), note: '距離は行ごとの縮尺(MPP·cos lat/cos lat0)を光線に沿って積算。光線は大円(弦からの反りを放物線で近似)', path: 'geodesic-parabolic', scale: 'row-cos-lat', nodata: 'sea-level-0m' },
        dem: { sources: srcText, tiles: st.tiles, fetched: st.fetched, cached: st.cached, retried: st.retried, bytes: st.bytes, from5a: st.from5a, from5b: st.from5b, from5c: st.from5c, from10b: st.from10b, filled_from_next: st.filled, missing: st.missing, errors: st.errors, data_px: nData },
        method: 'R2: 目的点から窓の縁の全画素へ光線(大円に沿う。距離は行ごとの縮尺の積算)。見かけ高度角=(h−d²·inv2R−hS)/d の最大を更新。観測者=地上+observer_h。除外=目的点側(山頂部+半径)・観測点側(半径)。式・除外はアプリの統一可視判定と同じ',
        outline: { tol_px: 0, edges: RG.nEdges, rings: RG.nRings, holes: nHoles, vertices_raw: RG.nVerts, vertices: RG.nVerts, encoding: 'outline: 島ごとに[項番,画素数,外周,穴…]。各環は画素の角の整数座標(窓の左上が0,0)を先頭=絶対・以降=差分でGoogle polyline符号(倍率なし)' },
        result: { visible_px: nVis, visible_km2: +(nVis * pxArea / 1e6).toFixed(3), data_px: nData, islands: idx.length, rays },
        timing_s: { tiles: +((t1 - t0) / 1000).toFixed(1), viewshed: +((t2 - t1) / 1000).toFixed(1), islands: +((t3 - t2) / 1000).toFixed(1), outline: +((t4 - t3) / 1000).toFixed(1), total: +((now() - t0) / 1000).toFixed(1) },
        attribution: '国土地理院 標高タイル(DEM5A/5B/5C/10B)を加工して作成。日本の主な山岳標高(国土地理院)を加工して作成' };
    const out = { meta, islands: islandsObj, outline };
    if (job.returnBits) {
        const bits = new Uint8Array(Math.ceil(W * H / 8));
        for (let i = 0; i < visible.length; i++) if (visible[i] === 1) { const b = Math.floor(i / 8); bits[b] |= (128 >> (i - b * 8)); }
        out.bits = bits;
    }
    return out;
}

self.onmessage = async (ev) => {
    const m = ev.data;
    if (!m || m.type !== 'compute') return;
    try {
        const r = await compute(m.job || {});
        self.postMessage({ type: 'done', meta: r.meta, islands: r.islands, outline: r.outline, bits: r.bits || null });
    } catch (e) {
        self.postMessage({ type: 'error', message: (e && e.message) ? e.message : String(e) });
    }
};
