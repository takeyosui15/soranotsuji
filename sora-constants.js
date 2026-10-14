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

// 宙の辻の「数の単一情報源」。
// 地球の大きさ・大気差・観測者・標高タイル・可視判定の既定値と、それらを使う「どこでも同じでなければならない小さな式」を、ここに1度だけ書く。
// 読み方: 本体(index.html)は <script src="sora-constants.js">、ワーカーは importScripts('sora-constants.js')、Nodeの道具は require() で同じ SORA を得る。
// 値を変えるときはここだけを変える(APP_VERSIONと同じ考え方)。計算の本体(判定の式・光線の歩き方)は各ファイルに残し、ここは値と共通の式だけを持つ。
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;   // Node(tools/)
    else root.SORA = api;                                                          // ブラウザ本体(window)・ワーカー(self)
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /** 地球の大きさ(m) */
    const EARTH = Object.freeze({
        WGS84_SEMI_MAJOR_M: 6378137,            // 赤道半径 a(測地線・局所半径・メルカトルの縮尺の元)
        WGS84_SEMI_MINOR_M: 6356752.3142,       // 極半径 b
        WGS84_FLATTENING: 1 / 298.257223563,    // 扁平率 f(Vincentyの式)
        HAVERSINE_RADIUS_M: 6371000,            // ハバーサイン距離の球の半径(Leaflet CRS.Earth.distance と同じ値。検索結果の距離と可視判定の刻みがこの値で揃っている)
        EQUATOR_CIRCUMFERENCE_M: 40075016.686,  // 赤道の周長 2πa(メルカトル画素の長さの元)
    });

    /** 大気差(地形の見通しに使う気差係数Kと、Kを気象条件から算出する式の係数) */
    const REFRACTION = Object.freeze({
        K_STANDARD: 0.132,                // 測量標準の気差係数(標準気象 P=1013.25/T=15/Γ=0.0125 でのK)。静的資産の道具の既定とヘルプの目安。本体の計算は設定の値(大気差補正オフ=0)を使う
        STD_PRESSURE_HPA: 1013.25,        // 標準気圧
        STD_TEMPERATURE_C: 15.0,          // 標準気温
        STD_LAPSE_RATE_K_PER_M: 0.0125,   // 既定の気温減率(この値でK=0.132になる)
        ISA_LAPSE_RATE_K_PER_M: 0.0065,   // 国際標準大気の気温減率(以前の既定値。保存データの移行判定に使う)
        K_FORMULA_FACTOR: 503,            // K ≈ 503·P/T²·(0.034 − Γ) の 503
        K_FORMULA_GRADIENT: 0.034,        // 同じ式の 0.034
    });

    /** 観測者 */
    const OBSERVER = Object.freeze({
        EYE_HEIGHT_M: 1.5,   // 地上に立った人の目の高さ(可視マップの観測者・観測点の高さの既定)
    });

    /** 可視判定の既定値(基本オプションの除外範囲・山頂部。設定で変えられる値の「既定」がここ) */
    const VISIBILITY = Object.freeze({
        EXCLUDE_TARGET_M: 15,     // 目的点側の除外半径(自己遮蔽+鋭峰の写り込みを吸収)
        EXCLUDE_OBSERVER_M: 10,   // 観測点側の除外半径(足元の自己遮蔽)
        SUMMIT_BAND_M: 300,       // 山頂部の帯の高さ(山頂からこの高さ以内で山頂につながる地形は遮蔽に数えない)
        SUMMIT_SEARCH_M: 3000,    // 山頂部を探す半径
        SUMMIT_UP_M: 100,         // 目的点よりこれ以上高い地形が帯につながる時は「目的点は山頂ではない」
        PATH_CHUNK: 64,           // 統一可視判定の経路を区切る標本数(大円を区間ごとに直線で近似する長さ=約128m)
    });

    /** 標高タイル(国土地理院)と、ワーカー・道具の格子の符号 */
    const DEM = Object.freeze({
        GSI_TILE_BASE: 'https://cyberjapandata.gsi.go.jp/xyz/',
        GSI_INVALID_CODE: 0x800000,   // PNGの画素値がこの値=無効(海など)
        GSI_CODE_WRAP: 0x1000000,     // 負の標高の折り返し
        GSI_UNIT_M: 0.01,             // 画素値1あたり0.01m
        GRID_NODATA: 65535,           // Uint16格子の「データ無し」
        GRID_OFFSET_M: 100,           // 格子の符号 = round((標高 + 100) × 10)
        GRID_SCALE: 10,
        FINE_ZOOM: 15,                // DEM5A/5B/5Cのズーム(1画素≈4m)
        COARSE_ZOOM: 14,              // DEM10Bのズーム(1画素≈8m。辻メッシュの格子)
        JAPAN_BBOX: Object.freeze({ latMin: 20.0, latMax: 46.0, lngMin: 122.0, lngMax: 156.0 }),   // 地理院の標高タイルがある範囲(離島を含めて広めに)
    });

    /** 端末の店(IndexedDB。地図の地理院タイル soranotsuji-maptiles / 標高タイル soranotsuji-kashimap)。第158 */
    const TILE_STORE = Object.freeze({
        MISS_TTL_MS: 30 * 24 * 3600 * 1000,   // 「無し」(404)の印の寿命=30日。過ぎたら取り直す(地理院は後からタイルを足すことがある: DEM5Aの範囲の拡大など)
    });

    /** 気差係数K = 503·P/T²·(0.034 − Γ)。P: 気圧(hPa)、T: 気温(°C→ケルビン)、Γ: 気温減率(K/m、正値) */
    function calculateKFromMeteo(pressureHpa, temperatureC, lapseRateKPerM) {
        const tKelvin = temperatureC + 273.15;
        return REFRACTION.K_FORMULA_FACTOR * (pressureHpa / (tKelvin * tKelvin)) * (REFRACTION.K_FORMULA_GRADIENT - lapseRateKPerM);
    }

    /** 緯度(度)での WGS84 楕円体の地心距離(m)。ρ(φ) = sqrt[((a²cosφ)² + (b²sinφ)²) / ((a cosφ)² + (b sinφ)²)]。赤道でa、極でb、北緯35°で約6371km */
    function getLocalEarthRadius(latDeg) {
        const lat = latDeg * Math.PI / 180;
        const cosLat = Math.cos(lat), sinLat = Math.sin(lat);
        const a = EARTH.WGS84_SEMI_MAJOR_M, b = EARTH.WGS84_SEMI_MINOR_M;
        const a2cos = a * a * cosLat;
        const b2sin = b * b * sinLat;
        const acos = a * cosLat;
        const bsin = b * sinLat;
        return Math.sqrt((a2cos * a2cos + b2sin * b2sin) / (acos * acos + bsin * bsin));
    }

    /** 地球の丸み+気差の実効半径の逆数の半分 1/(2·Reff)。Reff = 2点の局所半径の平均 / (1 − k)。沈み込み drop(d) = d²·inv2R */
    function inv2ReffFor(latA, latB, k) {
        const Reff = ((getLocalEarthRadius(latA) + getLocalEarthRadius(latB)) / 2) / (1 - k);
        return 1 / (2 * Reff);
    }

    /** ハバーサイン距離(m)。式・演算の順序を変えないこと(本体・辻メッシュのワーカー・道具で同じビット列になる前提で、検索結果と判定が揃っている) */
    function haversineDistanceM(lat1, lng1, lat2, lng2) {
        const rad = Math.PI / 180, R = EARTH.HAVERSINE_RADIUS_M;
        const sinDLat = Math.sin((lat2 - lat1) * rad / 2);
        const sinDLng = Math.sin((lng2 - lng1) * rad / 2);
        const a = sinDLat * sinDLat + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * sinDLng * sinDLng;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /** メルカトル(256px×2^zoom)の1画素の長さ(m)。緯度latDegの所の値 */
    function metersPerPixel(latDeg, zoom) {
        return EARTH.EQUATOR_CIRCUMFERENCE_M * Math.cos(latDeg * Math.PI / 180) / (256 * Math.pow(2, zoom));
    }

    /** 日本域(地理院の標高タイルがある範囲)か */
    function insideJapan(lat, lng) {
        const b = DEM.JAPAN_BBOX;
        return lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax;
    }

    /** 2点を結ぶ大円(球面の線形補間)。at(f) で始点からの割合 f(0〜1)の点 {lat, lng} を返す。
     *  視線は観測点・目的点・地心を含む鉛直面(大円)の中にあるので、見通しの経路はこれに沿って歩く(緯度経度の直線補間や地図の直線は航程線=大円ではない)。
     *  本体の統一可視判定と辻メッシュのワーカーが同じ式で同じ点列を得るための共通部品 */
    function greatCirclePath(lat1, lng1, lat2, lng2) {
        const D2R = Math.PI / 180, R2D = 180 / Math.PI;
        const p1 = lat1 * D2R, l1 = lng1 * D2R, p2 = lat2 * D2R, l2 = lng2 * D2R;
        const x1 = Math.cos(p1) * Math.cos(l1), y1 = Math.cos(p1) * Math.sin(l1), z1 = Math.sin(p1);
        const x2 = Math.cos(p2) * Math.cos(l2), y2 = Math.cos(p2) * Math.sin(l2), z2 = Math.sin(p2);
        const dot = Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2));
        const ang = Math.acos(dot);   // 中心角
        const sinAng = Math.sin(ang);
        const at = (f) => {
            let A, B;
            if (sinAng < 1e-12) { A = 1 - f; B = f; }   // ほぼ同じ点: 線形
            else { A = Math.sin((1 - f) * ang) / sinAng; B = Math.sin(f * ang) / sinAng; }
            const x = A * x1 + B * x2, y = A * y1 + B * y2, z = A * z1 + B * z2;
            return { lat: Math.atan2(z, Math.sqrt(x * x + y * y)) * R2D, lng: Math.atan2(y, x) * R2D };
        };
        return { angleRad: ang, at };
    }

    return Object.freeze({ EARTH, REFRACTION, OBSERVER, VISIBILITY, DEM, TILE_STORE, calculateKFromMeteo, getLocalEarthRadius, inv2ReffFor, haversineDistanceM, metersPerPixel, insideJapan, greatCirclePath });
});
