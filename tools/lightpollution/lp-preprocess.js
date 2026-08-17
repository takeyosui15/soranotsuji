#!/usr/bin/env node
// 光害アセット前処理 (デッサン18 フェーズ3用。オフラインで1回だけ実行する)
//
// Falchi et al. 2016「世界光害アトラス」(GFZ Data Services, doi:10.5880/GFZ.1.4.2016.001) の
// GeoTIFF(人工天空輝度 mcd/m²)から日本域を切り出し、SQM(mag/arcsec²)へ変換して
// Uint8量子化した軽量バイナリ(lp-japan.bin)とメタ情報(lp-japan.json)を生成する。
// 参照元が更新されたら、このスクリプトを再実行するだけでアセットを最新化できる。
//
// 使い方:
//   npm install geotiff        (このディレクトリで1回)
//   node lp-preprocess.js --in World_Atlas_2015.tif [--out ../../data] [--downsample 4]
//   node lp-preprocess.js --selftest        (合成GeoTIFFでパイプラインを自己検証)
//
// 入力の入手: https://dataservices.gfz-potsdam.de/contact/showshort.php?id=escidoc:1541893
//   (要ダウンロード。非商用条件・クレジット必須: Falchi et al. 2016, GFZ Data Services)
//
// 変換式 (lightpollutionmap.info help の整理に従う):
//   自然光 22.0 mag/arcsec² = 0.171168465 mcd/m²
//   total = artificial + 0.171168465 [mcd/m²]
//   SQM   = log10(total / 108000000) / (-0.4)
// 量子化: SQM∈[SQM_MIN, SQM_MAX] を 0〜255 に線形割当(0=最も明るい空, 255=自然の暗さ)。
//
// 実行時の参照(フェーズ3でscript.jsに実装):
//   ix = floor((lng - west) / dLng), iy = floor((north - lat) / dLat)
//   SQM = SQM_MIN + bin[iy*width + ix] / 255 * (SQM_MAX - SQM_MIN)

const fs = require('fs');
const path = require('path');

const NATURAL = 0.171168465;          // 22.0 mag/arcsec² の輝度 [mcd/m²]
const SQM_MIN = 15.0, SQM_MAX = 22.0; // 量子化レンジ(都心の明るい空〜自然の暗さ)

function art2sqm(art) {
    const total = Math.max(0, art) + NATURAL;
    return Math.log10(total / 108000000) / (-0.4);
}
function quantize(sqm) {
    const q = Math.round((sqm - SQM_MIN) / (SQM_MAX - SQM_MIN) * 255);
    return Math.max(0, Math.min(255, q));
}

