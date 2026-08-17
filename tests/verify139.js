// 第61ラウンド検証: v1.56.0 ①位置情報の配置(デッサン01確定版) ②標高オプション→標高フィルタ全改名
// ③曜日フィルタ新設(辻検索/辻メッシュ検索メニュー+My辻検索の行フォーム。全結果経路に適用)
// 結果コントロールメニュー(辻検索/辻メッシュ/My辻一括)は次ラウンドの主役(仕様凍結済み)。
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');
const html = fs.readFileSync(path.join(path.dirname(target), 'index.html'), 'utf8');

// ---- W0: 版数ピン(最新のverifyに集約。第62ラウンドでverify140へ移管) ----
check('W0 APP_VERSIONが存在する', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('W0 Version Historyに1.56.0の行がある', src.includes('Version 1.56.0 - ') || !!process.argv[2]);

// ---- W1: 標高オプション→標高フィルタの全改名(本体=Version History除く) ----
{
    const body = src.replace(/^[\s\S]*?\*\//, '');
    const oldN = (html.match(/標高オプション/g) || []).length + (body.match(/標高オプション/g) || []).length;
    check('W1 旧称「標高オプション」=0(ラベル・ヘルプ・コメント・ステータス)', oldN === 0, `old=${oldN}`);
    check('W1 My辻リストCSVヘッダの34列目=標高フィルタ', src.includes(',精度-フィルタ,標高フィルタ,標高OKフィルタ,'));
    check('W1 URLキーは不変(tsujiElevationOption等が辞書に残る)', src.includes("'tsujiElevationOption', 'tsujiElevOK', 'tsujiElevNG'"));
}

// ---- W2: 位置情報の配置(デッサン01確定版) ----
{
    const rowOf = (needle) => { const i = html.indexOf(needle); return html.lastIndexOf('control-row', i); };
    // GPS+radio-startは観測点名の行、辻+radio-endは目的点名の行
    check('W2 GPSボタンとradio-startは観測点名の行', rowOf('id="btn-gps"') === rowOf('id="input-start-name"') &&
        rowOf('id="radio-start"') === rowOf('id="input-start-name"'));
    check('W2 辻ボタンとradio-endは目的点名の行', rowOf('id="btn-dp365"') === rowOf('id="input-end-name"') &&
        rowOf('id="radio-end"') === rowOf('id="input-end-name"'));
    // ボタンは縦に詰めて連続(GPS→Hom→推山→URL→辻→高移)、目的点標高/目的点高の行はボタン無し
    const order = ['btn-gps', 'btn-reg-start', 'btn-reg-end', 'btn-url-location', 'btn-dp365', 'btn-move-peak']
        .map(id => html.indexOf(`id="${id}"`));
    check('W2 ボタンはGPS/Hom/推山/URL/辻/高移の順で縦1列', order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])));
    check('W2 URLボタンは観測点高の行(radio無し)', rowOf('id="btn-url-location"') === rowOf('id="input-start-elev"'));
}

