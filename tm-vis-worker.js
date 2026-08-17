// 辻メッシュ検索 標高オプションの可視判定ワーカー
// 統一可視判定コア(_visJudgeCore)と同一のサンプリング(z15半画素・SEG=64チャンク)・同一の丸め・
// 同一の除外規則で、割り当てられたチャンク帯域 [chunk0, chunk1) のみを判定する。
// 標高はメインスレッドで dm(0.1m)のInt32に符号化したタイル(z15=5A→5B→5Cマージ済み / z14)を参照する。
// dm/10 はメインスレッドの Math.round(e*10)/10 と同一のdouble値になるため、判定結果は逐次版とビット一致する。

'use strict';

const SENTINEL = -2147483648;   // 標高データ無し

/** Leaflet CRS.Earth.distance と同一のハバーサイン距離(m)。式・演算順も一致させる(R=6371000) */
function _distanceM(lat1d, lng1d, lat2d, lng2d) {
    const rad = Math.PI / 180,
        lat1 = lat1d * rad,
        lat2 = lat2d * rad,
        sinDLat = Math.sin((lat2d - lat1d) * rad / 2),
        sinDLon = Math.sin((lng2d - lng1d) * rad / 2),
        a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon,
        c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371000 * c;
}

self.onmessage = (ev) => {
    const m = ev.data;
    if (!m || m.type !== 'judge') return;
    const { jobId, chunk0, chunk1, lat, lng, startTotal, endLat, endLng, endTotal, exclM } = m;
    const obsExclM = m.obsExclM || 0;   // 除外範囲(観測点側)。旧メッセージ形式では0(=無効)

    // タイル索引: key = tx*32768+ty → Int32Array(256*256, dm)
    const tiles15 = new Map();
    for (let i = 0; i < m.tiles15.length; i++) tiles15.set(m.tiles15[i].key, m.tiles15[i].dm);
    const tiles14 = new Map();
    for (let i = 0; i < m.tiles14.length; i++) tiles14.set(m.tiles14[i].key, m.tiles14[i].dm);

    // メインスレッドの elevAtPix15 チェーンと同値(z15マージ済み→z14)。範囲外・データ無しは null。
    // 連続サンプルは同じタイルに当たることが多いため、直前のタイルをキャッシュする(結果は不変)
    let lk15 = NaN, lt15 = null, lk14 = NaN, lt14 = null;
    const elevAtPix15 = (gx, gy) => {
        const k15 = (gx >> 8) * 32768 + (gy >> 8);
        if (k15 !== lk15) { lk15 = k15; lt15 = tiles15.get(k15) || null; }
        if (lt15) {
            const dm = lt15[(gy & 255) * 256 + (gx & 255)];
            if (dm !== SENTINEL) return dm / 10;
        }
        const gx14 = gx >> 1, gy14 = gy >> 1;
        const k14 = (gx14 >> 8) * 32768 + (gy14 >> 8);
        if (k14 !== lk14) { lk14 = k14; lt14 = tiles14.get(k14) || null; }
        if (!lt14) return null;
        const dm14 = lt14[(gy14 & 255) * 256 + (gx14 & 255)];
        return (dm14 === SENTINEL) ? null : dm14 / 10;
    };

    const scale15 = Math.pow(2, 15);
    const R128 = 128 / Math.PI;
    const gpy15At = (latd) => (128 - R128 * Math.atanh(Math.sin(latd * Math.PI / 180))) * scale15;
    const kept = lat.length;
    const blocked = new Uint8Array(kept);   // 1 = この帯域内に遮蔽あり(除外範囲を除く)

    for (let i = 0; i < kept; i++) {
        const sLat = lat[i], sLng = lng[i];
        const sTotal = startTotal[i];
        // _visJudgeCore と同一のパラメータ化
        const distM = _distanceM(sLat, sLng, endLat, endLng);
        const stepM = 40075016.686 * Math.cos(sLat * Math.PI / 180) / (scale15 * 256) / 2;
        const steps = Math.max(2, Math.ceil(distM / stepM));
        const sx15 = 128 * (sLng / 180 + 1) * scale15;
        const dx = (128 * (endLng / 180 + 1) * scale15 - sx15) / steps;
        const dLat = endLat - sLat;
        // 担当チャンクのみ判定(チャンク境界=逐次版のSEG=64境界と一致させ、緯度の線形補間もビット一致させる)
        outer:
        for (let c = chunk0; c < chunk1; c++) {
            const j0 = 1 + c * 64;
            if (j0 >= steps) break;
            const j1 = Math.min(j0 + 63, steps - 1);
            const gyA = gpy15At(sLat + dLat * (j0 / steps));
            const dgy = (j1 > j0) ? (gpy15At(sLat + dLat * (j1 / steps)) - gyA) / (j1 - j0) : 0;
            for (let j = j0; j <= j1; j++) {
                const e = elevAtPix15((sx15 + dx * j) | 0, (gyA + dgy * (j - j0)) | 0);
                if (e === null || e === undefined) continue;
                const r = j / steps;
                const lineElev = sTotal + (endTotal - sTotal) * r;
                if (e > lineElev) {
                    if (distM * (1 - r) <= exclM) continue;   // 除外範囲(目的点側)のNGは無視
                    if (distM * r <= obsExclM) continue;      // 除外範囲(観測点側)のNGは無視
                    blocked[i] = 1;
                    break outer;   // この画素はNG確定(帯域内の早期打ち切り)
                }
            }
        }
        if ((i & 1023) === 0) self.postMessage({ type: 'progress', jobId, done: i });
    }
    self.postMessage({ type: 'done', jobId, blocked }, [blocked.buffer]);
};
