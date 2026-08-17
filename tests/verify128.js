// 第50ラウンド検証: PLATEAU建物レイヤPoC「都市モード」(v1.45.0)。
// - 合成Dracoフィクスチャ(tests/data/plateau-fixture/=既知座標・既知高さの箱ビル2棟。
//   実データと同じ b3dm→glb→Draco+CESIUM_RTC 構造。routeモックで配信)を使い、
//   変換連鎖(楕円体高→ジオイド補正→ENU→見かけ高さ)を数値で表明する。
// - UI: メニュー/ctrlの「:都市モード」「:テクスチャ」(初期値オン)・双方向連動・
//   ON/OFF・扇の向きの追従・整備都市外の表示・localStorage保存。
// - Dracoデコーダはvendor/draco/(sync-apptestがgstatic参照を書き換え)。実ネットワークは遮断。
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// ---- P0: 版数ピン(最新のverifyに集約) ----
check('P0 APP_VERSIONが存在(版数ピンは最新のverifyに集約)', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) || !!process.argv[2]);
check('P0 Version Historyに最新版の行がある', /Version \d+\.\d+\.\d+ - /.test(src) || !!process.argv[2]);

// ---- P1: ソース静的検査(対応表の読込口・出典) ----
// (対応表そのものの内容リントは第51ラウンドで全国化に伴いverify129へ移設)
check('P1 全国対応表の読込口(SM_BLDG_CITIES_URL=data/plateau-bldg-cities.json)',
    src.includes("SM_BLDG_CITIES_URL = 'data/plateau-bldg-cities.json'") && /function _smBldgLoadCities\(/.test(src));
check('P1 ヘルプにPLATEAU出典(CC BY 4.0)とDraco明記', (() => {
    const html = fs.readFileSync(path.join(path.dirname(target), 'index.html'), 'utf8');
    return html.includes('Project PLATEAU') && html.includes('CC BY 4.0') && html.includes('Draco');
})());

// ============================================================
// ブラウザ検査: フィクスチャで変換連鎖+UI連動の実挙動
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
        if (u.startsWith(BASE + '/__pf/')) {   // フィクスチャ配信(ローカル完結のまま3D Tilesを模す)
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
    await p.waitForTimeout(400);

    // P2: 既定値(初期値オンは依頼者決定)とUIの存在
    {
        const r = await p.evaluate(() => ({
            smBldg: appState.smBldg, smBldgTex: appState.smBldgTex,
            menu: [...['chk-sora-bldg', 'chk-sora-bldg-tex', 'chk-sora-ctrl-bldg', 'chk-sora-ctrl-bldg-tex']
                .map(id => { const el = document.getElementById(id); return el ? el.checked : null; })],
            status: !!document.getElementById('sora-bldg-status') && !!document.getElementById('sora-ctrl-bldg-status'),
        }));
        check('P2 既定値: smBldg=true・smBldgTex=true', r.smBldg === true && r.smBldgTex === true);
        check('P2 メニュー/ctrlの4チェックが存在し初期チェック済み+状況表示span', r.menu.every(v => v === true) && r.status, JSON.stringify(r.menu));
    }

    // P3: フィクスチャ読込(観測点35,138・北向き) → 1タイル/2棟が現れる
    await p.evaluate(() => {
        window._smSyntheticElev = () => 0;   // 実DEMを遮断(地形は平ら)
        // 日時を正午へ固定(第64ラウンド: 夜に回すと第54の窓明かりが単色ビルへ窓テクスチャを
        // 貼るため、P4/P5のテクスチャ有無の期待が崩れる。実行時刻に依存しないように固定する)
        appState.currentDate = new Date('2026-08-02T12:00:00+09:00');
        window._smBldgCities = [{ code: 'FX', name: 'fixture', bbox: [137.99, 34.99, 138.01, 35.01],
            lod1: location.origin + '/__pf/tileset.json',
            lod2NoTex: location.origin + '/__pf/tileset.json',
            lod2Tex: location.origin + '/__pf/tileset.json' }];
        appState.start = { lat: 35.0, lng: 138.0, elev: 0 };
        appState.end = { lat: 35.0045, lng: 138.0, elev: 0 };
        appState.soraBaseAz = 0; appState.soraOffsetAz = 0; appState.soraBaseAlt = 0;
        if (!appState.isSoramadoActive) toggleSoramado();
    });
    await p.waitForFunction(() => document.getElementById('sora-bldg-status').textContent === '1タイル/2棟', { timeout: 20000 })
        .catch(() => {});
    {
        const r = await p.evaluate(() => ({ st: document.getElementById('sora-bldg-status').textContent,
            stc: document.getElementById('sora-ctrl-bldg-status').textContent, n: _smBldgGrp ? _smBldgGrp.children.length : -1 }));
        check('P3 フィクスチャ読込: 状況表示「1タイル/2棟」(メニュー/ctrl両方)', r.st === '1タイル/2棟' && r.stc === '1タイル/2棟', JSON.stringify(r));
        check('P3 シーンにタイルグループ1件', r.n === 1, `children=${r.n}`);
    }

    // P4: 変換連鎖の数値 — アプリの基準関数 calculateApparentAltitude との一致を表明。
    // (建物の頂点は「同じ地点・同じ標高について視高度計算が言う位置」に置かれること。
    //  地形・辻検索と同じ世界に座る=本PoCの本質。素朴な z≈標高 とは緯度別局所半径差の分
    //  [約0.0032·d。地形コードに「3kmで約10m」と明記の効果]だけ意図的にずれる)
    {
        const r = await p.evaluate(() => {
            const out = { boxes: [], corners: [] };
            _smBldgGrp.children[0].children.forEach(m => {
                const pos = m.geometry.getAttribute('position');
                let zmin = 1e9, zmax = -1e9, ymin = 1e9, ymax = -1e9, xmax = 0;
                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
                    zmin = Math.min(zmin, z); zmax = Math.max(zmax, z);
                    ymin = Math.min(ymin, y); ymax = Math.max(ymax, y);
                    xmax = Math.max(xmax, Math.abs(x));
                }
                out.boxes.push({ tex: !!m.material.map, zmin, zmax, ymin, ymax, xmax, verts: pos.count });
            });
            // フィクスチャの既知コーナー(箱A頂部NE=標高100m・箱B頂部NE=標高200m)の期待位置
            for (const c of [{ name: 'A頂部', lat: 35.0049, lng: 138.00044, msl: 100 },
                             { name: 'B頂部', lat: 35.0074, lng: 138.00122, msl: 200 }]) {
                const inv = geodesic.Geodesic.WGS84.Inverse(35.0, 138.0, c.lat, c.lng);
                const altDeg = calculateApparentAltitude(inv.s12, 0, c.msl, 35.0, c.lat);
                const exp = { x: inv.s12 * Math.sin(inv.azi1 * Math.PI / 180),
                              y: inv.s12 * Math.cos(inv.azi1 * Math.PI / 180),
                              z: inv.s12 * Math.tan(altDeg * Math.PI / 180) };
                let best = 1e9;
                _smBldgGrp.children[0].children.forEach(m => {
                    const pos = m.geometry.getAttribute('position');
                    for (let i = 0; i < pos.count; i++) {
                        best = Math.min(best, Math.hypot(pos.getX(i) - exp.x, pos.getY(i) - exp.y, pos.getZ(i) - exp.z));
                    }
                });
                out.corners.push({ name: c.name, best, z: exp.z.toFixed(2) });
            }
            return out;
        });
        const boxA = r.boxes.find(b => !b.tex), boxB = r.boxes.find(b => b.tex);
        check('P4 プリミティブ2件=無テクスチャ(箱A)+テクスチャ付き(箱B)', r.boxes.length === 2 && !!boxA && !!boxB, JSON.stringify(r.boxes.map(b => b.tex)));
        check('P4 箱A頂部(標高100m)がアプリ基準の視高度位置と一致(±0.15m)', r.corners[0].best < 0.15,
            `ずれ=${r.corners[0].best.toFixed(3)}m 期待z=${r.corners[0].z}`);
        check('P4 箱B頂部(標高200m・テクスチャ側)も一致(±0.15m)', r.corners[1].best < 0.15,
            `ずれ=${r.corners[1].best.toFixed(3)}m 期待z=${r.corners[1].z}`);
        check('P4 箱A: 高さスパン≈100m・北≈455〜545m・東西|x|≤60m(ENU配置)',
            boxA && Math.abs((boxA.zmax - boxA.zmin) - 100) < 1 && boxA.ymin > 440 && boxA.ymax < 560 && boxA.xmax < 60,
            boxA && `span=${(boxA.zmax - boxA.zmin).toFixed(2)} y=[${boxA.ymin.toFixed(1)}, ${boxA.ymax.toFixed(1)}] |x|max=${boxA.xmax.toFixed(1)}`);
    }

    // P5: テクスチャOFF(ctrl側クリック→メニュー側へ連動+テクスチャ無しで再構築)
    {
        await p.evaluate(() => { const el = document.getElementById('chk-sora-ctrl-bldg-tex'); el.checked = false; el.dispatchEvent(new Event('change')); });
        await p.waitForFunction(() => document.getElementById('sora-bldg-status').textContent === '1タイル/2棟' &&
            _smBldgGrp.children.length === 1 && _smBldgGrp.children[0].children.every(m => !m.material.map), { timeout: 15000 }).catch(() => {});
        const r = await p.evaluate(() => ({ tex: appState.smBldgTex, menuChk: document.getElementById('chk-sora-bldg-tex').checked,
            maps: _smBldgGrp.children.length ? _smBldgGrp.children[0].children.map(m => !!m.material.map) : null }));
        check('P5 テクスチャOFF: ctrl→メニュー連動+全プリミティブが単色(頂点色)へ', r.tex === false && r.menuChk === false && r.maps && r.maps.every(v => !v), JSON.stringify(r));
    }

    // P6: 都市モードOFF(メニュー側)→消灯+状況クリア+ctrl連動。ONで復帰(キャッシュ経路)
    {
        await p.evaluate(() => { const el = document.getElementById('chk-sora-bldg'); el.checked = false; el.dispatchEvent(new Event('change')); });
        await p.waitForTimeout(200);
        const off = await p.evaluate(() => ({ n: _smBldgGrp.children.length, st: document.getElementById('sora-bldg-status').textContent,
            ctrlChk: document.getElementById('chk-sora-ctrl-bldg').checked }));
        check('P6 都市モードOFF: シーンから消え状況表示は空・ctrl側も連動OFF', off.n === 0 && off.st === '' && off.ctrlChk === false, JSON.stringify(off));
        await p.evaluate(() => { const el = document.getElementById('chk-sora-bldg'); el.checked = true; el.dispatchEvent(new Event('change')); });
        await p.waitForFunction(() => _smBldgGrp.children.length === 1, { timeout: 15000 }).catch(() => {});
        const on = await p.evaluate(() => _smBldgGrp.children.length);
        check('P6 都市モードON復帰: 幾何キャッシュから再表示', on === 1, `children=${on}`);
    }

    // P7: 扇の向きの追従(南向き=建物は視野外→0タイル。北へ戻すと復帰)
    {
        await p.evaluate(() => { appState.soraOffsetAz = 180; _smBldgUpdate(); });
        await p.waitForFunction(() => document.getElementById('sora-bldg-status').textContent === '0タイル/0棟', { timeout: 10000 }).catch(() => {});
        const south = await p.evaluate(() => ({ st: document.getElementById('sora-bldg-status').textContent, n: _smBldgGrp.children.length }));
        check('P7 南向き: 扇に入らず0タイル/0棟', south.st === '0タイル/0棟' && south.n === 0, JSON.stringify(south));
        await p.evaluate(() => { appState.soraOffsetAz = 0; _smBldgUpdate(); });
        await p.waitForFunction(() => _smBldgGrp.children.length === 1, { timeout: 10000 }).catch(() => {});
        check('P7 北へ戻すと復帰', await p.evaluate(() => _smBldgGrp.children.length === 1));
    }

    // P8: 整備都市外(対応表bboxの外へ観測点を移動)
    {
        await p.evaluate(() => { appState.start = { lat: 36.5, lng: 140.0, elev: 0 }; _smBldgUpdate(); });
        await p.waitForFunction(() => document.getElementById('sora-bldg-status').textContent === '整備都市外', { timeout: 10000 }).catch(() => {});
        const r = await p.evaluate(() => ({ st: document.getElementById('sora-bldg-status').textContent, n: _smBldgGrp.children.length }));
        check('P8 整備都市外の表示(エラーにしない)+シーンは空', r.st === '整備都市外' && r.n === 0, JSON.stringify(r));
    }

    // P9: localStorage保存往復(smBldg/smBldgTex)
    {
        const r = await p.evaluate(() => {
            appState.smBldg = true; appState.smBldgTex = false; saveAppState();
            const saved = JSON.parse(localStorage.getItem('soranotsuji_app'));
            return { s1: saved.smBldg, s2: saved.smBldgTex };
        });
        check('P9 localStorage保存にsmBldg/smBldgTexが乗る', r.s1 === true && r.s2 === false, JSON.stringify(r));
    }

    check('P10 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
