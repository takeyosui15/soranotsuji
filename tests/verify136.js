// 第58ラウンド検証: v1.53.0 ①地図マーカーのポップアップが開かない同類バグの一網打尽
// (_glAddMarkerへ「クリックで必ず開く」を一般化。観測点/目的点/My観測点/My目的点で実挙動を検査)
// ②辻検索/辻メッシュ/My辻検索の結果出力へ「検索中心」(point/line)列を追加(デッサン03/04/10)。
//   画面=視半径の右、File=共通CSV65→66列。
//   (第58時点はメッシュ画素リストのみ対象外だったが、第59ラウンドのデッサン04訂正で全表対象へ。
//    S2は「4表全てに列あり」へ意図更新済み。画素リストのE2Eはverify137のB3)
// 列数ピンの更新はverify96(T2)/verify98(V3/V5)側。ここでは列の位置と値を検査する。
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// ---- S0: 版数ピン(最新のverifyに集約。第59ラウンドでverify137へ移管) ----
check('S0 APP_VERSIONが存在する', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('S0 Version Historyに1.53.0の行がある', src.includes('Version 1.53.0 - ') || !!process.argv[2]);

// ---- S1: 共通CSVヘッダ(辻検索/辻メッシュ/My辻検索のFile出力が共用) ----
check('S1 共通CSVヘッダは視半径→検索中心→検索中心方位角差の順',
    src.includes("'方位角','視高度','視半径','検索中心','検索中心方位角差','検索中心視高度差',"));

// ---- S2: 画面テーブルの列(第59ラウンドでメッシュ画素リストにも追加=デッサン04訂正。4表全てにあり) ----
{
    const n = (src.match(/<th>検索中心<\/th>/g) || []).length;
    check('S2 <th>検索中心</th>は4箇所(辻検索・My辻・メッシュ詳細・メッシュ画素リスト)', n === 4, `n=${n}`);
    // 視半径の直右(辻検索・My辻・メッシュ画素リストは文字列連結なしでこの並びが現れる)
    const m = (src.match(/<th>視半径<\/th><th>検索中心<\/th><th>検索中心方位角差<\/th>/g) || []).length;
    check('S2 辻検索・My辻・メッシュ画素リストのtheadで視半径の直右に検索中心', m === 3, `m=${m}`);
    // メッシュ詳細は行を跨ぐため単体で(直前の定数が視半径で終わることはL8806前後の連結順で保証)
    check('S2 メッシュ詳細theadに検索中心→検索中心方位角差',
        src.includes("'<th>検索中心</th><th>検索中心方位角差</th>"));
    // 視半径→検索中心方位角差の直結thead(列の入れ忘れ)が残っていないこと
    const noCol = (src.match(/<th>視半径<\/th><th>検索中心方位角差<\/th>/g) || []).length;
    check('S2 視半径→検索中心方位角差の直結theadは0箇所(全表に列あり)', noCol === 0, `n=${noCol}`);
    // 旧データ耐性: centerMode未定義はpoint扱いで表示(My辻の行描画・メッシュ詳細の正規化)
    check('S2 centerMode未定義はpoint扱い(My辻セル+メッシュ詳細ctrMode正規化)',
        src.includes("r.tsuji.centerMode === 'line' ? 'line' : 'point'") &&
        src.includes("ctrMode: C ? (C.centerMode === 'line' ? 'line' : 'point') : '-'"));
}

// ---- S3: マーカー修正の形(一般化+観測点個別対応の撤去+優辻ピンは独自経路のまま) ----
{
    const n = (src.match(/if \(!pp\.isOpen\(\)\) mk\.togglePopup\(\)/g) || []).length;
    check('S3 「クリックで必ず開く」が_glAddMarkerのピン型/div型の2箇所に一般化', n === 2, `n=${n}`);
    check('S3 優辻ピンは独自のクリック→ポップアップ経路のまま(回帰なし)',
        src.includes("el.addEventListener('click', () => _tmShowPinPopup(big))"));
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
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, timezoneId: 'Asia/Tokyo' });
    await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
        route.request().url().startsWith(BASE) ? route.continue() : route.abort();
    });
    const p = await ctx.newPage();
    await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForFunction(() => typeof glMap === 'object' && glMap !== null && !!_glLocMarkers, { timeout: 10000 });
    await p.waitForTimeout(400);

    // B1: マーカーポップアップの実挙動(観測点/目的点/My観測点/My目的点の4種が「クリックで開く」)
    {
        const r = await p.evaluate(async () => {
            const sleep = (ms) => new Promise(res => setTimeout(res, ms));
            const clickAndCheck = async (mk) => {
                mk.getElement().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                await sleep(80);   // 「必ず開く」はsetTimeout(0)経由
                const pp = mk.getPopup();
                const open = !!pp && pp.isOpen();
                const html = open ? (pp.getElement() ? pp.getElement().innerHTML : '') : '';
                if (open) mk.togglePopup();   // 次のマーカーのために閉じる
                return { open, html };
            };
            const out = {};
            out.obs = await clickAndCheck(_glLocMarkers.obs);
            out.tgt = await clickAndCheck(_glLocMarkers.tgt);
            // My観測点/My目的点を1件ずつ作ってマーカー再構築
            appState.myObservations = [{ id: 1, name: 'テスト観測点', lat: 36.0, lng: 138.0, elev: 100, height: 2 }];
            appState.myTargets = [{ id: 1, name: 'テスト目的点', lat: 36.1, lng: 138.1, elev: 200, height: 0 }];
            glUpdateMyPointMarkers();
            const mks = _glMarkerGroups['mypoint'] || [];
            out.myCount = mks.length;
            out.myObs = await clickAndCheck(mks[0]);
            out.myTgt = await clickAndCheck(mks[1]);
            return out;
        });
        check('B1 観測点マーカー: クリックでポップアップが開く(緯度〜相手高度)',
            r.obs.open && r.obs.html.includes('緯度') && r.obs.html.includes('相手高度'), `open=${r.obs.open}`);
        check('B1 目的点マーカー: クリックでポップアップが開く(今回の不具合本体)',
            r.tgt.open && r.tgt.html.includes('目的点') && r.tgt.html.includes('相手高度'), `open=${r.tgt.open}`);
        check('B1 My観測点マーカー: クリックでポップアップが開く(同類)',
            r.myCount === 2 && r.myObs.open && r.myObs.html.includes('My観測点'), `n=${r.myCount} open=${r.myObs.open}`);
        check('B1 My目的点マーカー: クリックでポップアップが開く(同類)',
            r.myTgt.open && r.myTgt.html.includes('My目的点'), `open=${r.myTgt.open}`);
    }

    // B2: 辻検索(画面)E2E — 検索中心列の位置と値(point→lineの切替も実検索で確認)
    {
        const run = async () => await p.evaluate(async () => {
            appState.start = { lat: 36.2919, lng: 137.7811, elev: 1500 };
            appState.startApiElev = 1500; appState.startHeight = 0;
            appState.end = { lat: 36.342, lng: 137.647, elev: 3180 };
            appState.endApiElev = 3180; appState.endHeight = 0;
            appState.tsujiSearchBaseAz = 290; appState.tsujiSearchBaseAlt = 5;
            appState.tsujiSearchOffsetAz = 0; appState.tsujiSearchOffsetAlt = 0;
            appState.tsujiSearchToleranceAz = 180; appState.tsujiSearchToleranceAlt = 90;   // 必ずヒットする広さ
            appState.tsujiSearchDays = 2;
            appState.tsujiMoonFilterEnabled = false; appState.tsujiAccuracyFilterEnabled = false;
            appState.tsujiElevationOption = false; appState.tsujiTimeFilter = false;
            appState.bodies.forEach(bo => bo.visible = (bo.id === 'Moon'));
            await startTsujiSearch();
            const table = document.querySelector('#tsujisearch-content table');
            if (!table) return { ok: false };
            const ths = [...table.querySelectorAll('thead th')].map(th => th.textContent);
            const iCtr = ths.indexOf('検索中心'), iAngR = ths.indexOf('視半径');
            const cells = [...table.querySelectorAll('tbody tr.td-data-row')].map(tr => tr.children[iCtr] ? tr.children[iCtr].textContent : '');
            return { ok: true, iCtr, iAngR, nTh: ths.length, rows: cells.length, vals: [...new Set(cells)] };
        });
        const r1 = await run();
        check('B2 辻検索(画面): theadの視半径の右が検索中心(23列)',
            r1.ok && r1.iCtr === r1.iAngR + 1 && r1.nTh === 23, JSON.stringify({ iCtr: r1.iCtr, iAngR: r1.iAngR, nTh: r1.nTh }));
        check('B2 辻検索(画面): 全行の検索中心=point(既定)', r1.ok && r1.rows >= 1 && r1.vals.join(',') === 'point',
            `rows=${r1.rows} vals=${r1.vals}`);
        await p.evaluate(() => { appState.tsujiCenterMode = 'line'; });
        const r2 = await run();
        check('B2 辻検索(画面): 検索中心=lineで再検索→全行line', r2.ok && r2.rows >= 1 && r2.vals.join(',') === 'line',
            `rows=${r2.rows} vals=${r2.vals}`);
        await p.evaluate(() => { appState.tsujiCenterMode = 'point'; });
    }

    // B3: 共通CSV(File出力の行ビルダー)— 検索中心の位置と値(line/未定義=point)
    {
        const r = await p.evaluate(async () => {
            const mkRow = (centerMode) => ({
                tsuji: { id: 'T1', name: 'test', memo: '', baseAz: 100, baseAlt: 5, offsetAz: 0, offsetAlt: 0,
                         ...(centerMode !== undefined ? { centerMode } : {}), mwOffsetAngle: 0 },
                obs: { id: 'O1', name: 'obs', lat: 35.5, lng: 138.8, elev: 900, height: 1.5, memo: '' },
                tgt: { id: 'G1', name: 'tgt', lat: 35.3606, lng: 138.7274, elev: 3776, height: 0, memo: '' },
                body: appState.bodies.find(bo => bo.id === 'Moon') || { id: 'Moon', name: '月' },
                time: new Date(2026, 6, 20, 21, 30, 0), azimuth: 100.5, altitude: 5.5, dist: 0.02,
                symbol: '◎', moonAge: 7.7, moonIcon: '🌓', moonIllum: 55.5, timeCategory: '夜', elevationStatus: '-' });
            let captured = null;
            const origCreate = URL.createObjectURL, origClick = HTMLAnchorElement.prototype.click;
            URL.createObjectURL = (blob) => { captured = blob; return 'blob:test'; };
            HTMLAnchorElement.prototype.click = function () {};
            try { await downloadTsujiResultCsv([mkRow('line'), mkRow(undefined)], 't.csv'); }
            finally { URL.createObjectURL = origCreate; HTMLAnchorElement.prototype.click = origClick; }
            const text = await captured.text();
            const lines = text.replace(/^﻿/, '').split('\r\n').filter(l => l.length);
            const head = lines[0].split(',');
            const iCtr = head.indexOf('検索中心'), iAngR = head.indexOf('視半径');
            return { iCtr, iAngR, nCols: head.length,
                     v1: lines[1].split(',')[iCtr], v2: lines[2].split(',')[iCtr] };
        });
        check('B3 共通CSV: 視半径の右に検索中心(66列)', r.iCtr === r.iAngR + 1 && r.nCols === 66, JSON.stringify(r));
        check('B3 共通CSV: centerMode=line→line・未定義→point(旧データ耐性)', r.v1 === 'line' && r.v2 === 'point',
            `v1=${r.v1} v2=${r.v2}`);
    }

    check('B4 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
