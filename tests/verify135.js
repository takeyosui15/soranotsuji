// 第57ラウンド検証: リファクタリングB第2弾④(v1.52.0)=300ch以上の最後の2組の統合。
// - _searchSunMoonRiseSet: 日月出没4探索のtry(一括出力の日別事前計算/日別キャッシュ)325文字×2。
// - _pushMyTsujiResults: My辻検索の結果平坦化ループ(一括計算/File出力)303文字×2。
// これで300文字以上の重複グループは0(累計92→73)。無いことのテスト+軽い実挙動。
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// ---- W0: 版数ピン(最新のverifyに集約) ----
check('W0 APP_VERSIONが存在する', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));   // 版数ピンは最新のverifyに移管(第58ラウンド)
check('W0 Version Historyに1.52.0の行がある', src.includes('Version 1.52.0 - ') || !!process.argv[2]);

// ---- W1: 無いことのテスト(重複の再増殖検知) ----
{
    const c1 = (src.match(/_searchSunMoonRiseSet\(/g) || []).length;
    const c2 = (src.match(/_pushMyTsujiResults\(/g) || []).length;
    const c3 = (src.match(/time: r\.time, azimuth: r\.azimuth, altitude: r\.altitude, dist: r\.dist/g) || []).length;
    check('W1 日月出没4探索は_searchSunMoonRiseSetの1箇所のみ(定義1+呼出2)', c1 === 3, `count=${c1}`);
    // 呼出3=一括計算/File出力(dup組)+単発File出力(同型の第3現場をついで統合。res.obs/tgt=オーバーライド還流)
    check('W1 My辻結果の平坦化は_pushMyTsujiResultsの1箇所のみ(定義1+呼出4・本体1)', c2 === 5 && c3 === 1, `ref=${c2} body=${c3}`);   // 第62ラウンド: 結果コントロールのFile出力(_tsujiResFileCsv)が呼出+1
}

// ============================================================
// ブラウザ検査: 統合後の実挙動(実Astronomy呼び出し+平坦化の形)
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

    // W2: 実挙動 — 日月出没4探索が東京で有限時刻を返す・平坦化が形どおり積む
    {
        const r = await p.evaluate(() => {
            const obs = new Astronomy.Observer(35.6586, 139.7454, 0);
            const d = new Date('2026-08-02T00:00:00+09:00');
            const rs = _searchSunMoonRiseSet(obs, d);
            const all = [];
            _pushMyTsujiResults(all, { id: 1 }, { obs: 'O', tgt: 'T', bodyResults: [
                { body: 'Sun', results: [{ time: 't1', azimuth: 90, altitude: 1, dist: 0.1 }, { time: 't2', azimuth: 91, altitude: 2, dist: 0.2 }] },
                { body: 'Moon', results: [{ time: 't3', azimuth: 92, altitude: 3, dist: 0.3 }] },
            ] });
            return { srOk: !!(rs.sr && rs.sr.date instanceof Date), ssOk: !!(rs.ss && rs.ss.date instanceof Date),
                     n: all.length, first: all[0], lastBody: all[2] && all[2].body };
        });
        check('W2 日月出没4探索: 東京で日の出/日の入が有限時刻', r.srOk && r.ssOk);
        check('W2 平坦化: 2天体3行が形どおり積まれる(tsuji/obs/tgt/body/time…)',
            r.n === 3 && r.first && r.first.body === 'Sun' && r.first.azimuth === 90 && r.first.obs === 'O' && r.lastBody === 'Moon',
            JSON.stringify(r.first));
    }
    check('W3 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
