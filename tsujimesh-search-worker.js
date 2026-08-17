/*
宙の辻 - Sora no Tsuji
Copyright (C) 2026 Takeyoshi Watanabe (Sora no Tsuji Project)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.
*/

// 辻メッシュ検索 Web Worker
// メインスレッドから init で「全画素の基準方位角/基準視高度(画素→目的点)」と方位角ビン索引を受け取り、
// search で 1天体×日チャンクを処理する。
// 探索は反転方式: 画素ごとに時間を全走査するのではなく、天体の毎分の方位角/視高度(領域中心・画素非依存)から
// 方位角ビン索引で候補画素だけを引き、精度フィルタ(角距離≤ε)で判定する。
// 秒精細化は天体の秒間位置を1回だけ計算して全ヒット画素で共有する(画素側は算術のみ)。

importScripts('https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js');

const A = (typeof Astronomy !== 'undefined') ? Astronomy
        : (typeof self !== 'undefined' && self.Astronomy) ? self.Astronomy
        : null;

if (!A) {
    self.postMessage({ error: 'Astronomy engine failed to load in worker.' });
}

const D2R = Math.PI / 180;

function wrap180(deg) {
    return ((deg + 540) % 360) - 180;
}

// 球面角距離 (tsuji-search-worker.js の angularDistance と同一式)
function angularDistance(az1, alt1, az2, alt2) {
    const sinDelta = Math.sin(alt1 * D2R) * Math.sin(alt2 * D2R) +
                     Math.cos(alt1 * D2R) * Math.cos(alt2 * D2R) * Math.cos((az1 - az2) * D2R);
    return Math.acos(Math.max(-1, Math.min(1, sinDelta))) / D2R;
}

function calcAzAlt(body, time, observer, refractionEnabled) {
    let ra, dec;
    if (body.fixed) {
        ra = body.ra;
        dec = body.dec;
    } else {
        const eq = A.Equator(body.id, time, observer, true, true);
        ra = eq.ra;
        dec = eq.dec;
    }
    const hor = A.Horizon(time, observer, ra, dec, refractionEnabled ? 'normal' : null);
    return { az: hor.azimuth, alt: hor.altitude };
}

// 画素データ (init で受領)
let P = null;   // { count, baseAz:Float32Array, baseAlt:Float32Array, minAlt, maxAlt, binSize, nBins, binIndex:Uint32Array, binPixels:Uint32Array }

