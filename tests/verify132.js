// 第54ラウンド検証: 夜の磨き(月連動の夜の底+窓明かり)+リファクタリングB第2弾①(v1.49.0)。
// - 夜の底: _smBldgNightFloor(月なし0.15〜満月が高い夜0.32。輝面比×月高度/30°クランプ)。
// - 窓明かり: 単色ビル(無テクスチャ面)は夜に窓格子タイルへ切替(壁面UV=水平接線×標高の3mピッチ・
//   屋根は消灯セル)。テクスチャ=航空写真ビルは減光のみ。
// - リファクタリング第1弾: 重複地図の最上位2組(_makeElevAtPix15 1184ch×2 / _makeRiseSetForDay 706ch×2)の
//   関数化 — 無いことのテストで再増殖を検知。
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// ---- T0: 版数ピン(最新のverifyに集約) ----
check('T0 APP_VERSIONが存在(版数ピンは最新のverifyに集約)', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) || !!process.argv[2]);
check('T0 Version Historyに最新版の行がある', /Version \d+\.\d+\.\d+ - /.test(src) || !!process.argv[2]);

// ---- T1: リファクタリングB第2弾①の無いことのテスト(重複の再増殖検知) ----
{
    const c1 = (src.match(/const key = \(gx >> 8\) \* 32768 \+ \(gy >> 8\);/g) || []).length;
    check('T1 z15標高チェーンの実体は_makeElevAtPix15の1箇所のみ', c1 === 1, `count=${c1}`);
    const c2 = (src.match(/riseSetCache/g) || []).length;
    check('T1 riseSetCacheの独自実装は0(キャッシュは_makeRiseSetForDayが所有)', c2 === 0, `count=${c2}`);
    const c3 = (src.match(/_makeElevAtPix15\(/g) || []).length;
    const c4 = (src.match(/_makeRiseSetForDay\(/g) || []).length;
    check('T1 工場関数は定義1+呼出2(elevAtPix15/riseSetForDay共に3箇所)', c3 === 3 && c4 === 3, `elev=${c3} rise=${c4}`);
}

// ============================================================
// ブラウザ検査: 夜の底の純関数+フィクスチャで窓明かりの実挙動
// ============================================================
(async () => {
    const { chromium } = require('playwright-core');
    const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
    const BASE = 'http://127.0.0.1:8099';
    const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
    const b = await chromium.launch({ executablePath: EXE, headless: true, args: ARGS });
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, timezoneId: 'Asia/Tokyo' });
    const FIX = path.join(__dirname, 'data', 'plateau-fixture');
    await ctx.route('**/*', route => {
        const u = route.request().url();
        if (u.startsWith(BASE + '/__pf/')) {
            const rel = u.slice((BASE + '/__pf/').length).split('?')[0];
            const fp = path.join(FIX, rel);
            if (fs.existsSync(fp)) route.fulfill({ status: 200, contentType: rel.endsWith('.json') ? 'application/json' : 'application/octet-stream', body: fs.readFileSync(fp) });
            else route.fulfill({ status: 404, body: 'nf' });
            return;
        }
        u.startsWith(BASE) ? route.continue() : route.abort();
    });
    const p = await ctx.newPage();
    await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForFunction(() => typeof glMap === 'object' && glMap !== null, { timeout: 10000 });
    await p.waitForTimeout(300);

    // T2: 夜の底の純関数の性質
    {
        const r = await p.evaluate(() => ({
            noMoon: _smBldgNightFloor(-5, 1),          // 月が沈んでいれば輝面比に依らず0.15
            fullHigh: _smBldgNightFloor(60, 1),        // 満月が高い夜=0.32(高度30°で頭打ち)
            halfMid: _smBldgNightFloor(15, 1),         // 高度15°=持ち上げ半分
            fracHalf: _smBldgNightFloor(60, 0.5),      // 輝面比50%=持ち上げ半分
        }));
        check('T2 夜の底: 月なし0.15・満月が高い夜0.32・高度/輝面比で比例',
            Math.abs(r.noMoon - 0.15) < 1e-9 && Math.abs(r.fullHigh - 0.32) < 1e-9 &&
            Math.abs(r.halfMid - 0.235) < 1e-9 && Math.abs(r.fracHalf - 0.235) < 1e-9, JSON.stringify(r));
    }

    // T3/T4: フィクスチャで窓明かり切替+月連動の床の配線
    await p.evaluate(() => {
        window._smSyntheticElev = () => 0;
        window._smBldgCities = [{ code: 'FX', name: 'fixture', bbox: [137.99, 34.99, 138.01, 35.01],
            lod1: location.origin + '/__pf/tileset.json',
            lod2NoTex: location.origin + '/__pf/tileset.json',
            lod2Tex: location.origin + '/__pf/tileset.json' }];
        appState.start = { lat: 35.0, lng: 138.0, elev: 0 };
        appState.end = { lat: 35.0045, lng: 138.0, elev: 0 };
        appState.soraBaseAz = 0; appState.soraOffsetAz = 0; appState.soraBaseAlt = 0;
        if (!appState.isSoramadoActive) toggleSoramado();
    });
    await p.waitForFunction(() => document.getElementById('sora-bldg-status').textContent === '1タイル/2棟', { timeout: 20000 }).catch(() => {});
    {
        const r = await p.evaluate(() => {
            const out = {};
            const meshes = _smBldgGrp.children[0].children;
            const untex = meshes.find(m => m.userData.smBldgWin), photo = meshes.find(m => !m.userData.smBldgWin);
            appState.currentDate = new Date('2026-08-02T12:00:00+09:00');   // 正午
            _smBldgUpdate();
            out.noonUntexMap = !!untex.material.map;
            out.noonB = [untex.material.color.b, photo.material.color.b];
            appState.currentDate = new Date('2026-08-02T00:30:00+09:00');   // 真夜中
            _smBldgUpdate();
            out.nightUntexMap = !!untex.material.map;
            out.nightPhotoMapIsPhoto = !!photo.material.map && photo.material.map !== untex.material.map;
            out.hasWinUv = !!untex.geometry.getAttribute('uv');
            out.floor = _smBldgMoonNight();
            out.nightPhotoB = photo.material.color.b;
            out.untexBrighter = untex.material.color.b > photo.material.color.b;   // 窓明かりで単色ビルは床より明るい
            return out;
        });
        check('T3 窓明かり: 正午=窓タイルなし(色1.0)→夜=単色ビルだけ窓タイルON+壁面UVあり',
            !r.noonUntexMap && r.noonB.every(v => v === 1) && r.nightUntexMap && r.hasWinUv && r.nightPhotoMapIsPhoto,
            JSON.stringify({ noon: r.noonUntexMap, night: r.nightUntexMap, uv: r.hasWinUv }));
        check('T4 月連動の床: 写真ビルの夜の暗さ=_smBldgMoonNight()と一致([0.15,0.32])+窓明かり側はそれより明るい',
            Math.abs(r.nightPhotoB - r.floor) < 1e-6 && r.floor >= 0.15 - 1e-9 && r.floor <= 0.32 + 1e-9 && r.untexBrighter,
            `floor=${r.floor.toFixed(3)} photoB=${r.nightPhotoB.toFixed(3)}`);
    }
    check('T5 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
