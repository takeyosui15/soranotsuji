// 第53ラウンド検証: 都市モードの「表示タイル数」スライダー(v1.48.0)。
// - 1〜300(第63ラウンドで上限150→300)・初期値30(第54ラウンドで35→30)は「毎回」=localStorageに保存しない(依頼者指定。スマホで48枚が
//   開けなかった対策 — 大きな値のまま再訪して端末が重くなるのを防ぐ。視界範囲と同じ思想)。
// - 宙の窓メニュー/ctrlメニューの双方向連動。予算はfanKeyに入り変更で再選択される。
// フィクスチャはverify128と同じ合成Draco。実ネットワークは遮断。
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// ---- S0: 版数ピン(最新のverifyに集約) ----
check('S0 APP_VERSIONが存在(版数ピンは最新のverifyに集約)', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) || !!process.argv[2]);
check('S0 Version Historyに最新版の行がある', /Version \d+\.\d+\.\d+ - /.test(src) || !!process.argv[2]);

// ---- S1: ソース静的検査(既定値と「保存しない」の無いことのテスト) ----
check('S1 既定値 smBldgTiles: def30・min1・max500(第54で35→30・第63で上限300・第65で500)', src.includes('smBldgTiles: { def: 30, min: 1, max: 500'));
check('S1 保存対象外(saveAppStateのペイロードと復元リストに現れない)',
    !src.includes('smBldgTiles: appState.smBldgTiles') && !src.includes("'smBldgTiles'"));
check('S1 LRUキャッシュ上限520(スライダー最大500で表示中タイルを追い出さない。第64で160→320・第65で520)', src.includes('SM_BLDG_CACHE_MAX = 520'));

// ============================================================
// ブラウザ検査: 初期値・双方向連動・非保存・正規化・fanKeyへの反映
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

    // S2: 初期値30+スライダー2本の存在(min/max/value)
    {
        const r = await p.evaluate(() => {
            const els = ['input-sora-bldg-tiles', 'input-sora-ctrl-bldg-tiles'].map(id => document.getElementById(id));
            return { st: appState.smBldgTiles,
                sliders: els.map(el => el && { min: el.min, max: el.max, v: el.value }),
                labels: ['sora-bldg-tiles-val', 'sora-ctrl-bldg-tiles-val'].map(id => (document.getElementById(id) || {}).textContent) };
        });
        check('S2 初期値30・スライダー2本(1〜500。第65ラウンドで上限500)・ラベル「30枚」', r.st === 30 &&
            r.sliders.every(s => s && s.min === '1' && s.max === '500' && s.v === '30') &&
            r.labels.every(t => t === '30枚'), JSON.stringify(r));
    }

    // S3: 双方向連動(ctrl側を80へ→メニュー側スライダー/ラベル/appStateが追従)
    {
        const r = await p.evaluate(() => {
            const el = document.getElementById('input-sora-ctrl-bldg-tiles');
            el.value = '80'; el.dispatchEvent(new Event('input'));
            return { st: appState.smBldgTiles, menuV: document.getElementById('input-sora-bldg-tiles').value,
                     menuL: document.getElementById('sora-bldg-tiles-val').textContent };
        });
        check('S3 ctrl→メニュー連動(80枚)', r.st === 80 && r.menuV === '80' && r.menuL === '80枚', JSON.stringify(r));
    }

    // S4: 保存されない(saveAppState後のlocalStorageにキーが無い=「毎回」初期値)
    {
        const r = await p.evaluate(() => {
            saveAppState();
            const saved = JSON.parse(localStorage.getItem('soranotsuji_app'));
            return { has: 'smBldgTiles' in saved, cur: appState.smBldgTiles };
        });
        check('S4 localStorageに保存されない(毎回初期値30で開く)', r.has === false && r.cur === 80, JSON.stringify(r));
    }

    // S5: 正規化(999→300・0→1・ゴミ→既定30)
    {
        const r = await p.evaluate(() => {
            const out = [];
            for (const v of [999, 0, 'garbage']) { appState.smBldgTiles = v; normalizeAppState(); out.push(appState.smBldgTiles); }
            appState.smBldgTiles = 30;
            return out;
        });
        check('S5 正規化: 999→500(第65ラウンドで上限500)・0→1・ゴミ→30', r[0] === 500 && r[1] === 1 && r[2] === 30, JSON.stringify(r));
    }

    // S6: フィクスチャで予算がfanKeyに乗る(変更で再選択が走る)
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
        const r = await p.evaluate(async () => {
            const key30 = _smBldgFanKey;
            const el = document.getElementById('input-sora-bldg-tiles');
            el.value = '1'; el.dispatchEvent(new Event('input'));
            await new Promise(res => setTimeout(res, 400));
            return { key30EndsWith30: key30.endsWith('|30'), key1: _smBldgFanKey.endsWith('|1'),
                     st: document.getElementById('sora-bldg-status').textContent, n: _smBldgGrp.children.length };
        });
        check('S6 予算がfanKeyに乗り(…|30→…|1)、変更で再選択(フィクスチャは1タイルのまま健在)',
            r.key30EndsWith30 && r.key1 && r.st === '1タイル/2棟' && r.n === 1, JSON.stringify(r));
    }
    check('S7 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
