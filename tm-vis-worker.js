// 辻メッシュ検索 標高オプションの可視判定ワーカー
// 統一可視判定コア(_visJudgeCore)と同一のサンプリング(z15半画素・SEG=SORA.VISIBILITY.PATH_CHUNK(64)のチャンク)・同一の丸め・
// 同一の除外規則(目的点側/観測点側/山頂部の帯)で、割り当てられたチャンク帯域 [chunk0, chunk1) のみを判定する。
// 標高はメインスレッドで dm(0.1m)のInt32に符号化したタイル(z15=5A→5B→5Cマージ済み / z14)を参照する。
// dm/10 はメインスレッドの Math.round(e*10)/10 と同一のdouble値になるため、判定結果は逐次版とビット一致する。

'use strict';

importScripts('sora-constants.js');   // 数の単一情報源(ハバーサイン・1画素の長さ・大円の補間・日本域)。本体の _visJudgeCore と同じ関数を使うので同じビット列になる

const SENTINEL = -2147483648;   // 標高データ無し

/** ハバーサイン距離(m)。本体の _geoDistM と同じ関数(sora-constants.js) */
function _distanceM(lat1d, lng1d, lat2d, lng2d) { return SORA.haversineDistanceM(lat1d, lng1d, lat2d, lng2d); }

self.onmessage = (ev) => {
    const m = ev.data;
    if (!m || m.type !== 'judge') return;
    const { jobId, chunk0, chunk1, lat, lng, startTotal, endLat, endLng, endTotal, exclM } = m;
    const obsExclM = m.obsExclM || 0;   // 除外範囲(観測点側)。旧メッセージ形式では0(=無効)
    const inv2R = m.inv2R || 0;         // 地球の丸み+気差 1/(2·Reff) (第116ラウンド。0=補正なし=旧動作)
    const band = m.band || null;        // 山頂部(第152): {x0,y0,w,h,bits(1bit/画素)}。目的点につながる帯の画素の遮蔽は無視(本体の_sbHasと同じ)
    const bandHas = (gx, gy) => { const bx = gx - band.x0, by = gy - band.y0; if (bx < 0 || by < 0 || bx >= band.w || by >= band.h) return false; const i = by * band.w + bx; return ((band.bits[i >> 3] >> (i & 7)) & 1) === 1; };

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
    const gpx15At = (lngd) => 128 * (lngd / 180 + 1) * scale15;
    const SEG = SORA.VISIBILITY.PATH_CHUNK;
    const kept = lat.length;
    const blocked = new Uint8Array(kept);   // 1 = この帯域内に遮蔽あり(除外範囲を除く)
    const endInJapan = SORA.insideJapan(endLat, endLng);

    for (let i = 0; i < kept; i++) {
        const sLat = lat[i], sLng = lng[i];
        const sTotal = startTotal[i];
        // _visJudgeCore と同一のパラメータ化(経路は大円。区間(SEG標本)の両端を球面補間で求め、中は画素座標の直線で近似する)
        const distM = _distanceM(sLat, sLng, endLat, endLng);
        const stepM = SORA.metersPerPixel(sLat, 15) / 2;
        const steps = Math.max(2, Math.ceil(distM / stepM));
        const path = SORA.greatCirclePath(sLat, sLng, endLat, endLng);
        const seaAsZero = endInJapan && SORA.insideJapan(sLat, sLng);   // 日本域: 標高タイルの無い所=海→海面0mとして遮る(可視マップと同じ)
        const endDrop = distM * distM * inv2R;   // 目的点の沈み込み(_visJudgeCoreと同一の式・演算順)
        // 担当チャンクのみ判定(チャンク境界=逐次版のSEG境界と一致させ、区間内の補間もビット一致させる)
        outer:
        for (let c = chunk0; c < chunk1; c++) {
            const j0 = 1 + c * SEG;
            if (j0 >= steps) break;
            const j1 = Math.min(j0 + SEG - 1, steps - 1);
            const pA = path.at(j0 / steps), pB = (j1 > j0) ? path.at(j1 / steps) : pA;
            const gxA = gpx15At(pA.lng), gyA = gpy15At(pA.lat);
            const dgx = (j1 > j0) ? (gpx15At(pB.lng) - gxA) / (j1 - j0) : 0;
            const dgy = (j1 > j0) ? (gpy15At(pB.lat) - gyA) / (j1 - j0) : 0;
            for (let j = j0; j <= j1; j++) {
                const gx = (gxA + dgx * (j - j0)) | 0, gy = (gyA + dgy * (j - j0)) | 0;
                let e = elevAtPix15(gx, gy);
                if (e === null || e === undefined) { if (!seaAsZero) continue; e = 0; }
                const r = j / steps;
                const d = distM * r;
                const lineElev = sTotal + (endTotal - endDrop - sTotal) * r;
                if (e - d * d * inv2R > lineElev) {
                    if (distM * (1 - r) <= exclM) continue;   // 除外範囲(目的点側)のNGは無視
                    if (band && bandHas(gx, gy)) continue;    // 山頂部(目的点につながる帯)の地形は遮蔽に数えない(第152)
                    if (d <= obsExclM) continue;              // 除外範囲(観測点側)のNGは無視
                    blocked[i] = 1;
                    break outer;   // この画素はNG確定(帯域内の早期打ち切り)
                }
            }
        }
        if ((i & 1023) === 0) self.postMessage({ type: 'progress', jobId, done: i });
    }
    self.postMessage({ type: 'done', jobId, blocked }, [blocked.buffer]);
};
