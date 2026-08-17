// 第62ラウンド検証: v1.57.0 ①結果コントロールメニュー(辻検索/My辻=共有tsujires・辻メッシュ=tsujimeshres):
//   検索時スナップショットの独立コピー・生結果からの再導出(再検索なし)・File出力
// ②曜日フィルタのURLキー16個+短縮URL辞書v14(v13以前は凍結) ③My辻リストCSV 37→45列(29〜36列目に曜日)
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// ---- T0: 版数(存在検査。版数ピンは最新のverify141に集約) ----
check('T0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('T0 Version Historyに1.57.0の行がある', src.includes('Version 1.57.0 - '));

// ---- T1: URL v14(エンコーダ抽出でラウンドトリップ) ----
{
    const begin = src.indexOf('const _QP_B64');
    const end = src.indexOf('function buildBaseUrl');
    const qp = {};
    new Function('exports', src.slice(begin, end) +
        '\nexports.enc=encodeQueryParam; exports.dec=decodeQueryParam; exports.VERSIONS=_QP_SEED_VERSIONS;')(qp);
    const long = 'mode=tsujisearch&tsujiDowFilter=true&tsujiDowSat=true&tsujiDowSun=false&tsujiMeshDowFilter=true&tsujiMeshDowMon=true';
    const enc = qp.enc(long);
    check('T1 v14辞書: 曜日キー入りURLのenc→decラウンドトリップ', qp.dec(enc) === long && enc.length < long.length,
        `enc=${enc.length} long=${long.length}`);
    check('T1 辞書は15版以上(v14キーは以後の版にも引き継がれる)', qp.VERSIONS.length >= 15, `versions=${qp.VERSIONS.length}`);
}

// ---- T2: 静的な形 ----
check('T2 My辻リストCSVヘッダは28列目の後に曜日8列(29〜36列目。第80で直後に月間13列)',
    src.includes(',終了前後時刻,曜日フィルタ,曜日月フィルタ,曜日火フィルタ,曜日水フィルタ,曜日木フィルタ,曜日金フィルタ,曜日土フィルタ,曜日日フィルタ,月間フィルタ,'));
check('T2 結果コントロールの部品(tsujires/tsujimeshres)がindex.htmlに存在', (() => {
    const html = fs.readFileSync(path.join(path.dirname(target), 'index.html'), 'utf8');
    return ['chk-tsujires-moon-filter', 'chk-tsujires-dow-filter', 'chk-tsujires-elev-filter', 'btn-tsujires-file',
            'chk-tsujimeshres-moon-filter', 'chk-tsujimeshres-dow-filter', 'btn-tsujimeshres-file', 'tsujires-ctrl-header']
        .every(id => html.includes(`id="${id}"`));
})());

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

    // U1: My辻リストCSVの45列ラウンドトリップ+37列旧形式の互換
    {
        const r = await p.evaluate(() => {
            const t = { id: 7, name: 'dowテスト', days: 30, bodyIds: 'Moon', obsId: 1, tgtId: 2, baseAz: 100, baseAlt: 5,
                offsetAz: 0, offsetAlt: 0, toleranceAz: 15, toleranceAlt: 15, centerMode: 'line', mwOffsetAngle: 0,
                moonFilter: false, moonBase: 14.8, moonTolerance: 2,
                timeFilter: false, startMode: 'sunset', startTime: '00:00', startPrePost: false, startPrePostDir: 'before', startOffset: '00:00',
                endMode: 'sunrise', endTime: '00:00', endPrePost: false, endPrePostDir: 'before', endOffset: '00:00',
                dowFilter: true, dowMon: false, dowTue: true, dowWed: false, dowThu: false, dowFri: false, dowSat: true, dowSun: false,
                accuracyFilter: true, accDblCircle: true, accCircle: false, accTriangle: false, accDash: false,
                elevationOption: false, elevOK: false, elevNG: false, memo: 'メモ', checked: true };
            const csv = _buildMyTsujiCsv([t]);
            const lines = csv.split('\r\n').filter(Boolean);
            const head = lines[0].split(',');
            const cols = lines[1].split(',');
            const back = parseMyTsujiCsvLine(cols, 2);
            // 37列旧形式(曜日8列+月間13列=29〜49列目を抜いた形)も読める(既定=オフ)
            const legacy37 = cols.slice(0, 28).concat(cols.slice(49));
            const backOld = parseMyTsujiCsvLine(legacy37, 2);
            return { nCols: cols.length, nHead: head.length, hdr29: head[28], hdr36: head[35], hdr37: head[36],
                dow: back && [back.dowFilter, back.dowTue, back.dowSat, back.dowMon], center: back && back.centerMode,
                acc: back && back.accuracyFilter, memo: back && back.memo,
                oldCols: legacy37.length, oldDow: backOld && backOld.dowFilter, oldAcc: backOld && backOld.accuracyFilter };
        });
        check('U1 58列CSV: 29列目=曜日フィルタ・36列目=曜日日フィルタ・37列目=月間フィルタ(第80で45→58列)',
            r.nCols === 58 && r.nHead === 58 && r.hdr29 === '曜日フィルタ' && r.hdr36 === '曜日日フィルタ' && r.hdr37 === '月間フィルタ', JSON.stringify({ n: r.nCols, h29: r.hdr29, h37: r.hdr37 }));
        check('U1 58列の入出力ラウンドトリップ(曜日・検索中心・精度・メモ)',
            JSON.stringify(r.dow) === '[true,true,true,false]' && r.center === 'line' && r.acc === true && r.memo === 'メモ', JSON.stringify(r.dow));
        check('U1 37列旧形式は曜日既定オフで読める(精度等の後続列はズレない)',
            r.oldCols === 37 && r.oldDow === false && r.oldAcc === true);
    }

    // U2: 辻検索の結果コントロール — スナップショット(独立コピー)+再導出+メニューへ書き戻さない
    {
        const r = await p.evaluate(async () => {
            appState.start = { lat: 36.2919, lng: 137.7811, elev: 1500 };
            appState.startApiElev = 1500; appState.startHeight = 0;
            appState.end = { lat: 36.342, lng: 137.647, elev: 3180 };
            appState.endApiElev = 3180; appState.endHeight = 0;
            appState.tsujiSearchBaseAz = 290; appState.tsujiSearchBaseAlt = 5;
            appState.tsujiSearchOffsetAz = 0; appState.tsujiSearchOffsetAlt = 0;
            appState.tsujiSearchToleranceAz = 180; appState.tsujiSearchToleranceAlt = 90;
            appState.tsujiSearchDays = 8;
            appState.tsujiMoonFilterEnabled = true; appState.tsujiMoonBase = 10; appState.tsujiMoonTolerance = 15;
            appState.tsujiAccuracyFilterEnabled = false; appState.tsujiElevationOption = false;
            appState.tsujiTimeFilter = false; appState.tsujiDowFilter = false;
            appState.bodies.forEach(bo => bo.visible = (bo.id === 'Moon'));
            await startTsujiSearch();
            const out = {};
            out.ctrlShown = !document.getElementById('tsujires-ctrl').classList.contains('hidden');
            out.snapMoon = document.getElementById('chk-tsujires-moon-filter').checked;   // メニュー値のコピー
            out.snapBase = document.getElementById('input-tsujires-moon-base').value;
            const rows1 = document.querySelectorAll('#tsujisearch-content tbody tr.td-data-row').length;
            // コントロールで曜日フィルタ(先頭行の曜日のみ)を適用 → 再導出で行が減る
            const dowIdx = [...document.querySelectorAll('#tsujisearch-content thead th')].findIndex(th => th.textContent === '曜日');
            const firstDow = document.querySelector('#tsujisearch-content tbody tr.td-data-row').children[dowIdx].textContent.replace(/[()]/g, '');
            const sufMap = { '月': 'mon', '火': 'tue', '水': 'wed', '木': 'thu', '金': 'fri', '土': 'sat', '日': 'sun' };
            const dchk = document.getElementById('chk-tsujires-dow-filter');
            dchk.checked = true; dchk.dispatchEvent(new Event('change'));
            const daychk = document.getElementById(`chk-tsujires-dow-${sufMap[firstDow]}`);
            daychk.checked = true; daychk.dispatchEvent(new Event('change'));
            await new Promise(res => setTimeout(res, 200));
            const rows2 = [...document.querySelectorAll('#tsujisearch-content tbody tr.td-data-row')];
            out.rows1 = rows1; out.rows2 = rows2.length;
            out.allMatch = rows2.every(tr => tr.children[dowIdx].textContent.replace(/[()]/g, '') === firstDow);
            out.menuUntouched = appState.tsujiDowFilter === false;   // メニューへ書き戻さない(独立コピー)
            out.statusN = document.getElementById('tsujisearch-status').textContent;
            return out;
        });
        check('U2 検索完了でコントロール表示+メニュー値のスナップショット(月齢on/基準10)',
            r.ctrlShown && r.snapMoon === true && r.snapBase === '10', JSON.stringify({ m: r.snapMoon, b: r.snapBase }));
        check('U2 コントロールの曜日フィルタで再導出(行が減り指定曜日のみ・件数表示追従)',
            r.rows2 >= 1 && r.rows2 < r.rows1 && r.allMatch && r.statusN.includes(`${r.rows2}件`), JSON.stringify({ r1: r.rows1, r2: r.rows2 }));
        check('U2 コントロールの変更はメニューへ書き戻さない(独立コピー)', r.menuUntouched);
    }

    // U3: My辻検索の追加絞り込み(_myTsujiResPass)の性質
    {
        const r = await p.evaluate(() => {
            const mk = (day, sym, moonAge, elev) => ({ time: new Date(2026, 6, 18 + day, 21, 0, 0), symbol: sym, moonAge,
                elevationStatus: elev, tw: null });
            const sat = mk(0, '◎', 10, 'OK');    // 2026-07-18=土
            const sun = mk(1, '○', 20, 'NG');    // 2026-07-19=日
            const off = _resCtlAllOff();
            const dowF = { ...off, dowFilter: true, dowSat: true };
            const accF = { ...off, accuracyFilter: true, accDblCircle: true };
            const moonF = { ...off, moonFilter: true, moonBase: 10, moonTolerance: 2 };
            const elevF = { ...off, elevFilter: true, elevOK: true };
            return {
                allOff: _myTsujiResPass(sat, off) && _myTsujiResPass(sun, off),
                dow: _myTsujiResPass(sat, dowF) && !_myTsujiResPass(sun, dowF),
                acc: _myTsujiResPass(sat, accF) && !_myTsujiResPass(sun, accF),
                moon: _myTsujiResPass(sat, moonF) && !_myTsujiResPass(sun, moonF),
                elev: _myTsujiResPass(sat, elevF) && !_myTsujiResPass(sun, elevF),
            };
        });
        check('U3 My辻の追加絞り込み: 全オフ=素通し・曜日/精度/月齢/標高の各フィルタが効く',
            r.allOff && r.dow && r.acc && r.moon && r.elev, JSON.stringify(r));
    }

    // U4: 辻メッシュの結果コントロール — 合成メッシュで再導出(verify137方式のモック)
    {
        const r = await p.evaluate(async () => {
            const obs = { lat: 35.5, lng: 138.8, elev: 900 };
            const t0 = new Date(2026, 6, 19, 10, 0, 0);   // 2026-07-19=日曜
            const aobs = new Astronomy.Observer(obs.lat, obs.lng, obs.elev);
            const eq = Astronomy.Equator('Sun', t0, aobs, true, true);
            const hor = Astronomy.Horizon(t0, aobs, eq.ra, eq.dec, null);
            const N = 2;
            _tsujiMeshCalc = {
                baseAz: Float64Array.from([hor.azimuth + 0.01, hor.azimuth + 0.05]),
                baseAlt: Float64Array.from([hor.altitude, hor.altitude]),
                dE: new Float64Array(N), dN: new Float64Array(N), tanLat: Math.tan(obs.lat * Math.PI / 180),
                offsetAz: 0, offsetAlt: 0, centerMode: 'point',
                observerData: obs, refractionEnabled: false,
                minAlt: hor.altitude, maxAlt: hor.altitude,
                binSize: 360, nBins: 1, binIndex: Uint32Array.from([0, N]), binPixels: Uint32Array.from([0, 1]),
            };
            _tsujiMeshPix = { lat: [35.501, 35.502], lng: [138.801, 138.802], elev: [900, 910] };
            window._tsujiMeshLayerVisible = true;
            const sun = appState.bodies.find(bo => bo.id === 'Sun');
            const ev = { bestPix: 0, bestTimeMs: t0.getTime(), bestDist: 0.01, bestAz: hor.azimuth, bestAlt: hor.altitude,
                pixIdx: Uint32Array.from([0, 1]), pixTime: Float64Array.from([t0.getTime(), t0.getTime() + 60e3]),
                pixDist: Float32Array.from([0.01, 0.05]), total: 2, capped: false, dayIdx: 0 };
            _tmResRaw = { allBodyEvents: [{ body: sun, events: [ev] }], visFlags: null, elevOn: false };
            _resCtlSet('tsujimeshres', _resCtlAllOff(), false);
            _resCtlReapply('tsujimeshres');
            const out = {};
            out.n1 = _tsujiMeshRows.length;
            out.status1 = document.getElementById('tsujimesh-status').textContent;
            // 曜日フィルタ(土のみ)→ 日曜の行が消える
            const dchk = document.getElementById('chk-tsujimeshres-dow-filter');
            dchk.checked = true; dchk.dispatchEvent(new Event('change'));
            const sat = document.getElementById('chk-tsujimeshres-dow-sat');
            sat.checked = true; sat.dispatchEvent(new Event('change'));
            await new Promise(res => setTimeout(res, 150));
            out.n2 = _tsujiMeshRows.length;
            out.menuUntouched = appState.tsujiMeshDowFilter === false;
            return out;
        });
        check('U4 辻メッシュ: 再導出で1行(合成1イベント)+件数表示', r.n1 === 1 && r.status1.includes('1件'), JSON.stringify(r));
        check('U4 辻メッシュ: コントロールの曜日フィルタで0行に+メニューへ書き戻さない',
            r.n2 === 0 && r.menuUntouched, `n2=${r.n2}`);
    }

    // U5: File出力(tsujires・辻検索モード) — 生結果から再decorateして共通66列CSV
    {
        const r = await p.evaluate(async () => {
            const moon = appState.bodies.find(bo => bo.id === 'Moon');
            _tsujiResRaw = {
                kind: 'tsuji', elevStatus: '-',
                totalResults: [{ body: moon, results: [{ time: new Date(2026, 6, 20, 21, 30, 0), azimuth: 100.5, altitude: 5.5, dist: 0.02 }], limitReached: false }],
                ctx: { observerData: { lat: 35.5, lng: 138.8, elev: 901.5 }, searchCenterMode: 'point',
                    baseAz: 100, baseAlt: 5, offsetAz: 0, offsetAlt: 0, days: 2, mwOffAngle: 0,
                    obs: { id: '', name: '', lat: 35.5, lng: 138.8, elev: 900, height: 1.5, memo: '' },
                    tgt: { id: '', name: '', lat: 35.36, lng: 138.72, elev: 3776, height: 0, memo: '' } },
            };
            _resCtlSet('tsujires', _resCtlAllOff(), false);
            let captured = null;
            const origCreate = URL.createObjectURL, origClick = HTMLAnchorElement.prototype.click;
            URL.createObjectURL = (blob) => { captured = blob; return 'blob:test'; };
            HTMLAnchorElement.prototype.click = function () {};
            try { await _tsujiResFileCsv(); }
            finally { URL.createObjectURL = origCreate; HTMLAnchorElement.prototype.click = origClick; }
            if (!captured) return { ok: false };
            const text = await captured.text();
            const lines = text.replace(/^﻿/, '').split('\r\n').filter(l => l.length);
            return { ok: true, lines: lines.length, nCols: lines[0].split(',').length };
        });
        check('U5 結果コントロールのFile出力: 生結果から共通66列CSV(ヘッダ+1行)', r.ok && r.lines === 2 && r.nCols === 66, JSON.stringify(r));
    }

    check('U6 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
