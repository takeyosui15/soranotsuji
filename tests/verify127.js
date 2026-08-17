// 第42ラウンド検証: リファクタリングB第1弾「ファイル入出力の型」の関数化。
// - 無いことのテスト(第32ラウンドの型): ファイル選択・FileReader・ダウンロード末尾の
//   ボイラープレートがヘルパー以外に存在しないことをソースで表明する(再増殖の検知)
// - ブラウザ: 関数化後のCSV出力/入力の実挙動(exportMyStarsCsv / importMyStarsCsv の端到端)
const fs = require('fs');
const path = require('path');
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// ---- O0: 版数ピン(最新のverifyに集約) ----
check('O0 APP_VERSIONが存在(版数ピンは最新のverifyに集約)', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src) || !!process.argv[2]);
check('O0 Version Historyに最新版の行がある', /Version \d+\.\d+\.\d+ - /.test(src) || !!process.argv[2]);

// ---- O1〜O4: 無いことのテスト(殻の再増殖の検知) ----
{
  const nInput = (src.match(/createElement\('input'\)/g) || []).length;
  check("O1 ファイル選択の殻はpickTextFileの1箇所のみ(createElement('input')=1)", nInput === 1, `count=${nInput}`);
  const nReader = (src.match(/new FileReader/g) || []).length;
  check('O2 FileReaderはpickTextFileの1箇所のみ', nReader === 1, `count=${nReader}`);
  const nUrl = (src.match(/URL\.createObjectURL/g) || []).length;
  // 許容4箇所: downloadTextFile(テキスト)・soraExportDownload(動画/画像Blob・遅延revoke)・
  // 動画プレビューと画像プレビューのsrc用(ダウンロードではない)
  check('O3 createObjectURLは4箇所(テキストDL/宙の窓DL/動画src/画像src)のみ', nUrl === 4, `count=${nUrl}`);
  const nSplit = (src.match(/replace\(\/\\r\\n\/g/g) || []).length;
  check('O4 CSV行分割の正規表現はsplitCsvLinesの1箇所のみ', nSplit === 1, `count=${nSplit}`);
}

// ============================================================
// ブラウザ検査: 関数化後のCSV出力/入力の端到端
// ============================================================
(async () => {
  const { chromium } = require('playwright-core');
  const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const BASE='http://127.0.0.1:8099';
  const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:10000});
  await p.waitForTimeout(400);

  // O5: CSV出力(downloadTextFile経由)がMy天体の内容を正しいファイル名・BOM付きで出す
  {
    const r = await p.evaluate(async () => {
      appState.myStars = [{ id: 1, name: 'テスト星', ra: 5.5, dec: -7.4, visible: true, color: '#DDA0DD', isDashed: true }];
      const oc = window.confirm, oCreate = URL.createObjectURL;
      window.confirm = () => true;
      let blob = null; URL.createObjectURL = (bl) => { blob = bl; return 'blob:x'; };
      const oClick = HTMLAnchorElement.prototype.click;
      let fname = ''; HTMLAnchorElement.prototype.click = function () { fname = this.download; };
      exportMyStarsCsv();
      HTMLAnchorElement.prototype.click = oClick; URL.createObjectURL = oCreate; window.confirm = oc;
      const text = await blob.text();
      // BOMの確認はバイト列で行う(blob.text()はUTF-8のBOMを仕様どおり剥がすため)
      const head = new Uint8Array((await blob.arrayBuffer()).slice(0, 3));
      const bom = head[0] === 0xEF && head[1] === 0xBB && head[2] === 0xBF;
      return { fname, bom, hasRow: text.includes('1,テスト星,5.5,-7.4') };
    });
    check('O5 CSV出力の端到端(ファイル名/BOM/行内容)', /^soranotsuji-My天体-.*\.csv$/.test(r.fname) && r.bom && r.hasRow,
      JSON.stringify(r));
  }

  // O6: CSV入力(pickTextFile経由)の端到端 — ファイル選択をスタブしてCSVを流し込む
  {
    const r = await p.evaluate(() => {
      const op = window.pickTextFile, oc = window.confirm, oa = window.alert;
      window.confirm = () => true; window.alert = () => {};
      window.pickTextFile = (accept, onText) => onText('﻿天体ID,天体名,赤経,赤緯\n2,読込星,1.25,-3.5\n# コメント行\n');
      try { importMyStarsCsv(); } finally { window.pickTextFile = op; window.confirm = oc; window.alert = oa; }
      const s = appState.myStars.find(x => x.id === 2);
      return { count: appState.myStars.length, ok: !!s && s.name === '読込星' && s.ra === 1.25 && s.dec === -3.5 };
    });
    check('O6 CSV入力の端到端(コメント行スキップ+登録)', r.count === 1 && r.ok, JSON.stringify(r));
  }

  check('O7 ページエラーなし', errs.length===0, errs.slice(0,3).join(' | '));

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
