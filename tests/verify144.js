// 第68ラウンド検証: v1.61.0 状態遷移表(第67)で見つけた穴の修正(案a・依頼者GO)
// 「端末側に未保存の変更がある」印(localEdit)をセットに永続で持ち、再確認の時刻比較が一致でも
// 👎を保つ。印は編集で立ち、保存/読込の成功で消える。判定は純関数_mySetSyncVerdictへ一元化。
const fs = require('fs');
const path = require('path');
let PASS = 0, FAIL = 0;
const check = (n, ok, d) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${d ? '  ' + d : ''}`); ok ? PASS++ : FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// ---- V0: 版数の存在検査(版数ピンは最新のverify145へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.61.0の行がある', src.includes('Version 1.61.0 - ') || !!process.argv[2]);

// ---- V1: 静的な形(印の立つ場所・消える場所・判定の一元化) ----
check('V1 判定の純関数_mySetSyncVerdictがあり、再確認と一括確認の両方が使う',
    src.includes('function _mySetSyncVerdict(s, modifiedTime)') &&
    src.includes("const verdict = _mySetSyncVerdict(s, meta.modifiedTime);") &&
    src.includes("_mySetSyncVerdict(s, meta.modifiedTime) === 'ok' ? 'ok' : 'stale'"));
check('V1 印が立つ: 編集時にs.localEdit=true+保存(永続)',
    src.includes('if (!s.localEdit) { s.localEdit = true; saveAppState(); }'));
check('V1 印が消える: 保存成功・読込成功・切替時のシート取得・解除の4箇所',
    (src.match(/\.localEdit = false;/g) || []).length === 4);
check('V1 複製は元の印を引き継ぐ', src.includes('localEdit: !!src.localEdit'));
check('V1 端末側変更の案内文がある', src.includes('端末側に未保存の変更があります'));

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

    // W1: 判定の真理値表(時刻一致×印の4象限+同期記録なし)
    {
        const r = await p.evaluate(() => {
            const T = '2026-08-09T00:00:00.000Z', T2 = '2026-08-09T01:00:00.000Z';
            return {
                okCase: _mySetSyncVerdict({ lastSyncSheetTime: T, localEdit: false }, T),
                localCase: _mySetSyncVerdict({ lastSyncSheetTime: T, localEdit: true }, T),
                staleCase: _mySetSyncVerdict({ lastSyncSheetTime: T, localEdit: false }, T2),
                staleEditCase: _mySetSyncVerdict({ lastSyncSheetTime: T, localEdit: true }, T2),
                noSyncCase: _mySetSyncVerdict({ lastSyncSheetTime: null, localEdit: false }, T),
            };
        });
        check('W1 真理値表: 一致+印なし=ok / 一致+印あり=stale-local / 不一致=stale / 記録なし=stale',
            r.okCase === 'ok' && r.localCase === 'stale-local' && r.staleCase === 'stale' &&
            r.staleEditCase === 'stale' && r.noSyncCase === 'stale', JSON.stringify(r));
    }

    // W2: 編集で印が立ち、永続化される(表示中セットに紐付けがある想定を合成)
    {
        const r = await p.evaluate(() => {
            appState.mySets = [{ id: 7, name: 'テスト', sheetId: 'sheet-xyz', lastSyncSheetTime: '2026-08-09T00:00:00.000Z', localEdit: false, data: {} }];
            appState.mySetCurrentId = 7;
            mySetSheetStates[7] = 'ok';
            _mySetMarkCurrentEdited();
            const saved = JSON.parse(localStorage.getItem('soranotsuji_app'));
            const savedSet = (saved.mySets || []).find(m => m.id === 7);
            return { flag: appState.mySets[0].localEdit, state: mySetSheetStates[7], persisted: savedSet ? savedSet.localEdit : null };
        });
        check('W2 編集で印が立つ+表示は👎(stale)+localStorageへ永続', r.flag === true && r.state === 'stale' && r.persisted === true, JSON.stringify(r));
    }

    // W3: 印がある間は再確認相当の判定でもokにならない(checkAllの判定式そのもの)
    {
        const r = await p.evaluate(() => {
            const s = appState.mySets[0];
            const same = s.lastSyncSheetTime;   // シートは変わっていない(時刻一致)
            return { verdict: _mySetSyncVerdict(s, same) };
        });
        check('W3 時刻一致でも印がある間はstale-local(👍へ戻らない=第67の穴の修正)', r.verdict === 'stale-local', JSON.stringify(r));
    }

    check('W4 ページエラーなし', errs.length === 0, errs.slice(0, 3).join(' | '));

    await b.close();
    console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
    process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
