// 第90ラウンド検証: v1.73.0
// プラスコードの短縮形入力(第78ラウンドの依頼の後段)。
//   分解(コードと基準地名の順序不問)・recoverNearest相当の展開(近傍セルへの±1調整)・
//   基準地名ピッカー経由のE2E・地名省略時の地図中心基準。
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

// ---- V0: 版数の存在検査(版数ピンは最新のverify157へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.73.0の行がある', src.includes('Version 1.73.0 - ') || !!process.argv[2]);

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof _plusCodeRecover==='function',{timeout:8000});
  await p.waitForTimeout(600);

  // R1: 短縮形の分解(順序不問・コードのみ・非該当の拒否)
  {
    const r=await p.evaluate(()=>{
      const a=_plusCodeShortParse('MQPJ+2V 港区');
      const b2=_plusCodeShortParse('港区 MQPJ+2V');
      const c=_plusCodeShortParse('MQPJ+2V');
      const d=_plusCodeShortParse('東京都港区 芝公園 MQPJ+2V');
      const rej=[_plusCodeShortParse('8Q7XMQPJ+2V'),        // フルコードは対象外(parseInputが先に受ける)
                 _plusCodeShortParse('東京タワー'),
                 _plusCodeShortParse('MQP+2V 港区'),         // 「+」前が奇数
                 _plusCodeShortParse('35.65,139.74')].every(x=>x===null);
      return { a, b2, c, d, rej };
    });
    check('R1 「コード+地名」「地名+コード」「コードのみ」「複数語の地名」を分解、非該当は拒否',
      r.a&&r.a.code==='MQPJ+2V'&&r.a.locality==='港区'&&
      r.b2&&r.b2.code==='MQPJ+2V'&&r.b2.locality==='港区'&&
      r.c&&r.c.code==='MQPJ+2V'&&r.c.locality===null&&
      r.d&&r.d.locality==='東京都港区 芝公園'&&r.rej, JSON.stringify(r));
  }

  // R2: recoverNearestの性質(基準がセルの近くなら元のセルへ・遠ければ最も近い隣セルへ)
  {
    const r=await p.evaluate(()=>{
      const c=_plusCodeDecode('8Q7XMQPJ+2V');   // 元のフルコードの中心
      const eq=(u,v)=>u&&Math.abs(u.lat-v.lat)<1e-9&&Math.abs(u.lng-v.lng)<1e-9;
      const same1=eq(_plusCodeRecover('MQPJ+2V', c.lat, c.lng), c);                       // 4桁落ち(1°)
      const same2=eq(_plusCodeRecover('MQPJ+2V', c.lat+0.4, c.lng-0.4), c);               // 半セル未満のズレ
      const same3=eq(_plusCodeRecover('7XMQPJ+2V', c.lat+3, c.lng-3), c);                 // 2桁落ち(20°)
      const same4=eq(_plusCodeRecover('PJ+2V', c.lat+0.02, c.lng-0.02), c);               // 6桁落ち(0.05°)
      const adj=_plusCodeRecover('MQPJ+2V', c.lat+0.9, c.lng);                            // 半セル超→隣セルへ
      const adjOk=adj&&Math.abs(adj.lat-(c.lat+1))<1e-9&&Math.abs(adj.lng-c.lng)<1e-9;
      return { same1, same2, same3, same4, adjOk };
    });
    check('R2 基準が近ければ元のセルへ(2/4/6桁落ちとも)・半セルを超えると最も近い隣セルへ',
      r.same1&&r.same2&&r.same3&&r.same4&&r.adjOk, JSON.stringify(r));
  }

  // R3: E2E(「MQPJ+2V 港区」→基準地名ピッカーで選択→選んだ地点の近傍セルが観測点に)
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      getElevation = async () => 7;
      searchLocation = async () => [{ title:'港区役所', address:'東京都港区芝公園', lat:35.6581, lon:139.7514 }];
      const exp=_plusCodeRecover('MQPJ+2V', 35.6581, 139.7514);
      const el=document.getElementById('input-start-latlng');
      el.value='MQPJ+2V 港区';
      await handleLocationInput(el.value, true);
      const pickerShown=!document.getElementById('location-picker').classList.contains('hidden');
      const item=document.querySelector('#picker-list .picker-item');
      if (item) item.click();
      await new Promise(r=>setTimeout(r,200));
      return { pickerShown,
               latOk: Math.abs(appState.start.lat-exp.lat)<1e-9, lngOk: Math.abs(appState.start.lng-exp.lng)<1e-9,
               elev: appState.startApiElev };
    });
    check('R3 短縮形+基準地名→ピッカーで選択→選んだ地点の近傍セルの中心が観測点に(標高も取得経路)',
      r.pickerShown&&r.latOk&&r.lngOk&&r.elev===7, JSON.stringify(r));
  }

  // R4: 基準地名なしの短縮形は地図の中心を基準に展開
  {
    const r=await p.evaluate(async()=>{
      const c=glMap.getCenter();
      const exp=_plusCodeRecover('MQPJ+2V', c.lat, c.lng);   // 適用後に地図が動くので先に計算
      await handleLocationInput('MQPJ+2V', false);           // 目的点側で
      await new Promise(r=>setTimeout(r,100));
      return { latOk: Math.abs(appState.end.lat-exp.lat)<1e-9, lngOk: Math.abs(appState.end.lng-exp.lng)<1e-9 };
    });
    check('R4 地名を省いた短縮形は地図の中心を基準に展開(目的点)', r.latOk&&r.lngOk, JSON.stringify(r));
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