async function preprocess({ inPath, outDir, bbox, downsample }) {
    // fromFile はファイル全体をメモリに読まず、必要なタイル/ストリップだけをランダムアクセスで読む。
    // 全球GeoTIFFは2GiB超(readFileSyncのBuffer上限を超える)ため、この方式が必須
    const { fromFile } = require('geotiff');
    let tiff;
    try {
        tiff = await fromFile(inPath);
    } catch (e) {
        if (e.code === 'EPERM' || e.code === 'EACCES') {
            console.error(`エラー: macOSのプライバシー保護により、このフォルダのファイルを開けませんでした: ${inPath}`);
            console.error('');
            console.error('対処(どちらか一方でOK):');
            console.error('  A. 【簡単】Finderで対象の .tif ファイルを、この tools/lightpollution フォルダへ');
            console.error('     ドラッグして移動し、次のように実行する:');
            console.error('       node lp-preprocess.js --in ./World_Atlas_2015.tif');
            console.error('  B. ターミナルにダウンロードフォルダへのアクセスを許可する:');
            console.error('     システム設定 → プライバシーとセキュリティ → ファイルとフォルダ →');
            console.error('     ターミナル → 「ダウンロードフォルダ」をオン → ターミナルを再起動して再実行');
            console.error('');
            console.error('  ※ それでも同じエラーの場合は、ファイルがiCloudのプレースホルダ(雲アイコン)に');
            console.error('     なっていないかご確認ください(Finderでダブルクリック等で一度ローカルに実体化します)');
            process.exit(1);
        }
        throw e;
    }
    const img = await tiff.getImage();
    const [ox, oy] = img.getOrigin();               // 左上コーナー (lng, lat)
    const [sx, syRaw] = img.getResolution();        // 度/画素 (syは負のことが多い)
    const sy = Math.abs(syRaw);
    const W = img.getWidth(), H = img.getHeight();
    // bbox(west,south,east,north) → 画素窓
    const x0 = Math.max(0, Math.floor((bbox.west - ox) / sx));
    const x1 = Math.min(W, Math.ceil((bbox.east - ox) / sx));
    const y0 = Math.max(0, Math.floor((oy - bbox.north) / sy));
    const y1 = Math.min(H, Math.ceil((oy - bbox.south) / sy));
    if (x1 <= x0 || y1 <= y0) throw new Error('切り出し範囲がGeoTIFFの範囲外です');
    console.log(`入力: ${W}×${H}px 原点(${ox},${oy}) 解像度(${sx}°,${sy}°)`);
    console.log(`切り出し窓: x ${x0}..${x1}, y ${y0}..${y1} (${x1 - x0}×${y1 - y0}px) → 1/${downsample} に縮約`);
    console.log('切り出し帯を読み込み中… (ファイル全体ではなく必要な帯だけを読みます。大きなファイルでは数分かかることがあります)');
    const raster = (await img.readRasters({ window: [x0, y0, x1, y1] }))[0];
    const cw = x1 - x0, ch = y1 - y0;
    const ow = Math.floor(cw / downsample), oh = Math.floor(ch / downsample);
    const out = new Uint8Array(ow * oh);
    // downsample×downsample の平均輝度→SQM→量子化 (輝度平均が物理的に正しい合成)
    for (let j = 0; j < oh; j++) {
        for (let i = 0; i < ow; i++) {
            let sum = 0, n = 0;
            for (let dj = 0; dj < downsample; dj++) {
                for (let di = 0; di < downsample; di++) {
                    const v = raster[(j * downsample + dj) * cw + (i * downsample + di)];
                    if (isFinite(v) && v >= 0) { sum += v; n++; }
                }
            }
            out[j * ow + i] = quantize(art2sqm(n ? sum / n : 0));
        }
    }
    const meta = {
        source: 'Falchi et al. 2016, World Atlas of Artificial Night Sky Brightness (GFZ Data Services, doi:10.5880/GFZ.1.4.2016.001)',
        license: '非商用条件・クレジット必須',
        west: ox + x0 * sx, north: oy - y0 * sy,
        east: ox + (x0 + ow * downsample) * sx, south: oy - (y0 + oh * downsample) * sy,
        width: ow, height: oh,
        dLng: sx * downsample, dLat: sy * downsample,
        sqmMin: SQM_MIN, sqmMax: SQM_MAX,
        generatedAt: new Date().toISOString(),
    };
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'lp-japan.bin'), out);
    fs.writeFileSync(path.join(outDir, 'lp-japan.json'), JSON.stringify(meta, null, 2));
    console.log(`出力: ${path.join(outDir, 'lp-japan.bin')} (${(out.length / 1024).toFixed(0)}KB, ${ow}×${oh}px)`);
    console.log(`メタ: ${path.join(outDir, 'lp-japan.json')}`);
    return { out, meta };
}

/** 合成GeoTIFFでパイプラインを自己検証(入力ファイル不要・ネットワーク不要)。
 *  geotiffの書き込み器はUint8のみ確実なため、合成値は整数輝度(mcd/m²)で作る。
 *  実データ(float32)の読みはgeotiffの読み器が標準対応しており、ここでは
 *  切り出し窓の座標計算・SQM変換・量子化・参照式の正しさを検証する */
