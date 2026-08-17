// 第80ラウンド検証: v1.64.0
// ①月間フィルタのURLキー26個+短縮辞書v15 ②My辻リストCSV 45→58列(37〜49列目=月間)
// ③地平線下の閉じ蓋(地表の下に天の川が透けない) ④MederuU sync.js(自己テスト+実走)
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };

const target = process.argv[2] || path.join(__dirname, '..', 'script.js');
const src = fs.readFileSync(target, 'utf8');

// ---- V0: 版数の存在検査(版数ピンは最新のverify148へ移行済み) ----
check('V0 APP_VERSIONがある', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに1.64.0の行がある', src.includes('Version 1.64.0 - ') || !!process.argv[2]);

// ---- S: MederuU sync.js(Node内で自己テスト+dry-run実走) ----
{
  const syncPath = path.join(__dirname, '..', 'ClaudeMederuU', 'mederuu-repo-staging', 'sync.js');
  let selfOk = false, out = '';
  try { out = execFileSync('node', [syncPath, '--self-test'], { encoding: 'utf8' }); selfOk = /FAIL=0/.test(out); }
  catch (e) { out = String(e.stdout || e); }
  check('S1 sync.js自己テスト(検査パターン8種)全PASS', selfOk, out.split('\n').filter(l=>l.startsWith('FAIL')).join(' '));
  let dryOk = false, dry = '';
  try { dry = execFileSync('node', [syncPath, path.join(__dirname, '..'), 'soranotsuji', '--dry-run'], { encoding: 'utf8' }); dryOk = true; }
  catch (e) { dry = String(e.stdout || e); }
  const skip0 = /秘密検査スキップ: 0件/.test(dry);
  const copied = /コピー\/更新: [1-9]\d*件/.test(dry);
  check('S2 宙の辻のdry-run実走: 吸い上げあり+秘密検査スキップ0件(終了コード0)', dryOk && skip0 && copied,
    (dry.match(/コピー.*件/)||[''])[0]);
}

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof drawSoramado==='function',{timeout:8000});
  await p.waitForTimeout(800);

  // U1: 月間フィルタのURLキー+短縮辞書v15の往復+実URLでの復元
  {
    const r=await p.evaluate(()=>{
      window.confirm=()=>true; window.alert=()=>{};
      const v15=_QP_SEED_VERSIONS.length>=15;
      const dictHas=_QP_SEED_VERSIONS[14].includes('&tsujiMonthFilter=false')&&_QP_SEED_VERSIONS[14].includes('&tsujiMeshMonth12=false');
      const params=buildCommonUrlParams(false);
      params.set('mode','tsujisearch');
      params.set('tsujiMonthFilter','true');
      params.set('tsujiMonth8','true');
      const enc=encodeQueryParam(params.toString());
      const dec=decodeQueryParam(enc);
      return { roundtrip: dec===params.toString(), v15, dictHas, qs: params.toString() };
    });
    check('U1 短縮URL辞書v15(月間26シード)+往復一致', r.roundtrip&&r.v15&&r.dictHas, JSON.stringify({v15:r.v15,dictHas:r.dictHas,rt:r.roundtrip}));
    const p3=await ctx.newPage();
    await p3.goto(BASE+'/index.html?'+r.qs,{waitUntil:'load'});
    await p3.waitForFunction(()=>typeof appState!=='undefined'&&typeof drawSoramado==='function',{timeout:8000});
    await p3.waitForTimeout(600);
    const rr=await p3.evaluate(()=>({mf:appState.tsujiMonthFilter,m8:appState.tsujiMonth8,m7:appState.tsujiMonth7,
      chk:document.getElementById('chk-tsuji-month-8').checked}));
    await p3.close();
    check('U1 実URLで開くと月間フィルタが復元される(8月=on・7月=off・チェックボックス反映)',
      rr.mf===true&&rr.m8===true&&rr.m7===false&&rr.chk===true, JSON.stringify(rr));
  }

  // C1: My辻リストCSV 58列(出力ヘッダ・出力行・取り込みの往復・旧45列の互換)
  {
    const r=await p.evaluate(()=>{
      const t={ id:9, name:'月間往復', days:365, bodyIds:'Sun', obsId:1, tgtId:1, baseAz:100, baseAlt:1,
        offsetAz:0, offsetAlt:0, toleranceAz:15, toleranceAlt:15, centerMode:'point', mwOffsetAngle:0,
        moonFilter:false, moonBase:14.8, moonTolerance:2,
        timeFilter:false, startMode:'sunset', startTime:'00:00', startPrePost:false, startPrePostDir:'before', startOffset:'00:00',
        endMode:'sunrise', endTime:'00:00', endPrePost:false, endPrePostDir:'before', endOffset:'00:00',
        dowFilter:false, dowMon:false, dowTue:false, dowWed:false, dowThu:false, dowFri:false, dowSat:false, dowSun:false,
        monthFilter:true, month1:false, month2:false, month3:false, month4:false, month5:false, month6:false,
        month7:false, month8:true, month9:false, month10:false, month11:false, month12:true,
        accuracyFilter:false, accDblCircle:false, accCircle:false, accTriangle:false, accDash:false,
        elevationOption:false, elevOK:false, elevNG:false, checked:false, memo:'m' };
      const csv=_buildMyTsujiCsv([t]);
      const lines=csv.trim().split('\r\n');
      const headCols=lines[0].split(',');
      const rowCols=lines[1].split(',');
      const back=parseMyTsujiCsvLine(rowCols, 2);
      const roundtrip=back&&back.monthFilter===true&&back.month8===true&&back.month12===true&&back.month7===false&&back.memo==='m';
      // 旧45列(月間列なし)も列数判別で読める(月間=全オフ)
      const cols45=rowCols.slice(0,36).concat(rowCols.slice(49));
      const old=parseMyTsujiCsvLine(cols45, 3);
      const oldOk=old&&old.monthFilter===false&&old.month8===false&&old.dowFilter===false&&old.memo==='m';
      return { headN:headCols.length, rowN:rowCols.length,
        h37:headCols[36], h38:headCols[37], h49:headCols[48], h50:headCols[49],
        roundtrip, oldOk };
    });
    check('C1 CSVは58列(37列目=月間フィルタ・38〜49列目=1〜12月・50列目=精度フィルタ)',
      r.headN===58&&r.rowN===58&&r.h37==='月間フィルタ'&&r.h38==='月間1月フィルタ'&&r.h49==='月間12月フィルタ'&&r.h50==='精度フィルタ',
      JSON.stringify({headN:r.headN,h37:r.h37,h50:r.h50}));
    check('C1 出力→取り込みの往復で月間が保たれる(8月・12月=on/7月=off)', r.roundtrip);
    check('C1 旧45列形式も列数判別で読める(月間=全オフ補完)', r.oldOk);
  }

  // G1: 地平線下の閉じ蓋 — 宙の窓を開くと球帽が構築され、観測点標高で伏角キーが変わる
  {
    const r2=await p.evaluate(async()=>{
      appState.start={lat:35.6585,lng:139.7454,elev:150}; appState.startApiElev=18.5; appState.startHeight=131.5;
      if(!appState.isSoramadoActive) toggleSoramado();
      await new Promise(r=>setTimeout(r,1500));
      const built=_smGroundGrp&&_smGroundGrp.children.length===1;
      const key1=_smGroundKey;
      const posAttr=built?_smGroundGrp.children[0].geometry.getAttribute('position'):null;
      // 頂点の最高高度角がほぼ-伏角(150m→約-0.363°)・最低が約-89.5°
      let maxAlt=-90, minAlt=90;
      if(posAttr){
        for(let i=0;i<posAttr.count;i++){
          const x=posAttr.getX(i),y=posAttr.getY(i),z=posAttr.getZ(i);
          const alt=Math.asin(z/Math.hypot(x,y,z))*180/Math.PI;
          if(alt>maxAlt)maxAlt=alt; if(alt<minAlt)minAlt=alt;
        }
      }
      const dip=getHorizonDip(150);
      // 観測点標高を変える→伏角キーが変わり再構築
      appState.start.elev=929;
      _smUpdateGroundCap();
      const key2=_smGroundKey;
      appState.start.elev=150; _smUpdateGroundCap();
      toggleSoramado();
      return { built, key1, key2, maxAlt, minAlt, dip };
    });
    check('G1 宙の窓に地平線下の閉じ蓋が構築される(上端=−伏角・下端=−89.5°)',
      r2.built&&Math.abs(r2.maxAlt-(-r2.dip))<0.01&&Math.abs(r2.minAlt-(-89.5))<0.01,
      JSON.stringify({maxAlt:+r2.maxAlt.toFixed(3),dip:+r2.dip.toFixed(3),minAlt:+r2.minAlt.toFixed(2)}));
    check('G1 観測点標高の変更で伏角キーが変わり再構築される', r2.key1!==r2.key2, `${r2.key1}→${r2.key2}`);
  }

  check('E ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