self.onmessage = (e) => {
    if (!A) {
        self.postMessage({ error: 'Astronomy engine not available' });
        return;
    }
    const d = e.data;
    if (d.type === 'init') {
        P = {
            count: d.count,
            baseAz: d.baseAz, baseAlt: d.baseAlt,
            dE: d.dE, dN: d.dN,   // 領域中心からの東/北変位÷地球半径(rad)。地平座標系の画素位置補正に使う
            tanLat: d.tanLat,     // 領域中心緯度のtan(子午線収束の方位回転 ωU=dE·tanφ 用)
            minAlt: d.minAlt, maxAlt: d.maxAlt,
            binSize: d.binSize, nBins: d.nBins,
            binIndex: d.binIndex, binPixels: d.binPixels,
        };
        self.postMessage({ type: 'inited' });
        return;
    }
    if (d.type !== 'search' || !P) return;

    const {
        reqId, body, observerData, refractionEnabled,
        offsetAz, offsetAlt, centerMode, epsilon,
        searchStartMs, dayStart, dayEnd,
    } = d;

    const observer = new A.Observer(observerData.lat, observerData.lng, observerData.elev);
    const isLine = centerMode === 'line';
    const dAz = wrap180(offsetAz);            // 線分の広がり(短い側で連続化)
    const dAlt = offsetAlt;
    const len2 = dAz * dAz + dAlt * dAlt;
    // 高度の帯 (画素の baseAlt 相対): 点=offsetAlt±ε / 線=[min(0,dAlt)-ε, max(0,dAlt)+ε]
    const altLo = (isLine ? Math.min(0, dAlt) : offsetAlt) - epsilon;
    const altHi = (isLine ? Math.max(0, dAlt) : offsetAlt) + epsilon;
    // 方位角の帯 (画素の baseAz 相対)
    const azLo = (isLine ? Math.min(0, dAz) : dAz);
    const azHi = (isLine ? Math.max(0, dAz) : dAz);

    // 判定: 検索中心(点=オフセット点 / 線=基準点→オフセット点の線分[az/alt平面])への球面角距離。
    // 天体の(az,alt)は領域中心での値なので、画素位置の地平座標系へ一次補正してから比較する。
    // 地平座標系は観測位置ごとに回転する(中心から3kmの画素で最大約0.03°)。ENU基底の一次回転ベクトルは
    // ω = (−dN, dE, dE·tanφ)/R (東軸まわり=北移動の傾き, 北軸まわり=東移動の傾き, 上軸まわり=子午線収束)。
    // 固定方向ベクトル e の画素座標系での成分は e' = e − ω×e。
    const evalDist = (pix, ex, ny, uz) => {
        const wE = -P.dN[pix], wN = P.dE[pix], wU = P.dE[pix] * P.tanLat;
        const cx = ex - (wN * uz - wU * ny);
        const cy = ny - (wU * ex - wE * uz);
        const cz = uz - (wE * ny - wN * ex);
        const altPd = Math.asin(Math.max(-1, Math.min(1, cz))) / D2R;
        const azP = Math.atan2(cx, cy) / D2R;
        const bAz = P.baseAz[pix], bAlt = P.baseAlt[pix];
        if (isLine) {
            const pAz = wrap180(azP - bAz), pAlt = altPd - bAlt;
            let s = len2 > 0 ? (pAz * dAz + pAlt * dAlt) / len2 : 0;
            s = Math.max(0, Math.min(1, s));
            return angularDistance(azP, altPd, bAz + s * dAz, bAlt + s * dAlt);
        }
        return angularDistance(azP, altPd, bAz + offsetAz, bAlt + offsetAlt);
    };
    // (az,alt)→ENU方向ベクトル成分(east, north, up)
    const dirENU = (az, alt) => {
        const ca = Math.cos(alt * D2R);
        return [Math.sin(az * D2R) * ca, Math.cos(az * D2R) * ca, Math.sin(alt * D2R)];
    };

    // 候補画素をコールバックへ (方位角ビン索引 + 高度帯の粗ふるい)
    const forCandidates = (az, alt, cb) => {
        const cosAlt = Math.max(Math.cos(alt * D2R), 0.02);
        let half = (azHi - azLo) / 2 + epsilon / cosAlt + P.binSize + 0.08;   // +0.08°=画素位置の座標系補正マージン
        if (half > 15) half = 15;
        const center = az - (azLo + azHi) / 2;
        const b0 = Math.floor((((center - half) % 360 + 360) % 360) / P.binSize);
        const b1 = Math.floor((((center + half) % 360 + 360) % 360) / P.binSize);
        const scanBin = (b) => {
            const st = P.binIndex[b], en = P.binIndex[b + 1];
            for (let i = st; i < en; i++) {
                const pix = P.binPixels[i];
                const relAlt = alt - P.baseAlt[pix];
                if (relAlt < altLo - 0.05 || relAlt > altHi + 0.05) continue;   // ±0.05°=座標系補正マージン
                cb(pix);
            }
        };
        if (b0 <= b1) {
            for (let b = b0; b <= b1; b++) scanBin(b);
        } else {   // 0°をまたぐ
            for (let b = b0; b < P.nBins; b++) scanBin(b);
            for (let b = 0; b <= b1; b++) scanBin(b);
        }
    };

    const events = [];
    const MAX_PIX_PER_DAY = 2359296;   // 256×256×36 = 検索エリア最大(6×6)の全画素(実質上限なし)

    for (let day = dayStart; day < dayEnd; day++) {
        const dayBase = searchStartMs + day * 86400000;
        const perPix = new Map();   // pixIdx -> { dist, timeMs, az, alt }

        // Pass 1: 当日 0:00〜23:59 を 1分単位スキャン
        for (let s = 0; s < 1440; s++) {
            const t = dayBase + s * 60000;
            const { az, alt } = calcAzAlt(body, new Date(t), observer, refractionEnabled);
            // 全画素の視高度範囲の外なら即スキップ。さらに視高度の変化速度上限(日周運動+月の固有運動+
            // 視差/大気差の変動を含めても0.35°/分)から範囲外が確定する分数だけ先へ飛ばす。
            // 飛ばした標本はどのみち範囲外で不採用なので、評価結果は全標本評価と完全に同一(結果不変の高速化)
            const bandLo = P.minAlt + altLo - 0.05, bandHi = P.maxAlt + altHi + 0.05;
            if (alt < bandLo || alt > bandHi) {
                const skip = Math.floor(Math.max(bandLo - alt, alt - bandHi) / 0.35) - 1;
                if (skip > 0) s += skip;
                continue;
            }
            const [ex, ny, uz] = dirENU(az, alt);
            forCandidates(az, alt, (pix) => {
                const dist = evalDist(pix, ex, ny, uz);
                if (dist > epsilon) return;
                const rec = perPix.get(pix);
                if (!rec || dist < rec.dist) perPix.set(pix, { dist, timeMs: t, az, alt });
            });
        }

        if (perPix.size === 0) continue;

        // Pass 2: 秒精細化。ヒット分の±60秒の天体位置を1回だけ計算して全画素で共有
        const secCache = new Map();   // minuteMs -> { azs:Float64Array(121), alts:Float64Array(121) }
        const getSec = (minuteMs) => {
            let c = secCache.get(minuteMs);
            if (!c) {
                const azs = new Float64Array(121), alts = new Float64Array(121);
                const exs = new Float64Array(121), nys = new Float64Array(121), uzs = new Float64Array(121);
                for (let i = 0; i <= 120; i++) {
                    const { az, alt } = calcAzAlt(body, new Date(minuteMs + (i - 60) * 1000), observer, refractionEnabled);
                    azs[i] = az; alts[i] = alt;
                    const e2 = dirENU(az, alt);
                    exs[i] = e2[0]; nys[i] = e2[1]; uzs[i] = e2[2];
                }
                c = { azs, alts, exs, nys, uzs };
                secCache.set(minuteMs, c);
            }
            return c;
        };
        for (const [pix, rec] of perPix) {
            const c = getSec(rec.timeMs);
            const base = rec.timeMs - 60000;
            for (let i = 0; i <= 120; i++) {
                const dist = evalDist(pix, c.exs[i], c.nys[i], c.uzs[i]);
                if (dist < rec.dist) {
                    rec.dist = dist; rec.az = c.azs[i]; rec.alt = c.alts[i];
                    rec.bestSec = base + i * 1000;
                }
            }
            if (rec.bestSec !== undefined) rec.timeMs = rec.bestSec;
            // 精細化後にε超になることはない(単調に改善するのみ)
        }

        // イベント化: 最良画素と、その日の全ヒット画素のコンパクト配列
        let entries = [...perPix.entries()];
        const capped = entries.length > MAX_PIX_PER_DAY;
        if (capped) {
            entries.sort((a, b) => a[1].dist - b[1].dist);
            entries = entries.slice(0, MAX_PIX_PER_DAY);
        }
        let best = entries[0];
        for (const en of entries) if (en[1].dist < best[1].dist) best = en;
        const n = entries.length;
        const pixIdx = new Uint32Array(n), pixTime = new Float64Array(n), pixDist = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            pixIdx[i] = entries[i][0];
            pixTime[i] = entries[i][1].timeMs;
            pixDist[i] = entries[i][1].dist;
        }
        events.push({
            dayIdx: day,
            bestPix: best[0], bestTimeMs: best[1].timeMs, bestDist: best[1].dist,
            bestAz: best[1].az, bestAlt: best[1].alt,
            total: perPix.size, capped,
            pixIdx, pixTime, pixDist,
        });
    }

    const transfers = [];
    events.forEach(ev => { transfers.push(ev.pixIdx.buffer, ev.pixTime.buffer, ev.pixDist.buffer); });
    self.postMessage({ type: 'result', reqId, dayStart, dayEnd, events }, transfers);
};
