#!/usr/bin/env node
// NAME
//   make-geoid-jp.js — 日本周辺のジオイド高格子 data/geoid-jp.json の生成
// SYNOPSIS
//   npm install egm96-universal && node tools/geoid/make-geoid-jp.js
// DESCRIPTION
//   PLATEAU建物レイヤ(宙の窓の都市モード)の高さ補正用アセットを生成する。
//   PLATEAUの3D Tilesの高さは楕円体高(WGS84)、宙の辻のDEMは標高のため、
//   標高 = 楕円体高 − ジオイド高N の補正が必要(実測の経緯はdessin/06のPLATEAU節)。
//   NはEGM96(egm96-universal)から0.25°格子で標本化する。精度は±1m級
//   (東京での実測: EGM96=36.797m vs GSIGEO2011=37.104m, Δ0.31m)。建物の据え付けには十分。
// OUTPUT
//   data/geoid-jp.json — {lat0,lon0,dlat,dlon,nlat,nlon,unit:0.1(m),src,vals[]}
//   vals は南→北の行順・西→東の列順、0.1m単位の整数(N × 10 を四捨五入)。
// HISTORY
//   第50ラウンドで作成(PLATEAU建物レイヤのPoCと同時)。
const fs = require('fs');
const path = require('path');
const egm96 = require('egm96-universal');

const lat0 = 24.0, lon0 = 123.0, dlat = 0.25, dlon = 0.25;
const nlat = Math.round((46.0 - lat0) / dlat) + 1;   // 24〜46°N → 89行
const nlon = Math.round((146.0 - lon0) / dlon) + 1;  // 123〜146°E → 93列
const vals = new Array(nlat * nlon);
for (let j = 0; j < nlat; j++) {
    for (let i = 0; i < nlon; i++) {
        const n = egm96.meanSeaLevel(lat0 + j * dlat, lon0 + i * dlon);
        vals[j * nlon + i] = Math.round(n * 10);
    }
}
const out = { lat0, lon0, dlat, dlon, nlat, nlon, unit: 0.1, src: 'EGM96 (egm96-universal)', vals };
const dst = path.join(__dirname, '..', '..', 'data', 'geoid-jp.json');
fs.writeFileSync(dst, JSON.stringify(out));
console.log(`wrote ${dst}: ${nlat}x${nlon} = ${vals.length} vals, ` +
    `${(fs.statSync(dst).size / 1024).toFixed(1)}KB, N(Tokyo 35.69,139.69)=` +
    `${egm96.meanSeaLevel(35.69, 139.69).toFixed(3)}m`);
