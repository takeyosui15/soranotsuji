// 第64ラウンド検証: v1.59.0 前ラウンドのフィードバック4件
// ①辻メッシュ結果コントロールの精度フィルタ=検索メニューと同じ読み取り専用固定(オン/◎オン/○△-オフ)
// ②観測点の初期値=東京タワー展望台の理想位置(依頼者実測の座標。地面標高は旧位置と同じ18.5m)
// ③Hom/推山リセットで既定名が入らない不具合の修正(座標が既定値のまま=変化なしのリセット経路)
// ④表示タイル数300が150で頭打ちになる不具合の修正(予算計算の旧上限Math.min(150)の残置+LRU 160→320)
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');
const html = fs.readFileSync(path.join(path.dirname(target), 'index.html'), 'utf8');

// ---- V0: 版数(存在検査。版数ピンは最新のverify143に集約) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.59.0の行がある', src.includes('Version 1.59.0 - '));

// ---- V1: 静的な形 ----
check('V1 タイル予算の上限が既定値表のmaxを参照(二重定義の一元化)+LRU上限あり(値のピンは最新のverify143へ=第65で520)',
    src.includes('Math.min(APP_DEFAULTS.smBldgTiles.max, Math.round(Number(appState.smBldgTiles)') && /SM_BLDG_CACHE_MAX = \d+/.test(src));
check('V1 メッシュのスナップショットFは精度を固定値で持つ(appState参照をやめた)',
    src.includes('F.accDblCircle = true; F.accCircle = false;'));
check('V1 index.html: メッシュ結果コントロールの精度フィルタと◎がchecked+disabled',
    html.includes('id="chk-tsujimeshres-acc-filter" class="body-checkbox" checked disabled') &&
    html.includes('id="chk-tsujimeshres-acc-dbl-circle" class="body-checkbox" checked disabled'));
check('V1 既定名の経路: 座標一致の自動記入(_locNameApplyDefaultIfHome)+リセットはセットで(第65から_locNameSet)',
    src.includes('function _locNameApplyDefaultIfHome(side)') && src.includes('_locNameSet(type, def.name, def)'));

// ============================================================
// ブラウザ検査
// ============================================================
(async () => {
    const { chromium } = require('playwright-core');
    const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
    const BASE = 'http://127.0.0.1:8099';
    const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
    const b = await chromium.launch({ executablePath: EXE, headless: true, args: ARGS });
    const ctx = await b.newContext({ viewport: { width: 900, height: 900 }, timezoneId: 'Asia/Tokyo' });
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

    // W1: 新初期値(展望台の理想位置)+初期表示の既定名
    {
        const r = await p.evaluate(() => ({
            lat: appState.start.lat, lng: appState.start.lng,
            name: document.getElementById('input-start-name').value,
        }));
        check('W1 起動時の観測点=展望台の理想位置+観測点名=東京タワー',
            r.lat === 35.6585309298041 && r.lng === 139.74538790268673 && r.name === '東京タワー', JSON.stringify(r));
    }

    // W2: 不具合③の再現手順 — 座標が既定値のまま名前を消してHom/推山リセット→既定名が入り直す
    {
        await p.fill('#input-start-name', '');
        await p.fill('#input-start-latlng', '');
        await p.click('#btn-reg-start');
        await p.waitForTimeout(300);
        const startName = await p.evaluate(() => document.getElementById('input-start-name').value);
        check('W2 座標が既定値のままのHomリセットでも観測点名=東京タワー(修正前は空のままだった)',
            startName === '東京タワー', `name=${JSON.stringify(startName)}`);
        await p.fill('#input-end-name', '');
        await p.fill('#input-end-latlng', '');
        await p.click('#btn-reg-end');
        await p.waitForTimeout(300);
        const endName = await p.evaluate(() => document.getElementById('input-end-name').value);
        check('W2 推山リセットでも目的点名=富士山', endName === '富士山', `name=${JSON.stringify(endName)}`);
    }

    // W3: 移動→リセットの従来経路も健在(第63のW1相当の回帰)
    {
        const r = await p.evaluate(() => {
            appState.start = { lat: 36.0, lng: 138.0, elev: 0 };
            updateAll();
            const moved = document.getElementById('input-start-name').value;
            return { moved };
        });
        await p.fill('#input-start-latlng', '');
        await p.click('#btn-reg-start');
        await p.waitForTimeout(300);
        const back = await p.evaluate(() => document.getElementById('input-start-name').value);
        check('W3 座標移動で空白→Homリセットで東京タワー(従来経路の回帰)',
            r.moved === '' && back === '東京タワー', JSON.stringify({ moved: r.moved, back }));
    }

    // W4: メッシュ結果コントロールの精度フィルタ=読み取り専用固定
    {
        const read = () => p.evaluate(() => {
            const g = (id) => { const el = document.getElementById(id); return el ? `${el.checked ? 1 : 0}${el.disabled ? 'd' : '-'}` : 'x'; };
            return {
                filter: g('chk-tsujimeshres-acc-filter'), dbl: g('chk-tsujimeshres-acc-dbl-circle'),
                circle: g('chk-tsujimeshres-acc-circle'), tri: g('chk-tsujimeshres-acc-triangle'), dash: g('chk-tsujimeshres-acc-dash'),
            };
        });
        const fresh = await read();
        const fixedOk = (s) => s.filter === '1d' && s.dbl === '1d' && s.circle === '0d' && s.tri === '0d' && s.dash === '0d';
        check('W4 初期状態: 精度フィルタ=オン読専・◎=オン読専・○△-=オフ読専', fixedOk(fresh), JSON.stringify(fresh));
        // スナップショット展開(全オフFを渡しても)固定が保たれ、読み値も◎のみ
        const after = await p.evaluate(() => {
            _resCtlSet('tsujimeshres', _resCtlAllOff(), false);
            const F = _resCtlRead('tsujimeshres');
            return { acc: F.accuracyFilter, dbl: F.accDblCircle, cir: F.accCircle };
        });
        const after2 = await read();
        check('W4 全オフFを展開しても固定のまま+読み値は精度=オン/◎=オン/○=オフ',
            fixedOk(after2) && after.acc === true && after.dbl === true && after.cir === false, JSON.stringify({ after, after2 }));
    }

    // W5: 表示タイル数300が予算(fanKey)まで通る(修正前は|150に頭打ち)
    {
        const r = await p.evaluate(async () => {
            if (!appState.isSoramadoActive) toggleSoramado();
            await new Promise(res => setTimeout(res, 300));
            const el = document.getElementById('input-sora-bldg-tiles');
            el.value = '300'; el.dispatchEvent(new Event('input'));
            await new Promise(res => setTimeout(res, 400));
            return { tiles: appState.smBldgTiles, key300: _smBldgFanKey.endsWith('|300'), key: _smBldgFanKey.split('|').pop() };
        });
        check('W5 スライダー300→appState=300+タイル予算(fanKey末尾)も300(修正前は150で頭打ち)',
            r.tiles === 300 && r.key300, JSON.stringify(r));
    }

    check('W6 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
