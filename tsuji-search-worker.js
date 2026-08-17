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

// 辻検索 Web Worker
// メインスレッドから 1天体・指定日範囲のチャンクを受け取り、
// 1分単位スキャン → 前後60秒の1秒単位リファインを行ってベスト時刻を返す。
// 粗探索には「安全スキップ」を併用: 天体の移動速度上限から許容範囲外が確定する標本を
// 飛ばして高速化する(飛ばすのは必ず範囲外の標本のみなので、結果は全標本評価と完全に同一)。

importScripts('https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js');

// astronomy.browser.min.js は UMD で window へ登録する場合がある。
// Web Worker のグローバルは self なので、window 経由のフォールバックも見ておく。
const A = (typeof Astronomy !== 'undefined') ? Astronomy
        : (typeof self !== 'undefined' && self.Astronomy) ? self.Astronomy
        : null;

if (!A) {
    self.postMessage({ error: 'Astronomy engine failed to load in worker.' });
}

// 方位角範囲チェック (script.js の isAzimuthInRange と同一)
function isAzimuthInRange(az, targetAz, tolerance) {
    let diff = az - targetAz;
    diff = ((diff + 540) % 360) - 180;
    return Math.abs(diff) <= tolerance;
}

// 球面角距離 (Az,Alt 座標系での厳密な角距離)
// 観測点天球上の2点 (az1,alt1) と (az2,alt2) の角距離を計算する。
// 高度が低いほど方位角の単位距離が cos(alt) で縮むため、擬似ユークリッドより厳密。
function angularDistance(az1, alt1, az2, alt2) {
    const toRad = Math.PI / 180;
    const sinDelta = Math.sin(alt1*toRad) * Math.sin(alt2*toRad) +
                     Math.cos(alt1*toRad) * Math.cos(alt2*toRad) * Math.cos((az1-az2)*toRad);
    const clamped = Math.max(-1, Math.min(1, sinDelta));
    return Math.acos(clamped) * 180 / Math.PI;
}

// ±180°への方位角差の正規化
function wrap180(deg) {
    return ((deg + 540) % 360) - 180;
}

// 検索中心オプション「線」: 基準点(az0,alt0)からオフセット点(az1,alt1)までの線分に対する判定。
// ヒット判定は「線分上のいずれかの点から許容範囲(方位角/視高度の矩形)内」(媒介変数sの1次不等式区間の交差)。
// 精度角距離は、度数平面での線分への最近点(sをクランプした射影)との球面角距離。
function segmentMatch(az, alt, az0, alt0, az1, alt1, toleranceAz, toleranceAlt) {
    const dAz = wrap180(az1 - az0);       // 線分の方位角の広がり(短い側で連続化)
    const dAlt = alt1 - alt0;
    const pAz = wrap180(az - az0);        // 判定点(基準点相対)
    const pAlt = alt - alt0;
    // |pAz - s*dAz| <= tolAz を満たす s の区間
    let azLo = -Infinity, azHi = Infinity;
    if (Math.abs(dAz) < 1e-12) {
        if (Math.abs(pAz) > toleranceAz) return null;
    } else {
        azLo = (pAz - toleranceAz) / dAz; azHi = (pAz + toleranceAz) / dAz;
        if (azLo > azHi) { const t = azLo; azLo = azHi; azHi = t; }
    }
    // |pAlt - s*dAlt| <= tolAlt を満たす s の区間
    let altLo = -Infinity, altHi = Infinity;
    if (Math.abs(dAlt) < 1e-12) {
        if (Math.abs(pAlt) > toleranceAlt) return null;
    } else {
        altLo = (pAlt - toleranceAlt) / dAlt; altHi = (pAlt + toleranceAlt) / dAlt;
        if (altLo > altHi) { const t = altLo; altLo = altHi; altHi = t; }
    }
    const lo = Math.max(0, azLo, altLo), hi = Math.min(1, azHi, altHi);
    if (lo > hi) return null;
    // 精度角距離: 線分への最近点(度数平面の射影をクランプ)からの角距離
    const len2 = dAz * dAz + dAlt * dAlt;
    let s = len2 > 0 ? (pAz * dAz + pAlt * dAlt) / len2 : 0;
    s = Math.max(0, Math.min(1, s));
    const nAz = az0 + s * dAz, nAlt = alt0 + s * dAlt;
    return { dist: angularDistance(az, alt, nAz, nAlt) };
}

