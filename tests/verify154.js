// 第87ラウンド検証: v1.71.0
// 怒号の項目15: Googleプラスコード(Open Location Code)のフルコード入力。
//   ローカル復号(通信不要)・公式テストベクタ・既存の「緯度,経度」/Zipコード保護との共存・観測点設定のE2E。
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

// ---- V0: 版数の存在検査(版数ピンは最新のverify155へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.71.0の行がある', src.includes('Version 1.71.0 - ') || !!process.argv[2]);

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof _plusCodeDecode==='function',{timeout:8000});
  await p.waitForTimeout(400);

  // P1: 公式テストベクタ(open-location-codeのdecoding試験より)と不正入力の拒否
  {
    const r=await p.evaluate(()=>{
      const eq=(r,la,lo)=>r&&Math.abs(r.lat-la)<1e-9&&Math.abs(r.lng-lo)<1e-9;
      const ok1=eq(_plusCodeDecode('8FVC2222+22'), 47.0000625, 8.0000625);          // 10桁の中心
      const ok2=eq(_plusCodeDecode('4VCPPQGP+Q9'), -41.2730625, 174.7859375);       // 南半球
      const ok3=eq(_plusCodeDecode('62G20000+'), 0.5, -179.5);                      // パディング2桁
      const ok4=eq(_plusCodeDecode('7FG49Q00+'), 20.375, 2.775);                    // パディング6桁
      const ok5=eq(_plusCodeDecode('8FVC2222+22G'), 47.0000625, 8.000078125);       // 11桁グリッド
      const lower=eq(_plusCodeDecode('8fvc2222+22'), 47.0000625, 8.0000625);        // 小文字も可
      const bad=['MQPJ+2V','8Q7XMQPJ','8Q7X00PJ+','8Q7XMQPJ+2','ZZZZZZZZ+','35.65,139.74','']
        .every(c=>_plusCodeDecode(c)===null);
      return { ok1, ok2, ok3, ok4, ok5, lower, bad };
    });
    check('P1 公式テストベクタ5種+小文字が復号でき、不正な形(短縮形含む)は全て拒否',
      r.ok1&&r.ok2&&r.ok3&&r.ok4&&r.ok5&&r.lower&&r.bad, JSON.stringify(r));
  }

  // P2: parseInputでの共存(プラスコード・従来の緯度,経度・Zipコード保護)
  {
    const r=await p.evaluate(()=>{
      const pc=parseInput('8Q7XMQPJ+2V');
      const ll=parseInput('35.65,139.74');
      const zip=parseInput('1234567');
      const name=parseInput('東京タワー');
      return { pcTokyo: pc&&pc.lat>35&&pc.lat<36&&pc.lng>139&&pc.lng<140,
               ll: ll&&ll.lat===35.65&&ll.lng===139.74, zipNull: zip===null, nameNull: name===null };
    });
    check('P2 parseInput: プラスコード=東京付近の座標・「緯度,経度」従来どおり・数値のみ/地名はnullのまま',
      r.pcTokyo&&r.ll&&r.zipNull&&r.nameNull, JSON.stringify(r));
  }

  // P3: E2E(観測点の緯度経度欄にプラスコード→復号したセル中心が観測点に設定される)
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      getElevation = async () => 25;   // 標高APIのモック(ネットワーク遮断下)
      const exp=_plusCodeDecode('8Q7XMQPJ+2V');
      await handleLocationInput('8Q7XMQPJ+2V', true);
      return { latOk: Math.abs(appState.start.lat-exp.lat)<1e-9,
               lngOk: Math.abs(appState.start.lng-exp.lng)<1e-9,
               elev: appState.startApiElev };
    });
    check('P3 観測点欄のプラスコード入力→復号座標(セル中心)が観測点に設定・標高も取得経路に乗る',
      r.latOk&&r.lngOk&&r.elev===25, JSON.stringify(r));
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
