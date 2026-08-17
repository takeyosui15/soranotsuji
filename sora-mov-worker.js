/*
宙の辻 - Sora no Tsuji
Copyright (C) 2026 Takeyoshi Watanabe (Sora no Tsuji Project)
GNU General Public License v3.0 (LICENSEファイル参照)

宙の窓インターバルMovの再生用ワーカー:
フレーム(日時)毎の 空の回転基底・表示天体の方位/高度/視半径/月相 を事前計算して返す。
メインスレッドは再生時にこの結果をデキューして表示するだけ(日時情報メニューとは切り離した別処理)。
*/
importScripts('https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js');

const KM_PER_AU = 149597870.7;

self.onmessage = (e) => {
    const { reqId, off, frames, bodies, observer, refraction } = e.data;
    let obs;
    try { obs = new Astronomy.Observer(observer.lat, observer.lng, observer.elev); }
    catch (err) { self.postMessage({ reqId, off, frames: [] }); return; }
    const refr = refraction ? 'normal' : null;
    const out = [];
    for (const ms of frames) {
        const date = new Date(ms);
        const frame = { t: ms, sky: null, bodies: [] };
        try {
            // 空(EQJ→地平)の回転基底: RA0h/Dec0° と Dec+90° の地平方向(屈折なし; 全天の回転に使用)
            const h1 = Astronomy.Horizon(date, obs, 0, 0, null);
            const h2 = Astronomy.Horizon(date, obs, 0, 90, null);
            frame.sky = { rx: { az: h1.azimuth, alt: h1.altitude }, rz: { az: h2.azimuth, alt: h2.altitude } };
        } catch (err) { /* skyなしフレーム(スキップ扱い) */ }
        for (const b of bodies) {
            try {
                let ra = b.ra, dec = b.dec, angR = 0;
                if (!b.fixed) {
                    const eq = Astronomy.Equator(b.id, date, obs, true, true);
                    ra = eq.ra; dec = eq.dec;
                    if (b.radiusKm) angR = Math.atan(b.radiusKm / (eq.dist * KM_PER_AU)) * 180 / Math.PI;
                }
                const h = Astronomy.Horizon(date, obs, ra, dec, refr);
                const fb = { az: h.azimuth, alt: h.altitude, angR };
                if (b.id === 'Moon') {
                    const ill = Astronomy.Illumination('Moon', date);
                    fb.phase = ill.phase_fraction;
                    fb.waxing = Astronomy.MoonPhase(date) < 180;
                }
                frame.bodies.push(fb);
            } catch (err) { frame.bodies.push(null); }
        }
        out.push(frame);
    }
    self.postMessage({ reqId, off, frames: out });
};
