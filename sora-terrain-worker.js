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

// 宙の窓 DEM地形タイル取得 Web Worker
// メインスレッドから 1タイルのURLと、そのタイル内で標高が必要なサブピクセル群を受け取り、
// fetch → PNGデコード(createImageBitmap / OffscreenCanvas) → 標高(GSI dem_png方式) を計算して返す。
// ネットワークとデコードをワーカーにオフロードし、メインスレッドのプレビュー描画を軽く保つ。
//
// 受信: { reqId, url, pts: [{ idx, pX, pY, fX, fY }] }   (fX/fY=小数画素座標。バイリニア補間に使用)
//   または z15チェーン形式 { reqId, urls: [DEM5A,5B,5C], fbUrl: z14親タイル, pts: [{ idx, fX, fY, fbX, fbY }] }
//   (欠損画素はチェーンの次のソース→最後にz14親タイル(fbX/fbY=親タイル内の小数画素座標)を参照)
// 返信: { reqId, elevs: [{ idx, elev }] }   (取得/デコード失敗時は elev=0)

const POW2_8 = Math.pow(2, 8);
const POW2_16 = Math.pow(2, 16);
const POW2_23 = Math.pow(2, 23);
const POW2_24 = Math.pow(2, 24);

// GSI 標高タイル(dem_png)のRGB→標高(m)変換。script.js の _elevFromRGB と同一式。
function elevFromRGB(r, g, b) {
    if (r === 128 && g === 0 && b === 0) return null;   // 無効値(データ無し)
    const d = r * POW2_16 + g * POW2_8 + b;
    let h = (d < POW2_23) ? d : d - POW2_24;
    if (h === -POW2_23) h = 0; else h *= 0.01;
    return h;
}

// 小数画素座標(fX,fY)のバイリニア補間。script.js の _bilinearElevFromImg と同一実装。
// 無効画素が4近傍に混じる場合は従来の最近傍参照へフォールバック(null=全て無効)。
// 1点参照: p.nearest=true は最近傍画素(山頂スナップ頂点。getElevationと同じ参照)、それ以外はバイリニア補間
function sampleElev(data, fX, fY, nearest) {
    if (nearest) {
        const x = Math.min(255, Math.floor(fX)), y = Math.min(255, Math.floor(fY));
        const o = (y * 256 + x) * 4;
        return elevFromRGB(data[o], data[o + 1], data[o + 2]);
    }
    return bilinearElev(data, fX, fY);
}

function bilinearElev(data, fX, fY) {
    const gx = Math.min(255, Math.max(0, fX - 0.5));
    const gy = Math.min(255, Math.max(0, fY - 0.5));
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = Math.min(255, x0 + 1), y1 = Math.min(255, y0 + 1);
    const wx = gx - x0, wy = gy - y0;
    const at = (x, y) => { const o = (y * 256 + x) * 4; return elevFromRGB(data[o], data[o + 1], data[o + 2]); };
    const v00 = at(x0, y0), v10 = at(x1, y0), v01 = at(x0, y1), v11 = at(x1, y1);
    if (v00 === null || v10 === null || v01 === null || v11 === null) {
        return at(Math.min(255, Math.floor(fX)), Math.min(255, Math.floor(fY)));
    }
    return v00 * (1 - wx) * (1 - wy) + v10 * wx * (1 - wy) + v01 * (1 - wx) * wy + v11 * wx * wy;
}

// GSIのDEMタイルは日本域のみ。範囲外のGSI URLは取得自体をスキップする(海外での404嵐対策。
// script.js の _gsiTileOutsideJapan と同一ロジック)
const GSI_BBOX = { latMin: 20.0, latMax: 46.0, lngMin: 122.0, lngMax: 156.0 };
function gsiTileOutsideJapan(url) {
    if (!url.includes('cyberjapandata.gsi.go.jp')) return false;
    const m = url.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/);
    if (!m) return false;
    const z = +m[1], x = +m[2], y = +m[3];
    const n = Math.pow(2, z);
    const lngW = x / n * 360 - 180, lngE = (x + 1) / n * 360 - 180;
    const latN = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
    const latS = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;
    return latN < GSI_BBOX.latMin || latS > GSI_BBOX.latMax || lngE < GSI_BBOX.lngMin || lngW > GSI_BBOX.lngMax;
}

