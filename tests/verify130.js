// 第52ラウンド検証: 都市モードの遠景対応+夜馴染み(v1.47.0)。依頼者の実機フィードバック3件:
// - 観測点初期値(東京タワー)を建物の外へ(都市モードで初期画面が壁になる問題)
// - 都市ビルの奥行き上限200km(霞ヶ浦→ダイヤモンド富士+都心シルエット)+
//   タイル予算の配り方=「見かけの高さ順」+都市単位の扇プレフィルタ
// - 建物の太陽高度減光(昼1.0↔夜0.26。日時変更は材質色のみ追従=幾何再構築なし)
// フィクスチャはverify128と同じ合成Draco(tests/data/plateau-fixture/)。実ネットワークは遮断。
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// ---- R0: 版数ピン(最新のverifyに集約) ----
check('R0 APP_VERSIONが存在(版数ピンは最新のverifyに集約)', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) || !!process.argv[2]);
check('R0 Version Historyに最新版の行がある', /Version \d+\.\d+\.\d+ - /.test(src) || !!process.argv[2]);

// ---- R1: ソース静的検査 ----
check('R1 観測点の初期値=東京タワーの展望台の理想位置(35.6585309298041, 139.74538790268673。第64で建物の外→展望台・第65で名前もセットに)',
    src.includes("DEFAULT_START = { name: '東京タワー', lat: 35.6585309298041, lng: 139.74538790268673, elev: 18.5, height: 150.0 }"));
check('R1 都市ビルの奥行き上限200km', src.includes('SM_BLDG_RANGE_CAP_KM = 200'));
check('R1 URL短縮辞書v13は凍結のまま(初期値変更で_QP_KEYDEFS_V13に旧/新座標ペアが無い)',
    !src.includes("'&startLat=") && !src.includes("'&startLng="));

// ============================================================
// ブラウザ検査: 初期値・純関数(減光/スコア/扇足切り)・フィクスチャで減光の実挙動
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

    // R2: 起動時の観測点=新初期値(start.elevはAPI標高18.5+高さ150=168.5の合成値)
    {
        const r = await p.evaluate(() => ({ lat: appState.start.lat, lng: appState.start.lng,
            api: appState.startApiElev, elev: appState.start.elev }));
        check('R2 起動時のappState.start=新初期値(API標高18.5は実測同値・elev=18.5+高さ150)',
            r.lat === 35.6585309298041 && r.lng === 139.74538790268673 && r.api === 18.5 && r.elev === 168.5, JSON.stringify(r));
    }

    // R3: 純関数の性質
    {
        const r = await p.evaluate(() => {
            // 第54ラウンドで夜の底が月連動(_smBldgNightFloor)になったため、ここでは床0.26を明示指定して性質を検査
            const day = _smBldgSunDim(10, 0.26), night = _smBldgSunDim(-10, 0.26), mid = _smBldgSunDim(0, 0.26);
            // スコア: 都庁タイル(高さ幅211m)@65km vs 低い街(10m)@5km — 遠くの高層が勝つこと
            const tall = _smBldgTileScore({ minH: 40, maxH: 251 }, 65000);
            const low = _smBldgTileScore({ minH: 0, maxH: 10 }, 5000);
            const nearClamp = _smBldgTileScore({ minH: 0, maxH: 10 }, 1);   // 50m未満は50mでクランプ
            // 扇足切り: 観測点が都市の中=真 / 真後ろの都市=偽 / 扇内の遠い都市=真
            const ctx1 = { oLat: 35.0, oLng: 138.0, centerAz: 0, rangeKm: 200 };
            const inside = _smBldgCityInFan({ bbox: [137.9, 34.9, 138.1, 35.1] }, ctx1, 40);
            const behind = _smBldgCityInFan({ bbox: [137.95, 34.20, 138.05, 34.30] }, ctx1, 40);   // 南≈80km
            const ahead = _smBldgCityInFan({ bbox: [137.95, 35.70, 138.05, 35.80] }, ctx1, 40);    // 北≈80km
            return { day, night, mid, tall, low, nearClamp, inside, behind, ahead };
        });
        check('R3 減光: 昼(+10°)=1.0・夜(-10°)=0.26床(青寄り)・薄明(0°)は中間',
            r.day[2] === 1 && Math.abs(r.night[2] - 0.26) < 1e-9 && r.night[0] < r.night[2] &&
            r.mid[2] > r.night[2] && r.mid[2] < r.day[2],
            `day=${r.day.map(v => v.toFixed(2))} night=${r.night.map(v => v.toFixed(3))} mid=${r.mid[2].toFixed(3)}`);
        check('R3 スコア: 都心の高層@65kmが低い街@5kmに勝つ(見かけの高さ順)+近距離50mクランプ',
            r.tall > r.low && r.nearClamp === 10 / 50, `tall=${r.tall.toFixed(4)} low=${r.low.toFixed(4)}`);
        check('R3 都市の扇足切り: 中=真/真後ろ=偽/扇内遠方=真', r.inside === true && r.behind === false && r.ahead === true,
            JSON.stringify([r.inside, r.behind, r.ahead]));
    }

    // R4: フィクスチャで減光の実挙動(正午→材質1.0・真夜中→0.26。幾何は同一参照のまま)
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
            const geo0 = _smBldgGrp.children[0].children[0].geometry.uuid;
            appState.currentDate = new Date('2026-08-02T12:00:00+09:00');   // 正午
            _smBldgUpdate();
            out.noon = _smBldgGrp.children[0].children.map(m => m.material.color.b);
            appState.currentDate = new Date('2026-08-02T00:00:00+09:00');   // 真夜中
            _smBldgUpdate();
            // 第54ラウンドから夜の底は月連動([0.15,0.32])+単色ビルは窓明かりへ切替(詳細はverify132)
            const photo = _smBldgGrp.children[0].children.find(m => !m.userData.smBldgWin);
            out.nightPhotoB = photo.material.color.b;
            out.sameGeo = _smBldgGrp.children[0].children[0].geometry.uuid === geo0;   // 幾何は作り直していない
            return out;
        });
        check('R4 正午=減光なし(1.0)→真夜中=月連動の底[0.15,0.32]へ。幾何は同一参照のまま材質だけ追従',
            r.noon.every(v => v === 1) && r.nightPhotoB >= 0.15 - 1e-9 && r.nightPhotoB <= 0.32 + 1e-9 && r.sameGeo,
            `noon=${r.noon} nightPhotoB=${r.nightPhotoB.toFixed(3)} sameGeo=${r.sameGeo}`);
    }
    check('R5 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