// 1ステップ計算: 指定時刻での body の方位角・視高度を返す
function calcAzAlt(body, time, observer, refractionEnabled) {
    let ra, dec;
    if (body.fixed) {
        // 固定座標 (固定恒星 / My天体): メインスレッドから ra/dec が渡される
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

self.onmessage = (e) => {
    if (!A) {
        self.postMessage({ error: 'Astronomy engine not available' });
        return;
    }

    const {
        body,
        observerData,
        refractionEnabled,
        targetAz, targetAlt,
        toleranceAz, toleranceAlt,
        centerMode,               // 検索中心オプション: 'point'(既定)=オフセット点 / 'line'=基準点からオフセット点までの線
        centerAz0, centerAlt0,    // 'line'のときの基準点(線分の始点。終点は targetAz/targetAlt)
        searchStartMs,
        dayStart,
        dayEnd,
        maxResults,
    } = e.data;

    const observer = new A.Observer(observerData.lat, observerData.lng, observerData.elev);
    const isLine = centerMode === 'line';
    // 判定: 許容範囲内なら精度角距離(dist)を返し、範囲外なら null
    const matchDist = (az, alt) => {
        if (isLine) {
            const m = segmentMatch(az, alt, centerAz0, centerAlt0, targetAz, targetAlt, toleranceAz, toleranceAlt);
            return m ? m.dist : null;
        }
        if (isAzimuthInRange(az, targetAz, toleranceAz) && Math.abs(alt - targetAlt) <= toleranceAlt) {
            return angularDistance(az, alt, targetAz, targetAlt);
        }
        return null;
    };
    const stepsPerDay = 1440;  // 1分単位

    // 安全スキップの中心と包含半径: 許容範囲全体を「中心からskipRadius度以内」の球帽で包む。
    // 点モード=オフセット点+許容矩形、線モード=線分の中点+半長+許容矩形(いずれも角距離の上界)。
    // 天体の地平座標系での移動速度は 日周運動15.04°/h + 月の固有運動0.55°/h + 視差/大気差の変動
    // を含めても 0.35°/分 を超えないため、中心までの角距離が skipRadius より gap 度遠い標本からは
    // floor(gap/0.35)-1 分先まで「必ず許容範囲外」が確定する。スキップした標本はどのみち不採用
    // なので、粗探索の評価結果は全標本を評価した場合と完全に同一になる。
    const SKIP_RATE = 0.35;   // °/分 (移動速度の安全上限)
    let skipCtrAz = targetAz, skipCtrAlt = targetAlt;
    let skipRadius = toleranceAz + toleranceAlt;
    if (isLine) {
        const dAz = wrap180(targetAz - centerAz0), dAlt = targetAlt - centerAlt0;
        skipCtrAz = centerAz0 + dAz / 2;
        skipCtrAlt = centerAlt0 + dAlt / 2;
        skipRadius += Math.sqrt(dAz * dAz + dAlt * dAlt) / 2;
    }
    const results = [];

    for (let d = dayStart; d < dayEnd; d++) {
        const dayBase = searchStartMs + d * 86400000;
        const dayEndMs = dayBase + 86400000;  // 翌日 0:00:00.000 (この時刻は当日に含めない)
        let bestMatch = null;
        let bestDist = Infinity;

        // Pass 1: 当日 0:00〜23:59 を 1分単位スキャン (各日のスキャン範囲は重複させない)
        for (let s = 0; s < stepsPerDay; s++) {
            const time = new Date(dayBase + s * 60000);
            const { az, alt } = calcAzAlt(body, time, observer, refractionEnabled);
            const dist = matchDist(az, alt);
            if (dist !== null) {
                if (dist < bestDist) {
                    bestDist = dist;
                    bestMatch = { timeMs: time.getTime(), azimuth: az, altitude: alt, dist };
                }
            } else {
                // 許容範囲外: 中心から遠いほど先の標本まで範囲外が確定するので、その分を飛ばす(結果不変の高速化)
                const gap = angularDistance(az, alt, skipCtrAz, skipCtrAlt) - skipRadius;
                const skip = Math.floor(gap / SKIP_RATE) - 1;
                if (skip > 0) s += skip;
            }
        }

        // Pass 2: ベスト1分の前後60秒を1秒単位でリファイン
        if (bestMatch) {
            const refineCenter = bestMatch.timeMs;
            for (let dsec = -60; dsec <= 60; dsec++) {
                if (dsec === 0) continue;  // すでに計算済み
                const time = new Date(refineCenter + dsec * 1000);
                const { az, alt } = calcAzAlt(body, time, observer, refractionEnabled);
                const dist = matchDist(az, alt);
                if (dist !== null && dist < bestDist) {
                    bestDist = dist;
                    bestMatch = { timeMs: time.getTime(), azimuth: az, altitude: alt, dist };
                }
            }
            // リファイン後の最良時刻が当日 [dayBase, dayEndMs) に属する場合のみ採用。
            // 日付境界をまたいで前日/翌日に移動した場合は、その隣の日のスキャンで
            // 正しく当日扱いとして拾われるため、ここでは破棄して重複を防ぐ。
            if (bestMatch.timeMs >= dayBase && bestMatch.timeMs < dayEndMs) {
                results.push(bestMatch);
                if (results.length >= maxResults) break;
            }
        }
    }

    self.postMessage({ results, dayStart, dayEnd });
};
