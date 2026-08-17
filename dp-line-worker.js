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

// 辻ライン (DP線) 計算 Web Worker
// メインスレッドから 1天体・1時間分のチャンクを受け取り、
// サンプリング間隔ごとに可視点 (altitude > limit) を計算する。
//
// 各時刻で観測点位置を反復補正することで以下の精度を確保:
//   - 子午線収差: WGS84 楕円体上の back-azimuth 反復解で対処
//   - 月などの視差: 実際の観測点位置で天体方位を再計算
//   - 球面 R 近似: 観測点緯度に応じた WGS84 局所半径を使用
//
// GeographicLib は Worker 環境での importScripts が一部のブラウザ/環境で
// NetworkError になるため、Vincenty Direct 法を Worker 内に自前実装している。
// (WGS84 楕円体上で精度 ~0.5mm を確保。GeographicLib (Karney) と同等。)
//
// このWorkerはプール内で再利用される設計のため、起動時のオーバーヘッドを
// 1度だけ負担して、以降のメッセージは postMessage のみで処理する。

importScripts('https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js');

const A = (typeof Astronomy !== 'undefined') ? Astronomy
        : (typeof self !== 'undefined' && self.Astronomy) ? self.Astronomy
        : null;

if (!A) {
    self.postMessage({ error: 'Astronomy engine failed to load in DP line worker.' });
}

// WGS84 楕円体パラメータ
const WGS84_A = 6378137;          // 赤道半径 (semi-major)
const WGS84_B = 6356752.3142;     // 極半径 (semi-minor)
const WGS84_F = 1 / 298.257223563; // 扁平率

/** 観測点緯度における WGS84 楕円体上の地心距離 (geocentric radius)
 *  ρ(φ) = sqrt[((a²cosφ)² + (b²sinφ)²) / ((a cosφ)² + (b sinφ)²)] */
function getLocalEarthRadius(latDeg) {
    const lat = latDeg * Math.PI / 180;
    const cosLat = Math.cos(lat), sinLat = Math.sin(lat);
    const a2cos = WGS84_A * WGS84_A * cosLat;
    const b2sin = WGS84_B * WGS84_B * sinLat;
    const acos = WGS84_A * cosLat;
    const bsin = WGS84_B * sinLat;
    return Math.sqrt(
        (a2cos * a2cos + b2sin * b2sin) /
        (acos * acos + bsin * bsin)
    );
}

/** 観測者高 hObs / ターゲット高 hTarget のとき、観測高度 altObs に見える距離。
 *  有効地球半径モデル: 気差で光路が曲がる効果を「Reff = R/(1-k) に膨らんだ地球」
 *  と等価に扱う。観測点とターゲットで緯度が異なる場合、それぞれの局所半径を使う。 */
function calculateDistanceForAltitudes(altObs, hObs, hTarget, k, obsLat, tgtLat) {
    const R_obs = (typeof obsLat === 'number') ? getLocalEarthRadius(obsLat) : WGS84_A;
    const R_tgt = (typeof tgtLat === 'number') ? getLocalEarthRadius(tgtLat) : R_obs;
    const Reff_obs = R_obs / (1 - k);
    const Reff_tgt = R_tgt / (1 - k);
    const Reff_avg = (Reff_obs + Reff_tgt) / 2;
    const r1 = Reff_obs + hObs;
    const r2 = Reff_tgt + hTarget;
    const altObsRad = altObs * Math.PI / 180;

    let sinVal, altTargetRad, c;
    if (hObs <= hTarget) {
        // r1 ≤ r2: ∠OP2P1 は鋭角解
        sinVal = r1 / r2 * Math.sin(Math.PI / 2 + altObsRad);
        if (sinVal > 1) sinVal = 1;
        if (sinVal < -1) sinVal = -1;
        altTargetRad = Math.PI / 2 - Math.asin(sinVal);
        c = altTargetRad - altObsRad;
    } else {
        // r1 > r2: ∠OP2P1 は鈍角解 (鋭角解は遠方の偽解)
        sinVal = r1 / r2 * Math.sin(Math.PI / 2 - altObsRad);
        if (sinVal > 1) sinVal = 1;
        if (sinVal < -1) sinVal = -1;
        altTargetRad = Math.PI / 2 - Math.asin(sinVal);  // 鈍角解
        c = -altObsRad - altTargetRad;
    }
    return Reff_avg * c;
}

