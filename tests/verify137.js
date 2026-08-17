// 第59〜60ラウンド検証: v1.54.0〜 依頼者フィードバック
// ①辻マーカー上のホバーでも詳細リストを連動(従来はメッシュマーカーのみ)
// ②詳細リスト行クリック後の優辻マーカー: 第59の「同座標なら前面(1100)へ」は第60で撤回(依頼者判断:
//   観測点マーカーを選択できなくなる)。訂正後の定義=ジャンプでは強制配置せず、ピンは
//   「その辻時刻での最良画素」(argmin=観測点とは別の場所)に立てる。zIndexは常に900。
// ③「行選択後オプション」→「行選択後表示オプション」ラベル(ヘルプ2箇所も)
// ④メッシュ画素リスト(一覧側)にも「検索中心」列(デッサン04訂正。verify136のS2は4表へ意図更新済み)
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');
const html = fs.readFileSync(path.join(path.dirname(target), 'index.html'), 'utf8');

// ---- T0: 版数ピン(最新のverifyに集約。第60ラウンドでverify138へ移管) ----
check('T0 APP_VERSIONが存在する', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('T0 Version Historyに1.54.0の行がある', src.includes('Version 1.54.0 - ') || !!process.argv[2]);

// ---- T1: 静的な配線 ----
check('T1 画素リストの行データにcenterMode(検索の選択値を正規化して保持)',
    src.includes("centerMode: _tsujiMeshCalc.centerMode === 'line' ? 'line' : 'point',"));
{
    // 「行選択後オプション」は旧称0(「行選択後表示オプション」は部分文字列でないため単純countで判定できる)。
    // script.jsは冒頭のVersion History(改名の履歴として旧称に言及)を除いて数える(verify98 V0と同じ流儀)
    const body = src.replace(/^[\s\S]*?\*\//, '');
    const oldN = (html.match(/行選択後オプション/g) || []).length + (body.match(/行選択後オプション/g) || []).length;
    const newN = (html.match(/行選択後表示オプション/g) || []).length;
    check('T1 ラベル改名: 旧称「行選択後オプション」=0・新称がindex.htmlに存在', oldN === 0 && newN >= 2, `old=${oldN} new=${newN}`);
}
{
    // handleTsujiMeshGoldHover: 辻マーカー分岐とメッシュマーカー分岐の両方に詳細リスト連動がある
    const fn = src.slice(src.indexOf('function handleTsujiMeshGoldHover'), src.indexOf('function selectTsujiMeshRow'));
    const n = (fn.match(/_tmUpdateDetailList\(/g) || []).length;
    check('T1 ホバーの詳細リスト連動が辻マーカー/メッシュマーカーの2分岐にある', n === 2, `n=${n}`);
}
{
    // 第60ラウンドの訂正: ジャンプでの強制配置と_tmSyncPinZ(前面化)は撤回(無いことのテスト)。
    // 冒頭のVersion History(経緯として旧名に言及)は除いて数える(ラベル検査と同じ流儀)
    const body = src.replace(/^[\s\S]*?\*\//, '');
    check('T1 ジャンプの強制配置は撤回(jump.pixでの_tmForcedPin代入なし)', !body.includes('_tmForcedPin = { pix: jump.pix'));
    check('T1 _tmSyncPinZは撤回(0箇所)', !/_tmSyncPinZ/.test(body));
}

// ============================================================
// ブラウザ検査(合成メッシュ4画素: verify98 V3方式+recalc用の最小ビン索引)
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

    // 合成メッシュのセットアップ(以降のB1〜B3で共用)
    await p.evaluate(() => {
        const obs = { lat: 35.5, lng: 138.8, elev: 900 };
        const t0 = new Date(2026, 6, 19, 10, 0, 0);
        const aobs = new Astronomy.Observer(obs.lat, obs.lng, obs.elev);
        const eq = Astronomy.Equator('Sun', t0, aobs, true, true);
        const hor = Astronomy.Horizon(t0, aobs, eq.ra, eq.dec, null);
        const dOff = [0.011, 0.052, 0.201, 0.302];
        const N = 4;
        // 画素1の緯度経度が_tmPixAtLatLngで引けるよう、その地図画素をgxBase/gyBaseに据えた1×1グリッド
        const pixLL = { lat: 35.502, lng: 138.802 };
        const scale = Math.pow(2, TSUJIMESH_ZOOM), R = 128 / Math.PI;
        const gpx = Math.floor(128 * (pixLL.lng / 180 + 1) * scale);
        const gpy = Math.floor((128 - R * Math.atanh(Math.sin(pixLL.lat * Math.PI / 180))) * scale);
        _tsujiMeshCalc = {
            baseAz: Float64Array.from(dOff.map(d => hor.azimuth + d)),
            baseAlt: Float64Array.from(dOff.map(() => hor.altitude)),
            dE: new Float64Array(N), dN: new Float64Array(N), tanLat: Math.tan(obs.lat * Math.PI / 180),
            offsetAz: 0, offsetAlt: 0, centerMode: 'point',
            observerData: obs, refractionEnabled: false,
            minAlt: hor.altitude, maxAlt: hor.altitude,
            binSize: 360, nBins: 1, binIndex: Uint32Array.from([0, N]), binPixels: Uint32Array.from([0, 1, 2, 3]),
            grid: Int32Array.from([2]), gridW: 1, gxBase: gpx, gyBase: gpy,
            bounds: { west: 138.8019, east: 138.8021, north: 35.5021, south: 35.5019 },
        };
        _tsujiMeshPix = { lat: [35.501, 35.502, 35.503, 35.504], lng: [138.801, 138.802, 138.803, 138.804], elev: [900, 910, 920, 930] };
        window._tsujiMeshPixHeightUsed = 1.5;
        window._tsujiMeshLayerVisible = true;
        appState.end = { lat: 35.3606, lng: 138.7274, elev: 3776 };
        const sun = appState.bodies.find(bo => bo.id === 'Sun');
        const disp = (t) => {
            const d = new Date(t);
            return { dateObj: d, dateStr: '2026年07月19日', dowStr: '(日)', timeStr: _tmFmtTimeMs2(t),
                     timeCategory: '昼', sunriseStr: '05:00:00', sunsetStr: '19:00:00',
                     moonriseStr: '10:00:00', moonsetStr: '22:00:00', moonAge: 4.4, moonIcon: '🌒', moonIllum: 20.0,
                     symbol: '◎', elevationStatus: '-', mwOffAngle: 0, angularRadius: 0.262,
                     azDiff: 0, altDiff: 0, centerMode: 'point' };
        };
        const mkRow = (pixIdx, times, dist0) => Object.assign(disp(times[0]), {
            body: sun, dist: dist0,
            pixIdx: Uint32Array.from(pixIdx), pixTime: Float64Array.from(times),
            pixDist: Float32Array.from(pixIdx.map(i => dOff[i])),
            azimuth: hor.azimuth, altitude: hor.altitude });
        window.__t0 = t0.getTime();
        _tsujiMeshRows = [mkRow([2, 0, 1], [t0.getTime(), t0.getTime() + 60e3, t0.getTime() + 120e3], 0.011)];
        drawTsujiMeshMarkers();   // 白マーカー索引(CSR)を構築(詳細リストのデータ源)
    });

    // B1: 詳細リスト行クリック相当のジャンプ → 優辻ピンは定義通り「その辻時刻での最良画素」
    //     (=観測点とは別の場所・zIndex900のまま・観測点マーカーは最前面で選択できる)
    {
        const r = await p.evaluate(async () => {
            const out = {};
            appState.currentDate = new Date(window.__t0 + 60e3);
            syncUIFromState();
            _tmSetObserverToPix(0);
            selectTsujiMeshRow(0, { pix: 0, timeMs: window.__t0 + 60e3, dist: 0.011 });
            await new Promise(res => setTimeout(res, 250));
            out.forcedPin = _tmForcedPin;   // ジャンプでは強制配置しない → null
            const pins = _glMarkerGroups.tmpin || [];
            out.pinCount = pins.length;
            if (pins.length) {
                const ll = pins[0].getLngLat(), oll = _glLocMarkers.obs.getLngLat();
                out.samePos = Math.abs(ll.lat - oll.lat) < 1e-9 && Math.abs(ll.lng - oll.lng) < 1e-9;
                out.pinZ = pins[0].getElement().style.zIndex;
                // 期待argmin: アプリと同じ定義(その時刻の天体位置と各画素の検索中心の角距離が最小の画素)
                const t = new Date(window.__t0 + 60e3);
                const C = _tsujiMeshCalc;
                const aobs = new Astronomy.Observer(C.observerData.lat, C.observerData.lng, C.observerData.elev);
                const eq = Astronomy.Equator('Sun', t, aobs, true, true);
                const hor = Astronomy.Horizon(t, aobs, eq.ra, eq.dec, null);
                const D2R = Math.PI / 180;
                const ang = (az1, alt1, az2, alt2) => Math.acos(Math.max(-1, Math.min(1,
                    Math.sin(alt1 * D2R) * Math.sin(alt2 * D2R) + Math.cos(alt1 * D2R) * Math.cos(alt2 * D2R) * Math.cos((az1 - az2) * D2R)))) / D2R;
                let best = -1, bd = Infinity;
                for (let i = 0; i < C.baseAz.length; i++) {
                    const d = ang(hor.azimuth, hor.altitude, C.baseAz[i], C.baseAlt[i]);
                    if (d < bd) { bd = d; best = i; }
                }
                out.expectPix = best;
                out.pinAtExpect = Math.abs(ll.lat - _tsujiMeshPix.lat[best]) < 1e-9 && Math.abs(ll.lng - _tsujiMeshPix.lng[best]) < 1e-9;
                // 観測点の位置の最前面=観測点マーカー(選択できること=依頼者要件で900のまま)
                const opt = glMap.project([oll.lng, oll.lat]);
                const rect = glMap.getCanvas().getBoundingClientRect();
                const el = document.elementFromPoint(rect.left + opt.x, rect.top + opt.y - 15);
                out.topAtObs = el ? (el.closest('.location-marker') || el).className : null;
            }
            return out;
        });
        check('B1 ジャンプでは強制配置しない(_tmForcedPin=null)+ピンは1本', r.forcedPin === null && r.pinCount === 1, JSON.stringify({ f: r.forcedPin, n: r.pinCount }));
        check('B1 ピンは観測点と別の場所=その辻時刻での最良画素(定義通り)', !r.samePos && r.pinAtExpect, JSON.stringify({ same: r.samePos, exp: r.expectPix }));
        check('B1 ピンのzIndexは900のまま(観測点マーカーの後ろ)', r.pinZ === '900', `z=${r.pinZ}`);
        check('B1 観測点位置の最前面=観測点マーカー(選択できる)', String(r.topAtObs || '').includes('location-marker-observer'), r.topAtObs);
    }

    // B2: 辻マーカー上のホバーで詳細リストが更新される(+確定ポップアップ固定中は更新されない)
    {
        const r = await p.evaluate(async () => {
            const out = {};
            _tsujiMeshGoldSet = new Map([[1, 0.05]]);   // 画素1を辻マーカー集合に
            _glTmGoldShown = true;
            _tmDetailPix = -1;
            _tmDetailLockPopup = null;
            handleTsujiMeshGoldHover({ lat: 35.502, lng: 138.802 });   // 画素1の位置(1×1グリッドで解決)
            await new Promise(res => setTimeout(res, 100));
            out.detailPix = _tmDetailPix;
            out.header = document.getElementById('tsujimesh-detail-header').textContent;
            out.hidden = document.getElementById('tsujimesh-detail').classList.contains('hidden');
            const tip = document.querySelector('.maplibregl-popup-content');
            out.tip = tip ? tip.textContent.slice(0, 30) : '';
            // 確定ポップアップ固定中はホバーで更新しない
            _tmDetailLockPopup = {};   // truthyなら固定扱い(実物のポップアップは不要)
            _tmDetailPix = -1;
            handleTsujiMeshGoldHover({ lat: 35.502, lng: 138.802 });
            out.lockedPix = _tmDetailPix;
            _tmDetailLockPopup = null;
            return out;
        });
        check('B2 辻マーカーのホバーで詳細リストが画素1へ更新(ヘッダに緯度経度)', r.detailPix === 1 && !r.hidden && r.header.includes('35.502'), JSON.stringify({ pix: r.detailPix, h: r.header }));
        check('B2 ツールチップは辻マーカー(対象精度)', r.tip.includes('辻マーカー'), r.tip);
        check('B2 確定ポップアップ固定中はホバーで更新しない', r.lockedPix === -1, `pix=${r.lockedPix}`);
    }

    // B3: メッシュ画素リスト(一覧側)に検索中心列(視半径の右・23列・値はpoint/line)
    {
        const r = await p.evaluate(() => {
            renderTsujiMeshResults();
            const table = document.querySelector('#tsujimesh-content table');
            if (!table) return { ok: false };
            const ths = [...table.querySelectorAll('thead th')].map(th => th.textContent);
            const iCtr = ths.indexOf('検索中心'), iAngR = ths.indexOf('視半径');
            const tr = table.querySelector('tbody tr.td-data-row');
            return { ok: true, iCtr, iAngR, nTh: ths.length, cell: tr ? tr.children[iCtr].textContent : '' };
        });
        check('B3 画素リストのtheadで視半径の右が検索中心(23列)', r.ok && r.iCtr === r.iAngR + 1 && r.nTh === 23, JSON.stringify(r));
        check('B3 画素リストのセル値=point(検索時の選択値)', r.ok && r.cell === 'point', `cell=${r.cell}`);
    }

    check('B4 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
