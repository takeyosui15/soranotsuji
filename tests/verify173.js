// 第132〜133ラウンド検証: v1.87.0への追補4/5(依頼者依頼・指摘) — ①結果コントロールの精度フィルタ
// オプション(select-tsujimesh-time-eps)の初期値も○へ(検索メニュー側とベースを揃える)
// ②My観測点/My目的点の「写真から追加」(Exif位置情報の端末内読み取り→行追加。
// 名前=新規○○名・緯度経度=写真・標高=再取得・高さ=0・すぐ全て登録できる状態)
// ③宙の辻フォルダの追加/解除ボタンは設けない判断+ヘルプ(名前変更・移動OK)とプライバシーポリシー追記
// ④第133: 検索完了スナップショットの固定値が:○を強制オフ+○の行を結果リストから落とす不具合の修正
// (第64の固定値が第128の○追加後も◎のみオンだった)。ツールチップ簡素化・reset.htmlのドライブ注記
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
const idxSrc = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const privSrc = fs.readFileSync(path.join(__dirname, '..', 'privacy.html'), 'utf8');
const resetSrc = fs.readFileSync(path.join(__dirname, '..', 'reset.html'), 'utf8');

// ---- 合成写真: Exif GPS入りの最小JPEG/TIFFをバイト列で組み立てる(実写真は使わない=決定的) ----
// little: II/MMの別, latRef/lngRef: 'N'/'S'/'E'/'W', lat/lng: [度,分,秒x100]の整数
function buildExifJpeg({ little, latRef, lngRef, lat, lng, noGps }) {
  const tiff = [];
  const u16 = (v) => little ? [v & 255, v >> 8] : [v >> 8, v & 255];
  const u32 = (v) => little ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]
                            : [(v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255];
  tiff.push(...(little ? [0x49, 0x49] : [0x4D, 0x4D]), ...u16(42), ...u32(8));
  if (noGps) {
    tiff.push(...u16(0), ...u32(0));   // 空のIFD0(エントリ0件)
  } else {
    // IFD0: GPS IFDポインタ(0x8825)の1エントリ。GPS IFDはIFD0直後(8+2+12+4=26)
    tiff.push(...u16(1), ...u16(0x8825), ...u16(4), ...u32(1), ...u32(26), ...u32(0));
    // GPS IFD: 4エントリ(参照2+度分秒2)。データ領域は26+2+4*12+4=80
    tiff.push(...u16(4));
    tiff.push(...u16(1), ...u16(2), ...u32(2), latRef.charCodeAt(0), 0, 0, 0);   // GPSLatitudeRef(値は直置き)
    tiff.push(...u16(2), ...u16(5), ...u32(3), ...u32(80));                       // GPSLatitude
    tiff.push(...u16(3), ...u16(2), ...u32(2), lngRef.charCodeAt(0), 0, 0, 0);   // GPSLongitudeRef
    tiff.push(...u16(4), ...u16(5), ...u32(3), ...u32(104));                      // GPSLongitude
    tiff.push(...u32(0));
    for (const [d, m, s100] of [lat, lng]) {
      tiff.push(...u32(d), ...u32(1), ...u32(m), ...u32(1), ...u32(s100), ...u32(100));
    }
  }
  const app1Len = 2 + 6 + tiff.length;
  return Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE1, app1Len >> 8, app1Len & 255,
    0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff, 0xFF, 0xD9]);
}
// 富士山剣ヶ峰付近: 35°21'38.70"N 138°43'38.50"E → 35.36075, 138.727361(小数6桁丸め後)
const PHOTO_NE = buildExifJpeg({ little: true, latRef: 'N', lngRef: 'E', lat: [35, 21, 3870], lng: [138, 43, 3850] });
const PHOTO_SW = buildExifJpeg({ little: false, latRef: 'S', lngRef: 'W', lat: [35, 21, 3870], lng: [138, 43, 3850] });
const PHOTO_NOGPS = buildExifJpeg({ little: true, noGps: true });

// ---- V0: 版数ピン(最新の検証が持つ。第132/133もリリース前の追補なので1.87.0のまま) ----
check('V0 版数ピン 1.87.0+Version Historyに第132/133の追補4/5', /APP_VERSION = '1\.87\.0'/.test(src) && ((src.includes('第132ラウンド(リリース前の追補4') && src.includes('第133ラウンド(リリース前の追補5')) || !!process.argv[2]));

