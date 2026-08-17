// 第63ラウンド検証: v1.58.0 ①不具合修正=辻メッシュ結果コントロールの精度フィルタで0件
// (メッシュの精度記号は◎×2〜◎×128があるため、◎チェックとの単純一致で全行落ちていた→◎クラスへ正規化)
// ②結果コントロール内の時間フィルタ群/水平線の中央寄せ ③最大ズーム+2(派生ズームは実効値維持)
// ④観測点名/目的点名の既定名(東京タワー/富士山。既定座標に一致する間は自動で入る)
// ⑤「前後時間指定」改名・表示タイル数上限300・Myセット「複製」
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');
const html = fs.readFileSync(path.join(path.dirname(target), 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(path.dirname(target), 'style.css'), 'utf8');

// ---- V0: 版数(存在検査。版数ピンは最新のverify142に集約) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.58.0の行がある', src.includes('Version 1.58.0 - '));

// ---- V1: 静的な形 ----
check('V1 メッシュ精度フィルタは◎クラスへ正規化して判定', src.includes("const symClass = symbol.startsWith('◎') ? '◎' : symbol;"));
const body = src.replace(/^[\s\S]*?\*\//, '');   // 冒頭のVersion History(改名の経緯を書く場所)を除いた本体で数える
check('V1 「前後時刻指定」は0箇所・「前後時間指定」が2箇所(辻検索系+My辻の生成器。冒頭コメントは除外)',
    !body.includes('前後時刻指定') && !html.includes('前後時刻指定') && (body.match(/前後時間指定/g) || []).length === 2);
check('V1 表示タイル数の上限(既定値表+正規化[表のmax参照へ一元化: 第64]+スライダー2箇所+ヘルプ。上限値は第65で500へ=最新ピンはverify143)',
    /smBldgTiles: \{ def: 30, min: 1, max: \d+/.test(src) && src.includes('Math.min(APP_DEFAULTS.smBldgTiles.max, parseInt(el.value)') &&
    (html.match(/bldg-tiles" class="sora-slider" min="1" max="500"/g) || []).length === 2 && html.includes('(1〜500。'));
check('V1 Myセットのボタンは「複製」(確認文・自動命名も複製へ)',
    html.includes('id="btn-myset-copy" class="nav-btn main-btn" title="選択中のMyセットを複製します">複製</button>') &&
    src.includes('を複製しますか') && src.includes('の複製`'));
check('V1 最大ズーム+2(_glZoom(20))+メッシュ初期ズームは実効値維持(-3→-5)',
    src.includes('maxZoom: _glZoom(20)') && src.includes('mapAdapter.getMaxZoom() - 5'));
check('V1 結果コントロール内の時間フィルタ群/水平線の中央寄せCSS',
    css.includes('#tsujires-ctrl-body .tsuji-time-group, #tsujimesh-ctrl-body .tsuji-time-group { max-width: 360px;') &&
    css.includes('#tsujires-ctrl-body hr.tsujisearch-separator, #tsujimesh-ctrl-body hr.tsujisearch-separator { max-width: 360px;'));

// ---- V2: ヘッダコメントの守り(常設の網) ----
// Version Historyの文中にコメント終端の2文字を書くとブロックコメントが早閉じしてscript.js全体が
// 壊れる(第40・第62で2回発生)。node --checkを忘れても、ここで名前つきで露見するようにする。
// 最古のVersion 1.0.0の行は履歴の最下段から動かないため、これを終端より前に見つけられれば無事。
check('V2 冒頭コメントが最古のVersion 1.0.0まで閉じずに続く(文中の終端2文字で早閉じしていない)',
    src.slice(0, src.indexOf('*/')).includes('Version 1.0.0 - '));

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

    // W1: 既定名(初期表示=東京タワー/富士山・座標移動で空白・既定座標へ戻すと再表示=Hom/推山リセット相当)
    {
        const r = await p.evaluate(() => {
            const out = {};
            out.initStart = document.getElementById('input-start-name').value;
            out.initEnd = document.getElementById('input-end-name').value;
            appState.start = { lat: 36.0, lng: 138.0, elev: 0 };
            updateAll();
            out.movedStart = document.getElementById('input-start-name').value;
            appState.start = { lat: DEFAULT_START.lat, lng: DEFAULT_START.lng, elev: DEFAULT_START.elev + DEFAULT_START.height };
            appState.startApiElev = DEFAULT_START.elev; appState.startHeight = DEFAULT_START.height;
            updateAll();
            out.backStart = document.getElementById('input-start-name').value;
            return out;
        });
        check('W1 初期表示の観測点名/目的点名=東京タワー/富士山', r.initStart === '東京タワー' && r.initEnd === '富士山', JSON.stringify(r));
        check('W1 座標移動で空白→既定座標へ戻すと再び東京タワー(Hom/推山リセット相当)',
            r.movedStart === '' && r.backStart === '東京タワー', JSON.stringify(r));
    }

    // W2: 不具合修正の実挙動 — 高精度(◎×N)行がスナップショット(◎チェック)で落ちない
    {
        const r = await p.evaluate(async () => {
            const obs = { lat: 35.5, lng: 138.8, elev: 900 };
            const t0 = new Date(2026, 6, 19, 10, 0, 0);
            const aobs = new Astronomy.Observer(obs.lat, obs.lng, obs.elev);
            const eq = Astronomy.Equator('Sun', t0, aobs, true, true);
            const hor = Astronomy.Horizon(t0, aobs, eq.ra, eq.dec, null);
            const N = 2;
            _tsujiMeshCalc = {
                baseAz: Float64Array.from([hor.azimuth + 0.001, hor.azimuth + 0.05]),
                baseAlt: Float64Array.from([hor.altitude, hor.altitude]),
                dE: new Float64Array(N), dN: new Float64Array(N), tanLat: Math.tan(obs.lat * Math.PI / 180),
                offsetAz: 0, offsetAlt: 0, centerMode: 'point',
                observerData: obs, refractionEnabled: false,
                minAlt: hor.altitude, maxAlt: hor.altitude,
                binSize: 360, nBins: 1, binIndex: Uint32Array.from([0, N]), binPixels: Uint32Array.from([0, 1]),
            };
            _tsujiMeshPix = { lat: [35.501, 35.502], lng: [138.801, 138.802], elev: [900, 910] };
            const sun = appState.bodies.find(bo => bo.id === 'Sun');
            // bestDist=0.001 → 精度記号は◎×N(高精度)になる合成イベント
            const ev = { bestPix: 0, bestTimeMs: t0.getTime(), bestDist: 0.001, bestAz: hor.azimuth, bestAlt: hor.altitude,
                pixIdx: Uint32Array.from([0]), pixTime: Float64Array.from([t0.getTime()]),
                pixDist: Float32Array.from([0.001]), total: 1, capped: false, dayIdx: 0 };
            const allBodyEvents = [{ body: sun, events: [ev] }];
            // 検索メニューのスナップショット(◎=常時オン)と同じF → 修正前は0行・修正後は1行
            const snapF = _resCtlFromAppState('tsujiMesh');
            const built = _tmBuildRows(allBodyEvents, snapF, null, false);
            const sym = built.rows.length ? built.rows[0].symbol : '';
            // ○だけを許可すると◎×Nの行は落ちる(クラス判定の負の検査)
            const circF = { ..._resCtlAllOff(), accuracyFilter: true, accCircle: true };
            const built2 = _tmBuildRows(allBodyEvents, circF, null, false);
            return { n: built.rows.length, sym, n2: built2.rows.length };
        });
        check('W2 スナップショット(◎チェック)で◎×Nの行が残る(修正前は0件だった)',
            r.n === 1 && /^◎×\d+$/.test(r.sym), JSON.stringify(r));
        check('W2 ○のみ許可では◎×Nの行は落ちる(クラス判定の負の検査)', r.n2 === 0, `n2=${r.n2}`);
    }

    // W3: 最大ズーム+2の実測+メッシュ初期ズームの実効値維持
    {
        const r = await p.evaluate(() => ({ maxZ: mapAdapter.getMaxZoom() }));
        check('W3 地図の最大ズームが+2(=20)', r.maxZ === 20, `maxZ=${r.maxZ}`);
    }

    // W4: 中央寄せの実測(時間フィルタ群の実効幅=360px以下・中央)
    {
        const r = await p.evaluate(() => {
            const body = document.getElementById('tsujires-ctrl-body');
            body.classList.remove('hidden');
            document.getElementById('tsujires-ctrl').classList.remove('hidden');
            const grp = body.querySelector('.tsuji-time-group');
            const cs = getComputedStyle(grp);
            return { maxW: cs.maxWidth, mAuto: cs.marginLeft === cs.marginRight };
        });
        check('W4 コントロール内の時間フィルタ群はmax-width:360px+中央寄せ', r.maxW === '360px' && r.mAuto, JSON.stringify(r));
    }

    check('W5 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