// ---- W3: 曜日フィルタの静的配線 ----
{
    const tsujiN = (html.match(/chk-tsuji-dow-(mon|tue|wed|thu|fri|sat|sun)/g) || []).length;
    const meshN = (html.match(/chk-tsujimesh-dow-(mon|tue|wed|thu|fri|sat|sun)/g) || []).length;
    check('W3 辻検索/辻メッシュメニューに曜日チェック各7個', tsujiN === 7 && meshN === 7, `tsuji=${tsujiN} mesh=${meshN}`);
    check('W3 My辻の行フォームに曜日フィルタ(テンプレート+ハンドラ)',
        src.includes('mytsuji-dow-filter') && src.includes("onChange('mytsuji-dow-' + suf"));
    check('W3 3つの結果経路に適用(辻検索rowData・メッシュ行・My辻decorate)',
        (src.match(/_dowFilterAllows\(/g) || []).length >= 4);   // 定義1+呼出3以上
    check('W3 保存/復元/既定値(tsujiDowFilter/tsujiMeshDowFilterがAPP_DEFAULTSとsaveに存在)',
        src.includes('tsujiDowFilter: { def: false }') && src.includes('tsujiMeshDowFilter: { def: false }') &&
        src.includes('tsujiDowFilter: appState.tsujiDowFilter') && src.includes('tsujiMeshDowFilter: appState.tsujiMeshDowFilter'));
}

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
    await p.waitForFunction(() => typeof glMap === 'object' && glMap !== null, { timeout: 10000 });
    await p.waitForTimeout(400);

    // X1: _dowFilterAllowsの性質(無効=素通し・有効+全未チェック=素通し・有効+土のみ=土だけ)
    {
        const r = await p.evaluate(() => {
            const offF = { dowFilter: false };
            const noneF = { dowFilter: true };
            const satF = { dowFilter: true, dowSat: true };
            return {
                off: [0, 1, 2, 3, 4, 5, 6].every(d => _dowFilterAllows(offF, d)),
                none: [0, 1, 2, 3, 4, 5, 6].every(d => _dowFilterAllows(noneF, d)),
                sat: _dowFilterAllows(satF, 6) && [0, 1, 2, 3, 4, 5].every(d => !_dowFilterAllows(satF, d)),
            };
        });
        check('X1 曜日フィルタの判定(無効/全未チェック=素通し・土のみ=土だけ)', r.off && r.none && r.sat, JSON.stringify(r));
    }

    // X2: 辻検索(画面)E2E — 先頭行の曜日だけ通すと全行がその曜日になる
    {
        const r = await p.evaluate(async () => {
            appState.start = { lat: 36.2919, lng: 137.7811, elev: 1500 };
            appState.startApiElev = 1500; appState.startHeight = 0;
            appState.end = { lat: 36.342, lng: 137.647, elev: 3180 };
            appState.endApiElev = 3180; appState.endHeight = 0;
            appState.tsujiSearchBaseAz = 290; appState.tsujiSearchBaseAlt = 5;
            appState.tsujiSearchOffsetAz = 0; appState.tsujiSearchOffsetAlt = 0;
            appState.tsujiSearchToleranceAz = 180; appState.tsujiSearchToleranceAlt = 90;
            appState.tsujiSearchDays = 8;   // 全曜日を含む期間
            appState.tsujiMoonFilterEnabled = false; appState.tsujiAccuracyFilterEnabled = false;
            appState.tsujiElevationOption = false; appState.tsujiTimeFilter = false;
            appState.tsujiDowFilter = false;
            appState.bodies.forEach(bo => bo.visible = (bo.id === 'Moon'));
            await startTsujiSearch();
            const rows1 = [...document.querySelectorAll('#tsujisearch-content tbody tr.td-data-row')];
            if (!rows1.length) return { ok: false };
            const dowIdx = [...document.querySelectorAll('#tsujisearch-content thead th')].findIndex(th => th.textContent === '曜日');
            const firstDow = rows1[0].children[dowIdx].textContent;   // 例: (日)
            const dowChar = firstDow.replace(/[()]/g, '');
            const keyMap = { '月': 'Mon', '火': 'Tue', '水': 'Wed', '木': 'Thu', '金': 'Fri', '土': 'Sat', '日': 'Sun' };
            appState.tsujiDowFilter = true;
            appState['tsujiDow' + keyMap[dowChar]] = true;
            await startTsujiSearch();
            const rows2 = [...document.querySelectorAll('#tsujisearch-content tbody tr.td-data-row')];
            const allMatch = rows2.every(tr => tr.children[dowIdx].textContent === firstDow);
            // 後片付け
            appState.tsujiDowFilter = false;
            appState['tsujiDow' + keyMap[dowChar]] = false;
            return { ok: true, n1: rows1.length, n2: rows2.length, firstDow, allMatch };
        });
        check('X2 辻検索: 曜日フィルタで指定曜日の行だけになる(件数も減る)',
            r.ok && r.n2 >= 1 && r.n2 < r.n1 && r.allMatch, JSON.stringify(r));
    }

    // X3: My辻検索(decorate経路) — 行の曜日フィルタ設定で絞られる
    {
        const r = await p.evaluate(async () => {
            const mkRes = (time) => ({
                tsuji: { id: 'T1', name: 't', memo: '', baseAz: 100, baseAlt: 5, offsetAz: 0, offsetAlt: 0, centerMode: 'point',
                         mwOffsetAngle: 0, dowFilter: true, dowSat: true },
                obs: { id: 'O1', name: 'o', lat: 35.5, lng: 138.8, elev: 900, height: 0, memo: '' },
                tgt: { id: 'G1', name: 'g', lat: 35.36, lng: 138.72, elev: 3776, height: 0, memo: '' },
                body: appState.bodies.find(bo => bo.id === 'Moon'),
                time, azimuth: 100, altitude: 5, dist: 0.02 });
            // 2026-07-18(土)と2026-07-19(日)
            const decorated = await decorateMyTsujiResults([
                mkRes(new Date(2026, 6, 18, 21, 0, 0)), mkRes(new Date(2026, 6, 19, 21, 0, 0))]);
            return { n: decorated.length, dow: decorated.map(d => d.dowStr).join(',') };
        });
        check('X3 My辻検索: 行の曜日フィルタ(土のみ)で土曜だけ残る', r.n === 1 && r.dow === '(土)', JSON.stringify(r));
    }

    // X4: メニューUIの活性連動(チェックで月〜日が有効化+保存キー)
    {
        const r = await p.evaluate(() => {
            const chk = document.getElementById('chk-tsuji-dow-filter');
            chk.checked = true; chk.dispatchEvent(new Event('change'));
            const enabled = !document.getElementById('chk-tsuji-dow-sat').disabled;
            const sat = document.getElementById('chk-tsuji-dow-sat');
            sat.checked = true; sat.dispatchEvent(new Event('change'));
            const saved = JSON.parse(localStorage.getItem('soranotsuji_app') || '{}');
            const out = { enabled, state: appState.tsujiDowSat, saved: saved.tsujiDowSat };
            chk.checked = false; chk.dispatchEvent(new Event('change'));
            sat.checked = false; sat.dispatchEvent(new Event('change'));
            return out;
        });
        check('X4 メニュー連動: チェックで活性化+appState/localStorageへ保存', r.enabled && r.state === true && r.saved === true, JSON.stringify(r));
    }

    check('X5 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
