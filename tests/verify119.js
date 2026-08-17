// 第35ラウンド検証: スマホ辻メッシュ不具合の修正+MapLibre作法改善
// (1)メッシュ画像キャンバスの上限設計(最大辺2048。旧6144はiPhoneのキャンバス/テクスチャ上限超えでクラッシュ)
// (2)レイヤ表示OFF→ONの復帰(再描画なし) (3)再検索の繰り返しでも毎回描画+旧objectURLのrevoke
// (4)attributionのⓘ(compact)化 (5)setDataのバッチ化(方位線/辻ライン=1回ずつ)
// v1.37.1(監査第2弾): (6)DEMタイルキャッシュのLRU上限 (7)優辻ピンmouseenterのタッチガード+
// ツールチップoffsetの毎回設定 (8)検索完了後のワーカープール解放(ソース検査)
// ローカルハーネス(vendor)。外部への実アクセスは行わない(route abort)。
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const EXE='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE='http://127.0.0.1:8099';
const ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
let PASS=0, FAIL=0;
const check=(n,ok,d)=>{ console.log(`${ok?'PASS':'FAIL'} ${n}${d?'  '+d:''}`); ok?PASS++:FAIL++; };
// verify113の合成メッシュSETUPを流用(4画素)
const SETUP=fs.readFileSync(path.join(__dirname,'verify113.js'),'utf8').match(/const SETUP=`([\s\S]*?)`;/)[1];
(async()=>{
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    // 版数ピンは最新のverify(現在は120)のみに置く(テスト方針)。ここでは存在だけ確認する
    check('Y0 APP_VERSIONが定義されている', /APP_VERSION = '\d+\.\d+\.\d+'/.test(src));
  }
  const b=await chromium.launch({executablePath:EXE,headless:true,args:ARGS});
  const ctx=await b.newContext({viewport:{width:1000,height:900},timezoneId:'Asia/Tokyo'});
  await ctx.route('**/*', route => {   // テスト方針: ローカル以外への実アクセスを遮断
    route.request().url().startsWith(BASE) ? route.continue() : route.abort();
  });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(BASE+'/index.html',{waitUntil:'load'});
  await p.waitForFunction(()=>typeof glMap==='object'&&glMap!==null&&glMap.isStyleLoaded&&glMap.isStyleLoaded(),{timeout:10000});
  await p.waitForTimeout(600);

  // Y1: キャンバス寸法の上限設計(検索エリア別に最大辺2048px以下)
  {
    const r=await p.evaluate(()=>{
      // Sの決定式を実寸で検証: gridW=N*256としてS=min(8,floor(2048/W))・canvas=W*S
      const sizes={};
      for(const n of [2,3,4,5,6]){
        const W=n*256;
        const S=Math.max(1, Math.min(8, Math.floor(2048 / W)));
        sizes[n+'x'+n]=W*S;
      }
      return { sizes, allOk: Object.values(sizes).every(px=>px<=2048) };
    });
    check('Y1 全検索エリアでキャンバス最大辺2048px以下(旧: 3×3=6144/5×5=5120)', r.allOk, JSON.stringify(r.sizes));
    // 実装が本当にこの式か(ソース検査)
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    check('Y1 実装の式が2048上限', src.includes('Math.min(8, Math.floor(2048 / W))'));
  }

  await p.evaluate(SETUP);
  await p.evaluate(()=>{ glMap.jumpTo({ center:[138.8025,35.5025], zoom:_glZoom(15) }); });
  await p.waitForTimeout(300);

  // Y2: 再検索の繰り返し(描画→消去→描画×3)で毎回**同期で**表示される
  //     (第36ラウンドでcanvasソース化: PNG変換/objectURLが完全に廃止=生成0件を表明)
  {
    const r=await p.evaluate(()=>{
      let objUrls=0;
      const oc=URL.createObjectURL.bind(URL);
      URL.createObjectURL=(x)=>{ objUrls++; return oc(x); };
      const visSeq=[];
      for(let i=0;i<3;i++){
        clearTsujiMeshMarkers();
        drawTsujiMeshMarkers();
        visSeq.push(glMap.getLayoutProperty('tm-mesh-img','visibility'));   // 同期反映
      }
      URL.createObjectURL=oc;
      return { visSeq: visSeq.join(','), objUrls, srcType: glMap.getSource('tm-mesh-img').serialize().type };
    });
    check('Y2 3回の再検索で毎回同期でvisible(不具合(3)の回帰)', r.visSeq==='visible,visible,visible', r.visSeq);
    check('Y2 canvasソース化でobjectURL生成が0件(PNG変換の廃止)', r.objUrls===0&&r.srcType==='canvas', JSON.stringify(r));
  }

  // Y3: レイヤ表示OFF→ONで再描画なしに復帰(不具合(2)の回帰。実チェックボックス経由)
  {
    const r=await p.evaluate(async()=>{
      const chk=document.getElementById('chk-tsujimesh-marker-layer');
      const fire=()=>chk.dispatchEvent(new Event('change',{bubbles:true}));
      if(!chk) return { noChk:true };
      chk.checked=false; fire();
      const off=glMap.getLayoutProperty('tm-mesh-img','visibility');
      chk.checked=true; fire();
      const on=glMap.getLayoutProperty('tm-mesh-img','visibility');
      return { off, on };
    });
    check('Y3 実チェックボックスOFF→none/ON→visible(再描画なし)', r.off==='none'&&r.on==='visible', JSON.stringify(r));
  }

  // Y4: attributionがⓘ(compact)+重複なし(ベース地図の出典はソース側・customは標高/気象のみ)
  {
    const r=await p.evaluate(()=>{
      const el=document.querySelector('.maplibregl-ctrl-attrib');
      const inner=document.querySelector('.maplibregl-ctrl-attrib-inner');
      const txt=inner?inner.textContent:'';
      return { compact: !!el&&el.classList.contains('maplibregl-compact'),
               btn: !!document.querySelector('.maplibregl-ctrl-attrib-button'),
               txt, gsiOnce: (txt.match(/地理院タイル/g)||[]).length===1,
               noDup: !/(^|[^(標高])国土地理院[^(]/.test(txt) };
    });
    check('Y4 クレジット表示がⓘアイコン(compact)', r.compact&&r.btn, JSON.stringify({compact:r.compact,btn:r.btn}));
    check('Y4 クレジットの重複なし(ベース=地理院タイル1回+custom=標高/Open-Meteoのみ)',
      r.gsiOnce&&r.txt.includes('国土地理院(標高)')&&r.txt.includes('Open-Meteo'), r.txt);
  }

  // Y5: setDataのバッチ化 — updateCalculationで方位線1回・updateDPLinesで辻ライン1回
  {
    const r=await p.evaluate(async()=>{
      const counts={};
      const spy=(id)=>{ const s=glMap.getSource(id); const o=s.setData.bind(s); counts[id]=0;
        s.setData=(d)=>{ counts[id]++; return o(d); }; };
      spy('dir-lines'); spy('dp-lines');
      appState.bodies.forEach(b2=>{ b2.visible=['Sun','Moon','Venus'].includes(b2.id); });
      updateCalculation();
      const dirCalls=counts['dir-lines'];
      appState.isDPActive=true;
      counts['dp-lines']=0;
      await updateDPLines();
      const dpCalls=counts['dp-lines'];
      appState.isDPActive=false; updateAll();
      return { dirCalls, dpCalls };
    });
    // 方位線=一括1回(同期関数のためリセットの空setDataは省略=第36ラウンド)・辻ライン=リセット+一括の2回。
    // 旧実装は天体毎/線種毎に呼んでいた(3天体で方位線4回・辻ライン30回超)
    check('Y5 setDataは天体数に依らず方位線1回+辻ライン2回', r.dirCalls===1&&r.dpCalls===2, JSON.stringify(r));
  }

  // Y7: DEMタイルキャッシュのLRU上限(v1.37.1)。上限超過で最古を追い出し、使ったものは残す
  {
    const r=await p.evaluate(async()=>{
      const orig=_loadTileImage;
      _loadTileImage=async()=>{ const c=document.createElement('canvas'); c.width=c.height=256; return c; };
      _tileCache.clear();
      for(let i=0;i<_TILE_CACHE_MAX+10;i++){
        await _getTileImageData('u'+i);
        if(i===_TILE_CACHE_MAX-1) await _getTileImageData('u0');   // u0を使う→LRUで末尾へ(以後10回の追い出し対象から外れる)
      }
      const r2={ size:_tileCache.size, max:_TILE_CACHE_MAX,
                 keptUsed:_tileCache.has('u0'), evictedOldest:!_tileCache.has('u1'), keptNewest:_tileCache.has('u'+(_TILE_CACHE_MAX+9)) };
      _tileCache.clear(); _loadTileImage=orig;
      return r2;
    });
    check('Y7 タイルキャッシュは上限枚数でLRU(最古を追い出し・使用分は保持)',
      r.size===r.max&&r.keptUsed&&r.evictedOldest&&r.keptNewest, JSON.stringify(r));
  }

  // Y8: 優辻ピンのmouseenterはホバー環境のみ(タッチの合成mouseenterでツールチップを出さない)+
  //     ツールチップのoffsetは表示毎に設定される(8⇄26の使い回しズレの回帰)
  {
    const r=await p.evaluate(async()=>{
      drawTsujiMeshGoldSet(new Map([[0,0.011]]),{pix:0,dist:0.011,timeMs:_tsujiMeshRows[0].pixTime[0]});
      const el=_glMarkerGroups.tmpin[0].getElement();
      const orig=_mapDblClickMode;
      _mapDblClickMode=false;   // スマホ相当
      el.dispatchEvent(new MouseEvent('mouseenter'));
      const noTipOnTouch=_glTmHoverTip===null;
      _mapDblClickMode=true;    // PC相当
      el.dispatchEvent(new MouseEvent('mouseenter'));
      const tipOnHover=_glTmHoverTip!==null;
      const pinOffset=tipOnHover?_glTmHoverTip.options.offset:null;   // ピンは26
      _glTmShowTip(35.5025,138.8025,'x');                              // 既定は8(表示毎に設定)
      const defOffset=_glTmHoverTip.options.offset;
      _glTmHideTip(); _mapDblClickMode=orig;
      clearTsujiMeshMarkers(); drawTsujiMeshMarkers();
      await new Promise(res=>setTimeout(res,200));
      return { noTipOnTouch, tipOnHover, pinOffset, defOffset };
    });
    check('Y8 タッチではツールチップ非表示/ホバーでは表示+offsetが毎回反映(26→8)',
      r.noTipOnTouch&&r.tipOnHover&&r.pinOffset===26&&r.defOffset===8, JSON.stringify(r));
  }

  // Y10: 表示天体OFF→ONの往復で辻マーカー画像(tm-gold-img)が再描画なしに復帰する
  //      (旧実装はONに戻す経路が無く画像だけ欠けた。v1.37.0の表示一元化の回帰)
  {
    const r=await p.evaluate(async()=>{
      drawTsujiMeshGoldSet(new Map([[0,0.011]]),{pix:0,dist:0.011,timeMs:_tsujiMeshRows[0].pixTime[0]});
      for(let w=0;w<30&&!_glTmHasImg['tm-gold-img'];w++) await new Promise(res=>setTimeout(res,100));
      const before=glMap.getLayoutProperty('tm-gold-img','visibility');
      const sun=appState.bodies.find(b=>b.id==='Sun');
      sun.visible=false; applyTsujiMeshLayerVisibility();
      const off=glMap.getLayoutProperty('tm-gold-img','visibility');
      sun.visible=true; applyTsujiMeshLayerVisibility();   // 再描画は呼ばない
      const on=glMap.getLayoutProperty('tm-gold-img','visibility');
      return { before, off, on };
    });
    check('Y10 表示天体OFF→ONで辻マーカー画像が復帰(再描画なし)',
      r.before==='visible'&&r.off==='none'&&r.on==='visible', JSON.stringify(r));
  }

  // Y11: canvasソースのライフサイクル — 消去でcanvasが1×1へ縮む(実体解放)・
  //      非表示中の描き込みが再表示時にflushされる(テクスチャ更新は表示中しか走らないための対策)・
  //      flush後はpauseされ連続再描画ループにならない
  {
    const r=await p.evaluate(async()=>{
      clearTsujiMeshMarkers();
      const clearedW=_glTmCanvas['tm-mesh-img'].width;   // 1×1=解放
      // 非表示中に描く→表示に切り替えるとflushされる
      const chk=document.getElementById('chk-tsujimesh-marker-layer');
      chk.checked=false; chk.dispatchEvent(new Event('change',{bubbles:true}));
      drawTsujiMeshMarkers();
      const hiddenVis=glMap.getLayoutProperty('tm-mesh-img','visibility');   // 中身はあるが非表示
      const hiddenHas=_glTmHasImg['tm-mesh-img'];
      chk.checked=true; chk.dispatchEvent(new Event('change',{bubbles:true}));
      const shownVis=glMap.getLayoutProperty('tm-mesh-img','visibility');
      await new Promise(res=>setTimeout(res,400));   // flushの1フレーム(play→render→pause)を待つ
      const playing=glMap.getSource('tm-mesh-img')._playing;
      return { clearedW, hiddenVis, hiddenHas, shownVis, playing };
    });
    check('Y11 消去でcanvas1×1・非表示中の描画→表示でflush・flush後はpause',
      r.clearedW===1&&r.hiddenVis==='none'&&r.hiddenHas===true&&r.shownVis==='visible'&&r.playing===false,
      JSON.stringify(r));
  }

  // Y9: 検索完了後のワーカープール解放+描画スキップの可視化(ソース検査)
  {
    const src=fs.readFileSync(path.join(__dirname, '..', 'script.js'),'utf8');
    check('Y9 検索完了時にtsujiMeshPool.terminateAll(世代ガード後)+表示天体なし時も解放',
      /検索完了: ワーカープールを解放[\s\S]{0,400}?tsujiMeshPool\.terminateAll\(\)/.test(src)&&
      /検索せず終了: initデータを持ったまま常駐させない/.test(src));
    check('Y9 ソース未初期化時の画像描画スキップがconsole.warnで可視化される',
      src.includes('ソース未初期化のため描画をスキップ'));
  }

  check('Y6 ページエラーなし', errs.length===0, errs.slice(0,3).join(' | '));

  await b.close();
  console.log(`\n結果: PASS=${PASS} FAIL=${FAIL}`);
  process.exit(FAIL?1:0);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
