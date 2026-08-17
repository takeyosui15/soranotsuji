// 第65ラウンド検証: v1.60.0
// ①Hom/推山の「セットでリセット」(DEFAULT_START/ENDに名前を持たせ、名前・座標・標高・高さを表から一括)
// ②表示タイル数の上限300→500(LRU520)
// ③「向きの凍結標本」— 辻オフセット方位角の符号規約と検索中心「線」の実挙動を実検索で凍結する。
//   依頼者報告「正負が逆では/線が点と同じでは」の調査で現状が正しいことを実測した(回答その63)。
//   このテストは将来のリファクタで符号や線分判定が反転・退化したら検知するための網。
//   日時は冬(2026-12-01)固定: 冬は太陽が基準方位の低空を横切るため、点と線の差が必ず数値に出る。
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');
const html = fs.readFileSync(path.join(path.dirname(target), 'index.html'), 'utf8');
const dir = path.dirname(target);
const wTsuji = fs.readFileSync(path.join(dir, 'tsuji-search-worker.js'), 'utf8');
const wMesh = fs.readFileSync(path.join(dir, 'tsujimesh-search-worker.js'), 'utf8');

// ---- V0: 版数(存在検査。版数ピンは最新のverify144に集約) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.60.0の行がある', src.includes('Version 1.60.0 - '));

// ---- V1: 静的な形 ----
check('V1 DEFAULT_START/ENDが名前を持つ(セットでリセットの表)',
    src.includes("DEFAULT_START = { name: '東京タワー', lat:") && src.includes("DEFAULT_END = { name: '富士山', lat:"));
check('V1 リセットは名前・座標・標高・高さをセットで(_locNameSetを座標比較なしで呼ぶ)',
    src.includes('_locNameSet(type, def.name, def)') && src.includes('function _locNameSet(side, name, pos)'));