// TerrariumタイルをGSI符号へ正規化(script.js の _terrariumToGsi と同一式)。以降のデコードは共通
function terrariumToGsi(data) {
    for (let i = 0; i < data.length; i += 4) {
        const h = (data[i] * 256 + data[i + 1] + data[i + 2] / 256) - 32768;
        let v = Math.round(h * 100);
        if (v < 0) v += 16777216;
        data[i] = (v >> 16) & 255; data[i + 1] = (v >> 8) & 255; data[i + 2] = v & 255;
    }
    return data;
}

// タイル画像キャッシュ (ワーカーは再利用されるため、z14親タイル等の重複取得を避ける。上限8枚・先入れ先出し)
const _tileCache = new Map();   // url -> Uint8ClampedArray(256×256×4) | null(取得失敗)
async function loadTileData(url) {
    if (_tileCache.has(url)) return _tileCache.get(url);
    let data = null;
    if (gsiTileOutsideJapan(url)) {
        _tileCache.set(url, null);
        return null;
    }
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const blob = await resp.blob();
        const bmp = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(256, 256);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bmp, 0, 0, 256, 256);
        data = ctx.getImageData(0, 0, 256, 256).data;
        if (url.includes('/terrarium/')) data = terrariumToGsi(data);   // 全球DEMはGSI符号へ正規化
        if (bmp.close) bmp.close();
    } catch (err) { data = null; }
    if (_tileCache.size >= 8) _tileCache.delete(_tileCache.keys().next().value);
    _tileCache.set(url, data);
    return data;
}

self.onmessage = async (e) => {
    const { reqId, url, urls, fbUrl, fb2Url, pts } = e.data;
    const out = new Array(pts.length);
    if (urls) {
        // z15チェーン(DEM5A→5B→5C)+z14親タイル+全球DEM(fb2Url。海外のみ実質有効)。
        // タイルは必要になるまで取得しない
        const chainImgs = new Array(urls.length).fill(undefined);
        const getChain = async (c) => { if (chainImgs[c] === undefined) chainImgs[c] = await loadTileData(urls[c]); return chainImgs[c]; };
        let fbImg, fb2Img;
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            let v = null;
            for (let c = 0; c < urls.length && v === null; c++) {
                const img = await getChain(c);
                if (img) v = sampleElev(img, p.fX, p.fY, p.nearest);
            }
            if (v === null && fbUrl) {
                if (fbImg === undefined) fbImg = await loadTileData(fbUrl);
                if (fbImg) v = sampleElev(fbImg, p.fbX, p.fbY, p.nearest);
            }
            if (v === null && fb2Url) {   // 全球DEM(同じz15タイル。座標はそのまま)
                if (fb2Img === undefined) fb2Img = await loadTileData(fb2Url);
                if (fb2Img) v = sampleElev(fb2Img, p.fX, p.fY, p.nearest);
            }
            out[i] = { idx: p.idx, elev: (v === null) ? 0 : v };
        }
        self.postMessage({ reqId, elevs: out });
        return;
    }
    const img = await loadTileData(url);
    let fb2ImgS;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        let v = null;
        if (img) {
            v = (p.fX !== undefined)
                ? sampleElev(img, p.fX, p.fY, p.nearest)
                : elevFromRGB(img[(p.pY * 256 + p.pX) * 4], img[(p.pY * 256 + p.pX) * 4 + 1], img[(p.pY * 256 + p.pX) * 4 + 2]);
        }
        if (v === null && fb2Url) {   // 全球DEM(同じz/x/yタイル。座標はそのまま)
            if (fb2ImgS === undefined) fb2ImgS = await loadTileData(fb2Url);
            if (fb2ImgS) {
                v = (p.fX !== undefined)
                    ? sampleElev(fb2ImgS, p.fX, p.fY, p.nearest)
                    : elevFromRGB(fb2ImgS[(p.pY * 256 + p.pX) * 4], fb2ImgS[(p.pY * 256 + p.pX) * 4 + 1], fb2ImgS[(p.pY * 256 + p.pX) * 4 + 2]);
            }
        }
        out[i] = { idx: p.idx, elev: (v === null) ? 0 : v };
    }
    self.postMessage({ reqId, elevs: out });
};
