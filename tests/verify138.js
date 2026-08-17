// 第60ラウンド検証: v1.55.0 ①機能改善3=観測点名/目的点名テキストボックス+My観測点/My目的点の取得ボタン
// (デッサン01/11/12: 名前でジオコーディング→結果が観測点/目的点欄へ・確定座標の間だけ名前保持・
//  他の手段で座標が変われば空白へ・取得ボタンは名前を使う[空白なら新規○○名]・保存しない=毎回空白)
// ②検索エリア(3×3〜6×6)を辻メッシュ検索メニュー側にも追加(デッサン04)。ctrl⇄メニュー双方向連動。
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');
const html = fs.readFileSync(path.join(path.dirname(target), 'index.html'), 'utf8');

// ---- U0: 版数ピン(最新のverifyに集約。第61ラウンドでverify139へ移管) ----
check('U0 APP_VERSIONが存在する', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('U0 Version Historyに1.55.0の行がある', src.includes('Version 1.55.0 - ') || !!process.argv[2]);

// ---- U1: 静的な形 ----
check('U1 観測点名/目的点名の入力欄(プレースホルダー=建物名 地名 住所・150字)',
    /id="input-start-name" placeholder="建物名 地名 住所" maxlength="150"/.test(html) &&
    /id="input-end-name" placeholder="建物名 地名 住所" maxlength="150"/.test(html));
check('U1 名前欄は座標欄の直前の行(観測点名→観測点・目的点名→目的点の順)',
    html.indexOf('input-start-name') < html.indexOf('input-start-latlng') &&
    html.indexOf('input-start-latlng') < html.indexOf('input-end-name') &&
    html.indexOf('input-end-name') < html.indexOf('input-end-latlng'));
check('U1 名前は保存しない(saveAppStateの対象キーにない=appStateに載せていない)',
    !src.includes('startName') && !src.includes('endName'));
check('U1 検索エリアのメニュー側ラジオ(tsujimesh-area-menu ×4)',
    (html.match(/name="tsujimesh-area-menu"/g) || []).length === 4);
check('U1 検索エリアの双方向連動(_tmSyncAreaRadios=定義1+両グループのセレクタ)',
    (src.match(/function _tmSyncAreaRadios\(/g) || []).length === 1 &&
    (src.match(/tsujimesh-area"\], input\[name="tsujimesh-area-menu"/g) || []).length === 2);

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
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForFunction(() => typeof glMap === 'object' && glMap !== null && !!_glLocMarkers, { timeout: 10000 });
    await p.waitForTimeout(400);

    // V1: 観測点名の検索→確定(ジオコーディングはスタブ)→座標反映+名前保持
    {
        const r = await p.evaluate(async () => {
            const out = {};
            window.confirm = () => true; window.alert = (m) => { window.__alert = String(m); };
            // 実ネットワーク遮断環境のため、地名検索は同一形状のスタブに差し替える(候補1件)
            window.searchLocation = async (q) => {
                window.__query = q;
                return [{ title: '東京タワー', address: '東京都港区芝公園', lat: 35.6586, lon: 139.7454 }];
            };
            const nameEl = document.getElementById('input-start-name');
            nameEl.value = '東京タワー';
            nameEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await new Promise(res => setTimeout(res, 200));
            out.pickerShown = !document.getElementById('location-picker').classList.contains('hidden');
            const item = document.querySelector('#picker-list .picker-item');
            out.hasItem = !!item;
            if (item) item.click();
            await new Promise(res => setTimeout(res, 300));
            out.lat = appState.start.lat; out.lng = appState.start.lng;
            out.nameKept = document.getElementById('input-start-name').value;
            out.coordBox = document.getElementById('input-start-latlng').value;
            return out;
        });
        check('V1 観測点名のEnterで検索ダイアログ(スタブ候補1件)', r.pickerShown && r.hasItem);
        check('V1 確定で観測点の座標が設定される(結果が観測点欄へ)',
            Math.abs(r.lat - 35.6586) < 1e-6 && Math.abs(r.lng - 139.7454) < 1e-6 && r.coordBox.includes('35.6586'), JSON.stringify({ lat: r.lat, box: r.coordBox }));
        check('V1 確定した座標の間は観測点名を保持', r.nameKept === '東京タワー', `name=${r.nameKept}`);
    }

    // V2: 観測点取得は観測点名を使う→座標が他の手段で変わると名前は空白へ→空白時の取得は新規観測点名
    {
        const r = await p.evaluate(async () => {
            const out = {};
            appState.myObservations = [];
            document.getElementById('btn-myobs-get').click();
            await new Promise(res => setTimeout(res, 100));
            out.capturedName = appState.myObservations.length ? appState.myObservations[appState.myObservations.length - 1].name : '';
            out.capturedLat = appState.myObservations.length ? appState.myObservations[appState.myObservations.length - 1].lat : null;
            // 座標を地図クリック相当で変更(名前検索以外の手段) → 名前は空白へ戻る(デッサン01の制約)
            appState.start = { lat: 36.0, lng: 138.0, elev: 100 };
            appState.startApiElev = 100; appState.startHeight = 0;
            updateAll();
            out.nameCleared = document.getElementById('input-start-name').value;
            // 空白のまま取得 → 従来通り「新規観測点名」
            document.getElementById('btn-myobs-get').click();
            await new Promise(res => setTimeout(res, 100));
            out.blankName = appState.myObservations[appState.myObservations.length - 1].name;
            return out;
        });
        check('V2 観測点取得: 名前入力中はその名前でMy観測点を追加', r.capturedName === '東京タワー' && Math.abs(r.capturedLat - 35.6586) < 1e-6, JSON.stringify(r));
        check('V2 座標が他の手段で変わると観測点名は空白へ', r.nameCleared === '', `v=${r.nameCleared}`);
        check('V2 空白時の観測点取得は「新規観測点名」', r.blankName === '新規観測点名', `name=${r.blankName}`);
    }

    // V3: 目的点側も同じ(検索確定→名前保持→目的点取得に反映)+入力途中は消えない
    {
        const r = await p.evaluate(async () => {
            const out = {};
            window.searchLocation = async () => [{ title: '富士山', address: '静岡県', lat: 35.3606, lon: 138.7274 }];
            const nameEl = document.getElementById('input-end-name');
            nameEl.value = '富士山';
            nameEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await new Promise(res => setTimeout(res, 200));
            const item = document.querySelector('#picker-list .picker-item');
            if (item) item.click();
            await new Promise(res => setTimeout(res, 300));
            out.lat = appState.end.lat;
            out.nameKept = nameEl.value;
            appState.myTargets = [];
            document.getElementById('btn-mytgt-get').click();
            await new Promise(res => setTimeout(res, 100));
            out.capturedName = appState.myTargets.length ? appState.myTargets[0].name : '';
            // 入力途中(フォーカス中)は座標が変わっても消さない(タイプ中の保護)。
            // 初期状態はパネルがminimized(非表示の入力にはfocusが効かない)ため、開いてから検査する
            document.getElementById('control-panel').classList.remove('minimized');
            const startName = document.getElementById('input-start-name');
            startName.focus();
            startName.value = '入力途中のなまえ';
            appState.start = { lat: 36.5, lng: 137.5, elev: 0 };
            updateAll();
            out.typingKept = startName.value;
            startName.blur(); startName.value = '';
            return out;
        });
        check('V3 目的点名の検索確定→座標反映+名前保持→目的点取得に反映',
            Math.abs(r.lat - 35.3606) < 1e-6 && r.nameKept === '富士山' && r.capturedName === '富士山', JSON.stringify(r));
        check('V3 入力途中(フォーカス中)の名前は座標変更でも消えない', r.typingKept === '入力途中のなまえ', `v=${r.typingKept}`);
    }

    // V4: 検索エリアのメニュー⇄ctrl双方向連動(検索は起動しない状態で)
    {
        const r = await p.evaluate(() => {
            const out = {};
            const menu5 = document.querySelector('input[name="tsujimesh-area-menu"][value="5"]');
            menu5.checked = true; menu5.dispatchEvent(new Event('change'));
            out.areaAfterMenu = _tmSearchArea;
            out.ctrlSynced = document.querySelector('input[name="tsujimesh-area"][value="5"]').checked;
            const ctrl4 = document.querySelector('input[name="tsujimesh-area"][value="4"]');
            ctrl4.checked = true; ctrl4.dispatchEvent(new Event('change'));
            out.areaAfterCtrl = _tmSearchArea;
            out.menuSynced = document.querySelector('input[name="tsujimesh-area-menu"][value="4"]').checked;
            return out;
        });
        check('V4 メニュー側5×5→_tmSearchArea=5+ctrl側も5に連動', r.areaAfterMenu === 5 && r.ctrlSynced, JSON.stringify(r));
        check('V4 ctrl側4×4→_tmSearchArea=4+メニュー側も4に連動', r.areaAfterCtrl === 4 && r.menuSynced);
    }

    check('V5 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
