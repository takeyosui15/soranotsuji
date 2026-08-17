// 第95ラウンド検証: v1.77.0
// まとめ確認への対応 第3陣: ①URL取得ボタン毎の発行キーの絞り込み(位置情報=full全部盛り・
//   辻検索/辻メッシュ=tsuji・宙の窓=soramado。復元側は不変=無いキーは開いた側の既定値のまま)
//   ②My辻検索URLに大気差/気象(取得時点)+天の川の基準点(行の値)を追加
//   ③URL取得ダイアログの「:QRコード」チェック(初期値オフ): URLのQRコード画像をクリップボードへ。
//   QRの検査は本物の復号器(jsQR)でエンコード→復号の往復を実測する。
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
const JSQR = require.resolve('jsqr/dist/jsQR.js');   // ハーネスnode_modulesの復号器(ページへ注入)

// ---- V0: 版数の存在検査(版数ピンは最新のverify161へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.77.0の行がある', src.includes('Version 1.77.0 - ') || !!process.argv[2]);

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof buildCommonUrlParams==='function',{timeout:8000});
  await p.waitForTimeout(400);

  // U1: プロファイル毎の発行キー(グループの出し分け)
  {
    const r=await p.evaluate(()=>{
      window.confirm=()=>true; window.alert=()=>{};
      // 既定値以外の状態を仕込む(bodyColorの選択的発行も見るため太陽色を変更)
      appState.soraFocal=135; appState.fwEnabled=true; appState.ssDays=8;
      appState.refractionEnabled=true; appState.baseOptMwBase='offset'; appState.mwOffsetAngle=30;
      appState.mwShowConstFig=true; appState.elevExcludeRadius=33; appState.tsujiLineIncludeOffset=false;
      const sun=appState.bodies.find(x=>x.id==='Sun'); const sunColor0=sun.color; sun.color='#123456';
      const keysOf=prof=>{ const ps=buildCommonUrlParams('fixed',prof); return new Set([...ps.keys()]); };
      const full=keysOf('full'), tsuji=keysOf('tsuji'), sora=keysOf('soramado');
      sun.color=sunColor0;
      const hasAll=(s,ks)=>ks.every(k=>s.has(k));
      const hasNone=(s,ks)=>ks.every(k=>!s.has(k));
      return {
        // 第97ラウンドの意図更新: 宙検索(ss系)は封鎖中機能のため公開ビルドではfullにも乗らない
        // (?forecast=1時のみ発行=verify162 C3が検査)。ssPresetをhasAllからhasNoneへ移した
        fullOk: hasAll(full, ['date','startLat','starId','dp','soraFocal','fwEnabled','bodyColorSun',
                              'refractionEnabled','meteoP','baseOptMwBase','mwOffsetAngle','mwShowBodies','mwConstNameSort',
                              'elevExcludeEnabled','tsujiLineIncludeOffset'])
              && hasNone(full, ['ssPreset','ssStat']),
        tsujiOk: hasAll(tsuji, ['date','startLat','endLat','starId','refractionEnabled','meteoP','meteoT','meteoL',
                                'baseOptMwBase','mwOffsetAngle','elevExcludeEnabled','elevExcludeRadius','tsujiLineIncludeOffset'])
              && hasNone(tsuji, ['dp','elevation','soramado','tsujisearch','soraFocal','soraBaseAz','fwEnabled','ssPreset',
                                 'bodyColorSun','mwShowBodies','mwConstNameSort']),
        soraOk: hasAll(sora, ['date','startLat','starId','soraFocal','soraBaseAz','fwEnabled','bodyColorSun',
                              'refractionEnabled','meteoP','baseOptMwBase','mwOffsetAngle','mwShowBodies','mwConstNameSort'])
              && hasNone(sora, ['dp','elevation','tsujisearch','tsujimesh','ssPreset','ssDays',
                                'elevExcludeEnabled','tsujiLineIncludeOffset']),
        nFull: full.size, nTsuji: tsuji.size, nSora: sora.size,
      };
    });
    check('U1 full=全部盛り(従来どおり全グループ+変更した太陽色)', r.fullOk, JSON.stringify({n:r.nFull}));
    check('U1 tsuji=検索の再現に絞る(大気差/気象/天の川基準点/除外範囲/辻オフセットのみ。sora*/fw*/ss*/パネル/天体色/全天儀表示なし)',
      r.tsujiOk, JSON.stringify({n:r.nTsuji}));
    check('U1 soramado=窓の再現に絞る(sora*/fw*/天体色/全天儀表示+大気差/天の川基準点。ss*/パネル/除外範囲/辻オフセットなし)',
      r.soraOk, JSON.stringify({n:r.nSora}));
  }

  // U2: 実ボタンの流れ(長いURL)でも同じ絞り込み+モードキー(クリップボードのモックで捕まえる)
  {
    const r=await p.evaluate(async()=>{
      const got=[];
      const orig=navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText=t=>{ got.push(t); return Promise.resolve(); };
      document.getElementById('url-picker-short').checked=false;   // 長いURLで中身を見る
      document.getElementById('url-picker-qr').checked=false;
      copyTsujiSearchUrl('fixed');
      copySoramadoUrl('fixed');
      await new Promise(r=>setTimeout(r,100));
      navigator.clipboard.writeText=orig;
      document.getElementById('url-picker-short').checked=true;
      const ps=u=>new URLSearchParams(u.split('?')[1]);
      const t=ps(got[0]||''), s=ps(got[1]||'');
      return { n: got.length,
        tsuji: { mode: t.get('mode'), days: t.has('tsujiSearchDays'), sora: t.has('soraFocal'), ss: t.has('ssPreset'), dp: t.has('dp'), refr: t.has('refractionEnabled') },
        sora:  { mode: s.get('mode'), open: s.get('soramado'), focal: s.has('soraFocal'), fw: s.has('fwEnabled'), ss: s.has('ssPreset'), elev: s.has('elevExcludeEnabled') } };
    });
    check('U2 辻検索URL=mode+tsuji*+計算に効く組だけ(sora*/ss*/パネルなし)',
      r.n===2&&r.tsuji.mode==='tsujisearch'&&r.tsuji.days&&r.tsuji.refr&&!r.tsuji.sora&&!r.tsuji.ss&&!r.tsuji.dp, JSON.stringify(r.tsuji));
    check('U2 宙の窓URL=mode=preview+soramado=true+sora*/fw*(ss*/除外範囲なし)',
      r.sora.mode==='preview'&&r.sora.open==='true'&&r.sora.focal&&r.sora.fw&&!r.sora.ss&&!r.sora.elev, JSON.stringify(r.sora));
  }

  // U3: My辻検索URLに大気差/気象+行の天の川の基準点が乗る
  {
    const r=await p.evaluate(async()=>{
      const got=[];
      const orig=navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText=t=>{ got.push(t); return Promise.resolve(); };
      document.getElementById('url-picker-short').checked=false;
      appState.myObservations=[{id:1,name:'観',lat:35.6,lng:139.7,elev:10,height:0,checked:false,memo:''}];
      appState.myTargets=[{id:1,name:'目',lat:35.36,lng:138.73,elev:3776,height:0,checked:false,memo:''}];
      appState.myTsujiSearches=[{id:1,name:'行',days:365,bodyIds:'MilkyWay',obsId:1,tgtId:1,baseAz:250,baseAlt:2,
        offsetAz:0,offsetAlt:0,toleranceAz:15,toleranceAlt:15,centerMode:'point',mwOffsetEnabled:true,mwOffsetAngle:30,
        moonFilter:false,checked:false,memo:''}];
      renderMyTsujiSearches();
      const radio=document.querySelector('input[name="mytsuji-select"]');
      if (radio) radio.checked=true;
      copyMyTsujiSearchUrl('fixed');
      appState.myTsujiSearches[0].mwOffsetEnabled=false;
      copyMyTsujiSearchUrl('fixed');
      await new Promise(r=>setTimeout(r,100));
      navigator.clipboard.writeText=orig;
      document.getElementById('url-picker-short').checked=true;
      appState.myTsujiSearches=[]; appState.myObservations=[]; appState.myTargets=[]; renderMyTsujiSearches();
      const ps=u=>new URLSearchParams(u.split('?')[1]);
      const a=ps(got[0]||''), b=ps(got[1]||'');
      return { n: got.length,
        on: { base: a.get('baseOptMwBase'), ang: a.get('mwOffsetAngle'), refr: a.has('refractionEnabled'), p: a.has('meteoP'), mode: a.get('mode') },
        off: { base: b.get('baseOptMwBase'), ang: b.get('mwOffsetAngle') } };
    });
    check('U3 My辻URL: 行の:天の川オプションオン→baseOptMwBase=offset・角度30+大気差/気象',
      r.n===2&&r.on.base==='offset'&&r.on.ang==='30'&&r.on.refr&&r.on.p&&r.on.mode==='tsujisearch', JSON.stringify(r.on));
    check('U3 My辻URL: 行のオプションオフ→baseOptMwBase=center(角度は保持値0…行の値)', r.off.base==='center', JSON.stringify(r.off));
  }

  check('E1 発行側ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));

  // U4: 絞ったURLの復元=無いキーは開いた側の既定値のまま(sora*が漏れない)
  let tsujiShort=null, defFocal=null;
  {
    const r=await p.evaluate(()=>{
      appState.tsujiSearchDays=100;
      const ps=buildCommonUrlParams('fixed','tsuji');
      ps.set('mode','tsujisearch'); ps.set('tsujiSearchDays','100');
      return '?query='+encodeQueryParam(ps.toString());
    });
    tsujiShort=r;
  }
  {
    const ctx2=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
    await ctx2.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
    const p2=await ctx2.newPage();
    await p2.goto(BASE+'/index.html',{waitUntil:'load'});
    await p2.waitForFunction(()=>typeof drawSoramado==='function',{timeout:8000});
    defFocal=await p2.evaluate(()=>appState.soraFocal);
    await p2.close();
    const p3=await ctx2.newPage();
    await p3.goto(BASE+'/index.html'+tsujiShort,{waitUntil:'load'});
    await p3.waitForFunction(()=>typeof drawSoramado==='function',{timeout:8000});
    await p3.waitForTimeout(800);
    const r=await p3.evaluate(()=>({ days: appState.tsujiSearchDays, focal: appState.soraFocal,
      refr: appState.refractionEnabled, pend: !!appState._pendingTsujiSearch || appState.isTsujiSearchActive }));
    await ctx2.close();
    check('U4 辻検索の絞ったURLで開く→辻検索は復元(100日・自動実行)・宙の窓は既定のまま(絞りの漏れなし)',
      r.days===100 && r.focal===defFocal && r.refr===true && r.pend, JSON.stringify({...r, defFocal}));
  }

  // Q1: QRコード(チェックの形+エンコード→jsQRで復号の往復)
  {
    await p.addScriptTag({ path: JSQR });   // 本物の復号器を注入(ローカルファイル・通信なし)
    const r=await p.evaluate(async()=>{
      const shortChk=document.getElementById('url-picker-short');
      const qrChk=document.getElementById('url-picker-qr');
      const sameRow = qrChk && shortChk && qrChk.closest('.url-picker-opts-row')===shortChk.closest('.url-picker-opts-row');
      // クリップボードのモック(画像アイテムを捕まえる)
      if (typeof ClipboardItem === 'undefined') window.ClipboardItem = class { constructor(o) { this.items = o; } };
      const captured=[];
      const origWrite = navigator.clipboard.write ? navigator.clipboard.write.bind(navigator.clipboard) : null;
      navigator.clipboard.write = items => { captured.push(...items); return Promise.resolve(); };
      const alerts=[]; const origAlert=window.alert; window.alert=m=>alerts.push(String(m));
      qrChk.checked=true; shortChk.checked=true;
      copyLocationUrl('fixed');
      await new Promise(r=>setTimeout(r,400));
      qrChk.checked=false;
      window.alert=origAlert;
      if (origWrite) navigator.clipboard.write = origWrite;
      if (!captured.length) return { sameRow, initOff: !qrChk.defaultChecked, fail:'no clipboard item' };
      const item=captured[0];
      const blobP = item.items ? item.items['image/png'] : item.getType('image/png');
      const blob = await Promise.resolve(blobP);
      const bmp = await createImageBitmap(blob);
      const cv=document.createElement('canvas'); cv.width=bmp.width; cv.height=bmp.height;
      const c2=cv.getContext('2d'); c2.drawImage(bmp,0,0);
      const img=c2.getImageData(0,0,cv.width,cv.height);
      const dec=jsQR(img.data, img.width, img.height);
      if (!dec) return { sameRow, initOff: !qrChk.defaultChecked, fail:'jsQR decode null', w:cv.width };
      const url=dec.data;
      const q=new URLSearchParams(url.split('?')[1]);
      const decoded=decodeQueryParam(q.get('query'));
      const inner=decoded?new URLSearchParams(decoded):null;
      return { sameRow, initOff: !qrChk.defaultChecked, w:cv.width,
               okMsg: alerts.some(a=>a.includes('QRコード')&&a.includes('コピー')),
               urlHead: url.slice(0, 40), hasQuery: q.has('query'),
               mode: inner&&inner.get('mode'), focal: inner&&inner.get('soraFocal') };
    });
    check('Q1 「:QRコード」チェックは「:短いURL」と同じ段+初期値オフ', r.sameRow&&r.initOff, JSON.stringify({sameRow:r.sameRow,initOff:r.initOff}));
    check('Q1 QR画像をjsQRで復号→短いURLがそのまま読める(query→復号→mode=preview+sora状態)',
      !r.fail&&r.hasQuery&&r.mode==='preview'&&r.focal==='135'&&r.okMsg,
      JSON.stringify({fail:r.fail,mode:r.mode,focal:r.focal,okMsg:r.okMsg,w:r.w}));
  }

  // Q2: 容量超過の案内(QRに入らない長さ→短いURLの案内)
  {
    const r=await p.evaluate(async()=>{
      const alerts=[]; const origAlert=window.alert; window.alert=m=>alerts.push(String(m));
      await copyShareQr('x'.repeat(3500), 'テスト');
      window.alert=origAlert;
      return { alerts };
    });
    check('Q2 URLがQRの容量を超える時は「短いURL」を案内', r.alerts.some(a=>a.includes('長すぎて')&&a.includes('短いURL')), JSON.stringify(r.alerts));
  }

  check('E2 ページエラーなし(QR含む)', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
