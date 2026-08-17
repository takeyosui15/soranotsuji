// 第51ラウンド検証: 都市モードの全国化(v1.46.0)= data/plateau-bldg-cities.json の内容リント+読込配線。
// - 静的: 全国対応表(tools/plateau/make-bldg-cities.jsで生成)の形状・値域・網羅の検査。
//   実ネットワークは使わない(表の生成時にtileset root実測済み。ここでは「表が壊れていないこと」を凍結)。
// - ブラウザ: _smBldgLoadCities()が表を読み絶対URL化して返すこと・bboxフィルタが都庁→新宿区を
//   見つけること(routeはローカルのみ。宙の窓は開かない=軽い配線検査)。
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// ---- Q0: 版数ピン(最新のverifyに集約) ----
check('Q0 APP_VERSIONが存在(版数ピンは最新のverifyに集約)', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) || !!process.argv[2]);
check('Q0 Version Historyに最新版の行がある', /Version \d+\.\d+\.\d+ - /.test(src) || !!process.argv[2]);

// ---- Q1: 全国対応表の静的リント ----
{
    const j = JSON.parse(fs.readFileSync(path.join(path.dirname(target), 'data', 'plateau-bldg-cities.json'), 'utf8'));
    check('Q1 base=PLATEAU公式配信(assets.cms.plateau.reearth.io)', j.base === 'https://assets.cms.plateau.reearth.io/assets/', j.base);
    const cs = j.cities || [];
    check('Q1 都市数400件以上(第51ラウンド生成時448件)', cs.length >= 400, `n=${cs.length}`);
    const bad = [];
    const seen = new Set();
    let lod1 = 0, lod2NoTex = 0, lod2Tex = 0;
    for (const c of cs) {
        if (!/^\d{5}$/.test(c.code)) bad.push(c.code + ':code形状');
        if (!c.name) bad.push(c.code + ':name空');
        const b = c.bbox;
        if (!Array.isArray(b) || b.length !== 4 || !(b[0] < b[2] && b[1] < b[3]) ||
            !(122 <= b[0] && b[2] <= 154 && 20 <= b[1] && b[3] <= 46)) bad.push(c.code + ':bbox異常');
        const urls = [c.lod1, c.lod2NoTex, c.lod2Tex].filter(Boolean);
        if (!urls.length) bad.push(c.code + ':変種なし');
        for (const u of urls) if (!u.endsWith('/tileset.json') || /\s/.test(u)) bad.push(c.code + ':URL形状');
        const k = c.code + '|' + c.name;
        if (seen.has(k)) bad.push(c.code + ':重複'); seen.add(k);
        if (c.lod1) lod1++; if (c.lod2NoTex) lod2NoTex++; if (c.lod2Tex) lod2Tex++;
    }
    check('Q1 全エントリの形状OK(code5桁・name・bbox日本域・変種≧1・URL末尾tileset.json・重複なし)',
        bad.length === 0, bad.slice(0, 6).join(', ') || `lod1=${lod1} lod2NoTex=${lod2NoTex} lod2Tex=${lod2Tex}`);
    const shinjuku = cs.find(c => c.code === '13104'), chiyoda = cs.find(c => c.code === '13101');
    const inBox = (c, lng, lat) => c && lng >= c.bbox[0] && lat >= c.bbox[1] && lng <= c.bbox[2] && lat <= c.bbox[3];
    check('Q1 都庁∈新宿区bbox・皇居∈千代田区bbox(PoC実測の継承)',
        inBox(shinjuku, 139.6917, 35.6896) && inBox(chiyoda, 139.7528, 35.6852));
    check('Q1 新宿区はテクスチャ付きLOD2を持つ(既定表示の実データ)', !!(shinjuku && shinjuku.lod2Tex));
}

// ---- Q2: ソース配線(picker/相対URL絶対化) ----
check('Q2 テクスチャON/OFFのLODフォールバック(tex: lod2Tex→lod2NoTex→lod1 / notex: lod2NoTex→lod1→lod2Tex)',
    src.includes('(c.lod2Tex || c.lod2NoTex || c.lod1)') && src.includes('(c.lod2NoTex || c.lod1 || c.lod2Tex)'));

// ============================================================
// ブラウザ検査: 読込配線(表→絶対URL→bboxフィルタ)
// ============================================================
(async () => {
    const { chromium } = require('playwright-core');
    const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
    const BASE = 'http://127.0.0.1:8099';
    const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
    const b = await chromium.launch({ executablePath: EXE, headless: true, args: ARGS });
    const ctx = await b.newContext({ viewport: { width: 1200, height: 900 }, timezoneId: 'Asia/Tokyo' });
    await ctx.route('**/*', route => {
        route.request().url().startsWith(BASE) ? route.continue() : route.abort();
    });
    const p = await ctx.newPage();
    await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/index.html', { waitUntil: 'load' });
    await p.waitForFunction(() => typeof glMap === 'object' && glMap !== null, { timeout: 10000 });
    await p.waitForTimeout(300);

    {
        const r = await p.evaluate(async () => {
            const cities = await _smBldgLoadCities();
            const shinjuku = cities.find(c => c.code === '13104');
            // 都庁の観測点で範囲10kmのbboxフィルタ(アプリ本体の判定と同じ式)
            const oLat = 35.6896, oLng = 139.6917, rangeKm = 10;
            const mLat = rangeKm / 111.32, mLng = rangeKm / (111.32 * Math.cos(oLat * Math.PI / 180));
            const hits = cities.filter(c =>
                oLat >= c.bbox[1] - mLat && oLat <= c.bbox[3] + mLat &&
                oLng >= c.bbox[0] - mLng && oLng <= c.bbox[2] + mLng);
            return { n: cities.length, absOk: cities.every(c => [c.lod1, c.lod2NoTex, c.lod2Tex].filter(Boolean).every(u => u.startsWith('https://'))),
                     texUrl: shinjuku && shinjuku.lod2Tex, hitNames: hits.map(h => h.name) };
        });
        check('Q3 _smBldgLoadCities: 400件以上を絶対URL化して返す', r.n >= 400 && r.absOk, `n=${r.n}`);
        check('Q3 新宿区lod2Texが公式配信の絶対URL', !!r.texUrl && r.texUrl.startsWith('https://assets.cms.plateau.reearth.io/assets/'), String(r.texUrl).slice(0, 60));
        check('Q3 都庁の観測点(範囲10km)で新宿区・千代田区が候補に入る',
            r.hitNames.includes('新宿区') && r.hitNames.includes('千代田区'), r.hitNames.slice(0, 8).join(','));
    }
    check('Q4 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