// ---- T1: UI文言(第133): ○ラジオのツールチップからデッサンの考え方を削除+reset.htmlのドライブ注記 ----
check('T1 「:○」ラジオのtitleは±0.25°のみ(実用域の説明はデッサンへ)+reset.htmlにドライブは残る注記',
  !idxSrc.includes('辻検索の◎○に相当する実用域') &&
  resetSrc.includes('Googleドライブに保存した内容（宙の辻フォルダ）はそのまま残り'));

// ---- F1/F2: 公開文書の明記(プライバシーポリシー+ヘルプ) ----
check('F1 プライバシーポリシー: 写真は端末内処理のみ・送信/保存しない+改定日',
  privSrc.includes('「写真から追加」で選択した写真は、位置情報(Exif)を読み取るために利用者の端末内(ブラウザ内)でのみ処理されます') &&
  privSrc.includes('改定日: 2026年8月23日'));
check('F2 ヘルプ: 宙の辻フォルダは名前変更・移動しても連携が保たれる+写真から追加の説明',
  idxSrc.includes('名前変更したり、別の場所へ移動したりしても、連携はそのまま保たれます') &&
  idxSrc.includes('<strong>写真から追加</strong>: 撮った写真の位置情報 (Exif) から観測点・目的点を追加できます'));

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof addMyPointFromPhoto==='function',{timeout:8000});
  await p.waitForTimeout(400);

  // ---- C1: 結果コントロールの精度フィルタオプション初期値=○(非永続・検索メニュー側と同じ) ----
  {
    const r=await p.evaluate(()=>{
      const sel=document.getElementById('select-tsujimesh-time-eps');
      return { v: sel.value, idx: sel.selectedIndex, first: sel.options[0].textContent, n: sel.options.length,
               eps: (typeof _tmCtrlEps!=='undefined') && _tmCtrlEps===0.25 };
    });
    check('C1 コントロールの精度フィルタオプション初期値=○(±0.25°)・9段・_tmCtrlEps=0.25',
      r.v==='0.25'&&r.idx===0&&r.first==='○(±0.25°)'&&r.n===9&&r.eps, JSON.stringify(r));
  }

  // ---- C2/C3: 検索完了スナップショットの固定値(第133・依頼者指摘の不具合を実測) ----
  {
    const r=await p.evaluate(()=>{
      const F=_resCtlFromAppState('tsujiMesh');
      const snap={ filter:F.accuracyFilter, dbl:F.accDblCircle, circle:F.accCircle, tri:F.accTriangle, dash:F.accDash };
      _resCtlSet('tsujimeshres', F, false);   // 検索完了時と同じ経路でコントロールへ展開
      const chk=(id)=>document.getElementById(id).checked;
      const dom={ dbl:chk('chk-tsujimeshres-acc-dbl-circle'), circle:chk('chk-tsujimeshres-acc-circle'),
                  tri:chk('chk-tsujimeshres-acc-triangle'), dash:chk('chk-tsujimeshres-acc-dash') };
      const readBack=_resCtlRead('tsujimeshres');   // _tmBuildRowsの行絞り込みが読む値
      return { snap, dom, rbCircle: readBack.accCircle, rbDbl: readBack.accDblCircle };
    });
    check('C2 スナップショット値: メッシュの精度フィルタは◎○オン・△-オフの固定の枠(○が落ちない)',
      r.snap.filter&&r.snap.dbl&&r.snap.circle&&!r.snap.tri&&!r.snap.dash, JSON.stringify(r.snap));
    check('C3 検索完了経路(_resCtlSet)後もコントロールの:○はオン+行絞り込みの読み値もオン(○の行が結果リストに残る)',
      r.dom.dbl&&r.dom.circle&&!r.dom.tri&&!r.dom.dash&&r.rbCircle&&r.rbDbl, JSON.stringify(r.dom));
  }

  // ---- P1: Exif位置情報パーサ単体(リトルエンディアンJPEG N/E・ビッグエンディアンTIFF S/W・GPS無し) ----
  {
    const r=await p.evaluate(({ne,sw,ng})=>{
      const buf=(a)=>Uint8Array.from(a).buffer;
      const g1=_exifGpsFromArrayBuffer(buf(ne));
      const g2=_exifGpsFromArrayBuffer(buf(sw.slice(12)));   // TIFF生(Exif構造そのもの)としても読めること
      const g2j=_exifGpsFromArrayBuffer(buf(sw));
      const g3=_exifGpsFromArrayBuffer(buf(ng));
      return { g1, g2, g2j, g3 };
    }, { ne: Array.from(PHOTO_NE), sw: Array.from(PHOTO_SW), ng: Array.from(PHOTO_NOGPS) });
    const near=(a,b)=>a!==null&&a!==undefined&&Math.abs(a-b)<1e-9;
    check('P1 Exifパーサ: JPEG(II)のN/E読取・TIFF生とJPEG(MM)のS/Wは負値・GPS無しはnull',
      near(r.g1&&r.g1.lat,35.36075)&&near(r.g1&&r.g1.lng,138+43/60+38.5/3600)&&
      near(r.g2&&r.g2.lat,-35.36075)&&near(r.g2j&&r.g2j.lng,-(138+43/60+38.5/3600))&&r.g3===null,
      JSON.stringify(r));
  }

  // ---- P2: 写真から追加(My観測点・結合): 行の初期値=依頼者指定・標高は再取得・dirtyで全て登録が押せる状態 ----
  {
    await p.evaluate(()=>{
      window._t173={ confirms:[], alerts:[], elevCalls:[], origElev:getElevation, origC:window.confirm, origA:window.alert };
      window.confirm=(m)=>{ _t173.confirms.push(m); return true; };
      window.alert=(m)=>{ _t173.alerts.push(m); };
      getElevation=async(la,ln)=>{ _t173.elevCalls.push([la,ln]); return 135.7; };   // 再取得の証明(写真由来の標高は無い)
    });
    const before=await p.evaluate(()=>appState.myObservations.length);
    await p.setInputFiles('#file-myobs-photo', { name: 'fuji.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(PHOTO_NE) });
    await p.waitForFunction((n)=>appState.myObservations.length===n+1,before,{timeout:5000});
    const r=await p.evaluate(()=>{
      const row=appState.myObservations[appState.myObservations.length-1];
      return { row, dirty: document.getElementById('btn-myobs-regall').classList.contains('dirty'),
               confirmMsg: _t173.confirms[_t173.confirms.length-1]||'', elevCalls: _t173.elevCalls,
               inputCleared: document.getElementById('file-myobs-photo').value==='' };
    });
    check('P2 写真から追加(観測点): 名前=新規観測点名・緯度経度=写真(6桁丸め)・標高=再取得135.7・高さ0・確認に緯度経度・dirtyで全て登録可・input空戻し',
      r.row.name==='新規観測点名'&&r.row.lat===35.36075&&r.row.lng===138.727361&&r.row.elev===135.7&&r.row.height===0&&r.row.memo===''&&
      r.dirty&&r.confirmMsg.includes('My観測点リストに追加しますか')&&r.confirmMsg.includes('35.36075')&&
      r.elevCalls.length===1&&r.elevCalls[0][0]===35.36075&&r.inputCleared, JSON.stringify(r));
  }

  // ---- P3: 位置情報の無い写真は追加しない(alertで案内・行は不変) ----
  {
    const before=await p.evaluate(()=>({ n: appState.myObservations.length, a: _t173.alerts.length }));
    await p.setInputFiles('#file-myobs-photo', { name: 'nogps.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(PHOTO_NOGPS) });
    await p.waitForFunction((k)=>_t173.alerts.length===k+1,before.a,{timeout:5000});
    const r=await p.evaluate(()=>({ n: appState.myObservations.length, msg: _t173.alerts[_t173.alerts.length-1] }));
    check('P3 GPS無し写真: 「読み取れませんでした」のalert・行は追加しない',
      r.n===before.n&&String(r.msg).includes('写真から位置情報を読み取れませんでした'), JSON.stringify(r));
  }

  // ---- P4: My目的点側も同じ流儀(新規目的点名・S/W写真=南緯/西経の符号) ----
  {
    const before=await p.evaluate(()=>appState.myTargets.length);
    await p.setInputFiles('#file-mytgt-photo', { name: 'sw.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(PHOTO_SW) });
    await p.waitForFunction((n)=>appState.myTargets.length===n+1,before,{timeout:5000});
    const r=await p.evaluate(()=>{
      const row=appState.myTargets[appState.myTargets.length-1];
      // 後片付け: スタブと確認/警告を復元(以降のブロックに漏らさない)
      getElevation=_t173.origElev; window.confirm=_t173.origC; window.alert=_t173.origA;
      return { row, dirty: document.getElementById('btn-mytgt-regall').classList.contains('dirty') };
    });
    check('P4 写真から追加(目的点): 新規目的点名・南緯/西経は負の緯度経度・高さ0・dirty',
      r.row.name==='新規目的点名'&&r.row.lat===-35.36075&&r.row.lng===-138.727361&&r.row.height===0&&r.dirty, JSON.stringify(r));
  }

  const fatal=errs.filter(e=>!/ResizeObserver/.test(e));
  check('E1 ページエラーなし', fatal.length===0, fatal.join(' | '));

  await b.close();
  console.log(`\nverify173: ${PASS} PASS / ${FAIL} FAIL`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
