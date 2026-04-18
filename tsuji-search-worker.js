// 辻検索 Web Worker
// メインスレッドから 1天体・指定日範囲のチャンクを受け取り、
// 1分単位スキャン → 前後60秒の1秒単位リファインを行ってベスト時刻を返す。

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

// 角距離 (Az,Alt の擬似ユークリッド距離。既存実装と同じ)
function angularDistance(az1, alt1, az2, alt2) {
    let azDiff = az1 - az2;
    azDiff = ((azDiff + 540) % 360) - 180;
    const altDiff = alt1 - alt2;
    return Math.sqrt(azDiff * azDiff + altDiff * altDiff);
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
        searchStartMs,
        dayStart,
        dayEnd,
        maxResults,
    } = e.data;

    const observer = new A.Observer(observerData.lat, observerData.lng, observerData.elev);
    const stepsPerDay = 1440;  // 1分単位
    const results = [];

    for (let d = dayStart; d < dayEnd; d++) {
        const dayBase = searchStartMs + d * 86400000;
        let bestMatch = null;
        let bestDist = Infinity;

        // Pass 1: 1分単位スキャン (24時間 × 60分)
        for (let s = 0; s < stepsPerDay; s++) {
            const time = new Date(dayBase + s * 60000);
            const { az, alt } = calcAzAlt(body, time, observer, refractionEnabled);
            if (isAzimuthInRange(az, targetAz, toleranceAz) && Math.abs(alt - targetAlt) <= toleranceAlt) {
                const dist = angularDistance(az, alt, targetAz, targetAlt);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestMatch = { timeMs: time.getTime(), azimuth: az, altitude: alt, dist };
                }
            }
        }

        // Pass 2: ベスト1分の前後60秒を1秒単位でリファイン
        if (bestMatch) {
            const refineCenter = bestMatch.timeMs;
            for (let dsec = -60; dsec <= 60; dsec++) {
                if (dsec === 0) continue;  // すでに計算済み
                const time = new Date(refineCenter + dsec * 1000);
                const { az, alt } = calcAzAlt(body, time, observer, refractionEnabled);
                if (isAzimuthInRange(az, targetAz, toleranceAz) && Math.abs(alt - targetAlt) <= toleranceAlt) {
                    const dist = angularDistance(az, alt, targetAz, targetAlt);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestMatch = { timeMs: time.getTime(), azimuth: az, altitude: alt, dist };
                    }
                }
            }
            results.push(bestMatch);
            if (results.length >= maxResults) break;
        }
    }

    self.postMessage({ results, dayStart, dayEnd });
};