async function selftest() {
    const { writeArrayBuffer } = require('geotiff');
    const os = require('os');
    // 世界全体を粗い0.5°格子で合成: 東京相当(35.75N,139.75E)だけ明るく(art=30)、他は暗い(art=1)
    const W = 720, H = 360, vals = new Uint8Array(W * H).fill(1);
    const put = (lat, lng, v) => { const x = Math.floor((lng + 180) / 0.5), y = Math.floor((90 - lat) / 0.5); vals[y * W + x] = v; };
    put(35.75, 139.75, 30);
    const ab = await writeArrayBuffer(vals, {
        width: W, height: H,
        ModelPixelScale: [0.5, 0.5, 0],
        ModelTiepoint: [0, 0, 0, -180, 90, 0],
    });
    const tmp = path.join(os.tmpdir(), 'lp-selftest.tif');
    fs.writeFileSync(tmp, Buffer.from(ab));
    const outDir = path.join(os.tmpdir(), 'lp-selftest-out');
    const { out, meta } = await preprocess({ inPath: tmp, outDir, bbox: { west: 122, south: 24, east: 154, north: 46 }, downsample: 1 });
    // 検証1: 寸法 = (154-122)/0.5 × (46-24)/0.5 = 64×44
    const ok1 = meta.width === 64 && meta.height === 44;
    // 検証2: 参照式でのSQM ≈ 期待値(暗所=art2sqm(1)≈19.9 / 東京相当=art2sqm(30)≈16.4)
    const sqmOf = (lat, lng) => {
        const ix = Math.floor((lng - meta.west) / meta.dLng), iy = Math.floor((meta.north - lat) / meta.dLat);
        return meta.sqmMin + out[iy * meta.width + ix] / 255 * (meta.sqmMax - meta.sqmMin);
    };
    const dark = sqmOf(36.0, 138.0), tokyo = sqmOf(35.75, 139.75);
    const step = (SQM_MAX - SQM_MIN) / 255;   // 量子化1段の幅(≈0.027等級)
    const ok2 = Math.abs(dark - art2sqm(1)) <= step && Math.abs(tokyo - art2sqm(30)) <= step && tokyo < dark;
    console.log(`selftest: 寸法64×44=${ok1} / SQM(暗所)=${dark.toFixed(2)} (期待${art2sqm(1).toFixed(2)}) SQM(東京相当)=${tokyo.toFixed(2)} (期待${art2sqm(30).toFixed(2)}) 変換=${ok2}`);
    if (!(ok1 && ok2)) { console.error('SELFTEST FAILED'); process.exit(1); }
    console.log('SELFTEST PASS');
}

function usage() {
    console.log([
        '使い方 (このディレクトリ tools/lightpollution で実行してください):',
        '  1) npm install                       # 依存(geotiff)を入れる。1回だけ',
        '  2) node lp-preprocess.js --selftest  # 入力ファイル不要の動作確認(SELFTEST PASSと出ればOK)',
        '  3) node lp-preprocess.js --in ~/Downloads/World_Atlas_2015.tif',
        '',
        '  ※ --in の後ろは、GFZからダウンロードした実際のGeoTIFFファイルのパスに置き換えてください。',
        '     山括弧<>付きの「<GeoTIFF>」は説明用の穴埋め表記です。<>ごと入力するとzshの構文エラーになります。',
        '  ※ 入手先: https://dataservices.gfz-potsdam.de (doi:10.5880/GFZ.1.4.2016.001)',
        '',
        '  オプション: --out <出力先dir(既定 ../../data)> --downsample <縮約率(既定4)>',
        '              --west/--south/--east/--north <切り出し範囲(既定 E122〜154, N24〜46)>',
    ].join('\n'));
}

(async () => {
    const args = process.argv.slice(2);
    const get = (k, def) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : def; };
    try { require.resolve('geotiff'); } catch (_) {
        console.error('エラー: 依存パッケージ geotiff が見つかりません。');
        console.error('このディレクトリ(tools/lightpollution)で `npm install` を実行してから再度お試しください。');
        process.exit(1);
    }
    if (args.includes('--selftest')) { await selftest(); return; }
    const inPath = get('--in', null);
    if (!inPath || inPath.startsWith('--')) { usage(); process.exit(1); }
    if (!fs.existsSync(inPath)) {
        console.error(`エラー: 入力ファイルが見つかりません: ${inPath}`);
        console.error('GFZからダウンロードしたGeoTIFF(.tif)のパスを --in に指定してください。');
        usage();
        process.exit(1);
    }
    await preprocess({
        inPath,
        outDir: get('--out', path.join(__dirname, '..', '..', 'data')),
        bbox: { west: +get('--west', 122), south: +get('--south', 24), east: +get('--east', 154), north: +get('--north', 46) },
        downsample: Math.max(1, parseInt(get('--downsample', '4'))),
    });
})().catch(e => { console.error(e); process.exit(1); });
