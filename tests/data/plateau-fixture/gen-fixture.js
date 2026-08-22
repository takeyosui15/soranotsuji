#!/usr/bin/env node
// NAME
//   gen-fixture.js — PLATEAU建物レイヤ検証用の合成3D Tilesフィクスチャ生成
// SYNOPSIS
//   npm install draco3d && node tests/data/plateau-fixture/gen-fixture.js
// DESCRIPTION
//   verify128(都市モード)のための、実データと同じ構造(b3dm→glb→Draco圧縮+CESIUM_RTC)の
//   合成タイルを生成する。既知の緯度経度・既知の高さの箱ビル2棟(1棟はテクスチャ付き)を
//   置くことで、変換連鎖(楕円体高→ジオイド補正→ENU→見かけ高さ)を数値で表明できる。
//   実データ(PLATEAU)のバイナリはリポジトリに置かず、ライセンスも持ち込まない。
// LAYOUT
//   観測点(35.0, 138.0, 標高0) 想定。
//   箱A: 中心(35.0045, 138.0)≈北500m・footprint±0.0004°・標高0〜100m・無テクスチャ
//   箱B: 中心(35.0072, 138.001)≈北800m・footprint±0.0002°・標高0〜200m・テクスチャ付き(4×4赤PNG)
//   楕円体高 = 標高 + N(データ本体 data/geoid-jp.json をアプリと同じ双一次補間で参照)
// HISTORY
//   第50ラウンドで作成(PLATEAU建物レイヤPoCと同時)。
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const draco3d = require('draco3d');

const OBS = { lat: 35.0, lng: 138.0 };

// --- アプリ(_smBldgGeoidN)と同じ双一次補間でジオイド高Nを得る ---
const grid = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'data', 'geoid-jp.json'), 'utf8'));
function geoidN(g, lat, lng) {
    const fj = (lat - g.lat0) / g.dlat, fi = (lng - g.lon0) / g.dlon;
    const j = Math.max(0, Math.min(g.nlat - 2, Math.floor(fj)));
    const i = Math.max(0, Math.min(g.nlon - 2, Math.floor(fi)));
    const tj = Math.max(0, Math.min(1, fj - j)), ti = Math.max(0, Math.min(1, fi - i));
    const v = (jj, ii) => g.vals[jj * g.nlon + ii] * g.unit;
    return (v(j, i) * (1 - ti) + v(j, i + 1) * ti) * (1 - tj) + (v(j + 1, i) * (1 - ti) + v(j + 1, i + 1) * ti) * tj;
}
const N = geoidN(grid, OBS.lat, OBS.lng);

// --- 測地→ECEF(WGS84) ---
const A = 6378137.0, F = 1 / 298.257223563, E2 = F * (2 - F);
function geoToEcef(latDeg, lngDeg, h) {
    const la = latDeg * Math.PI / 180, lo = lngDeg * Math.PI / 180;
    const Nr = A / Math.sqrt(1 - E2 * Math.sin(la) ** 2);
    return [(Nr + h) * Math.cos(la) * Math.cos(lo), (Nr + h) * Math.cos(la) * Math.sin(lo), (Nr * (1 - E2) + h) * Math.sin(la)];
}

// --- 箱(直方体)を頂点+三角形で作る(緯度経度矩形×標高範囲。面ごとに独立頂点+法線+UV) ---
// glTFはy-up・RTC相対: gltf = (ecef.x−rtc.x, ecef.z−rtc.z, −(ecef.y−rtc.y))
function makeBox(rtc, lat0, lat1, lng0, lng1, msl0, msl1) {
    const c = (lat, lng, msl) => {
        const e = geoToEcef(lat, lng, msl + N);
        return [e[0] - rtc[0], e[2] - rtc[2], -(e[1] - rtc[1])];
    };
    // 8隅 → 6面×4頂点(面法線は局所ENUの向きから近似生成: 上面=up、側面=水平)
    const pos = [], nrm = [], uv = [], idx = [];
    const face = (quad, n) => {
        const b = pos.length / 3;
        for (let i = 0; i < 4; i++) { pos.push(...quad[i]); nrm.push(...n); }
        uv.push(0, 0, 1, 0, 1, 1, 0, 1);
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    // 法線はECEF系で作ってy-upへ回す(ecef n → gltf n = (nx, nz, -ny))
    const enu = (() => {
        const la = ((lat0 + lat1) / 2) * Math.PI / 180, lo = ((lng0 + lng1) / 2) * Math.PI / 180;
        return {
            up: [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)],
            east: [-Math.sin(lo), Math.cos(lo), 0],
            north: [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)],
        };
    })();
    const g = (v) => [v[0], v[2], -v[1]];
    const neg = (v) => [-v[0], -v[1], -v[2]];
    face([c(lat0, lng0, msl1), c(lat0, lng1, msl1), c(lat1, lng1, msl1), c(lat1, lng0, msl1)], g(enu.up));            // 上面
    face([c(lat0, lng0, msl0), c(lat1, lng0, msl0), c(lat1, lng1, msl0), c(lat0, lng1, msl0)], g(neg(enu.up)));       // 底面
    face([c(lat0, lng0, msl0), c(lat0, lng1, msl0), c(lat0, lng1, msl1), c(lat0, lng0, msl1)], g(neg(enu.north)));    // 南面
    face([c(lat1, lng0, msl0), c(lat1, lng0, msl1), c(lat1, lng1, msl1), c(lat1, lng1, msl0)], g(enu.north));         // 北面
    face([c(lat0, lng0, msl0), c(lat0, lng0, msl1), c(lat1, lng0, msl1), c(lat1, lng0, msl0)], g(neg(enu.east)));     // 西面
    face([c(lat0, lng1, msl0), c(lat1, lng1, msl0), c(lat1, lng1, msl1), c(lat0, lng1, msl1)], g(enu.east));          // 東面
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), uv: new Float32Array(uv), idx: new Uint32Array(idx) };
}

