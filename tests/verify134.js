// 第56ラウンド検証: 地図2.5D「3D風ビル」(案A)+リファクタリングB第2弾③(v1.51.0)。
// - 3D風ビル: レイヤーリストのチェックで、GSI最適化ベクトルタイルBldAのfill-extrusion(種別擬似高さ
//   10/40/100m)+地図の斜め視点(ピッチ60°)をON/OFF。タイル実体はrouteで遮断=スタイル状態を検査。
// - リファクタ③: 合成標高分岐の統合(_syntheticElevAtPix15)の無いことのテスト。
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// ---- V0: 版数ピン(最新のverifyに集約) ----
check('V0 APP_VERSIONが存在(版数ピンは最新のverifyに集約)', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) || !!process.argv[2]);
check('V0 Version Historyに最新版の行がある', /Version \d+\.\d+\.\d+ - /.test(src) || !!process.argv[2]);

// ---- V1: ソース静的検査 ----
check('V1 3D風ビル: 最適化ベクトルタイルXYZ+BldA+種別擬似高さ(3103→100/3102・3112→40/他10)',
    src.includes("optimal_bvmap-v1/{z}/{x}/{y}.pbf") && src.includes("'source-layer': 'BldA'") &&
    src.includes("['match', ['get', 'vt_code'], 3103, 100, 3102, 40, 3112, 40, 10]"));
{
    // Version Historyの言及は数えない(関数定義と代入だけを固定する — verify132のT1と同じ流儀)
    const c1 = (src.match(/function _syntheticElevAtPix15\(/g) || []).length;
    const c2 = (src.match(/= _syntheticElevAtPix15;/g) || []).length;
    const c3 = (src.match(/window\._tmSyntheticElev\(gx >> 1, gy >> 1\)/g) || []).length;
    check('V1 合成標高分岐の実体は_syntheticElevAtPix15の1箇所のみ(定義1+代入2)', c1 === 1 && c2 === 2 && c3 === 1, `def=${c1} assign=${c2} body=${c3}`);
}

// ============================================================
// ブラウザ検査: 3D風ビルのON/OFF(レイヤ・可視性・ピッチ)
// ============================================================
(async () => {
    const { chromium } = require('playwright-core');
    const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
    const BASE = 'http://127.0.0.1:8099';
    const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
    const b = await chromium.launch({ executablePath: EXE, headless: true, args: ARGS });
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, timezoneId: 'Asia/Tokyo' });
    await ctx.route('**/*', route => {
        route.request().url().startsWith(BASE) ? route.continue() : route.abort();
    });
    const p = await ctx.newPage();
    await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForFunction(() => typeof glMap === 'object' && glMap !== null, { timeout: 10000 });
    await p.waitForTimeout(400);

    // V2: 初期状態=チェックあり(未選択)・レイヤ未生成・ピッチ0
    {
        const r = await p.evaluate(() => ({
            chk: !!document.getElementById('gl-bldg3d-chk'),
            checked: document.getElementById('gl-bldg3d-chk') && document.getElementById('gl-bldg3d-chk').checked,
            layer: !!glMap.getLayer('bldg-3d'), pitch: glMap.getPitch() }));
        check('V2 初期状態: レイヤーリストに「3D風ビル」チェック(オフ)・レイヤ未生成・ピッチ0',
            r.chk && r.checked === false && r.layer === false && r.pitch === 0, JSON.stringify(r));
    }

    // V3: ONでレイヤ生成+可視+ピッチ60へ。OFFで不可視+ピッチ0へ(チェックのclickで実操作)
    {
        await p.evaluate(() => { const el = document.getElementById('gl-bldg3d-chk'); el.checked = true; el.dispatchEvent(new Event('change')); });
        await p.waitForFunction(() => glMap.getPitch() === 60, { timeout: 5000 }).catch(() => {});   // easeTo完了(600ms)をポーリングで待つ
        const on = await p.evaluate(() => ({ layer: !!glMap.getLayer('bldg-3d'),
            vis: glMap.getLayoutProperty('bldg-3d', 'visibility'), pitch: glMap.getPitch(),
            src: !!glMap.getSource('gsi-bvmap') }));
        check('V3 ON: fill-extrusionレイヤ生成+visible+ピッチ60°+ベクトルソース登録',
            on.layer && on.vis === 'visible' && on.pitch === 60 && on.src, JSON.stringify(on));
        await p.evaluate(() => { const el = document.getElementById('gl-bldg3d-chk'); el.checked = false; el.dispatchEvent(new Event('change')); });
        await p.waitForFunction(() => glMap.getPitch() === 0, { timeout: 5000 }).catch(() => {});   // easeTo完了(600ms)をポーリングで待つ
        const off = await p.evaluate(() => ({ vis: glMap.getLayoutProperty('bldg-3d', 'visibility'), pitch: glMap.getPitch() }));
        check('V3 OFF: レイヤ不可視+ピッチ0へ復帰', off.vis === 'none' && off.pitch === 0, JSON.stringify(off));
    }
    check('V4 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
