// 第99→100→101→102→103ラウンド検証: v1.85.0
// 第103: 読みの「-0.0」表示の解消(前/右の分解の丸め残差±1e-16mが負に振れても表示精度0で+0.0と出す)。
// 観測点の回転ボタン(依頼者仕様・第102で最終確定): 体の向きとカメラの向きは同じ
//   (どちらも基準方位角+カメラオフセット方位角)。回転ボタンはカメラオフセット方位角を±1°回す
//   (=カメラ向きボタンの方位側と同じ動き。値も入力欄も変わり、画面も移動の向きも一緒に回る)。
//   観測点の位置は動かず、前後左右の移動ボタンは体の向き基準で歩く。回転を戻すのはカメラ側の「リセット」。
//   段構成=1段目:左/後/前/右・2段目:左回転/下/上/右回転・3段目:読み・4段目:リセット/位置反映・
//   5段目:📷4・6段目:リセット/カメラ反映(第100ラウンドの依頼者指定)。
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

// ---- V0: 版数の存在(等値ピンは最新のverify165へ移譲=第108ラウンド) ----
check('V0 APP_VERSIONが存在(版数ピンはverify165が持つ)', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
check('V0 Version Historyに版の行がある', /Version \d+\.\d+\.\d+ - /.test(src) || !!process.argv[2]);

(async()=>{
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:900,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => { route.request().url().startsWith(BASE) ? route.continue() : route.abort(); });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof _smCamNudgeMove==='function',{timeout:8000});
  await p.waitForTimeout(400);

  // B1: 段構成(依頼者指定の6段)
  {
    const r=await p.evaluate(()=>{
      const rowOf=id=>document.getElementById(id).closest('.control-row');
      const ids=row=>[...row.querySelectorAll('button')].map(b=>b.id);
      const r1=rowOf('btn-sora-move-left'), r2=rowOf('btn-sora-move-rot-left'),
            r3=rowOf('btn-sora-move-reset'), r5=rowOf('btn-sora-cam-left'), r6=rowOf('btn-sora-cam-reset');
      const readoutRow=document.getElementById('sora-move-readout').closest('.control-row');
      return {
        row1: ids(r1), row2: ids(r2), row4: ids(r3), row5: ids(r5), row6: ids(r6),
        order: (r1.compareDocumentPosition(r2)&4) && (r2.compareDocumentPosition(readoutRow)&4) &&
               (readoutRow.compareDocumentPosition(r3)&4) && (r3.compareDocumentPosition(r5)&4) &&
               (r5.compareDocumentPosition(r6)&4) ? true : false };
    });
    check('B1 1段目=左/後/前/右', JSON.stringify(r.row1)===JSON.stringify(['btn-sora-move-left','btn-sora-move-back','btn-sora-move-fwd','btn-sora-move-right']), JSON.stringify(r.row1));
    check('B1 2段目=左回転/下/上/右回転', JSON.stringify(r.row2)===JSON.stringify(['btn-sora-move-rot-left','btn-sora-move-down','btn-sora-move-up','btn-sora-move-rot-right']), JSON.stringify(r.row2));
    check('B1 段の順序(移動→回転/縦→読み→リセット/位置反映→📷→リセット/カメラ反映)',
      r.order && JSON.stringify(r.row4)===JSON.stringify(['btn-sora-move-reset','btn-sora-move-apply']) &&
      JSON.stringify(r.row5)===JSON.stringify(['btn-sora-cam-left','btn-sora-cam-down','btn-sora-cam-up','btn-sora-cam-right']) &&
      JSON.stringify(r.row6)===JSON.stringify(['btn-sora-cam-reset','btn-sora-cam-apply']), JSON.stringify({order:r.order,row4:r.row4,row6:r.row6}));
  }

  // H1: 回転=カメラオフセット方位角が回る(値も入力欄も画面も)。基準方位角と観測点の位置は不変
  {
    const r=await p.evaluate(async()=>{
      window.confirm=()=>true; window.alert=()=>{};
      if(!appState.isSoramadoActive) toggleSoramado();
      await new Promise(r=>setTimeout(r,500));
      appState.soraBaseAz=0; appState.soraOffsetAz=0; appState.soraOffsetAlt=0; appState.soraBaseAlt=0;
      _smObsNudge={e:0,n:0,u:0}; _smCamNudgeBase=null;
      drawSoramado();
      const bearing0=(()=>{ const d=_smCamera.getWorldDirection(new THREE.Vector3()); return Math.atan2(d.x,d.y)*180/Math.PI; })();
      document.getElementById('btn-sora-move-rot-right').click();
      await new Promise(r=>setTimeout(r,100));
      const bearing1=(()=>{ const d=_smCamera.getWorldDirection(new THREE.Vector3()); return Math.atan2(d.x,d.y)*180/Math.PI; })();
      const shown=document.getElementById('input-sora-ctrl-offset-az').value;
      const mid={ offAz:appState.soraOffsetAz, baseAz:appState.soraBaseAz, shown,
                  nudge:{..._smObsNudge}, bearing0, bearing1,
                  readout:document.getElementById('sora-move-readout').textContent };
      // カメラ側の「リセット」で回転が戻る(回転ボタンも戻り先の仕組みに乗っている)
      document.getElementById('btn-sora-cam-reset').click();
      await new Promise(r=>setTimeout(r,100));
      mid.offAzAfterCamReset=appState.soraOffsetAz;
      mid.shownAfterCamReset=document.getElementById('input-sora-ctrl-offset-az').value;
      return mid;
    });
    check('H1 右回転→カメラオフセット方位角が+1°(値と入力欄)。基準方位角/観測点の移動は不変・読みは空のまま',
      r.offAz===1&&r.shown==='1.0000'&&r.baseAz===0&&!r.nudge.e&&!r.nudge.n&&!r.nudge.u&&r.readout==='',
      JSON.stringify({offAz:r.offAz,shown:r.shown,baseAz:r.baseAz,nudge:r.nudge,readout:r.readout}));
    check('H1 画面(カメラの向き)も体と一緒に右へ1°回る', Math.abs(r.bearing0)<0.01&&Math.abs(r.bearing1-1)<0.01,
      JSON.stringify({bearing0:+r.bearing0.toFixed(4),bearing1:+r.bearing1.toFixed(4)}));
    check('H1 カメラ側の「リセット」で回転が戻る(0°へ)', r.offAzAfterCamReset===0&&r.shownAfterCamReset==='0.0000',
      JSON.stringify({offAz:r.offAzAfterCamReset,shown:r.shownAfterCamReset}));
  }

  // H2: 回した向きで歩く(北向き+オフセット90°→「前▲」で東へ1m)+読みの分解も体の向き基準
  {
    const r=await p.evaluate(async()=>{
      appState.soraBaseAz=0; appState.soraOffsetAz=90;
      _smObsNudge={e:0,n:0,u:0};
      document.getElementById('btn-sora-move-fwd').click();
      await new Promise(r=>setTimeout(r,50));
      const n={..._smObsNudge};
      const readout=document.getElementById('sora-move-readout').textContent;
      return { n, readout };
    });
    check('H2 北向き+オフセット90°の「前▲」は東へ1m(e≈1, n≈0)', Math.abs(r.n.e-1)<1e-9&&Math.abs(r.n.n)<1e-9, JSON.stringify(r.n));
    check('H2 読みは体の向き基準で「前+1.0m」(回転の項は出さない)', r.readout==='移動中: 上+0.0m 前+1.0m 右+0.0m', r.readout);
  }

  // H2b: 回転ボタンで読みの前/右の分解もその場で読み直す(北へ1mの移動が、89→90°回転後は「右-1.0m」)
  {
    const r=await p.evaluate(async()=>{
      appState.soraBaseAz=0; appState.soraOffsetAz=89; _smCamNudgeBase=null;
      _smObsNudge={e:0,n:1,u:0}; _smObsNudgeReadout();
      document.getElementById('btn-sora-move-rot-right').click();
      await new Promise(r=>setTimeout(r,50));
      return { offAz:appState.soraOffsetAz, readout:document.getElementById('sora-move-readout').textContent };
    });
    check('H2b 回転ボタンで読みも即再分解(北1mの移動が右-1.0mへ)', r.offAz===90&&r.readout==='移動中: 上+0.0m 前+0.0m 右-1.0m', JSON.stringify(r));
  }

  // F1: 読みに「-0.0」を出さない(第103)。分解の丸め残差(負の極小値)は表示精度0.1mで+0.0へ
  {
    const r=await p.evaluate(async()=>{
      appState.soraBaseAz=0; appState.soraOffsetAz=0;
      _smObsNudge={e:0,n:-1e-13,u:0}; _smObsNudgeReadout();   // 数学上0の前成分が負の残差になった状況を注入
      const injected=document.getElementById('sora-move-readout').textContent;
      // 実操作の掃引: 基準方位角を変えながら「右▶︎」1回→読みの前は常に+0.0
      // (残差の符号は方位角次第で負にもなる。60°/100°は負になることを事前計算で確認済みの角)
      const degs=[...Array.from({length:52},(_,i)=>i*7), 60, 100];
      const bad=[];
      for(const deg of degs){
        appState.soraBaseAz=deg; _smObsNudge={e:0,n:0,u:0};
        document.getElementById('btn-sora-move-right').click();
        const t=document.getElementById('sora-move-readout').textContent;
        if(t.includes('-0.0')) bad.push(deg+':'+t);
      }
      _smObsNudge={e:0,n:0,u:0}; appState.soraBaseAz=0; appState.soraOffsetAz=90; _smObsNudgeReadout();   // H3の前提(オフセット90°)へ復元
      return { injected, bad };
    });
    check('F1 負の丸め残差でも読みは「前+0.0m」(注入で実測)', r.injected==='移動中: 上+0.0m 前+0.0m 右+0.0m', r.injected);
    check('F1 基準方位角の掃引(54方位×右▶︎1回・負残差の60°/100°込み)で「-0.0」が一度も出ない', r.bad.length===0, r.bad.slice(0,3).join(' | '));
  }

  // H3: 移動側のリセットは位置のみ(回転=オフセットは残る)・位置反映は位置だけ確定しオフセット不変
  {
    const r=await p.evaluate(async()=>{
      document.getElementById('btn-sora-move-reset').click();
      const afterReset={ offAz:appState.soraOffsetAz, nudge:{..._smObsNudge} };
      // 移動なしで位置反映→何もしない(観測点もオフセットも不変)
      getElevation=async()=>0;
      const lat0=appState.start.lat, lng0=appState.start.lng;
      await _smObsNudgeApply();
      const noMove={ latSame: appState.start.lat===lat0&&appState.start.lng===lng0, offAz:appState.soraOffsetAz };
      // 移動ありで位置反映→位置は確定・オフセット(体の向き)は不変
      _smObsNudge={e:2,n:0,u:0};
      await _smObsNudgeApply();
      await new Promise(r=>setTimeout(r,200));
      const dEm=(appState.start.lng-lng0)*111320*Math.cos(lat0*Math.PI/180);
      const after={ moved: Math.abs(dEm-2)<0.01, offAz:appState.soraOffsetAz, nudge:{..._smObsNudge} };
      appState.soraOffsetAz=0; _smCamNudgeBase=null; soraSyncUI(); _smObsNudgeReadout(); drawSoramado();
      return { afterReset, noMove, after };
    });
    check('H3 移動側のリセットは位置のみ0へ(回転=オフセット90°は残る)', r.afterReset.offAz===90&&!r.afterReset.nudge.e&&!r.afterReset.nudge.n&&!r.afterReset.nudge.u, JSON.stringify(r.afterReset));
    check('H3 移動なしの位置反映は何もしない(観測点もオフセットも不変)', r.noMove.latSame&&r.noMove.offAz===90, JSON.stringify(r.noMove));
    check('H3 移動ありの位置反映=位置だけ確定(東2m)・オフセットは不変', r.after.moved&&r.after.offAz===90&&!r.after.nudge.e, JSON.stringify(r.after));
  }

  check('E1 ページエラーなし', errs.length===0, errs.join(' | ').slice(0,300));
  await ctx.close();
  console.log(`---- PASS=${PASS} FAIL=${FAIL}`);
  await b.close();
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('HARNESS ERROR:',e); process.exit(2); });
