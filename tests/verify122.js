// 第38ラウンド検証: 観測点/目的点検索ボックスの正規化規則の整理(海外地名検索を可能に)
// - 英字のみ/海外言語のみ: 全角変換しない(旧: 全入力を全角化→OSMで海外地名が引けなかった)
// - 日本語を含む入力: 従来どおり半角英数記号を全角へ(住所の1-2-3の揺れ対策を維持)
// - 数値のみ(カンマ無し): 検索スキップ(OSMの郵便番号解釈で海外へ飛ぶ実測ありのため維持)
// ローカルハーネス(vendor)。外部への実アクセスは行わない(route abortでGSI/OSMをモック)。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };
(async()=>{
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    // 版数ピンは最新のverify(現在は123)のみに置く(テスト方針)。ここでは存在だけ確認する
    check('V0 APP_VERSIONが定義されている', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
  }
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  const gsiQueries=[], osmQueries=[];
  await ctx.route('**/*', route => {
    const u=route.request().url();
    if (u.startsWith(BASE)) return route.continue();
    if (u.includes('msearch.gsi.go.jp')) {
      gsiQueries.push(decodeURIComponent(u.split('q=')[1]||''));
      return route.fulfill({contentType:'application/json', body:'[]'});   // GSIヒット無し→OSMへ
    }
    if (u.includes('nominatim.openstreetmap.org')) {
      const q=decodeURIComponent((u.split('q=')[1]||'').split('&')[0]);
      osmQueries.push(q);
      const body=q==='Ayers Rock'
        ? JSON.stringify([{lat:'-25.3455545',lon:'131.0369615',display_name:'Uluru, Northern Territory, Australia'}])
        : '[]';
      return route.fulfill({contentType:'application/json', body});
    }
    return route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null,{timeout:10000});
  await p.waitForTimeout(400);

  // V1: 英字のみの入力は変換されず、そのままOSMまで届いてヒットする(海外地名検索)
  {
    const r=await p.evaluate(async()=>{
      let picked=null;
      window.showLocationPicker=(results)=>{ picked=results; };
      await handleLocationInput('Ayers Rock', true);
      return { box: document.getElementById('input-start-latlng').value,
               n: picked?picked.length:0,
               hit: picked&&picked[0]?{lat:picked[0].lat,t:picked[0].title}:null };
    });
    check('V1 英字入力は無変換のまま検索されOSMでヒット(検索ボックスも半角のまま)',
      r.box==='Ayers Rock'&&r.n===1&&r.hit&&Math.abs(r.hit.lat-(-25.3455545))<1e-6, JSON.stringify(r));
    check('V1 OSMへのクエリが半角のまま', osmQueries.includes('Ayers Rock'), osmQueries.join('|'));
  }

  // V2: 日本語を含む入力は従来どおり全角化(住所の1-2-3揺れ対策の維持)
  {
    const r=await p.evaluate(async()=>{
      window.showLocationPicker=()=>{};
      const oa=window.alert; window.alert=()=>{};
      await handleLocationInput('銀座1-2-3', true);
      window.alert=oa;
      return { box: document.getElementById('input-start-latlng').value };
    });
    // 期待値は実装と同じ写像(+0xFEE0)で組み立てる(全角ハイフンU+FF0Dと数学記号U+2212の取り違え防止)
    const zen='銀座'+'1-2-3'.replace(/./g,c=>String.fromCharCode(c.charCodeAt(0)+0xFEE0));
    check('V2 日本語入力は半角英数記号が全角化される(従来挙動の維持)', r.box===zen, JSON.stringify(r));
    check('V2 GSIへのクエリも全角', gsiQueries.some(q=>q===zen), gsiQueries.join('|'));
  }

  // V3: 数値のみ(カンマ無し)は検索スキップ(Zipコード誤認で海外へ飛ばない。OSMへ一切問い合わせない)
  {
    const before=osmQueries.length;
    const r=await p.evaluate(async()=>{
      let alerted=false; const oa=window.alert; window.alert=()=>{alerted=true;};
      await handleLocationInput('1234567', true);
      window.alert=oa;
      return { alerted };
    });
    check('V3 数値のみはOSMへ問い合わせず検索スキップ(郵便番号ジャンプ防止の維持)',
      r.alerted&&osmQueries.length===before, `osm=${osmQueries.length-before}`);
  }

  check('V4 ページエラーなし', errs.length===0, errs.slice(0,3).join(' | '));

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
