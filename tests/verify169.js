// 第125ラウンド検証: v1.86.2 — Googleドライブ同期ダイアログの[New]が両方に付くことがある不具合の修正。
// 依頼者仕様: [New]はどちらか一方だけ(どちらを残すかの道しるべ)。
// 旧実装は「前回同期からその側が変わったか」の両側独立表示で、①両側変更の競合 ②同期簿記なし、の
// 2経路で両方に点灯した(日付比較の疑いは晴れ=時刻は元からミリ秒精度で扱われている)。
// 修正後: 片側だけ変わっていればその側・両側変更なら更新日時(ミリ秒までの日時)の新しい側だけ。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// ---- V0: 版数の形(第126でピンはverify170へ移譲=最新の検証が持つ) ----
check('V0 版数の形+Version Historyに1.86.2の行', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) && (src.includes('Version 1.86.2 - ') || !!process.argv[2]));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof openGdriveSyncDialog==='function',{timeout:8000});
  await p.waitForTimeout(400);

  // 同期ダイアログの[New]を状態注入で実測するヘルパーを仕込み、5ケースを検査
  const r=await p.evaluate(()=>{
    const gd=appState.googleDrive;
    const setSavedAt=(iso)=>{ const s=JSON.parse(localStorage.getItem(STORAGE_KEY)); s.savedAt=new Date(iso).getTime(); localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); };
    const marks=()=>{
      openGdriveSyncDialog();
      const L=document.getElementById('gdrive-sync-local').innerHTML.includes('[New]');
      const D=document.getElementById('gdrive-sync-drive').innerHTML.includes('[New]');
      closeGdriveSyncDialog();
      return (L?'L':'-')+(D?'D':'-');
    };
    const out={};
    // (a) 競合(両側とも前回同期から変更)+ローカルの方が新しい → ローカルだけ
    setSavedAt('2026-08-23T13:00:00+09:00');
    gd.lastSyncFingerprint='deadbeef';                             // ローカル変更あり(指紋不一致)
    gd.lastSyncDriveModifiedTime='2026-08-23T01:00:00.000Z';
    gd.lastDriveModifiedTime='2026-08-23T03:00:00.000Z';           // ドライブ変更あり(12:00 JST)
    out.a=marks();
    // (b) 競合+ドライブの方が新しい(同じ日付・時刻違い=日時で比較している証拠) → ドライブだけ
    setSavedAt('2026-08-23T11:00:00+09:00');
    out.b=marks();
    // (c1) 片側のみ: ローカルだけ変更(指紋不一致・ドライブは同期時のまま) → ローカルだけ
    gd.lastSyncDriveModifiedTime=gd.lastDriveModifiedTime;
    out.c1=marks();
    // (c2) 片側のみ: ドライブだけ変更(指紋一致) → ドライブだけ。savedAtが後でも付かない(第36の性質の維持)
    gd.lastSyncFingerprint=localContentFingerprint();
    gd.lastDriveModifiedTime='2026-08-23T05:00:00.000Z';
    setSavedAt('2026-08-23T23:00:00+09:00');                       // 簿記保存でsavedAtだけ進んだ想定
    out.c2=marks();
    // (d) 同期簿記なし(初回・移行後)+両方に実体あり → 旧実装は両方点灯、新実装は新しい側だけ
    gd.lastSyncFingerprint=null; gd.lastSyncDriveModifiedTime=null;
    gd.lastDriveModifiedTime='2026-08-23T03:00:00.000Z';           // 12:00 JST < savedAt 23:00 JST
    out.d=marks();
    return out;
  });
  check('U1 競合(両側変更)+ローカルが新しい → [New]はローカルだけ', r.a==='L-', r.a);
  check('U2 競合+ドライブが新しい(同じ日付・時刻違い=ミリ秒までの日時比較) → ドライブだけ', r.b==='-D', r.b);
  check('U3 ローカルだけ変更 → ローカルだけ', r.c1==='L-', r.c1);
  check('U4 ドライブだけ変更 → ドライブだけ(簿記保存でsavedAtが後でも第36の性質を維持)', r.c2==='-D', r.c2);
  check('U5 同期簿記なし(初回)でも両方には付かない(旧実装の再発防止) → 新しい側だけ', r.d==='L-', r.d);

  check('E1 ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