// --- 4×4 赤PNG(依存なしで生成: CRC32+zlib) ---
function makePng() {
    const crcTable = [];
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
    const crc32 = (buf) => { let c = 0xFFFFFFFF; for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    const chunk = (type, data) => {
        const t = Buffer.from(type, 'ascii');
        const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
        const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
        return Buffer.concat([len, t, data, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(4, 0); ihdr.writeUInt32BE(4, 4); ihdr[8] = 8; ihdr[9] = 2;   // 4x4, 8bit, RGB
    const raw = Buffer.alloc(4 * (1 + 4 * 3));
    for (let y = 0; y < 4; y++) { raw[y * 13] = 0; for (let x = 0; x < 4; x++) { raw[y * 13 + 1 + x * 3] = 200; raw[y * 13 + 2 + x * 3] = 40; raw[y * 13 + 3 + x * 3] = 40; } }
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

(async () => {
    const enc = await draco3d.createEncoderModule({});
    const dec3 = await draco3d.createDecoderModule({});

    const boxA = makeBox.bind(null);
    const rtc = geoToEcef(35.0045, 138.0, N);   // 箱Aの底面中心
    const A_ = makeBox(rtc, 35.0041, 35.0049, 137.99956, 138.00044, 0, 100);
    const B_ = makeBox(rtc, 35.0070, 35.0074, 138.00078, 138.00122, 0, 200);

    const encodePrim = (m3) => {
        const builder = new enc.MeshBuilder();
        const mesh = new enc.Mesh();
        const attrs = {};
        attrs.POSITION = builder.AddFloatAttributeToMesh(mesh, enc.POSITION, m3.pos.length / 3, 3, m3.pos);
        attrs.NORMAL = builder.AddFloatAttributeToMesh(mesh, enc.NORMAL, m3.nrm.length / 3, 3, m3.nrm);
        attrs.TEXCOORD_0 = builder.AddFloatAttributeToMesh(mesh, enc.TEX_COORD, m3.uv.length / 2, 2, m3.uv);
        builder.AddFacesToMesh(mesh, m3.idx.length / 3, m3.idx);
        const encoder = new enc.Encoder();
        encoder.SetAttributeQuantization(enc.POSITION, 16);
        encoder.SetAttributeQuantization(enc.NORMAL, 10);
        encoder.SetAttributeQuantization(enc.TEX_COORD, 12);
        const dd = new enc.DracoInt8Array();
        const len = encoder.EncodeMeshToDracoBuffer(mesh, dd);
        const out = Buffer.alloc(len);
        for (let i = 0; i < len; i++) out[i] = dd.GetValue(i);
        enc.destroy(dd); enc.destroy(encoder); enc.destroy(mesh); enc.destroy(builder);
        return { bytes: out, attrs };
    };
    const pA = encodePrim(A_), pB = encodePrim(B_);
    // 生成直後にデコード往復して壊れていないことを確認(kaikiの教訓: 道具は先に自分を疑う)
    for (const [nm, pr, src] of [['A', pA, A_], ['B', pB, B_]]) {
        const db = new dec3.DecoderBuffer(); db.Init(new Int8Array(pr.bytes), pr.bytes.length);
        const d = new dec3.Decoder(); const m = new dec3.Mesh();
        const st = d.DecodeBufferToMesh(db, m);
        if (!st.ok() || m.num_points() !== src.pos.length / 3) throw new Error(`roundtrip ${nm} 失敗: ${st.error_msg()} pts=${m.num_points()}`);
        dec3.destroy(m); dec3.destroy(db); dec3.destroy(d);
    }
    const png = makePng();

    // --- glb組み立て(4バイト整列でBINへ: dracoA, dracoB, png) ---
    const align4 = (n) => (n + 3) & ~3;
    const oA = 0, oB = align4(oA + pA.bytes.length), oP = align4(oB + pB.bytes.length);
    const bin = Buffer.alloc(align4(oP + png.length));
    pA.bytes.copy(bin, oA); pB.bytes.copy(bin, oB); png.copy(bin, oP);
    const gltf = {
        asset: { generator: 'gen-fixture.js', version: '2.0' },
        extensionsUsed: ['CESIUM_RTC', 'KHR_draco_mesh_compression'],
        extensionsRequired: ['CESIUM_RTC', 'KHR_draco_mesh_compression'],
        extensions: { CESIUM_RTC: { center: rtc } },
        buffers: [{ byteLength: bin.length }],
        bufferViews: [
            { buffer: 0, byteOffset: oA, byteLength: pA.bytes.length },
            { buffer: 0, byteOffset: oB, byteLength: pB.bytes.length },
            { buffer: 0, byteOffset: oP, byteLength: png.length },
        ],
        images: [{ mimeType: 'image/png', bufferView: 2 }],
        samplers: [{ wrapS: 33071, wrapT: 33071 }],
        textures: [{ sampler: 0, source: 0 }],
        materials: [
            { pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 1 } },
            { pbrMetallicRoughness: { baseColorTexture: { index: 0, texCoord: 0 }, metallicFactor: 0, roughnessFactor: 1 } },
        ],
        meshes: [{ primitives: [
            { attributes: {}, mode: 4, material: 0, extensions: { KHR_draco_mesh_compression: { bufferView: 0, attributes: pA.attrs } } },
            { attributes: {}, mode: 4, material: 1, extensions: { KHR_draco_mesh_compression: { bufferView: 1, attributes: pB.attrs } } },
        ] }],
        nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
    };
    let jsonBuf = Buffer.from(JSON.stringify(gltf), 'utf8');
    if (jsonBuf.length % 4) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(4 - jsonBuf.length % 4, 0x20)]);
    const glbHead = Buffer.alloc(12); glbHead.write('glTF', 0, 'ascii');
    glbHead.writeUInt32LE(2, 4); glbHead.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
    const cJ = Buffer.alloc(8); cJ.writeUInt32LE(jsonBuf.length, 0); cJ.write('JSON', 4, 'ascii');
    const cB = Buffer.alloc(8); cB.writeUInt32LE(bin.length, 0); cB.write('BIN\0', 4, 'ascii');
    const glb = Buffer.concat([glbHead, cJ, jsonBuf, cB, bin]);

    // --- b3dm組み立て(featureTable JSONは8バイト境界へ空白パディング) ---
    let ftBuf = Buffer.from(JSON.stringify({ BATCH_LENGTH: 2 }), 'utf8');
    while ((28 + ftBuf.length) % 8) ftBuf = Buffer.concat([ftBuf, Buffer.from(' ')]);
    const head = Buffer.alloc(28);
    head.write('b3dm', 0, 'ascii'); head.writeUInt32LE(1, 4);
    head.writeUInt32LE(28 + ftBuf.length + glb.length, 8);
    head.writeUInt32LE(ftBuf.length, 12);
    const b3dm = Buffer.concat([head, ftBuf, glb]);
    const dataDir = path.join(__dirname, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'fx.b3dm'), b3dm);

    // --- tileset.json(rootが葉。region=箱を覆う矩形) ---
    const rad = (d) => d * Math.PI / 180;
    const tileset = {
        asset: { version: '1.0' }, geometricError: 500,
        root: {
            boundingVolume: { region: [rad(137.999), rad(34.999), rad(138.002), rad(35.008), N, 200 + N] },
            geometricError: 0, refine: 'REPLACE', content: { uri: 'data/fx.b3dm' },
        },
    };
    fs.writeFileSync(path.join(__dirname, 'tileset.json'), JSON.stringify(tileset));
    console.log(`N(${OBS.lat},${OBS.lng})=${N.toFixed(3)}m, rtc=[${rtc.map(v => v.toFixed(2)).join(',')}]`);
    console.log(`fx.b3dm: ${b3dm.length} bytes (dracoA=${pA.bytes.length}, dracoB=${pB.bytes.length}, png=${png.length})`);
})().catch(e => { console.error(e); process.exit(1); });