/** Vincenty Direct (WGS84 楕円体上の順問題)
 *  始点 (lat1, lng1) から方位 az で距離 dist 進んだ点 (lat2, lng2) を求める。
 *  さらに到着点での forward azimuth (azi2) も返す。
 *  精度 ~0.5mm。GeographicLib (Karney) より少し劣るが実用上同等。 */
function vincentyDirect(lat1Deg, lng1Deg, azDeg, distMeters) {
    const a = WGS84_A;
    const f = WGS84_F;
    const b = WGS84_B;
    const lat1 = lat1Deg * Math.PI / 180;
    const lng1 = lng1Deg * Math.PI / 180;
    const alpha1 = azDeg * Math.PI / 180;

    const sinAlpha1 = Math.sin(alpha1);
    const cosAlpha1 = Math.cos(alpha1);

    const tanU1 = (1 - f) * Math.tan(lat1);
    const cosU1 = 1 / Math.sqrt(1 + tanU1 * tanU1);
    const sinU1 = tanU1 * cosU1;

    const sigma1 = Math.atan2(tanU1, cosAlpha1);
    const sinAlpha = cosU1 * sinAlpha1;
    const cosSqAlpha = 1 - sinAlpha * sinAlpha;
    const uSq = cosSqAlpha * (a * a - b * b) / (b * b);
    const A_coef = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    const B_coef = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));

    let sigma = distMeters / (b * A_coef);
    let sigmaPrime, sin2SigmaM, cosSigma, sinSigma, cos2SigmaM, deltaSigma;
    let iter = 0;
    do {
        cos2SigmaM = Math.cos(2 * sigma1 + sigma);
        sinSigma = Math.sin(sigma);
        cosSigma = Math.cos(sigma);
        deltaSigma = B_coef * sinSigma * (cos2SigmaM + B_coef / 4 *
            (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
             B_coef / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) *
             (-3 + 4 * cos2SigmaM * cos2SigmaM)));
        sigmaPrime = sigma;
        sigma = distMeters / (b * A_coef) + deltaSigma;
    } while (Math.abs(sigma - sigmaPrime) > 1e-12 && ++iter < 100);

    const tmp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1;
    const lat2 = Math.atan2(
        sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1,
        (1 - f) * Math.sqrt(sinAlpha * sinAlpha + tmp * tmp)
    );
    const lambda = Math.atan2(
        sinSigma * sinAlpha1,
        cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1
    );
    const C_coef = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    const L = lambda - (1 - C_coef) * f * sinAlpha *
        (sigma + C_coef * sinSigma *
            (cos2SigmaM + C_coef * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
    const lng2 = lng1 + L;
    // 到着点での forward azimuth (= P から target を通り過ぎる方向)
    const alpha2 = Math.atan2(sinAlpha, -tmp);

    return {
        lat2: lat2 * 180 / Math.PI,
        lon2: lng2 * 180 / Math.PI,
        azi2: ((alpha2 * 180 / Math.PI) + 360) % 360
    };
}

/** 目的点 (target) から「観測点 P → 目的点の方位 = desiredBearing」
 *  となる観測点 P を距離 L で求める。Vincenty Direct + Newton 反復解。 */
function getObserverFromTargetBackAzimuth(targetLat, targetLng, desiredBearing, L) {
    let initAz = ((desiredBearing + 180) % 360 + 360) % 360;
    let r = vincentyDirect(targetLat, targetLng, initAz, L);
    for (let iter = 0; iter < 6; iter++) {
        const currentBackAz = ((r.azi2 + 180) % 360 + 360) % 360;
        let delta = desiredBearing - currentBackAz;
        delta = ((delta + 540) % 360) - 180;
        if (Math.abs(delta) < 1e-7) break;
        initAz = ((initAz + delta) % 360 + 360) % 360;
        r = vincentyDirect(targetLat, targetLng, initAz, L);
    }
    return { lat: r.lat2, lng: r.lon2 };
}

self.onmessage = (e) => {
    if (!A) {
        self.postMessage({ error: 'Astronomy engine not available' });
        return;
    }

    const {
        body, observerData, targetData, refractionEnabled, k,
        startOfDayMs, hourStart, hourEnd,
        valElev, targetElev, limit, distLimit,
        taskId,
        stepSeconds,  // optional: サンプリング間隔(秒) デフォルト 1
        altOffset     // optional: 辻オフセット視高度(°) — 天体が「目的点の見かけ高度+この角度」に来る位置を求める(第85ラウンド・項目12)
    } = e.data;
    const altOff = Number(altOffset) || 0;

    const refr = refractionEnabled ? 'normal' : null;
    const points = [];
    const stepSec = (stepSeconds && stepSeconds > 0) ? stepSeconds : 1;
    const startSec = hourStart * 3600;
    const endSec = hourEnd * 3600;
    const hasTarget = targetData && targetData.lat != null && targetData.lng != null;

    // 初期観測点 (反復のスタート地点)
    const initObs = new A.Observer(observerData.lat, observerData.lng, observerData.elev);

    for (let s = startSec; s < endSec; s += stepSec) {
        const time = new Date(startOfDayMs + s * 1000);

        // 反復補正: 観測点位置を更新しながら az/alt を再計算 (月の視差等を吸収)
        let curObs = initObs;
        let curLat = observerData.lat;
        let dest = null;
        let lastAz = null, lastDist = null;
        let limitReached = false;
        const maxIter = hasTarget ? 3 : 1;

        for (let iter = 0; iter < maxIter; iter++) {
            let r, d;
            if (body.fixed) {
                r = body.ra;
                d = body.dec;
            } else {
                const eq = A.Equator(body.id, time, curObs, true, true);
                r = eq.ra;
                d = eq.dec;
            }
            const hor = A.Horizon(time, curObs, r, d, refr);
            if (hor.altitude <= limit) { limitReached = true; break; }

            const tgtLatForCalc = hasTarget ? targetData.lat : undefined;
            const dist = calculateDistanceForAltitudes(hor.altitude - altOff, valElev, targetElev, k, curLat, tgtLatForCalc);
            if (dist <= 0 || dist >= distLimit) { limitReached = true; break; }

            if (!hasTarget) {
                // 反復不要モード (互換): dest は計算しない
                lastAz = hor.azimuth;
                lastDist = dist;
                break;
            }

            // 観測点位置を更新 (Vincenty Direct + 反復で WGS84 上の正確な位置)
            const newDest = getObserverFromTargetBackAzimuth(
                targetData.lat, targetData.lng, hor.azimuth, dist
            );

            // 収束チェック: 前回との位置差 < 1m なら早期 break (太陽はここで止まる)
            if (dest) {
                const dLat = newDest.lat - dest.lat;
                const dLng = newDest.lng - dest.lng;
                const approxMeters = Math.sqrt(dLat * dLat + dLng * dLng) * 111000;
                if (approxMeters < 1) {
                    dest = newDest; lastAz = hor.azimuth; lastDist = dist;
                    break;
                }
            }
            dest = newDest;
            lastAz = hor.azimuth;
            lastDist = dist;
            curLat = dest.lat;
            curObs = new A.Observer(dest.lat, dest.lng, valElev);
        }

        if (!limitReached && lastAz != null && lastDist != null) {
            const point = { dist: lastDist, az: lastAz, timeMs: time.getTime() };
            if (dest) { point.lat = dest.lat; point.lng = dest.lng; }
            points.push(point);
        }
    }
    self.postMessage({ points, hourStart, taskId });
};
