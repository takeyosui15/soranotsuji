// 第55ラウンド検証: リファクタリングB第2弾②=ワーカープールの型+日時ピッカーの統合(v1.50.0)。
// - _makeWorkerPool: 辻検索/辻メッシュの同型プール二重実装(505+334文字×2)を工場関数へ(挙動不変)。
// - _bindDateTimePair: 全天儀ctrl/宙の窓ctrlの日付時刻ピッカーハンドラ(470文字×2)を統合。
// - 無いことのテスト(再増殖検知)+実挙動(プールの形・日時ピッカーの配線)。
// 全天儀/宙の窓ctrlの深いE2Eはverify97が担当。実ネットワークは遮断。
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// ---- U0: 版数ピン(最新のverifyに集約) ----
check('U0 APP_VERSIONが存在(版数ピンは最新のverifyに集約)', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) || !!process.argv[2]);
check('U0 Version Historyに最新版の行がある', /Version \d+\.\d+\.\d+ - /.test(src) || !!process.argv[2]);

// ---- U1: 無いことのテスト(重複の再増殖検知) ----
{
    const c1 = (src.match(/function run\(worker, task\)/g) || []).length;
    const c2 = (src.match(/worker\.postMessage\(task\.taskData\)/g) || []).length;
    const c3 = (src.match(/queue\.length = 0/g) || []).length;
    check('U1 プールの配車/解放の実体は_makeWorkerPoolの1箇所のみ', c1 === 1 && c2 === 1 && c3 === 1, `run=${c1} post=${c2} free=${c3}`);
    const c4 = (src.match(/_makeWorkerPool\(/g) || []).length;
    check('U1 _makeWorkerPoolは定義1+呼出2(辻検索/辻メッシュ)', c4 === 3, `count=${c4}`);
    const c5 = (src.match(/_bindDateTimePair\(/g) || []).length;
    const c6 = (src.match(/base\.setHours\(parseInt\(parts\[0\]\) \|\| 0, parseInt\(parts\[1\]\) \|\| 0, parts\.length >= 3 \? \(parseInt\(parts\[2\]\) \|\| 0\) : 0, 0\);/g) || []).length;
    check('U1 日時ピッカーハンドラの実体は_bindDateTimePairの1箇所のみ(定義1+呼出2)', c5 === 3 && c6 === 1, `bind=${c5} body=${c6}`);
}

// ============================================================
// ブラウザ検査: プールの形+日時ピッカーの配線(統合後の実挙動)
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

    // U2: プールの外形(size・runTask/terminateAll関数・工場の独立性=2プールが別状態)
    {
        const r = await p.evaluate(() => {
            const a = _makeWorkerPool('dp-line-worker.js', () => 2);
            const bb = _makeWorkerPool('dp-line-worker.js', () => 2);
            a.ensure();
            return { size: typeof tsujiPool.size === 'number' && tsujiPool.size >= 1,
                     fns: typeof tsujiPool.runTask === 'function' && typeof tsujiPool.terminateAll === 'function' &&
                          typeof tsujiMeshPool.init === 'function' && typeof tsujiMeshPool.runTask === 'function',
                     independent: a.workers().length === 2 && bb.workers().length === 0 };
        });
        check('U2 プールの外形: tsujiPool.size健在・run/terminate/init健在・工場は独立状態を持つ', r.size && r.fns && r.independent, JSON.stringify(r));
    }

    // U3: 日時ピッカーの配線(統合後): 全天儀ctrl側・宙の窓ctrl側とも change でappState.currentDateが動く
    {
        const r = await p.evaluate(() => {
            const set = (dId, tId, dv, tv) => {
                const d = document.getElementById(dId), t = document.getElementById(tId);
                if (!d || !t) return null;
                d.value = dv; t.value = tv;
                t.dispatchEvent(new Event('change'));
                return appState.currentDate.getTime();
            };
            const mw = set('mw-ctrl-date', 'mw-ctrl-time', '2026-08-15', '21:30:00');
            const expMw = new Date('2026-08-15T21:30:00').getTime();
            const sora = set('sora-ctrl-date', 'sora-ctrl-time', '2026-09-01', '04:15:00');
            const expSora = new Date('2026-09-01T04:15:00').getTime();
            return { mwOk: mw === expMw, soraOk: sora === expSora };
        });
        check('U3 日時ピッカー配線: 全天儀ctrl・宙の窓ctrlともchangeでcurrentDateへ反映', r.mwOk && r.soraOk, JSON.stringify(r));
    }
    check('U4 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