check('V1 表示タイル数の上限500+LRU520', src.includes('smBldgTiles: { def: 30, min: 1, max: 500') &&
    src.includes('SM_BLDG_CACHE_MAX = 520') &&
    (html.match(/bldg-tiles" class="sora-slider" min="1" max="500"/g) || []).length === 2 && html.includes('(1〜500。'));
check('V1 符号規約: 検索中心=基準+オフセット(辻検索/My辻/メッシュworker/検索workerの線分)',
    src.includes('const targetAz = (baseAz + offsetAz + 360) % 360;') &&
    src.includes('const targetAz = ((t.baseAz || 0) + (t.offsetAz || 0) + 360) % 360;') &&
    wMesh.includes('bAz + offsetAz') &&
    wTsuji.includes('segmentMatch(az, alt, centerAz0, centerAlt0, targetAz, targetAlt'));

// ============================================================
// ブラウザ検査
// ============================================================
(async () => {
    const { chromium } = require('playwright-core');
    const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
    const BASE = 'http://127.0.0.1:8099';
    const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
    const b = await chromium.launch({ executablePath: EXE, headless: true, args: ARGS });
    const ctx = await b.newContext({ viewport: { width: 1000, height: 900 }, timezoneId: 'Asia/Tokyo' });
    await ctx.route('**/*', route => route.request().url().startsWith(BASE) ? route.continue() : route.abort());
    const p = await ctx.newPage();
    await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    p.on('dialog', d => d.accept());
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForFunction(() => typeof glMap === 'object' && glMap !== null, { timeout: 10000 });
    await p.waitForTimeout(400);
    await p.evaluate(() => {
        document.getElementById('control-panel').classList.remove('minimized');
        const menu = document.getElementById('location-menu');
        if (menu && menu.classList.contains('hidden')) menu.classList.remove('hidden');
    });

    // W1: セットでリセット — 座標・標高・高さ・名前を汚してからHom/推山で全部が既定値に戻る
    {
        await p.evaluate(() => {
            appState.start = { lat: 36.0, lng: 138.0, elev: 105 };
            appState.startApiElev = 100; appState.startHeight = 5;
            appState.end = { lat: 36.5, lng: 139.5, elev: 200 };
            appState.endApiElev = 200; appState.endHeight = 0;
            updateAll();
        });
        await p.fill('#input-start-latlng', '');
        await p.click('#btn-reg-start');
        await p.waitForTimeout(300);
        await p.fill('#input-end-latlng', '');
        await p.click('#btn-reg-end');
        await p.waitForTimeout(300);
        const r = await p.evaluate(() => ({
            sLat: appState.start.lat, sApi: appState.startApiElev, sH: appState.startHeight,
            sName: document.getElementById('input-start-name').value,
            eLat: appState.end.lat, eApi: appState.endApiElev, eH: appState.endHeight,
            eName: document.getElementById('input-end-name').value,
            defS: DEFAULT_START, defE: DEFAULT_END,
        }));
        check('W1 Homリセット=セットで既定値(座標・標高18.5・高さ150・名前=東京タワー)',
            r.sLat === r.defS.lat && r.sApi === 18.5 && r.sH === 150 && r.sName === '東京タワー', JSON.stringify({ sLat: r.sLat, sApi: r.sApi, sH: r.sH, sName: r.sName }));
        check('W1 推山リセット=セットで既定値(座標・標高3776・高さ0・名前=富士山)',
            r.eLat === r.defE.lat && r.eApi === 3776 && r.eH === 0 && r.eName === '富士山', JSON.stringify({ eLat: r.eLat, eApi: r.eApi, eH: r.eH, eName: r.eName }));
    }

    // W2: 向きの凍結標本(実検索・冬固定・太陽のみ8日・許容15/15)
    {
        const run = (mode, offAz) => p.evaluate(async ({ mode, offAz }) => {
            appState.currentDate = new Date('2026-12-01T09:00:00+09:00');
            appState.bodies.forEach(bo => bo.visible = (bo.id === 'Sun'));
            appState.tsujiSearchDays = 8;
            appState.tsujiSearchOffsetAz = offAz; appState.tsujiSearchOffsetAlt = 0;
            appState.tsujiSearchToleranceAz = 15; appState.tsujiSearchToleranceAlt = 15;
            appState.tsujiCenterMode = mode;
            _tsujiResRaw = null;
            await startTsujiSearch();
            if (!_tsujiResRaw || _tsujiResRaw.kind !== 'tsuji') return { n: 0 };
            const baseAz = _tsujiResRaw.ctx.baseAz;
            const rows = _tsujiResRaw.totalResults[0].results.map(r => ({
                dist: r.dist, azDiff: ((r.azimuth - baseAz + 540) % 360) - 180 }));
            return { n: rows.length, rows };
        }, { mode, offAz });
        const neg = await run('point', -10);
        check('W2 オフセット−10の実検索は基準の左(azDiff≈−10)にヒット=時計回り正の凍結',
            neg.n === 8 && neg.rows.every(r => r.azDiff > -10.6 && r.azDiff < -9.4 && r.dist < 1),
            neg.n ? `azDiff1=${neg.rows[0].azDiff.toFixed(3)} dist1=${neg.rows[0].dist.toFixed(3)}` : 'n=0');
        const pt = await run('point', 10);
        const ln = await run('line', 10);
        check('W2 検索中心「線」は「点」と異なる距離になる(冬の幾何。線への最近点<点への距離)',
            pt.n === 8 && ln.n === 8 && ln.rows[0].dist < pt.rows[0].dist - 1,
            `point1=${pt.n ? pt.rows[0].dist.toFixed(3) : '-'} line1=${ln.n ? ln.rows[0].dist.toFixed(3) : '-'}`);
    }

    // W3: 宙の窓の検索中心×は+オフセットで画面右(NDC x>0)
    {
        const r = await p.evaluate(async () => {
            if (!appState.isSoramadoActive) toggleSoramado();
            await new Promise(res => setTimeout(res, 600));
            appState.soraSearchCenter = true;
            appState.tsujiSearchOffsetAz = 5; appState.tsujiSearchOffsetAlt = 0;
            drawSoramado();
            await new Promise(res => setTimeout(res, 300));
            let x = null;
            _smBodiesGrp.children.forEach(c => {
                if (c.userData.kind === 'searchCenter') { const v = c.position.clone(); v.project(_smCamera); x = v.x; }
            });
            appState.tsujiSearchOffsetAz = 0;
            return { x };
        });
        check('W3 宙の窓: オフセット+5の検索中心×は画面右(NDC x>0)=時計回りが右の凍結', r.x !== null && r.x > 0, `x=${r.x}`);
    }

    // W4: 表示タイル数500がappStateと予算(fanKey)まで通る
    {
        const r = await p.evaluate(async () => {
            const el = document.getElementById('input-sora-bldg-tiles');
            el.value = '500'; el.dispatchEvent(new Event('input'));
            await new Promise(res => setTimeout(res, 400));
            return { tiles: appState.smBldgTiles, key500: _smBldgFanKey.endsWith('|500') };
        });
        check('W4 スライダー500→appState=500+タイル予算(fanKey末尾)も500', r.tiles === 500 && r.key500, JSON.stringify(r));
    }

    check('W5 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
