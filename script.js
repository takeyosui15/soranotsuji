/*
宙の辻 - Sora no Tsuji
Copyright (c) 2026- Sora no Tsuji Project

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

Version History:
Version 1.19.2 - 2026-05-01: fix: 辻検索とMy辻検索の精度不整合、辻検索とMy辻検索の計算中の観測点/目的点/日時の動的問題を修正
Version 1.19.1 - 2026-04-22: fix: 方位角/視高度4桁精度、精度角距離5桁精度、辻検索/My辻検索に精度フィルタ、各種不具合修正（件数表示、南中時/視半径、天体ID反映等）
Version 1.19.0 - 2026-04-18: feat: My天体改修、My観測点、My目的点、My辻検索、バックアップ/インポートの機能追加
Version 1.18.1 - 2026-04-05: fix: URL取得形式を3種類(日時固定、日時半固定、アクセス日時)に修正、マーカー位置を微調整
Version 1.18.0 - 2026-04-04: feat: マーカー色青赤、既定表示天体複数追加、encodeURL.html追加、URL取得ボタン×2追加
Version 1.17.3 - 2026-03-25: fix: Hom/推山ボタンのリセット/登録時に地図のズームを解除
Version 1.17.2 - 2026-03-25: fix: 既定目的点の富士山の緯度経度と標高を修正、ヘルプの内容を見直し
Version 1.17.1 - 2026-03-21: feat: 観測点/目的点標高、オフセット方位距離/視高距離、表示天体詳細表記
Version 1.17.0 - 2026-03-06: feat: 薄明ジャンプ機能追加、日出/日入/月出/月入ジャンプに視高度を表示
Version 1.16.9 - 2026-02-28: fix: 気差係数チェックボックスでフォームの有効/無効切り替え機能追加
Version 1.16.8 - 2026-02-28: fix: 辻Dayボタンの削除
Version 1.16.7 - 2026-02-28: fix: OSMフォールバックの追加、地図タイルのURL修正
Version 1.16.6 - 2026-02-28: fix: 辻Day/辻検索結果を表ソート化、地名検索複数件化
Version 1.16.5 - 2026-02-28: fix: 観測点高度が目的点高度より高い場合の処理を追加
Version 1.16.4 - 2026-02-26: fix: Astronomy.Horizonの気差補正オプションを解除（"normal" → null）
Version 1.16.3 - 2026-02-25: fix: 辻検索の△判定の範囲修正（視半径×4に変更）、ヘルプトピックの修正
Version 1.16.2 - 2026-02-25: fix: 辻検索の許容範囲ラベル修正、オフセット（ズレ）機能の追加、日付に曜日表示追加
Version 1.16.1 - 2026-02-25: fix: 辻検索にオフセット（ズレ）機能追加、許容範囲ラベル修正
Version 1.16.0 - 2026-02-25: feat: 辻検索機能追加（方位角・視高度範囲指定による天体検索）
Version 1.15.0 - 2026-02-25: feat: 辻Dayに時刻・月齢アイコン追加
Version 1.14.2 - 2026-02-25: fix: 大気差補正Kの計算式修正、辻Dayの△判定の範囲拡大
Version 1.14.1 - 2026-02-19: fix: 辻Day検索の不具合修正
Version 1.14.0 - 2026-02-19: feat: 辻Day検索機能追加
Version 1.13.0 - 2026-02-19: feat: Movボタン4種、標高取得ロジック改善、視度半径ライン追加
Version 1.12.0 - 2026-02-12: feat: 気象パラメータ連動で大気差補正Kを計算・表示する機能追加
Version 1.11.7 - 2026-02-11: fix: 大気差補正計算の不具合修正
Version 1.11.6 - 2026-02-09: fix: 大気差補正計算の不具合修正
Version 1.11.5 - 2026-02-08: fix: 月齢検索の不具合修正
Version 1.11.4 - 2026-02-07: fix: 初期表示を現在日時に修正
Version 1.11.3 - 2026-02-07: fix: 計算不具合等修正
Version 1.11.2 - 2026-02-06: style: 大気差補正Kの文言・表示修正
Version 1.11.1 - 2026-02-05: fix: 設定セクションのUI修正
Version 1.11.0 - 2026-02-05: feat: REFRACTION_K設定機能追加; 各種UI改善
Version 1.10.0 - 2026-02-05: Great-circle route line appended on map; Calculation optimization
Version 1.9.0 - 2026-02-05: Minor feature and apparent altitude appended in popup
Version 1.0.0 - 2026-01-29: Initial release
*/

// ============================================================
// 1. 定数定義
// ============================================================

const STORAGE_KEY = 'soranotsuji_app'; // 唯一の保存キー
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzq94EkeZgbWlFb65cb1WQcRrRVi2Qpd_i60NvJWx6BB6Qxpb-30GD7TSzZptpRYxYL/exec"; 
const SYNODIC_MONTH = 29.53058886; // 朔望月 (日数)

// 市区町村データ (遅延読み込み)
let muniData = null;
async function loadMuniData() {
    if (muniData) return muniData;
    const resp = await fetch('muni.json');
    muniData = await resp.json();
    return muniData;
}
const EARTH_RADIUS = 6378137;
const REFRACTION_K = 0.132; // 大気差補正定数: 0.132
// 標準大気モデルの定数
const STD_P = 1013.25;  // 標準気圧 (hPa)
const STD_T = 15.0;     // 標準気温 (°C)
const STD_L = 0.0065;   // 標準気温減率 Γ (K/m) 正値。0.0065が国際標準大気、0.0125が測量標準

const POLARIS_RA = 2.530304;
const POLARIS_DEC = 89.264109;
const MERAK_RA = 11.030689;
const MERAK_DEC = 56.382434;
const MINTAKA_RA = 5.533444;
const MINTAKA_DEC = -0.299095;
const SUBARU_RA = 3.777222;
const SUBARU_DEC = 24.178056;
const M42_RA = 5.588007;
const M42_DEC = -5.3876;
const VEGA_RA = 18.615649;
const VEGA_DEC = 38.783689;
const ALTAIR_RA = 19.846388;
const ALTAIR_DEC = 8.868321;
const DENEB_RA = 20.690532;
const DENEB_DEC = 45.280339;
const BETELGEUSE_RA = 5.919529;
const BETELGEUSE_DEC = 7.407064;
const SIRIUS_RA = 6.752477;
const SIRIUS_DEC = -16.716116;
const PROCYON_RA = 7.655033;
const PROCYON_DEC = 5.224988;

// 固定RA/Decの恒星IDリスト
const FIXED_STAR_IDS = ['Polaris', 'Merak', 'Mintaka', 'Subaru', 'M42', 'Vega', 'Altair', 'Deneb', 'Betelgeuse', 'Sirius', 'Procyon'];

/** 固定恒星判定 (既定恒星 + My天体) */
function isFixedStar(bodyId) {
    return FIXED_STAR_IDS.includes(bodyId) || appState.myStars.some(s => String(s.id) === bodyId);
}

// 天体の赤道半径 (km) - 視半径の計算用
const BODY_RADIUS_KM = {
    Sun: 695700, Moon: 1737.4,
    Mercury: 2439.7, Venus: 6051.8, Mars: 3396.2,
    Jupiter: 71492, Saturn: 60268, Uranus: 25559, Neptune: 24764
};
const KM_PER_AU = 149597870.7;

const DEFAULT_START = { lat: 35.658595126386274, lng: 139.74544465541842, elev: 18.5, height: 150.0 };
const DEFAULT_END = { lat: 35.3627986111111, lng: 138.730781416667, elev: 3776, height: 0 };

// 天体ごとの初期スタイル (リセット用)
const DEFAULT_BODIES = [
    { id: 'Sun',     color: '#FF0000', isDashed: false },
    { id: 'Moon',    color: '#FFFF00', isDashed: false },
    { id: 'Mercury', color: '#00BFFF', isDashed: false },
    { id: 'Venus',   color: '#FFC0CB', isDashed: false },
    { id: 'Mars',    color: '#FFA500', isDashed: false },
    { id: 'Jupiter', color: '#A52A2A', isDashed: false },
    { id: 'Saturn',  color: '#008000', isDashed: false },
    { id: 'Uranus',  color: '#ADFF2F', isDashed: false },
    { id: 'Neptune', color: '#4B0082', isDashed: false },
    { id: 'Pluto',   color: '#800080', isDashed: false },
    { id: 'Polaris', color: '#000000', isDashed: false },
    { id: 'Merak',   color: '#654321', isDashed: false },
    { id: 'Mintaka', color: '#FFFFFF', isDashed: false },
    { id: 'Subaru',  color: '#0000FF', isDashed: false }
];

const COLOR_MAP = [
    { name: '赤', code: '#FF0000' },
    { name: '桃', code: '#FFC0CB' },
    { name: '橙', code: '#FFA500' },
    { name: '黄', code: '#FFFF00' },
    { name: '黄緑', code: '#ADFF2F' },
    { name: '緑', code: '#008000' }, 
    { name: '水', code: '#00BFFF' },
    { name: '青', code: '#0000FF' },
    { name: '藍', code: '#4B0082' },
    { name: '紫', code: '#800080' },
    { name: '薄紫', code: '#DDA0DD' },
    { name: '茶', code: '#A52A2A' }, 
    { name: 'こげ茶', code: '#654321' },
    { name: '白', code: '#FFFFFF' },
    { name: '黒', code: '#000000' }
];

// ============================================================
// 2. グローバル変数 & アプリケーション状態 (appState)
// ============================================================

let map; 
let linesLayer;
let locationLayer;
let dpLayer;

// ★ 全てを管理する状態オブジェクト
let appState = {
    // 現在表示中の場所（elevはapiElev + heightの合算値）
    start: { lat: DEFAULT_START.lat, lng: DEFAULT_START.lng, elev: DEFAULT_START.elev + DEFAULT_START.height },
    end:   { lat: DEFAULT_END.lat,   lng: DEFAULT_END.lng,   elev: DEFAULT_END.elev + DEFAULT_END.height },

    // API取得の生の標高値（読み取り専用表示用）
    startApiElev: DEFAULT_START.elev,
    endApiElev: DEFAULT_END.elev,

    // ユーザー入力の追加高さ（編集可能）
    startHeight: DEFAULT_START.height,
    endHeight: DEFAULT_END.height,

    // 登録された場所 (Homeボタンで呼び出す場所)
    homeStart: null,
    homeEnd:   null,

    // 日時
    currentDate: new Date(),
    
    // My天体 (複数天体)
    myStars: [],

    // My観測点 / My目的点
    myObservations: [],  // { id, name, lat, lng, elev, height }
    myTargets: [],       // { id, name, lat, lng, elev, height }

    // My辻検索
    myTsujiSearches: [],  // { id, name, days, bodyIds, obsId, tgtId,
                          //   baseAz, baseAlt, offsetAz, offsetAlt,
                          //   toleranceAz, toleranceAlt,
                          //   moonFilter, moonBase, moonTolerance,
                          //   accuracyFilter, accDblCircle, accCircle, accTriangle, accDash,
                          //   checked, memo }

    // 大気差補正の有効/無効
    refractionEnabled: false,

    // 大気差補正係数 (meteoから計算)
    refractionK: calculateKFromMeteo(STD_P, STD_T, STD_L),

    //気象パラメータ (初期値は標準大気)
    meteo: { p: STD_P, t: STD_T, l: STD_L },

    // 訪問履歴
    lastVisitDate: null,

    // 天体設定
    bodies: [
        { id: 'Sun',     name: '太陽',   color: '#FF0000', isDashed: false, visible: true },
        { id: 'Moon',    name: '月',     color: '#FFFF00', isDashed: false, visible: true },
        { id: 'Mercury', name: '水星',   color: '#00BFFF', isDashed: false, visible: false },
        { id: 'Venus',   name: '金星',   color: '#FFC0CB', isDashed: false, visible: false },
        { id: 'Mars',    name: '火星',   color: '#FFA500', isDashed: false, visible: false },
        { id: 'Jupiter', name: '木星',   color: '#A52A2A', isDashed: false, visible: false },
        { id: 'Saturn',  name: '土星',   color: '#008000', isDashed: false, visible: false },
        { id: 'Uranus',  name: '天王星', color: '#ADFF2F', isDashed: false, visible: false },
        { id: 'Neptune', name: '海王星', color: '#4B0082', isDashed: false, visible: false },
        { id: 'Pluto',   name: '冥王星', color: '#800080', isDashed: false, visible: false },
        { id: 'Polaris', name: '北極星', color: '#000000', isDashed: false, visible: false },
        { id: 'Merak',   name: '北斗七星メラク', color: '#654321', isDashed: false, visible: false },
        { id: 'Mintaka', name: 'オリオン座ミンタカ', color: '#FFFFFF', isDashed: false, visible: false },
        { id: 'Subaru',  name: 'すばる', color: '#0000FF', isDashed: false, visible: false },
        { id: 'M42',     name: 'オリオン大星雲M42', color: '#DDA0DD', isDashed: false, visible: false },
        { id: 'Vega',    name: 'こと座ベガ', color: '#FFA500', isDashed: true, visible: false },
        { id: 'Altair',  name: 'わし座アルタイル', color: '#008000', isDashed: true, visible: false },
        { id: 'Deneb',   name: 'はくちょう座デネブ', color: '#FFD700', isDashed: true, visible: false },
        { id: 'Betelgeuse', name: 'オリオン座ベテルギウス', color: '#FF0000', isDashed: true, visible: false },
        { id: 'Sirius',  name: 'おおいぬ座シリウス', color: '#00BFFF', isDashed: true, visible: false },
        { id: 'Procyon', name: 'こいぬ座プロキオン', color: '#ADFF2F', isDashed: true, visible: false }
    ],

    // 機能フラグ
    isMoving: false,
    moveSpeed: null,  // 'month', 'day', 'hour', 'min'
    isDPActive: true,
    locMode: 'start',  // 'start' or 'end' — 地図クリック時にどちらの地点を移動するか
    isElevationActive: false,
    isTsujiSearchActive: false,

    // 辻検索パラメータ (全てlocalStorage保存)
    tsujiSearchBaseAz: 0,
    tsujiSearchOffsetAz: 0,
    tsujiSearchToleranceAz: 15,
    tsujiSearchBaseAlt: 0,
    tsujiSearchOffsetAlt: 0,
    tsujiSearchToleranceAlt: 15,
    tsujiSearchDays: 365,

    // 辻検索: 月齢フィルタ
    tsujiMoonFilterEnabled: false,
    tsujiMoonBase: 15,
    tsujiMoonTolerance: 2,

    // 精度フィルタ
    tsujiAccuracyFilterEnabled: false,
    tsujiAccDblCircle: false,
    tsujiAccCircle: false,
    tsujiAccTriangle: false,
    tsujiAccDash: false,

    // 月齢 (計算値、appStateで管理)
    moonAge: 0,

    // 内部制御用 (保存不要)
    timers: { move: null, fetch: null },
    elevationData: { points: [], index: 0 },
    tsujiSearchGeneration: 0,
    riseSetCache: {}
};

/** API標高とユーザー高さから内部計算用elevを再計算 */
function recalcElev(type) {
    if (type === 'start') {
        appState.start.elev = appState.startApiElev + appState.startHeight;
    } else {
        appState.end.elev = appState.endApiElev + appState.endHeight;
    }
}

let visitorData = null;
let editingBodyId = null;
let currentRiseSetData = {};


// ============================================================
// 3. 初期化プロセス
// ============================================================

window.onload = function() {
    console.log("宙の辻: 起動 (v1.19.2)");
    
    // Astronomy Engineが読み込まれているかチェック
    if (typeof Astronomy === 'undefined') {
        console.error("Astronomy Engine is not loaded.");
        return;
    }

    // GeographicLibが読み込まれているかチェック
    if (typeof geodesic === 'undefined') {
        console.error("GeographicLib is not loaded.");
        return;
    }

    // 1. 古いデータを削除 (Clean up)
    cleanupOldStorage();

    // 2. 設定読み込み
    loadAppState();

    // 2.5. URLパラメータからの復元（LocalStorageより優先）
    restoreFromUrl();

    // 3. 地図初期化
    initMap();

    // 4. UI構築
    setupUI();

    // 5. 初期状態反映
    if (appState.isDPActive) {
        document.getElementById('btn-dp').classList.add('active');
    }
    
    // 登録ボタンの見た目 (登録データがあるかどうかで判定)
    if(appState.homeStart) {
        const btn = document.getElementById('btn-reg-start');
        btn.classList.add('active');
        btn.title = "登録済みの観測点を呼び出し";
    }
    if(appState.homeEnd) {
        const btn = document.getElementById('btn-reg-end');
        btn.classList.add('active');
        btn.title = "登録済みの目的点を呼び出し";
    }

    // 位置情報: 観測点/目的点モードのlocalStorage復元値をセット
    document.getElementById(appState.locMode === 'end' ? 'radio-end' : 'radio-start').checked = true;

    // 辻検索: ①〜⑥+検索期間のlocalStorage復元値をセット
    document.getElementById('input-tsuji-az').value = appState.tsujiSearchBaseAz;
    document.getElementById('input-tsuji-az-offset').value = appState.tsujiSearchOffsetAz;
    document.getElementById('input-tsuji-az-tolerance').value = appState.tsujiSearchToleranceAz;
    document.getElementById('input-tsuji-alt').value = appState.tsujiSearchBaseAlt;
    document.getElementById('input-tsuji-alt-offset').value = appState.tsujiSearchOffsetAlt;
    document.getElementById('input-tsuji-alt-tolerance').value = appState.tsujiSearchToleranceAlt;
    document.getElementById('input-tsuji-search-days').value = appState.tsujiSearchDays;
    document.getElementById('chk-tsuji-moon-filter').checked = appState.tsujiMoonFilterEnabled;
    document.getElementById('input-tsuji-moon-base').value = appState.tsujiMoonBase;
    document.getElementById('input-tsuji-moon-tolerance').value = appState.tsujiMoonTolerance;
    document.getElementById('chk-tsuji-accuracy-filter').checked = appState.tsujiAccuracyFilterEnabled;
    document.getElementById('chk-tsuji-acc-dbl-circle').checked = appState.tsujiAccDblCircle;
    document.getElementById('chk-tsuji-acc-circle').checked = appState.tsujiAccCircle;
    document.getElementById('chk-tsuji-acc-triangle').checked = appState.tsujiAccTriangle;
    document.getElementById('chk-tsuji-acc-dash').checked = appState.tsujiAccDash;
    updateTsujiAccuracyFilterUI();
    updateTsujiMoonFilterUI();
    updateOffsetDistances();

    // リストを生成
    syncMyStarsToBodies();
    renderCelestialList();
    renderMyStarsList();
    renderMyPointsList('obs');
    renderMyPointsList('tgt');
    renderMyTsujiSearches();

    // My観測点/My目的点マーカーを表示
    setTimeout(() => updateMyPointMarkers(), 500);

    // ツールチップ設定
    setupTooltips();

    // 起動時は「現在日時」にセット（URLパラメータからの復元がない場合のみ）
    if (appState._restoredFromUrl) {
        delete appState._restoredFromUrl;
        syncUIFromState();
        updateAll();
    } else {
        setNow();
    }

    // リサイズ対応
    window.addEventListener('resize', () => {
        if(appState.isElevationActive) {
            drawProfileGraph();
        }
    });

    setTimeout(initVisitorCounter, 1000);

    // URLパラメータで辻検索が指定されていた場合、自動実行
    if (appState._pendingTsujiSearch) {
        delete appState._pendingTsujiSearch;
        setTimeout(() => {
            // toggleTsujiSearchと同じ処理を実行
            appState.isTsujiSearchActive = true;
            const btn = document.getElementById('btn-tsuji-search');
            const pnl = document.getElementById('tsujisearch-panel');
            btn.classList.add('active');
            pnl.classList.remove('hidden');
            document.getElementById('tsujisearch-header').innerHTML = '辻検索結果 <span id="tsujisearch-status"></span>';
            syncBottomPanels();
            startTsujiSearch();
        }, 500);
    }
};

// 古いキーの削除関数
function cleanupOldStorage() {
    const oldKeys = [
        'soranotsuji_start',
        'soranotsuji_end',
        'soranotsuji_mystar', 
        'soranotsuji_last_visit',
        'soranotsuji_reg_start',
        'soranotsuji_reg_end',
        'soranotsuji_state'
    ];
    oldKeys.forEach(key => {
        localStorage.removeItem(key);
    });
}

function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    const gsiStd = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>',
        maxZoom: 18
    });
    const gsiPhoto = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/ort/{z}/{x}/{y}.jpg', {
        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>',
        maxZoom: 18
    });
    const gsiPale = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>',
        maxZoom: 18
    });
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
    });

    map = L.map('map', {
        center: [appState.start.lat, appState.start.lng],
        zoom: 9, 
        layers: [gsiStd], 
        zoomControl: false
    });
    map.attributionControl.addAttribution('<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>,<a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>,<a href="https://open-meteo.com/" target="_blank">Open-Meteo</a>');

    L.control.layers({
        "標準(地理院)": gsiStd,
        "写真(地理院)": gsiPhoto,
        "淡色(地理院)": gsiPale,
        "OSM": osm
    }, null, { position: 'topleft' }).addTo(map);

    L.control.zoom({ position: 'topleft' }).addTo(map);
    L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map);
    
    linesLayer = L.layerGroup().addTo(map);
    locationLayer = L.layerGroup().addTo(map);
    dpLayer = L.layerGroup().addTo(map);

    map.on('click', onMapClick);
}


// ============================================================
// 4. UIイベント設定
// ============================================================

function setupUI() {
    document.getElementById('btn-help').onclick = toggleHelp;

    // 日時変更
    document.getElementById('date-input').addEventListener('change', () => {
        uncheckTimeShortcuts();
        syncStateFromUI();
        updateAll();
    });

    const tInput = document.getElementById('time-input');
    const tSlider = document.getElementById('time-slider');

    tSlider.addEventListener('input', () => {
        uncheckTimeShortcuts();
        const val = parseInt(tSlider.value);
        const h = Math.floor(val / 60);
        const m = val % 60;
        // スライダーで時刻を選んだ場合は秒を0にする（スライダーは分単位）
        tInput.value = `${('00' + h).slice(-2)}:${('00' + m).slice(-2)}:00`;
        syncStateFromUI();
        updateAll();
    });

    tInput.addEventListener('input', () => {
        uncheckTimeShortcuts();
        if (!tInput.value) return;
        const parts = tInput.value.split(':').map(Number);
        const h = parts[0], m = parts[1];
        if (!isNaN(h) && !isNaN(m)) {
            tSlider.value = h * 60 + m;  // スライダーは分単位（秒は反映しない）
            syncStateFromUI();
            updateAll();
        }
    });

    // 月齢入力
    document.getElementById('moon-age-input').addEventListener('change', (e) => {
        const targetAge = parseFloat(e.target.value);
        if (isNaN(targetAge)) {
            // 空欄時は計算値を復元
            e.target.value = appState.moonAge;
            return;
        }
        searchMoonAge(targetAge);
    });

    // ボタン類
    document.getElementById('btn-now').onclick = setNow;
    document.getElementById('btn-speed-month').onclick = () => toggleSpeed('month');
    document.getElementById('btn-speed-day').onclick = () => toggleSpeed('day');
    document.getElementById('btn-speed-hour').onclick = () => toggleSpeed('hour');
    document.getElementById('btn-speed-min').onclick = () => toggleSpeed('min');
    document.getElementById('btn-date-prev').onclick = () => addDay(-1);
    document.getElementById('btn-date-next').onclick = () => addDay(1);
    document.getElementById('btn-month-prev').onclick = () => addMonth(-1);
    document.getElementById('btn-month-next').onclick = () => addMonth(1);
    document.getElementById('btn-time-prev').onclick = () => addMinute(-1);
    document.getElementById('btn-time-next').onclick = () => addMinute(1);
    document.getElementById('btn-hour-prev').onclick = () => addMinute(-60);
    document.getElementById('btn-hour-next').onclick = () => addMinute(60);
    document.getElementById('btn-moon-prev').onclick = () => addMoonMonth(-1);
    document.getElementById('btn-moon-next').onclick = () => addMoonMonth(1);

    document.querySelectorAll('input[name="time-jump"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if(e.target.checked) jumpToEvent(e.target.value);
        });
    });

    document.getElementById('btn-gps').onclick = useGPS;
    document.getElementById('btn-elevation').onclick = toggleElevation;
    document.getElementById('btn-dp').onclick = toggleDP;
    document.getElementById('btn-tsuji-search').onclick = toggleTsujiSearch;

    // 位置情報: 観測点/目的点モードの変更をlocalStorage保存
    document.querySelectorAll('input[name="loc-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            appState.locMode = e.target.value;
            saveAppState();
        });
    });

    // 辻検索: ①〜⑥+検索期間の変更をlocalStorage保存
    document.getElementById('input-tsuji-az').addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) appState.tsujiSearchBaseAz = val;
        e.target.value = appState.tsujiSearchBaseAz;
        saveAppState();
    });
    document.getElementById('input-tsuji-az-offset').addEventListener('change', (e) => {
        appState.tsujiSearchOffsetAz = parseFloat(e.target.value) || 0;
        e.target.value = appState.tsujiSearchOffsetAz;
        saveAppState();
        updateOffsetDistances();
    });
    document.getElementById('input-tsuji-az-tolerance').addEventListener('change', (e) => {
        appState.tsujiSearchToleranceAz = parseFloat(e.target.value) || 15;
        e.target.value = appState.tsujiSearchToleranceAz;
        saveAppState();
    });
    document.getElementById('input-tsuji-alt').addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) appState.tsujiSearchBaseAlt = val;
        e.target.value = appState.tsujiSearchBaseAlt;
        saveAppState();
    });
    document.getElementById('input-tsuji-alt-offset').addEventListener('change', (e) => {
        appState.tsujiSearchOffsetAlt = parseFloat(e.target.value) || 0;
        e.target.value = appState.tsujiSearchOffsetAlt;
        saveAppState();
        updateOffsetDistances();
    });
    document.getElementById('input-tsuji-alt-tolerance').addEventListener('change', (e) => {
        appState.tsujiSearchToleranceAlt = parseFloat(e.target.value) || 15;
        e.target.value = appState.tsujiSearchToleranceAlt;
        saveAppState();
    });
    document.getElementById('input-tsuji-search-days').addEventListener('change', (e) => {
        appState.tsujiSearchDays = Math.min(Math.max(parseInt(e.target.value) || 365, 1), 36500);
        e.target.value = appState.tsujiSearchDays;
        saveAppState();
    });
    // 月齢フィルタ
    document.getElementById('chk-tsuji-moon-filter').addEventListener('change', (e) => {
        appState.tsujiMoonFilterEnabled = e.target.checked;
        updateTsujiMoonFilterUI();
        saveAppState();
    });
    document.getElementById('input-tsuji-moon-base').addEventListener('change', (e) => {
        appState.tsujiMoonBase = Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 30);
        e.target.value = appState.tsujiMoonBase;
        saveAppState();
    });
    document.getElementById('input-tsuji-moon-tolerance').addEventListener('change', (e) => {
        appState.tsujiMoonTolerance = Math.min(Math.max(parseFloat(e.target.value) || 0, 0), 15);
        e.target.value = appState.tsujiMoonTolerance;
        saveAppState();
    });
    // 精度フィルタ
    document.getElementById('chk-tsuji-accuracy-filter').addEventListener('change', (e) => {
        appState.tsujiAccuracyFilterEnabled = e.target.checked;
        updateTsujiAccuracyFilterUI();
        saveAppState();
    });
    ['dbl-circle', 'circle', 'triangle', 'dash'].forEach(key => {
        const propMap = { 'dbl-circle': 'tsujiAccDblCircle', 'circle': 'tsujiAccCircle', 'triangle': 'tsujiAccTriangle', 'dash': 'tsujiAccDash' };
        document.getElementById(`chk-tsuji-acc-${key}`).addEventListener('change', (e) => {
            appState[propMap[key]] = e.target.checked;
            saveAppState();
        });
    });

    // 登録ボタン
    document.getElementById('btn-reg-start').onclick = () => registerLocation('start');
    document.getElementById('btn-reg-end').onclick = () => registerLocation('end');

    // URL取得ボタン: ポップアップダイアログ表示
    document.getElementById('btn-url-location').onclick = () => toggleUrlPanel('location');
    document.getElementById('btn-url-tsuji').onclick = () => toggleUrlPanel('tsuji');
    // URL取得ダイアログ: 項目クリック
    document.getElementById('url-picker-fixed').addEventListener('click', () => {
        const mode = urlPickerMode;
        closeUrlPicker();
        if (mode === 'location') copyLocationUrl('fixed');
        else if (mode === 'tsuji') copyTsujiSearchUrl('fixed');
        else if (mode === 'mytsuji') copyMyTsujiSearchUrl('fixed');
    });
    document.getElementById('url-picker-semi-fixed').addEventListener('click', () => {
        const mode = urlPickerMode;
        closeUrlPicker();
        if (mode === 'location') copyLocationUrl('semi-fixed');
        else if (mode === 'tsuji') copyTsujiSearchUrl('semi-fixed');
        else if (mode === 'mytsuji') copyMyTsujiSearchUrl('semi-fixed');
    });
    document.getElementById('url-picker-access').addEventListener('click', () => {
        const mode = urlPickerMode;
        closeUrlPicker();
        if (mode === 'location') copyLocationUrl(false);
        else if (mode === 'tsuji') copyTsujiSearchUrl(false);
        else if (mode === 'mytsuji') copyMyTsujiSearchUrl(false);
    });

    // 座標入力 (changeイベント)
    const iStart = document.getElementById('input-start-latlng');
    const iEnd = document.getElementById('input-end-latlng');
    iStart.addEventListener('change', () => handleLocationInput(iStart.value, true));
    iEnd.addEventListener('change', () => handleLocationInput(iEnd.value, false));

    // 標高入力（ユーザーが手動で上書き可能。地図クリック等でAPI取得値に上書きされる）
    document.getElementById('input-start-api-elev').addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) appState.startApiElev = val;
        e.target.value = appState.startApiElev;
        recalcElev('start');
        saveAppState();
        updateAll();
    });
    document.getElementById('input-end-api-elev').addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) appState.endApiElev = val;
        e.target.value = appState.endApiElev;
        recalcElev('end');
        saveAppState();
        updateAll();
    });

    // 高さ入力（ユーザー入力の追加高さ）
    document.getElementById('input-start-elev').addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) appState.startHeight = val;
        e.target.value = appState.startHeight;
        recalcElev('start');
        saveAppState();
        updateAll();
    });
    document.getElementById('input-end-elev').addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) appState.endHeight = val;
        e.target.value = appState.endHeight;
        recalcElev('end');
        saveAppState();
        updateAll();
    });

    // My天体操作ボタン
    document.getElementById('btn-mystars-up').onclick = moveMyStarUp;
    document.getElementById('btn-mystars-down').onclick = moveMyStarDown;
    document.getElementById('btn-mystars-delete').onclick = deleteMyStar;
    document.getElementById('btn-mystars-csv-import').onclick = importMyStarsCsv;
    document.getElementById('btn-mystars-csv-append').onclick = appendMyStarsCsv;
    document.getElementById('btn-mystars-csv-export').onclick = exportMyStarsCsv;

    // My観測点ボタン
    document.getElementById('btn-myobs-apply').onclick = () => applyMyPoint('obs');
    document.getElementById('btn-myobs-get').onclick = () => getMyPointFromLocation('obs');
    document.getElementById('btn-myobs-regall').onclick = () => registerAllMyPoints('obs');
    document.getElementById('btn-myobs-up').onclick = () => moveMyPointUp('obs');
    document.getElementById('btn-myobs-down').onclick = () => moveMyPointDown('obs');
    document.getElementById('btn-myobs-addrow').onclick = () => addMyPointRow('obs');
    document.getElementById('btn-myobs-delrow').onclick = () => deleteMyPointRow('obs');
    document.getElementById('btn-myobs-csv-import').onclick = () => importMyPointsCsv('obs');
    document.getElementById('btn-myobs-csv-append').onclick = () => appendMyPointsCsv('obs');
    document.getElementById('btn-myobs-csv-export').onclick = () => exportMyPointsCsv('obs');
    document.getElementById('btn-myobs-url').onclick = () => getMyPointUrl('obs');

    // My目的点ボタン
    document.getElementById('btn-mytgt-apply').onclick = () => applyMyPoint('tgt');
    document.getElementById('btn-mytgt-get').onclick = () => getMyPointFromLocation('tgt');
    document.getElementById('btn-mytgt-regall').onclick = () => registerAllMyPoints('tgt');
    document.getElementById('btn-mytgt-up').onclick = () => moveMyPointUp('tgt');
    document.getElementById('btn-mytgt-down').onclick = () => moveMyPointDown('tgt');
    document.getElementById('btn-mytgt-addrow').onclick = () => addMyPointRow('tgt');
    document.getElementById('btn-mytgt-delrow').onclick = () => deleteMyPointRow('tgt');
    document.getElementById('btn-mytgt-csv-import').onclick = () => importMyPointsCsv('tgt');
    document.getElementById('btn-mytgt-csv-append').onclick = () => appendMyPointsCsv('tgt');
    document.getElementById('btn-mytgt-csv-export').onclick = () => exportMyPointsCsv('tgt');
    document.getElementById('btn-mytgt-url').onclick = () => getMyPointUrl('tgt');

    // My辻検索ボタン (Phase A-3)
    document.getElementById('btn-mytsuji-toggle-all').onclick = toggleAllMyTsuji;
    document.getElementById('btn-mytsuji-get').onclick = getMyTsujiFromTsujiSearch;
    document.getElementById('btn-mytsuji-regall').onclick = registerAllMyTsuji;
    document.getElementById('btn-mytsuji-up').onclick = moveMyTsujiUp;
    document.getElementById('btn-mytsuji-down').onclick = moveMyTsujiDown;
    document.getElementById('btn-mytsuji-addrow').onclick = addMyTsujiRow;
    document.getElementById('btn-mytsuji-delrow').onclick = deleteMyTsujiRow;
    // CSV (Phase B)
    document.getElementById('btn-mytsuji-csv-import').onclick = importMyTsujiCsv;
    document.getElementById('btn-mytsuji-csv-append').onclick = appendMyTsujiCsv;
    document.getElementById('btn-mytsuji-csv-export').onclick = exportMyTsujiCsv;
    document.getElementById('btn-mytsuji-url').onclick = getMyTsujiUrl;
    // batch (Phase C-2/C-3) — 結果は辻検索パネルを再利用
    document.getElementById('btn-mytsuji-batch').onclick = runBatchMyTsujiSearch;
    document.getElementById('btn-mytsuji-file').onclick = fileBatchMyTsujiSearch;


    // 天体検索ボタン
    document.getElementById('btn-starsearch').onclick = searchStars;
    document.getElementById('btn-starsearch-reg').onclick = registerSearchStar;

    // バックアップ / インポート
    document.getElementById('btn-backup').onclick = exportBackup;
    document.getElementById('btn-import').onclick = importBackup;

    // --- ★追加: 気象パラメータ連動 ---
    const iK = document.getElementById('input-refraction-k');
    const iP = document.getElementById('input-meteo-p');
    const iT = document.getElementById('input-meteo-t');
    const iL = document.getElementById('input-meteo-l');
    const chkRefraction = document.getElementById('chk-refraction');
    const btnResetMeteo = document.getElementById('btn-reset-meteo');
    const btnRegSettings = document.getElementById('btn-reg-settings');

    // 気差フォームの有効/無効を切り替える関数
    // 気差係数(iK)はデッサン仕様により常に読み取り専用
    const setRefractionFormEnabled = (enabled) => {
        iP.readOnly = !enabled;
        iP.disabled = !enabled;
        iT.readOnly = !enabled;
        iT.disabled = !enabled;
        iL.readOnly = !enabled;
        iL.disabled = !enabled;
        btnResetMeteo.disabled = !enabled;
        btnRegSettings.disabled = !enabled;
    };

    // チェックボックスの変更イベント
    chkRefraction.addEventListener('change', (e) => {
        appState.refractionEnabled = e.target.checked;
        setRefractionFormEnabled(e.target.checked);
        saveAppState();
        updateAll();
    });

    // 気象条件が変わったら K を再計算して表示する関数
    const updateK = () => {
        const p = parseFloat(iP.value);
        const t = parseFloat(iT.value);
        const l = parseFloat(iL.value);
        if(!isNaN(p) && !isNaN(t) && !isNaN(l)) {
            const newK = calculateKFromMeteo(p, t, l);
            // 小数点4桁で表示 (値はまだ保存しない)
            iK.value = newK.toFixed(4);
        }
    };

    iP.addEventListener('input', updateK);
    iT.addEventListener('input', updateK);
    iL.addEventListener('input', updateK);

    // リセットボタン
    btnResetMeteo.onclick = () => {
        iP.value = STD_P;
        iT.value = STD_T;
        iL.value = STD_L;
        updateK(); // 計算してKも更新
    };

    // 設定登録ボタン
    btnRegSettings.onclick = registerSettings;

    // 起動時の初期値を入力欄にセット
    if(appState.meteo) {
        iP.value = appState.meteo.p;
        iT.value = appState.meteo.t;
        iL.value = appState.meteo.l;
        iK.value = appState.refractionK.toFixed(4);
    }
    // 起動時のチェックボックス状態を反映
    chkRefraction.checked = appState.refractionEnabled;
    setRefractionFormEnabled(appState.refractionEnabled);

}


// ============================================================
// 5. 設定の保存・読み込み (Single Storage Key)
// ============================================================

/** 全状態を保存 */
function saveAppState() {
    // 保存したいデータだけを抽出
    const stateToSave = {
        start: appState.start,
        end: appState.end,
        homeStart: appState.homeStart, // 登録場所
        homeEnd: appState.homeEnd,     // 登録場所
        bodies: appState.bodies.filter(b => !b.isCustom),
        myStars: appState.myStars,
        myObservations: appState.myObservations,
        myTargets: appState.myTargets,
        myTsujiSearches: appState.myTsujiSearches,
        meteo: appState.meteo, //気象パラメータのみ保存(Kはmeteoから再計算)
        refractionEnabled: appState.refractionEnabled,
        isDPActive: appState.isDPActive,
        locMode: appState.locMode,
        lastVisitDate: appState.lastVisitDate,
        // 辻検索パラメータ (①〜⑥+検索期間)
        tsujiSearchBaseAz: appState.tsujiSearchBaseAz,
        tsujiSearchOffsetAz: appState.tsujiSearchOffsetAz,
        tsujiSearchToleranceAz: appState.tsujiSearchToleranceAz,
        tsujiSearchBaseAlt: appState.tsujiSearchBaseAlt,
        tsujiSearchOffsetAlt: appState.tsujiSearchOffsetAlt,
        tsujiSearchToleranceAlt: appState.tsujiSearchToleranceAlt,
        tsujiSearchDays: appState.tsujiSearchDays,
        tsujiMoonFilterEnabled: appState.tsujiMoonFilterEnabled,
        tsujiMoonBase: appState.tsujiMoonBase,
        tsujiMoonTolerance: appState.tsujiMoonTolerance,
        tsujiAccuracyFilterEnabled: appState.tsujiAccuracyFilterEnabled,
        tsujiAccDblCircle: appState.tsujiAccDblCircle,
        tsujiAccCircle: appState.tsujiAccCircle,
        tsujiAccTriangle: appState.tsujiAccTriangle,
        tsujiAccDash: appState.tsujiAccDash,
        // 標高関連（API標高とユーザー入力高）
        startApiElev: appState.startApiElev,
        endApiElev: appState.endApiElev,
        startHeight: appState.startHeight,
        endHeight: appState.endHeight
        // currentDateは保存せず、毎回起動時にリセット(日の出等)する方針
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
}

/** 全状態を復元 */
function loadAppState() {
    const json = localStorage.getItem(STORAGE_KEY);
    if (json) {
        try {
            const saved = JSON.parse(json);
            // 個別マージ
            if(saved.start) appState.start = saved.start;
            if(saved.end) appState.end = saved.end;
            if(saved.homeStart) appState.homeStart = saved.homeStart;
            if(saved.homeEnd) appState.homeEnd = saved.homeEnd;
            if(saved.myStars) appState.myStars = saved.myStars;
            if(saved.myObservations) appState.myObservations = saved.myObservations;
            if(saved.myTargets) appState.myTargets = saved.myTargets;
            if(saved.myTsujiSearches) appState.myTsujiSearches = saved.myTsujiSearches;
            if(saved.meteo) appState.meteo = saved.meteo;
            // meteoからKを再計算 (refractionKは保存しない)
            appState.refractionK = calculateKFromMeteo(appState.meteo.p, appState.meteo.t, appState.meteo.l);
            if(saved.refractionEnabled !== undefined) appState.refractionEnabled = saved.refractionEnabled;
            if(saved.isDPActive !== undefined) appState.isDPActive = saved.isDPActive;
            if(saved.locMode) appState.locMode = saved.locMode;
            if(saved.lastVisitDate) appState.lastVisitDate = saved.lastVisitDate;
            // 辻検索パラメータ復元 (①〜⑥+検索期間)
            if(saved.tsujiSearchBaseAz !== undefined) appState.tsujiSearchBaseAz = saved.tsujiSearchBaseAz;
            if(saved.tsujiSearchOffsetAz !== undefined) appState.tsujiSearchOffsetAz = saved.tsujiSearchOffsetAz;
            if(saved.tsujiSearchToleranceAz !== undefined) appState.tsujiSearchToleranceAz = saved.tsujiSearchToleranceAz;
            if(saved.tsujiSearchOffsetAlt !== undefined) appState.tsujiSearchOffsetAlt = saved.tsujiSearchOffsetAlt;
            if(saved.tsujiSearchBaseAlt !== undefined) appState.tsujiSearchBaseAlt = saved.tsujiSearchBaseAlt;
            if(saved.tsujiSearchToleranceAlt !== undefined) appState.tsujiSearchToleranceAlt = saved.tsujiSearchToleranceAlt;
            if(saved.tsujiSearchDays !== undefined) appState.tsujiSearchDays = saved.tsujiSearchDays;
            if(saved.tsujiMoonFilterEnabled !== undefined) appState.tsujiMoonFilterEnabled = saved.tsujiMoonFilterEnabled;
            if(saved.tsujiMoonBase !== undefined) appState.tsujiMoonBase = saved.tsujiMoonBase;
            if(saved.tsujiMoonTolerance !== undefined) appState.tsujiMoonTolerance = saved.tsujiMoonTolerance;
            if(saved.tsujiAccuracyFilterEnabled !== undefined) appState.tsujiAccuracyFilterEnabled = saved.tsujiAccuracyFilterEnabled;
            if(saved.tsujiAccDblCircle !== undefined) appState.tsujiAccDblCircle = saved.tsujiAccDblCircle;
            if(saved.tsujiAccCircle !== undefined) appState.tsujiAccCircle = saved.tsujiAccCircle;
            if(saved.tsujiAccTriangle !== undefined) appState.tsujiAccTriangle = saved.tsujiAccTriangle;
            if(saved.tsujiAccDash !== undefined) appState.tsujiAccDash = saved.tsujiAccDash;
            // 標高関連（API標高とユーザー入力高）
            if(saved.startApiElev !== undefined) appState.startApiElev = saved.startApiElev;
            if(saved.endApiElev !== undefined) appState.endApiElev = saved.endApiElev;
            if(saved.startHeight !== undefined) appState.startHeight = saved.startHeight;
            if(saved.endHeight !== undefined) appState.endHeight = saved.endHeight;
            // API標高とユーザー高さから内部計算用elevを再計算
            recalcElev('start');
            recalcElev('end');

            if(saved.bodies) {
                saved.bodies.forEach(sb => {
                    const b = appState.bodies.find(x => x.id === sb.id);
                    if(b) {
                        b.color = sb.color;
                        b.isDashed = sb.isDashed;
                        b.visible = sb.visible;
                    }
                });
            }
        } catch(e) { console.error("Load Error:", e); }
    }
}

/** 登録ボタンロジック (登録 / 呼び出し) */
function registerLocation(type) {
    const input = document.getElementById(`input-${type}-latlng`);
    const btn = document.getElementById(`btn-reg-${type}`);
    
    // キー名のマッピング (homeStart / homeEnd)
    const homeKey = (type === 'start') ? 'homeStart' : 'homeEnd';
    const hasRegistered = (appState[homeKey] !== null);

    // 1. リセット (空で押下)
    if (!input.value) {
        appState[homeKey] = null; // 登録削除

        // ★追加: 現在の場所をシステム初期値に戻す
        if (type === 'start') {
            appState.start = { lat: DEFAULT_START.lat, lng: DEFAULT_START.lng, elev: DEFAULT_START.elev + DEFAULT_START.height };
            appState.startApiElev = DEFAULT_START.elev;
            appState.startHeight = DEFAULT_START.height;
        } else {
            appState.end = { lat: DEFAULT_END.lat, lng: DEFAULT_END.lng, elev: DEFAULT_END.elev + DEFAULT_END.height };
            appState.endApiElev = DEFAULT_END.elev;
            appState.endHeight = DEFAULT_END.height;
        }
        
        saveAppState(); // 変更を保存
        updateAll();    // ★画面(入力欄・マーカー)を更新
        
        // ★親切機能: 地図もその場所へ移動させる
        const target = (type === 'start') ? appState.start : appState.end;
        map.setView([target.lat, target.lng]);

        btn.classList.remove('active');
        btn.title = `現在の${type==='start'?'観測点':'目的点'}を初期値として登録`;
        
        alert('初期値をリセットし、デフォルトに戻しました');
        return;
    }

    // 2. 呼び出し (登録データがある場合)
    if (hasRegistered) {
        // 登録データを現在地に適用
        if(type === 'start') {
            appState.start = { lat: appState.homeStart.lat, lng: appState.homeStart.lng, elev: appState.homeStart.elev };
            appState.startApiElev = appState.homeStart.apiElev !== undefined ? appState.homeStart.apiElev : appState.homeStart.elev;
            appState.startHeight = appState.homeStart.height || 0;
            recalcElev('start');
            appState.locMode = 'start';
            document.getElementById('radio-start').checked = true;
        } else {
            appState.end = { lat: appState.homeEnd.lat, lng: appState.homeEnd.lng, elev: appState.homeEnd.elev };
            appState.endApiElev = appState.homeEnd.apiElev !== undefined ? appState.homeEnd.apiElev : appState.homeEnd.elev;
            appState.endHeight = appState.homeEnd.height || 0;
            recalcElev('end');
            appState.locMode = 'end';
            document.getElementById('radio-end').checked = true;
        }
        
        saveAppState(); // 移動した状態を保存
        updateAll();
        
        // ★修正: fitBounds(全体表示) ではなく setView(その場所に移動)
        // これにより、観測点を呼び出したときに目的点まで引いてしまうのを防ぐ
        const target = (type === 'start') ? appState.start : appState.end;
        map.setView([target.lat, target.lng]);
        
        alert('登録済みの場所を呼び出しました');
    }

    // 3. 登録 (登録データがない場合)
    else {
        // 現在地を登録データとして保存（apiElevとheightも含める）
        if(type === 'start') {
            appState.homeStart = { ...appState.start, apiElev: appState.startApiElev, height: appState.startHeight };
        } else {
            appState.homeEnd = { ...appState.end, apiElev: appState.endApiElev, height: appState.endHeight };
        }
        
        saveAppState();
        
        btn.classList.add('active');
        btn.title = `登録済みの${type==='start'?'観測点':'目的点'}を呼び出し`;
        alert('現在の場所を初期値として登録しました');
    }
}


// ============================================================
// 6. メイン更新ロジック
// ============================================================

function syncStateFromUI() {
    const dStr = document.getElementById('date-input').value;
    const tStr = document.getElementById('time-input').value;
    if(dStr && tStr) {
        // tStr は "HH:MM" または "HH:MM:SS" のどちらの形式もあり得る
        const parts = tStr.split(':');
        const h = parseInt(parts[0]) || 0;
        const m = parseInt(parts[1]) || 0;
        const s = parts.length >= 3 ? (parseInt(parts[2]) || 0) : 0;
        const base = new Date(`${dStr}T00:00:00`);
        base.setHours(h, m, s, 0);
        appState.currentDate = base;
    }
}

function syncUIFromState() {
    const d = appState.currentDate;
    const yyyy = d.getFullYear();
    const mm = ('00'+(d.getMonth()+1)).slice(-2);
    const dd = ('00'+d.getDate()).slice(-2);
    const h = ('00'+d.getHours()).slice(-2);
    const m = ('00'+d.getMinutes()).slice(-2);
    const s = ('00'+d.getSeconds()).slice(-2);

    document.getElementById('date-input').value = `${yyyy}-${mm}-${dd}`;
    document.getElementById('time-input').value = `${h}:${m}:${s}`;
    // スライダーは分単位のまま（秒は無視）
    document.getElementById('time-slider').value = d.getHours() * 60 + d.getMinutes();
}

function updateAll() {
    if (!map) return;

    if (appState.isMoving) {
        syncUIFromState();
    } else {
        syncStateFromUI();
    }

    updateLocationDisplay();
    updateCalculation();
    
    if (appState.isDPActive) {
        updateDPLines();
    } else {
        dpLayer.clearLayers();
    }

    updateTsujiSearchInputs();
}

function updateLocationDisplay() {
    locationLayer.clearLayers();

    const fmt = (pos) => `${pos.lat}, ${pos.lng}`;
    
    if(document.activeElement.id !== 'input-start-latlng') {
        document.getElementById('input-start-latlng').value = fmt(appState.start);
    }
    if(document.activeElement.id !== 'input-end-latlng') {
        document.getElementById('input-end-latlng').value = fmt(appState.end);
    }
    
    // 読み取り専用のAPI標高
    document.getElementById('input-start-api-elev').value = appState.startApiElev;
    document.getElementById('input-end-api-elev').value = appState.endApiElev;
    // 編集可能なユーザー高さ
    document.getElementById('input-start-elev').value = appState.startHeight;
    document.getElementById('input-end-elev').value = appState.endHeight;

    const sPt = L.latLng(appState.start.lat, appState.start.lng);
    const ePt = L.latLng(appState.end.lat, appState.end.lng);
    
    // マーカーの設置（観測点:青、目的点:赤）— My観測点/My目的点マーカーより常に上に表示するためzIndexOffsetを高く設定
    const observerIcon = L.divIcon({ className: '', html: '<div class="location-marker location-marker-observer"></div>', iconSize: [24, 24], iconAnchor: [12, 24], popupAnchor: [0, -24] });
    const targetIcon = L.divIcon({ className: '', html: '<div class="location-marker location-marker-target"></div>', iconSize: [24, 24], iconAnchor: [12, 24], popupAnchor: [0, -24] });
    L.marker(sPt, { icon: observerIcon, zIndexOffset: 1000 }).addTo(locationLayer).bindPopup(createLocationPopup("観測点", appState.start, appState.end, appState.startApiElev, appState.startHeight));
    L.marker(ePt, { icon: targetIcon, zIndexOffset: 1000 }).addTo(locationLayer).bindPopup(createLocationPopup("目的点", appState.end, appState.start, appState.endApiElev, appState.endHeight));
    
    // 1. メルカトル図法の直線 (地図上の見かけの線) -> 黒い破線
    L.polyline([sPt, ePt], {
        color: 'black',
        weight: 2,          // 少し細めにして
        opacity: 0.5,       // 薄くする（補助線的な意味合い）
        dashArray: '10, 10' // 破線で描画
    }).addTo(locationLayer);

    // 2. 大圏航路 (地球上の実際の最短ルート) -> 黒い実線
    const pathPoints = calculateGreatCirclePoints(appState.start, appState.end);
    
    L.polyline(pathPoints, {
        color: 'black',
        weight: 4,    // 太く強調
        opacity: 0.8
        // dashArrayを指定しない＝実線
    }).addTo(locationLayer);
}

function updateCalculation() {
    linesLayer.clearLayers();
    const obsDate = appState.currentDate;
    const startOfDay = new Date(obsDate);
    startOfDay.setHours(0, 0, 0, 0);

    let observer;
    try {
        observer = new Astronomy.Observer(appState.start.lat, appState.start.lng, appState.start.elev);
    } catch(e) { return; }

    appState.bodies.forEach(body => {
        let ra;
        let dec;
        
        if (isFixedStar(body.id)) {
            const rd = getFixedStarRaDec(body.id);
            ra = rd.ra;
            dec = rd.dec;
        } else {
            const eq = Astronomy.Equator(body.id, obsDate, observer, true, true);
            ra = eq.ra;
            dec = eq.dec;
        }

        const hor = Astronomy.Horizon(obsDate, observer, ra, dec, appState.refractionEnabled ? "normal" : null);

        let riseStr = "--:--";
        let setStr = "--:--";

        if (isFixedStar(body.id)) {
            // 恒星: 出入り時刻は非同期で計算（下のsetTimeoutでまとめて処理）
        } else {
            try {
                const rise = Astronomy.SearchRiseSet(body.id, observer, +1, startOfDay, 2);
                const set  = Astronomy.SearchRiseSet(body.id, observer, -1, startOfDay, 2);
                riseStr = rise ? formatTime(rise.date, startOfDay) : "--:--";
                setStr = set ? formatTime(set.date, startOfDay) : "--:--";
            } catch(e){}
        }

        if (!isFixedStar(body.id) && riseStr === "--:--" && setStr === "--:--" && hor.altitude > 0) {
            riseStr = "00:00";
            setStr = "00:00";
        }

        // 視半径の計算
        const angR = getBodyAngularRadius(body.id, obsDate, observer);

        // 赤経・赤緯
        const radecEl = document.getElementById(`radec-${body.id}`);
        if (radecEl) {
            radecEl.innerText = `赤経 ${ra.toFixed(6)}h / 赤緯 ${dec.toFixed(6)}°`;
        }

        // 出/入時刻・南中時
        const risesetEl = document.getElementById(`riseset-${body.id}`);
        const transitEl = document.getElementById(`transit-${body.id}`);
        if (risesetEl) {
            if (isFixedStar(body.id)) {
                // 恒星: 出入り時刻・南中時を全て非同期で一括計算
                risesetEl.innerText = `出時刻 --:--:-- / 入時刻 --:--:--`;
                if (transitEl) transitEl.innerText = `南中時 --:--:-- / 視半径 -.---°`;
                const bodyId = body.id;
                const capturedRa = ra;
                const capturedDec = dec;
                setTimeout(() => {
                    const times = searchStarRiseSet(capturedRa, capturedDec, observer, startOfDay);
                    let rs = times.rise;
                    let ss = times.set;
                    if (rs === "--:--:--" && ss === "--:--:--") {
                        const h = Astronomy.Horizon(obsDate, observer, capturedRa, capturedDec, appState.refractionEnabled ? "normal" : null);
                        if (h.altitude > 0) { rs = "00:00:00"; ss = "00:00:00"; }
                    }
                    const transitStr = searchStarTransit(capturedRa, capturedDec, observer, startOfDay);
                    const rsEl = document.getElementById(`riseset-${bodyId}`);
                    const trEl = document.getElementById(`transit-${bodyId}`);
                    if (rsEl) rsEl.innerText = `出時刻 ${rs} / 入時刻 ${ss}`;
                    if (trEl) {
                        const existing = trEl.innerText;
                        const angPart = existing.includes(' / 視半径') ? existing.substring(existing.indexOf(' / 視半径')) : '';
                        trEl.innerText = `南中時 ${transitStr}${angPart}`;
                    }
                }, 0);
            } else {
                // 太陽系天体: 出入り時刻は同期、南中時のみ非同期
                risesetEl.innerText = `出時刻 ${riseStr} / 入時刻 ${setStr}`;
                if (transitEl) transitEl.innerText = `南中時 --:--:-- / 視半径 --°`;
                const bodyId = body.id;
                setTimeout(() => {
                    let transitStr = "--:--:--";
                    try {
                        const transit = Astronomy.SearchHourAngle(bodyId, observer, 0, startOfDay);
                        if (transit && transit.time) {
                            transitStr = formatTime(transit.time.date, startOfDay);
                        }
                    } catch(e) {}
                    const trEl = document.getElementById(`transit-${bodyId}`);
                    if (trEl) {
                        const existing = trEl.innerText;
                        const angPart = existing.includes(' / 視半径') ? existing.substring(existing.indexOf(' / 視半径')) : '';
                        trEl.innerText = `南中時 ${transitStr}${angPart}`;
                    }
                }, 0);
            }
        }

        // 方位角・視高度・視半径
        const dataEl = document.getElementById(`data-${body.id}`);
        const transitEl2 = document.getElementById(`transit-${body.id}`);
        if (dataEl) {
            const angRStr = BODY_RADIUS_KM[body.id] ? angR.toFixed(3) + '°' : '-.---°';
            dataEl.innerText = `方位角 ${hor.azimuth.toFixed(4)}° / 視高度 ${hor.altitude.toFixed(4)}°`;
            if (transitEl2) {
                const currentTransit = transitEl2.innerText;
                const transitPart = currentTransit.split(' / 視半径')[0];
                transitEl2.innerText = `${transitPart} / 視半径 ${angRStr}`;
            }
        }

        if (body.visible) {
            drawDirectionLine(appState.start.lat, appState.start.lng, hor.azimuth, hor.altitude, body);
        }
    });

    updateShortcutsData(startOfDay, observer);
    updateTwilightData(startOfDay, observer);
    updateMoonInfo(obsDate);
}

function updateDPLines() {
    dpLayer.clearLayers();
    const baseDate = new Date(appState.currentDate);
    baseDate.setHours(0, 0, 0, 0);
    
    const datePrev = new Date(baseDate.getTime() - 86400000);
    const dateNext = new Date(baseDate.getTime() + 86400000);
    const observer = new Astronomy.Observer(appState.start.lat, appState.start.lng, appState.start.elev);

    appState.bodies.forEach(body => {
        if (!body.visible) return;
        const pPrev = calculateDPPathPoints(datePrev, body, observer);
        const pNext = calculateDPPathPoints(dateNext, body, observer);
        const pCurr = calculateDPPathPoints(baseDate, body, observer);
        
        drawDPPath(pPrev, body.color, '1, 13', false);
        drawDPPath(pNext, body.color, '1, 13', false);
        drawDPPath(pCurr, body.color, '13, 13', true);

        // 視半径エッジライン (一点鎖線)
        const angR = getBodyAngularRadius(body.id, appState.currentDate, observer);
        if (angR >= 0.01) {
            const dashDot = '1, 13, 13, 13'; // 点-スペース-線-スペースのパターン
            drawDPPath(pCurr, body.color, dashDot, false, +angR);
            drawDPPath(pCurr, body.color, dashDot, false, -angR);
        }
    });
}


// ============================================================
// 7. ロジック・ヘルパー
// ============================================================

async function handleLocationInput(val, isStart) {
    if(!val) return;

    let coords = parseInput(val);
    if (coords) {
        await applyLocationCoords(coords, isStart);
        return;
    }

    // 半角→全角変換
    const fullVal = toFullWidth(val.trim());
    const inputId = isStart ? 'input-start-latlng' : 'input-end-latlng';
    document.getElementById(inputId).value = fullVal;

    const results = await searchLocation(fullVal);
    if (!results || results.length === 0) {
        alert('該当する地名が見つかりませんでした');
        return;
    }

    showLocationPicker(results, isStart);
}

async function applyLocationCoords(coords, isStart) {
    const elev = await getElevation(coords.lat, coords.lng);
    const validElev = (elev !== null) ? elev : 0;

    if(isStart) {
        appState.start = { ...coords, elev: validElev };
        appState.startApiElev = validElev;
        appState.startHeight = 0;
        appState.locMode = 'start';
        document.getElementById('radio-start').checked = true;
    } else {
        appState.end = { ...coords, elev: validElev };
        appState.endApiElev = validElev;
        appState.endHeight = 0;
        appState.locMode = 'end';
        document.getElementById('radio-end').checked = true;
    }

    const inputId = isStart ? 'input-start-latlng' : 'input-end-latlng';
    document.getElementById(inputId).blur();

    map.setView(coords);
    saveAppState();
    updateAll();
}

function showLocationPicker(results, isStartOrCallback) {
    const picker = document.getElementById('location-picker');
    const list = document.getElementById('picker-list');
    const title = document.getElementById('picker-title');
    title.textContent = `地名検索結果（${results.length}件）`;
    list.innerHTML = '';

    results.forEach(r => {
        const item = document.createElement('div');
        item.className = 'picker-item';
        item.innerHTML = `<div class="picker-name">${escapeHtml(r.title)}</div><div class="picker-address">${escapeHtml(r.address)}</div>`;
        item.addEventListener('click', async () => {
            closeLocationPicker();
            if (typeof isStartOrCallback === 'function') {
                // カスタムコールバック (My観測点/My目的点用)
                await isStartOrCallback(r);
            } else {
                // 既存の位置情報メニュー用 (boolean)
                const coords = { lat: r.lat, lng: r.lon };
                await applyLocationCoords(coords, isStartOrCallback);
            }
        });
        list.appendChild(item);
    });

    picker.classList.remove('hidden');
}

function closeLocationPicker() {
    document.getElementById('location-picker').classList.add('hidden');
}


// ============================================================
// 8. ツールチップ設定
// ============================================================

/**
 * すべての入力欄に対し、マウスオーバー時に入力内容をツールチップで表示する設定を行う
 */
function setupTooltips() {
    // 対象とする入力タイプ
    const selector = 'input[type="text"], input[type="number"], input[type="date"], input[type="time"]';
    const inputs = document.querySelectorAll(selector);

    inputs.forEach(input => {
        input.addEventListener('mouseover', function() {
            // 値が入っている場合のみ title属性に値をセットする
            if (this.value) {
                this.title = this.value;
            } else {
                // 値が空の場合は title属性を削除 (不要な空吹き出しを防ぐ)
                this.removeAttribute('title');
            }
        });
    });
}


// ============================================================
// 9. ユーティリティ
// ============================================================

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}


// ------------------------------------------------------
// 操作系ハンドラ
// ------------------------------------------------------

function setNow() { 
    uncheckTimeShortcuts(); 
    appState.currentDate = new Date(); 
    syncUIFromState(); 
    updateAll(); 
}

function jumpToEvent(type) { 
    if (!currentRiseSetData[type]) return; 
    appState.currentDate = currentRiseSetData[type]; 
    syncUIFromState(); 
    updateAll(); 
}

function addDay(d) { 
    uncheckTimeShortcuts(); 
    appState.currentDate.setDate(appState.currentDate.getDate() + d); 
    syncUIFromState(); 
    updateAll(); 
}

function addMonth(m) { 
    uncheckTimeShortcuts(); 
    appState.currentDate.setMonth(appState.currentDate.getMonth() + m); 
    syncUIFromState(); 
    updateAll(); 
}

function addMinute(m) {
    uncheckTimeShortcuts();
    appState.currentDate.setMinutes(appState.currentDate.getMinutes() + m);
    syncUIFromState();
    updateAll();
}

function addHour(h) {
    uncheckTimeShortcuts();
    appState.currentDate.setHours(appState.currentDate.getHours() + h);
    syncUIFromState();
    updateAll();
}

function addMoonMonth(dir) {
    uncheckTimeShortcuts(); // 1. ショートカットの選択解除

    // 2. 「今の瞬間の月」がどんな状態か（位相）を調べる
    const currentPhase = Astronomy.MoonPhase(appState.currentDate);

    // 3. 「だいたい1ヶ月後（または前）」の日付を計算する (推測)
    const roughTarget = new Date(appState.currentDate.getTime() + dir * SYNODIC_MONTH * 86400000);

    // 4. 検索の開始地点を「だいたいの日」の5日前にセットする
    const searchStart = new Date(roughTarget.getTime() - 5 * 86400000);

    // 5. 正確な日時を検索する (ここが心臓部！)
    const res = Astronomy.SearchMoonPhase(currentPhase, searchStart, 10);
    
    // 6. 結果の適用
    if(res && res.date) {
        appState.currentDate = res.date; // 正確な日時が見つかればそれをセット
    } else {
        appState.currentDate = roughTarget; // 見つからなければ概算値を使う(保険)
    }
    syncUIFromState(); 
    updateAll();
}

// 月齢検索ロジック
function searchMoonAge(targetAge) {
    uncheckTimeShortcuts();

    // 1. 現在の月齢を計算
    const currentPhaseAngle = Astronomy.MoonPhase(appState.currentDate);
    const currentAge = (currentPhaseAngle / 360) * SYNODIC_MONTH;

    // 2. 検索方向の判定 (過去に戻るべきか？)
    // 基本は「現在日時」から未来検索
    let searchStartDate = appState.currentDate;
    
    const diff = targetAge - currentAge;

    // 数値が減った場合 (例: 15->14) は過去を探す。
    if (diff < 0) {
        // 例: 10 -> -5 (差は -15) : 過去に戻る
        // 検索開始位置を「diff+半月前」にずらすことで、直近の過去を見つける
        searchStartDate = new Date(appState.currentDate.getTime() - (Math.floor(Math.abs(diff)) + 15) * 24 * 60 * 60 * 1000);
    }

    // 3. 検索実行
    // 例: 31を入力 -> 31 % 29.53 = 1.47 -> 月齢1.47の位相を検索
    const normalizedAge = targetAge % SYNODIC_MONTH;
    const targetPhase = (normalizedAge / SYNODIC_MONTH) * 360;
    
    // 検索期間を少し広めに(45日)とって、確実にヒットさせる
    const res = Astronomy.SearchMoonPhase(targetPhase, searchStartDate, 45);
    
    if(res && res.date) {
        document.getElementById('moon-age-input').blur(); 
        appState.currentDate = res.date; 
        syncUIFromState(); 
        updateAll(); 
    } else { 
        alert("見つかりませんでした"); 
    }
}

function uncheckTimeShortcuts() { 
    document.querySelectorAll('input[name="time-jump"]').forEach(r => r.checked = false); 
}

function stopMove() {
    appState.isMoving = false;
    appState.moveSpeed = null;
    clearInterval(appState.timers.move);
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
}

function toggleSpeed(speed) {
    if (appState.isMoving && appState.moveSpeed === speed) {
        stopMove();
        return;
    }

    stopMove();
    appState.isMoving = true;
    appState.moveSpeed = speed;

    const btnId = { month: 'btn-speed-month', day: 'btn-speed-day', hour: 'btn-speed-hour', min: 'btn-speed-min' };
    document.getElementById(btnId[speed]).classList.add('active');

    const actions = {
        month: () => addMonth(1),
        day:   () => addDay(1),
        hour:  () => addHour(1),
        min:   () => addMinute(1)
    };
    appState.timers.move = setInterval(actions[speed], 1000);
}

function toggleDP() {
    appState.isDPActive = !appState.isDPActive;
    const btn = document.getElementById('btn-dp');
    
    if(appState.isDPActive) {
        btn.classList.add('active'); 
    } else {
        btn.classList.remove('active');
    }
    saveAppState();
    updateAll();
}

function useGPS() {
    if (!navigator.geolocation) return alert('GPS非対応です');
    navigator.geolocation.getCurrentPosition(pos => {
        appState.start.lat = pos.coords.latitude; 
        appState.start.lng = pos.coords.longitude;
        map.setView([appState.start.lat, appState.start.lng], 10);
        getElevation(appState.start.lat, appState.start.lng).then(elev => {
            if(elev !== null) {
                appState.start.elev = elev;
                appState.startApiElev = elev;
                appState.startHeight = 0;
            }
            saveAppState();
            updateAll();
        });
    }, () => alert('位置情報を取得できませんでした'));
}


// ------------------------------------------------------
// 計算・描画ヘルパー (汎用)
// ------------------------------------------------------

function drawDirectionLine(lat, lng, azimuth, altitude, body) {
    // ★修正: Vincenty(大圏) ではなく Rhumb(等角) を使う
    // これにより、地図上で「指定した方位」に向かって真っ直ぐ線が引かれます
    const endPos = getDestinationRhumb(lat, lng, azimuth, 3000000); // 3000km

    const opacity = altitude < 0 ? 0.3 : 1.0; 
    const dashArray = body.isDashed ? '10, 10' : null;
    
    L.polyline([[lat, lng], [endPos.lat, endPos.lng]], {
        color: body.color,
        weight: 6,
        opacity: opacity,
        dashArray: dashArray
    }).addTo(linesLayer);
}

function calculateDPPathPoints(targetDate, body, observer) {
    const path = [];
    const startOfDay = new Date(targetDate.getTime());
    startOfDay.setHours(0, 0, 0, 0);
    const valElev = appState.start.elev;
    const dip = getHorizonDip(valElev); // 地平線の低下量 (度)
    const limit = -(dip + (16 / 60 + 1.18 / 3600) * 2 + 0.1); // 地平線の低下分 + 太陽の視直径 + 0.1度のマージン

    for (let m = 0; m < 1440; m += 1) { // 1分毎
        const time = new Date(startOfDay.getTime() + m * 60000);
        let r;
        let d;
        
        if (isFixedStar(body.id)) {
            const rd = getFixedStarRaDec(body.id);
            r = rd.ra;
            d = rd.dec;
        } else {
            const eq = Astronomy.Equator(body.id, time, observer, true, true);
            r = eq.ra;
            d = eq.dec;
        }

        const hor = Astronomy.Horizon(time, observer, r, d, appState.refractionEnabled ? "normal" : null);
        if (hor.altitude > limit) {
            const dist = calculateDistanceForAltitudes(hor.altitude, valElev, appState.end.elev);
            if (dist > 0 && dist < 500000) { // 500km以内のみ
                path.push({ dist: dist, az: hor.azimuth, time: time });
            }
        }
    }
    return path;
}

function drawDPPath(points, color, dashArray, withMarkers, azOffset) {
    if (points.length === 0) return;
    const targetPt = appState.end;
    let segments = [];
    let currentSegment = [];
    const offset = azOffset || 0;

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const obsAz = (p.az + offset + 540) % 360; // +180 して逆方位 + offset
        const dest = getDestinationGeodesic(targetPt.lat, targetPt.lng, obsAz, p.dist);
        const pt = [dest.lat, dest.lng];
        
        if (currentSegment.length > 0) {
            const prev = points[i-1];
            if (Math.abs(p.az - prev.az) > 5) {
                segments.push(currentSegment);
                currentSegment = [];
            }
        }
        currentSegment.push(pt);
        
        if (withMarkers && p.time.getMinutes() % 5 === 0) {
            L.circleMarker(pt, {
                radius: 4,
                color: color,
                fillColor: color,
                fillOpacity: 1.0,
                weight: 1
            }).addTo(dpLayer);
            
            const timeStr = formatTimeHM(p.time);
            L.marker(pt, {
                icon: L.divIcon({
                    className: 'dp-label-icon',
                    html: `<div style="font-size:14px;font-weight:bold;color:${color};text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;white-space:nowrap;">${timeStr}</div>`,
                    iconSize: [null, null],
                    iconAnchor: [-10, 7]
                })
            }).addTo(dpLayer);
        }
    }
    
    if (currentSegment.length > 0) segments.push(currentSegment);
    
    segments.forEach(seg => {
        L.polyline(seg, {
            color: color,
            weight: 5,
            opacity: 0.8,
            dashArray: dashArray
        }).addTo(dpLayer);
    });
}

// ------------------------------------------------------
// 計算ヘルパー (天体の視半径)
// ------------------------------------------------------
function getBodyAngularRadius(bodyId, date, observer) {
    const radiusKm = BODY_RADIUS_KM[bodyId];
    if (!radiusKm) return 0;
    const eq = Astronomy.Equator(bodyId, date, observer, true, true);
    const distKm = eq.dist * KM_PER_AU;
    return Math.atan(radiusKm / distKm) * 180 / Math.PI;
}

// 固定RA/Decの恒星のRA/Decを返すヘルパー
function getFixedStarRaDec(bodyId) {
    switch (bodyId) {
        case 'Polaris':    return { ra: POLARIS_RA, dec: POLARIS_DEC };
        case 'Merak':      return { ra: MERAK_RA, dec: MERAK_DEC };
        case 'Mintaka':    return { ra: MINTAKA_RA, dec: MINTAKA_DEC };
        case 'Subaru':     return { ra: SUBARU_RA, dec: SUBARU_DEC };
        case 'M42':        return { ra: M42_RA, dec: M42_DEC };
        case 'Vega':       return { ra: VEGA_RA, dec: VEGA_DEC };
        case 'Altair':     return { ra: ALTAIR_RA, dec: ALTAIR_DEC };
        case 'Deneb':      return { ra: DENEB_RA, dec: DENEB_DEC };
        case 'Betelgeuse': return { ra: BETELGEUSE_RA, dec: BETELGEUSE_DEC };
        case 'Sirius':     return { ra: SIRIUS_RA, dec: SIRIUS_DEC };
        case 'Procyon':    return { ra: PROCYON_RA, dec: PROCYON_DEC };
        default: {
            // My天体から検索
            const myStar = appState.myStars.find(s => String(s.id) === bodyId);
            if (myStar) return { ra: myStar.ra, dec: myStar.dec };
            return { ra: 0, dec: 0 };
        }
    }
}

// ------------------------------------------------------
// 計算ヘルパー (高度角→距離変換)
// ------------------------------------------------------
/**
 * 2つの高度(観測者・ターゲット)を地球を球体として、
 * 指定された見かけの高度角(altObs)で見える「地上の水平距離」を逆算する
 * * 原理: 地球中心(C)-観測者(O)-ターゲット(T) の3点で三角形を作る
 * 1. 既知の辺: r1(地球+観測者), r2(地球+ターゲット)
 * 2. 既知の角: 観測点での見かけの高度角(altObs)
 * 3. 正弦定理 (r1 / sin(PI/2 - altTarget) = r2 / sin(PI/2 + altObs) を使って、
 * 目的点の高度角(altTarget)を導き出す
 * 4. 三角形の内角の和(180°)から、地球中心角(c)を決定する: (PI/2 + altObs) + (PI/2 - altTarget) + c = PI → c = altTarget - altObs
 * 5. 円弧の長さの定義より、地上の距離Lは、L = R * c
 * @param {number} altObs 観測点での見かけの高度角 (度)
 * @param {number} hObs 観測者の標高 (m)
 * @param {number} hTarget ターゲットの標高 (m)
 */
function calculateDistanceForAltitudes(altObs, hObs, hTarget) {
    // 地球半径 (定数より取得)
    const R = EARTH_RADIUS;
    
    // 気差係数kを気象パラメータから都度計算 (気差OFF時は0)
    const k = appState.refractionEnabled ? calculateKFromMeteo(appState.meteo.p, appState.meteo.t, appState.meteo.l) : 0;
    const Reff = R / (1 - k);

    const r1 = R + hObs;    // 観測者
    const r2 = R + hTarget; // ターゲット

    const altObsRad = altObs * Math.PI / 180;

    let sinVal = 0;
    let altTargetRad = 0;
    let c = 0;

    if (hObs <= hTarget) {
        sinVal = r1/r2 * Math.sin(Math.PI/2 + altObsRad);
        if (sinVal > 1) sinVal = 1; // 安全策: asinの引数は[-1, 1]の範囲でなければならない
        if (sinVal < -1) sinVal = -1;
        altTargetRad = Math.PI/2 - Math.asin(sinVal);
        c = altTargetRad - altObsRad; // 観測点が低い場合は、地球中心角cは両者の差になる
    } else {
        sinVal = r1/r2 * Math.sin(Math.PI/2 - altObsRad);
        if (sinVal > 1) sinVal = 1; // 安全策: asinの引数は[-1, 1]の範囲でなければならない
        if (sinVal < -1) sinVal = -1;
        altTargetRad = Math.asin(sinVal) - Math.PI/2;
        c = -altObsRad - altTargetRad; // 観測点が高い場合は、地球中心角cは両者の和になる
    }
    const L = Reff * c;

    return L;
}

// ------------------------------------------------------
// 計算・描画ヘルパー (GeographicLib)
// ------------------------------------------------------
/**
 * 指定した地点から、方位(az)と距離(dist)進んだ先の座標を計算する
 * (GeographicLib を使用して高精度に計算)
 */
function getDestinationGeodesic(lat1, lon1, az, dist) {
    // WGS84楕円体を使用
    const geod = geodesic.Geodesic.WGS84;
    
    // Direct(順解法): 始点(lat1, lon1), 方位(az), 距離(dist) -> 終点
    // GeographicLibのDirectメソッドは { lat2, lon2, ... } を返します
    const r = geod.Direct(lat1, lon1, az, dist);

    return { lat: r.lat2, lng: r.lon2 };
}

// ★追加: 等角航路（地図上の直線）での到達点を計算する関数
function getDestinationRhumb(lat1, lon1, brng, dist) {
    const R = EARTH_RADIUS; // 地球半径 (m)
    const rad = Math.PI / 180;
    
    // ラジアン変換
    const lat1Rad = lat1 * rad;
    const lon1Rad = lon1 * rad;
    const brngRad = brng * rad;
    
    // 緯度の変化 (等角航路では緯度は距離のcos成分で単純に変化する)
    const d = dist / R; // 角距離
    let lat2Rad = lat1Rad + d * Math.cos(brngRad);

    // 緯度が90度を超えないように制限
    if (Math.abs(lat2Rad) > Math.PI / 2) {
        lat2Rad = lat2Rad > 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    // 経度の変化 (メルカトル図法上の伸び率「等長緯度」を考慮)
    const dPhi = Math.log(Math.tan(Math.PI / 4 + lat2Rad / 2) / Math.tan(Math.PI / 4 + lat1Rad / 2));
    
    // 東西方向(90度/270度)に近い場合のゼロ除算対策
    // q = (Δlat / ΔPhi) もしくは cos(lat)
    const q = Math.abs(dPhi) > 1e-10 ? (lat2Rad - lat1Rad) / dPhi : Math.cos(lat1Rad);
    
    const dLon = d * Math.sin(brngRad) / q;
    const lon2Rad = lon1Rad + dLon;

    return {
        lat: lat2Rad / rad,
        lng: lon2Rad / rad // Leafletは経度が180度を超えても描画してくれるので正規化しなくてOK
    };
}

// (参考) calculateGreatCirclePoints も GeographicLib 化する場合
function calculateGreatCirclePoints(start, end) {
    const points = [];
    
    const geod = geodesic.Geodesic.WGS84;
    
    // Inverse(逆解法)で2点間の測地線を定義
    // InverseLine は始点から終点への「ラインオブジェクト」を作ります
    const l = geod.InverseLine(start.lat, start.lng, end.lat, end.lng);
    
    // 距離 (l.s13)
    const dist = l.s13; 
    
    // 100分割 (または100kmごとなど) して点を取得
    const numSteps = 100;
    for (let i = 0; i <= numSteps; i++) {
        // 距離 s を指定して座標を算出
        const s = (dist * i) / numSteps;
        const r = l.Position(s);
        points.push([r.lat2, r.lon2]);
    }
    
    return points;
}

/**
 * 気象条件から気差係数 K を計算する
 * K = 503 * (P / T^2) * (0.034 - Γ)
 * Γ: 気温減率 (正値, K/m)
 */
function calculateKFromMeteo(p, tCel, l) {
    const tKelvin = tCel + 273.15; // ケルビンに変換
    // 近似式 (l = 気温減率Γ、正値)
    const k = 503 * (p / (tKelvin * tKelvin)) * (0.034 - l);
    return k;
}

// ------------------------------------------------------
// 計算・描画ヘルパー (イベントハンドラ)
// ------------------------------------------------------

// 地図クリック時の処理 
async function onMapClick(e) {
    // アニメーション中は地図クリック/タップで停止
    if (appState.isMoving) {
        stopMove();
        return;
    }
    const isStart = appState.locMode === 'start';
    const elev = await getElevation(e.latlng.lat, e.latlng.lng);
    const val = (elev !== null) ? elev : 0;
    
    if (isStart) {
        appState.start = { lat: e.latlng.lat, lng: e.latlng.lng, elev: val };
        appState.startApiElev = val;
        appState.startHeight = 0;
    } else {
        appState.end = { lat: e.latlng.lat, lng: e.latlng.lng, elev: val };
        appState.endApiElev = val;
        appState.endHeight = 0;
    }
    saveAppState();
    updateAll();
}

// 汎用ヘルパー
function parseInput(val) {
    if (val.indexOf(',') === -1) return null;
    const clean = val.replace(/[\(\)\s]/g, ''); 
    const parts = clean.split(',');
    if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
    return null;
}

// --- 半角→全角変換 ---
function toFullWidth(str) {
    return str.normalize('NFKC')
        .replace(/[\x21-\x7e]/g, ch =>
            String.fromCharCode(ch.charCodeAt(0) + 0xFEE0)
        ).replace(/ /g, '\u3000');
}

// --- 国土地理院 地名検索（GSI優先、OSMフォールバック） ---
async function searchLocation(query) {
    if (!query) return null;
    const q = query.trim();
    if (/^[\d\.\-\s\uff10-\uff19\uff0e\uff0d]+$/.test(q)) {
        console.warn("数値のみの入力のため、地名検索をスキップしました:", q);
        return null;
    }
    try {
        // 1. 国土地理院 検索
        const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data && data.length > 0) {
            const muni = await loadMuniData();
            const gsiResults = data
                .filter(item => item.properties.title.includes(q))
                .map(item => {
                    const code = item.properties.addressCode || '';
                    const muniStr = (code && muni && muni[code]) || '';
                    const parts = muniStr.split(',');
                    const pref = parts[1] || '';
                    const city = parts[3] || '';
                    const address = pref && city ? `${pref}　${city}` : '';
                    return {
                        lat: item.geometry.coordinates[1],
                        lon: item.geometry.coordinates[0],
                        title: item.properties.title,
                        address: address
                    };
                });
            if (gsiResults.length > 0) return gsiResults;
        }

        // 2. GSI結果0件 → OSMフォールバック
        const urlOsm = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`;
        const resOsm = await fetch(urlOsm);
        const dataOsm = await resOsm.json();
        if (!dataOsm || dataOsm.length === 0) return [];

        return dataOsm.map(item => ({
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            title: item.display_name.split(',')[0].trim(),
            address: item.display_name
        }));
    } catch(e) {
        console.error(e);
        return null;
    }
}

// --- GSI DEM PNGタイルによる標高取得 ---
const GSI_DEM_SOURCES = [
    { title: "DEM5A", url: "https://cyberjapandata.gsi.go.jp/xyz/dem5a_png/{z}/{x}/{y}.png", zoom: 15, fixed: 1 },
    { title: "DEM5B", url: "https://cyberjapandata.gsi.go.jp/xyz/dem5b_png/{z}/{x}/{y}.png", zoom: 15, fixed: 1 },
    { title: "DEM5C", url: "https://cyberjapandata.gsi.go.jp/xyz/dem5c_png/{z}/{x}/{y}.png", zoom: 15, fixed: 1 },
    { title: "DEM10B", url: "https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png", zoom: 14, fixed: 0 },
];

const POW2_8 = Math.pow(2, 8);
const POW2_16 = Math.pow(2, 16);
const POW2_23 = Math.pow(2, 23);
const POW2_24 = Math.pow(2, 24);

function _getTileInfo(lat, lng, zoom) {
    const lngRad = lng * Math.PI / 180;
    const R = 128 / Math.PI;
    const worldX = R * (lngRad + Math.PI);
    const pixelX = worldX * Math.pow(2, zoom);
    const tileX = Math.floor(pixelX / 256);

    const latRad = lat * Math.PI / 180;
    const worldY = -R / 2 * Math.log((1 + Math.sin(latRad)) / (1 - Math.sin(latRad))) + 128;
    const pixelY = worldY * Math.pow(2, zoom);
    const tileY = Math.floor(pixelY / 256);

    return {
        x: tileX, y: tileY,
        pX: Math.floor(pixelX - tileX * 256),
        pY: Math.floor(pixelY - tileY * 256)
    };
}

function _loadTileImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Tile load failed"));
        img.src = url;
    });
}

function _elevFromRGB(r, g, b) {
    if (r === 128 && g === 0 && b === 0) return null;
    const d = r * POW2_16 + g * POW2_8 + b;
    let h = (d < POW2_23) ? d : d - POW2_24;
    if (h === -POW2_23) h = 0;
    else h *= 0.01;
    return h;
}

// タイル画像キャッシュ (同一セッション内でタイル再利用)
const _tileCache = {};

async function _getTileImageData(tileUrl) {
    if (_tileCache[tileUrl]) return _tileCache[tileUrl];
    try {
        const img = await _loadTileImage(tileUrl);
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, 256, 256);
        _tileCache[tileUrl] = imgData;
        return imgData;
    } catch (e) {
        return null;
    }
}

function _makeTileUrl(demSource, tileX, tileY) {
    return demSource.url.replace('{z}', demSource.zoom).replace('{x}', tileX).replace('{y}', tileY);
}

// Open-Meteo Elevation API で標高を取得 (GSIフォールバック用)
async function _getElevationFromOpenMeteo(lat, lng) {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
        if (!res.ok) return null;
        const data = await res.json();
        if (data.elevation && data.elevation.length > 0 && data.elevation[0] !== null) {
            return parseFloat(data.elevation[0].toFixed(1));
        }
    } catch (e) { /* ignore */ }
    return null;
}

// 1地点の標高取得 (DEM5A→5B→5C→10B の順にフォールバック、全て失敗時はOpen-Meteo)
async function getElevation(lat, lng) {
    for (const dem of GSI_DEM_SOURCES) {
        const ti = _getTileInfo(lat, lng, dem.zoom);
        const url = _makeTileUrl(dem, ti.x, ti.y);
        const imgData = await _getTileImageData(url);
        if (!imgData) continue;
        const idx = (ti.pY * 256 + ti.pX) * 4;
        const h = _elevFromRGB(imgData.data[idx], imgData.data[idx + 1], imgData.data[idx + 2]);
        if (h !== null) return parseFloat(h.toFixed(dem.fixed));
    }
    // GSI DEMで取得できなかった場合、Open-Meteo APIにフォールバック
    const omElev = await _getElevationFromOpenMeteo(lat, lng);
    if (omElev !== null) return omElev;
    return 0;
}

// バッチ標高取得 (標高グラフ用 - タイル単位でまとめて処理)
let _elevFetchGeneration = 0;
async function fetchAllElevations(points, onProgress) {
    const generation = ++_elevFetchGeneration;

    for (const dem of GSI_DEM_SOURCES) {
        if (generation !== _elevFetchGeneration) return;

        // 未取得ポイントをタイルごとにグループ化
        const tileGroups = {};
        for (let i = 0; i < points.length; i++) {
            if (points[i].fetched) continue;
            const ti = _getTileInfo(points[i].lat, points[i].lng, dem.zoom);
            const key = `${ti.x}_${ti.y}`;
            if (!tileGroups[key]) {
                tileGroups[key] = {
                    url: _makeTileUrl(dem, ti.x, ti.y),
                    pts: []
                };
            }
            tileGroups[key].pts.push({ idx: i, pX: ti.pX, pY: ti.pY });
        }

        const tileKeys = Object.keys(tileGroups);
        if (tileKeys.length === 0) break;

        // 1タイルずつ並列ダウンロード
        const BATCH = 1;
        for (let b = 0; b < tileKeys.length; b += BATCH) {
            if (generation !== _elevFetchGeneration) return;

            const batch = tileKeys.slice(b, b + BATCH);
            const results = await Promise.all(batch.map(async key => {
                const group = tileGroups[key];
                const imgData = await _getTileImageData(group.url);
                return { imgData, pts: group.pts };
            }));

            for (const { imgData, pts } of results) {
                if (!imgData) continue;
                for (const pt of pts) {
                    if (points[pt.idx].fetched) continue;
                    const pIdx = (pt.pY * 256 + pt.pX) * 4;
                    const h = _elevFromRGB(imgData.data[pIdx], imgData.data[pIdx + 1], imgData.data[pIdx + 2]);
                    if (h !== null) {
                        points[pt.idx].elev = parseFloat(h.toFixed(dem.fixed));
                        points[pt.idx].fetched = true;
                    }
                }
            }

            const fetchedCount = points.filter(p => p.fetched).length;
            if (onProgress) onProgress(fetchedCount, points.length);
        }
    }

    // フォールバック: どのDEMでも取得できなかったポイントはOpen-Meteo APIで取得
    const unfetched = points.filter(p => !p.fetched);
    if (unfetched.length > 0) {
        // Open-Meteo APIはカンマ区切りで複数地点を一括取得可能
        const BATCH_OM = 100;
        for (let b = 0; b < unfetched.length; b += BATCH_OM) {
            if (generation !== _elevFetchGeneration) return;
            const batch = unfetched.slice(b, b + BATCH_OM);
            const lats = batch.map(p => p.lat).join(',');
            const lngs = batch.map(p => p.lng).join(',');
            try {
                const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.elevation) {
                        for (let i = 0; i < batch.length; i++) {
                            if (data.elevation[i] !== null && data.elevation[i] !== undefined) {
                                batch[i].elev = parseFloat(data.elevation[i].toFixed(1));
                                batch[i].fetched = true;
                            }
                        }
                    }
                }
            } catch (e) { /* ignore */ }
            const fetchedCount = points.filter(p => p.fetched).length;
            if (onProgress) onProgress(fetchedCount, points.length);
        }
    }
    // 最終フォールバック: それでも取得できなかったポイントは0
    for (const pt of points) {
        if (!pt.fetched) { pt.elev = 0; pt.fetched = true; }
    }
    if (onProgress) onProgress(points.length, points.length);
}

function createLocationPopup(title, pos, target, apiElev, height) {
    const az = calculateBearing(pos.lat, pos.lng, target.lat, target.lng);
    const dist = L.latLng(pos.lat, pos.lng).distanceTo(L.latLng(target.lat, target.lng));

    // ★追加: 視高度を計算
    const alt = calculateApparentAltitude(dist, pos.elev, target.elev);

    return `
        <b>${title}</b><br>
        緯度: ${pos.lat}°<br>
        経度: ${pos.lng}°<br>
        標高: ${apiElev != null ? apiElev : pos.elev} m<br>
        高さ: ${height != null ? height : 0} m<br>
        相手距離: ${(dist/1000).toFixed(2)} km<br>
        相手方位: ${az.toFixed(4)}°<br>
        相手高度: ${alt.toFixed(4)}°
    `;
}

// ★追加: 2点間の距離と標高差から視高度(角度)を計算する関数
function calculateApparentAltitude(dist, hObs, hTarget) {
    if (dist <= 0) return 0; // 距離0の場合は0度とする

    // 気差係数k (気差OFF時は0)
    const k = appState.refractionEnabled ? calculateKFromMeteo(appState.meteo.p, appState.meteo.t, appState.meteo.l) : 0;

    // 地球の曲率(と気差)を考慮した視高度計算式
    // tan(a) = (H_target - H_obs) / d - d / (2 * R) * (1 - k)
    const val = (hTarget - hObs) / dist - (dist * (1 - k)) / (2 * EARTH_RADIUS);
    return Math.atan(val) * 180 / Math.PI;
}

function calculateBearing(lat1, lng1, lat2, lng2) {
    const toRad = deg => deg * Math.PI / 180;
    const toDeg = rad => rad * 180 / Math.PI;
    const l1 = toRad(lat1);
    const l2 = toRad(lat2);
    const dLng = toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(l2);
    const x = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function getRiseSetAlt(bodyId, date, observer, refr) {
    const eq = Astronomy.Equator(bodyId, date, observer, true, true);
    const hor = Astronomy.Horizon(date, observer, eq.ra, eq.dec, refr);
    return hor.altitude.toFixed(4);
}

function updateShortcutsData(startOfDay, observer) {
    try {
        const sr = Astronomy.SearchRiseSet('Sun', observer, +1, startOfDay, 1);
        const ss = Astronomy.SearchRiseSet('Sun', observer, -1, startOfDay, 1);
        const mr = Astronomy.SearchRiseSet('Moon', observer, +1, startOfDay, 2);
        const ms = Astronomy.SearchRiseSet('Moon', observer, -1, startOfDay, 2);
        
        document.getElementById('time-sunrise').innerText = sr ? formatTime(sr.date) : "--:--";
        document.getElementById('time-sunset').innerText = ss ? formatTime(ss.date) : "--:--";
        document.getElementById('time-moonrise').innerText = mr ? formatTime(mr.date, startOfDay) : "--:--";
        document.getElementById('time-moonset').innerText = ms ? formatTime(ms.date, startOfDay) : "--:--";

        const refr = appState.refractionEnabled ? "normal" : null;
        document.getElementById('alt-sunrise').innerText = sr ? getRiseSetAlt('Sun', sr.date, observer, refr) : "--";
        document.getElementById('alt-sunset').innerText = ss ? getRiseSetAlt('Sun', ss.date, observer, refr) : "--";
        document.getElementById('alt-moonrise').innerText = mr ? getRiseSetAlt('Moon', mr.date, observer, refr) : "--";
        document.getElementById('alt-moonset').innerText = ms ? getRiseSetAlt('Moon', ms.date, observer, refr) : "--";

        currentRiseSetData = {
            sunrise: sr?.date,
            sunset: ss?.date,
            moonrise: mr?.date,
            moonset: ms?.date
        };
    } catch(e) {}
}

function updateTwilightData(startOfDay, observer) {
    try {
        const refr = appState.refractionEnabled ? "normal" : null;
        // 夜明側 (ascending)
        const astroDawn = Astronomy.SearchAltitude('Sun', observer, +1, startOfDay, 1, -18);
        const nautDawn  = Astronomy.SearchAltitude('Sun', observer, +1, startOfDay, 1, -12);
        const yoake     = Astronomy.SearchAltitude('Sun', observer, +1, startOfDay, 1, -7.361111);
        const civilDawn = Astronomy.SearchAltitude('Sun', observer, +1, startOfDay, 1, -6);
        const sr        = Astronomy.SearchRiseSet('Sun', observer, +1, startOfDay, 1);

        // 日暮側 (descending)
        const ss        = Astronomy.SearchRiseSet('Sun', observer, -1, startOfDay, 1);
        const civilDusk = Astronomy.SearchAltitude('Sun', observer, -1, startOfDay, 1, -6);
        const higure    = Astronomy.SearchAltitude('Sun', observer, -1, startOfDay, 1, -7.361111);
        const nautDusk  = Astronomy.SearchAltitude('Sun', observer, -1, startOfDay, 1, -12);
        const astroDusk = Astronomy.SearchAltitude('Sun', observer, -1, startOfDay, 1, -18);

        // 時刻DOM更新
        document.getElementById('time-astro-dawn').innerText = astroDawn ? formatTime(astroDawn.date) : "--:--";
        document.getElementById('time-naut-dawn').innerText  = nautDawn ? formatTime(nautDawn.date) : "--:--";
        document.getElementById('time-yoake').innerText      = yoake ? formatTime(yoake.date) : "--:--";
        document.getElementById('time-civil-dawn').innerText = civilDawn ? formatTime(civilDawn.date) : "--:--";
        document.getElementById('time-tw-sunrise').innerText = sr ? formatTime(sr.date) : "--:--";

        document.getElementById('time-tw-sunset').innerText  = ss ? formatTime(ss.date) : "--:--";
        document.getElementById('time-civil-dusk').innerText = civilDusk ? formatTime(civilDusk.date) : "--:--";
        document.getElementById('time-higure').innerText     = higure ? formatTime(higure.date) : "--:--";
        document.getElementById('time-naut-dusk').innerText  = nautDusk ? formatTime(nautDusk.date) : "--:--";
        document.getElementById('time-astro-dusk').innerText = astroDusk ? formatTime(astroDusk.date) : "--:--";

        // 日の出/入の視高度表示
        document.getElementById('alt-tw-sunrise').innerText = sr ? getRiseSetAlt('Sun', sr.date, observer, refr) : "--";
        document.getElementById('alt-tw-sunset').innerText  = ss ? getRiseSetAlt('Sun', ss.date, observer, refr) : "--";

        // currentRiseSetDataに薄明データを追加
        currentRiseSetData.astro_dawn = astroDawn?.date;
        currentRiseSetData.naut_dawn  = nautDawn?.date;
        currentRiseSetData.yoake      = yoake?.date;
        currentRiseSetData.civil_dawn = civilDawn?.date;
        currentRiseSetData.tw_sunrise = sr?.date;
        currentRiseSetData.tw_sunset  = ss?.date;
        currentRiseSetData.civil_dusk = civilDusk?.date;
        currentRiseSetData.higure     = higure?.date;
        currentRiseSetData.naut_dusk  = nautDusk?.date;
        currentRiseSetData.astro_dusk = astroDusk?.date;
    } catch(e) {}
}

function updateMoonInfo(date) {
    const phase = Astronomy.MoonPhase(date);
    const age = (phase / 360) * SYNODIC_MONTH;
    appState.moonAge = parseFloat(age.toFixed(1));
    document.getElementById('moon-age-input').value = appState.moonAge;
    const icons = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
    document.getElementById('moon-icon').innerText = icons[Math.round(phase / 45) % 8];
}

function formatTime(date, baseDate) {
    if (!date) return "--:--:--";

    let h = date.getHours();
    const m = date.getMinutes();
    const s = date.getSeconds();

    if (baseDate) {
        if (date.getTime() - baseDate.getTime() >= 86400000) {
            h += 24;
        }
    }

    return `${('00'+h).slice(-2)}:${('00'+m).slice(-2)}:${('00'+s).slice(-2)}`;
}

function formatTimeHM(date) {
    if (!date) return "--:--";
    return `${('00'+date.getHours()).slice(-2)}:${('00'+date.getMinutes()).slice(-2)}`;
}

function searchStarRiseSet(ra, dec, observer, startOfDay) {
    let rise = null;
    let set = null;
    let prevAlt = null;
    const start = startOfDay.getTime();
    
    for (let m = 0; m <= 1440; m += 1) { 
        const time = new Date(start + m * 60000);
        
        const hor = Astronomy.Horizon(time, observer, ra, dec, appState.refractionEnabled ? "normal" : null); 
        const alt = hor.altitude;
        
        if (prevAlt !== null) {
            if (prevAlt < 0 && alt >= 0) {
                rise = getCrossingTime(start + (m-1)*60000, start + m*60000, prevAlt, alt);
            } else if (prevAlt >= 0 && alt < 0) {
                set = getCrossingTime(start + (m-1)*60000, start + m*60000, prevAlt, alt);
            }
        }
        prevAlt = alt;
    }
    return {
        rise: rise ? formatTime(rise) : "--:--:--",
        set: set ? formatTime(set) : "--:--:--"
    };
}

function searchStarTransit(ra, dec, observer, startOfDay) {
    let maxAlt = -Infinity;
    let transitTime = null;
    const start = startOfDay.getTime();
    for (let m = 0; m <= 1440; m += 1) {
        const time = new Date(start + m * 60000);
        const hor = Astronomy.Horizon(time, observer, ra, dec, appState.refractionEnabled ? "normal" : null);
        if (hor.altitude > maxAlt) {
            maxAlt = hor.altitude;
            transitTime = time;
        }
    }
    return transitTime ? formatTime(transitTime, startOfDay) : "--:--:--";
}

/**
 * 線形補間により、高度が0(地平線)になる正確な時刻を計算する
 * 原理: 2点間を直線で結び、その線が0と交差するポイント(比率)を求める
 * * @param {number} t1 前回の時刻 (ms)
 * @param {number} t2 今回の時刻 (ms)
 * @param {number} alt1 前回の高度
 * @param {number} alt2 今回の高度
 */
function getCrossingTime(t1, t2, alt1, alt2) {
    // 1. 全体でどれだけ高度が変わったか (分母: 坂の高さ)
    const totalClimb = alt2 - alt1;
    
    // 2. 0(地平線)になるには、t1からあとどれだけ登ればいいか (分子: 残りの高さ)
    const needToClimb = 0 - alt1;
    
    // 3. その比率(進捗率)を出し、時間の幅(t2-t1)に掛けて、t1に足す
    const ratio = needToClimb / totalClimb;
    
    return new Date(t1 + (t2 - t1) * ratio);
}

/**
 * 眼高差（Dip of Horizon）を計算する
 * 引用: 天文航法, 天文学辞典, 理科年表
 * 式: σ = 1.776' × √h (分)
 * * @param {number} h 眼高 (メートル)
 * @returns {number} 眼高差 (度)
 */
function getHorizonDip(h) {
    if (!h || h <= 0) return 0;
    
    // 1.776分 × √h
    // 戻り値は「度」にする必要があるので 60 で割る
    return 1.776 * Math.sqrt(h) / 60;
}

// ============================================================
// My天体管理
// ============================================================

/** My天体 → bodies 配列に同期 */
function syncMyStarsToBodies() {
    // bodies から isCustom のものを除去
    appState.bodies = appState.bodies.filter(b => !b.isCustom);
    // myStars を bodies に追加
    appState.myStars.forEach(star => {
        appState.bodies.push({
            id: String(star.id),
            name: star.name,
            color: star.color,
            isDashed: star.isDashed,
            visible: star.visible,
            isCustom: true
        });
    });
}

/** 空きID番号の最小値を返す (1〜1000) */
function getNextMyStarId() {
    const usedIds = new Set(appState.myStars.map(s => s.id));
    for (let i = 1; i <= 1000; i++) {
        if (!usedIds.has(i)) return i;
    }
    return null;
}

/** My天体を追加 */
function addMyStar(name, ra, dec) {
    const id = getNextMyStarId();
    if (id === null) {
        alert('My天体の登録上限(1000件)に達しています');
        return false;
    }
    appState.myStars.push({
        id, name: name.replace(/,/g, '，'), ra, dec,
        visible: false,
        color: '#DDA0DD',
        isDashed: true
    });
    syncMyStarsToBodies();
    saveAppState();
    renderMyStarsList();
    updateAll();
    return true;
}

/** My天体リスト描画 */
function renderMyStarsList() {
    const list = document.getElementById('mystars-list');
    if (!list) return;
    list.innerHTML = '';

    if (appState.myStars.length === 0) {
        list.innerHTML = '<li class="mystars-empty">My天体は登録されていません</li>';
        return;
    }

    appState.myStars.forEach(star => {
        const bodyInBodies = appState.bodies.find(b => b.id === String(star.id));
        const dashClass = star.isDashed ? 'dashed' : 'solid';
        const li = document.createElement('li');
        li.innerHTML = `
            <input type="radio" name="mystars-select" value="${star.id}" class="mystars-radio">
            <input type="checkbox" class="body-checkbox" ${star.visible ? 'checked' : ''}>
            <div class="style-indicator ${dashClass}" style="color: ${escapeHtml(star.color)};"></div>
            <div class="body-info">
                <span class="body-name-label">${escapeHtml(star.name)}</span>
                <span class="body-name-id">ID: ${star.id}</span>
                <span id="radec-${star.id}" class="body-detail-text">赤経 ${star.ra.toFixed(6)}h / 赤緯 ${star.dec.toFixed(6)}°</span>
                <span id="riseset-${star.id}" class="body-detail-text">出時刻 --:--:-- / 入時刻 --:--:--</span>
                <span id="transit-${star.id}" class="body-detail-text">南中時 --:--:-- / 視半径 -.---°</span>
                <span id="data-${star.id}" class="body-detail-text">方位角 --° / 視高度 --°</span>
            </div>`;
        // チェックボックス: 表示/非表示
        li.querySelector('.body-checkbox').addEventListener('change', function() {
            star.visible = this.checked;
            if (bodyInBodies) bodyInBodies.visible = this.checked;
            saveAppState();
            updateAll();
        });
        // カラーパレット
        li.querySelector('.style-indicator').addEventListener('click', function() {
            openPalette(String(star.id));
        });
        list.appendChild(li);
    });
}

/** ラジオボタンで選択中のMy天体IDを取得 */
function getSelectedMyStarId() {
    const radio = document.querySelector('input[name="mystars-select"]:checked');
    return radio ? parseInt(radio.value) : null;
}

/** My天体を削除 */
function deleteMyStar() {
    const id = getSelectedMyStarId();
    if (id === null) return alert('削除するMy天体を選択してください');
    const star = appState.myStars.find(s => s.id === id);
    if (!star) return;
    if (!confirm(`My天体リストの天体(ID:${id}, ${star.name})を削除しますか？`)) return;
    appState.myStars = appState.myStars.filter(s => s.id !== id);
    syncMyStarsToBodies();
    saveAppState();
    renderMyStarsList();
    updateAll();
}

/** My天体を上に移動 */
function moveMyStarUp() {
    const id = getSelectedMyStarId();
    if (id === null) return;
    const idx = appState.myStars.findIndex(s => s.id === id);
    if (idx <= 0) return;
    [appState.myStars[idx - 1], appState.myStars[idx]] = [appState.myStars[idx], appState.myStars[idx - 1]];
    syncMyStarsToBodies();
    saveAppState();
    renderMyStarsList();
    // 選択状態を復元
    const radio = document.querySelector(`input[name="mystars-select"][value="${id}"]`);
    if (radio) radio.checked = true;
}

/** My天体を下に移動 */
function moveMyStarDown() {
    const id = getSelectedMyStarId();
    if (id === null) return;
    const idx = appState.myStars.findIndex(s => s.id === id);
    if (idx < 0 || idx >= appState.myStars.length - 1) return;
    [appState.myStars[idx], appState.myStars[idx + 1]] = [appState.myStars[idx + 1], appState.myStars[idx]];
    syncMyStarsToBodies();
    saveAppState();
    renderMyStarsList();
    const radio = document.querySelector(`input[name="mystars-select"][value="${id}"]`);
    if (radio) radio.checked = true;
}

/** 全角→半角変換 (名前以外の値用) */
function toHalfWidth(str) {
    return str.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
              .replace(/　/g, ' ');
}

/** ファイル名用日時フォーマット (YYYYMMDD-hhmmss) */
function formatFileDateTime() {
    const d = new Date();
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${Y}${M}${D}-${h}${m}${s}`;
}

/** CSV入力 (My天体) */
function importMyStarsCsv() {
    if (!confirm('My天体リストにCSVファイルから全て上書き入力・登録しますか？')) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const text = ev.target.result;
                const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
                if (lines.length < 2) return alert('CSVファイルにデータがありません');
                if (lines.length > 1001) return alert('CSVの上限は1000件(見出し行+1000行)です');

                const newStars = [];
                const usedIds = new Set();
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',');
                    if (cols.length < 4) { alert(`${i + 1}行目: 列数が不足しています`); return; }
                    const id = parseInt(toHalfWidth(cols[0].trim()));
                    const name = cols[1].trim();
                    const ra = parseFloat(toHalfWidth(cols[2].trim()));
                    const dec = parseFloat(toHalfWidth(cols[3].trim()));
                    if (isNaN(id) || id < 1 || id > 1000) { alert(`${i + 1}行目: IDが無効です(1〜1000)`); return; }
                    if (usedIds.has(id)) { alert(`${i + 1}行目: ID ${id} が重複しています`); return; }
                    if (!name) { alert(`${i + 1}行目: 天体名が空です`); return; }
                    if (isNaN(ra) || isNaN(dec)) { alert(`${i + 1}行目: 赤経/赤緯が無効です`); return; }
                    usedIds.add(id);
                    newStars.push({ id, name, ra, dec, visible: false, color: '#DDA0DD', isDashed: true });
                }
                // CSVの読み込み順で登録（ID昇順ソートはしない）
                appState.myStars = newStars;
                syncMyStarsToBodies();
                saveAppState();
                renderMyStarsList();
                updateAll();
                alert(`${newStars.length}件のMy天体を登録しました`);
            } catch (err) {
                alert('CSVの読み込みに失敗しました: ' + err.message);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
}

/** 追加CSV入力 (My天体 — 既存リストに追加) */
function appendMyStarsCsv() {
    if (!confirm('My天体リストにCSVファイルから"追加"入力・登録しますか？')) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const text = ev.target.result;
                const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
                if (lines.length < 2) return alert('CSVファイルにデータがありません');

                const csvEntries = [];
                const csvIds = new Set();
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',');
                    if (cols.length < 4) { alert(`${i + 1}行目: 列数が不足しています`); return; }
                    const id = parseInt(toHalfWidth(cols[0].trim()));
                    const name = cols[1].trim();
                    const ra = parseFloat(toHalfWidth(cols[2].trim()));
                    const dec = parseFloat(toHalfWidth(cols[3].trim()));
                    if (isNaN(id) || id < 1 || id > 1000) { alert(`${i + 1}行目: IDが無効です(1〜1000)`); return; }
                    if (csvIds.has(id)) { alert(`CSV内でID ${id} が重複しています`); return; }
                    if (!name) { alert(`${i + 1}行目: 天体名が空です`); return; }
                    if (isNaN(ra) || isNaN(dec)) { alert(`${i + 1}行目: 赤経/赤緯が無効です`); return; }
                    csvIds.add(id);
                    csvEntries.push({ id, name, ra, dec });
                }

                let addedCount = 0;
                for (const entry of csvEntries) {
                    // 上限チェック
                    if (appState.myStars.length >= 1000) { alert('My天体の登録上限(1000件)に達しています'); return; }

                    // 赤経/赤緯が同じ既存エントリがあればスキップ
                    const duplicate = appState.myStars.some(s => s.ra === entry.ra && s.dec === entry.dec);
                    if (duplicate) continue;

                    // ID重複チェック
                    if (appState.myStars.some(s => s.id === entry.id)) {
                        const ok = confirm(`My天体(ID:${entry.id}、${entry.name})は、IDが重複しています。新規にIDを採番しますか？(OK→採番する、キャンセル→処理終了)`);
                        if (!ok) return;
                        entry.id = getNextMyStarId();
                        if (entry.id === null) { alert('My天体の登録上限(1000件)に達しています'); return; }
                    }

                    appState.myStars.push({
                        id: entry.id, name: entry.name, ra: entry.ra, dec: entry.dec,
                        visible: false, color: '#DDA0DD', isDashed: true
                    });
                    addedCount++;
                }

                syncMyStarsToBodies();
                saveAppState();
                renderMyStarsList();
                updateAll();
                alert(`${addedCount}件のMy天体を追加しました`);
            } catch (err) {
                alert('CSVの読み込みに失敗しました: ' + err.message);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
}

/** CSV出力 (My天体) */
function exportMyStarsCsv() {
    if (appState.myStars.length === 0) return alert('My天体が登録されていません');
    if (!confirm('My天体リストの登録内容をCSVファイルに出力しますか？')) return;
    const bom = '\uFEFF';
    let csv = bom + '天体ID,天体名,赤経,赤緯\r\n';
    appState.myStars.forEach(s => {
        csv += `${s.id},${s.name},${s.ra},${s.dec}\r\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soranotsuji-My天体-${formatFileDateTime()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================
// 天体検索
// ============================================================

let CelestialDb = null; // celestial_db.json キャッシュ
let selectedSearchStar = null; // 検索で選択された天体

/** celestial_db.json をロード (キャッシュ) */
function loadCelestialDb() {
    if (CelestialDb) return Promise.resolve(CelestialDb);
    return fetch('celestial_db.json')
        .then(res => {
            if (!res.ok) throw new Error('celestial_db.json の読み込みに失敗しました');
            return res.json();
        })
        .then(data => {
            CelestialDb = data;
            return data;
        });
}

/** 天体検索を実行 */
function searchStars() {
    const keyword = document.getElementById('input-starsearch').value.trim();
    if (!keyword) return alert('検索キーワードを入力してください');

    const chkMag3 = document.getElementById('chk-search-mag3').checked;
    const chkMag6 = document.getElementById('chk-search-mag6').checked;
    const chkOther = document.getElementById('chk-search-other').checked;

    loadCelestialDb().then(db => {
        const results = db.filter(star => {
            // キーワードマッチ (name, keys)
            const text = `${star.name} ${star.keys || ''}`;
            if (!text.includes(keyword)) return false;
            // 等級フィルタ
            if (star.mag === null || star.mag === undefined) return chkOther;
            if (star.mag <= 3) return chkMag3;
            if (star.mag <= 6) return chkMag6;
            return chkOther;
        });
        showStarSearchPopup(results);
    }).catch(err => {
        alert('天体データの読み込みに失敗しました: ' + err.message);
    });
}

/** 検索ポップアップを表示 */
function showStarSearchPopup(results) {
    const popup = document.getElementById('starsearch-popup');
    const title = document.getElementById('starsearch-popup-title');
    const content = document.getElementById('starsearch-popup-content');

    title.textContent = `天体名検索結果（${results.length}件）`;
    content.innerHTML = '';

    if (results.length === 0) {
        content.innerHTML = '<div class="starsearch-no-result">該当する天体が見つかりませんでした</div>';
    } else {
        results.forEach(star => {
            const item = document.createElement('div');
            item.className = 'starsearch-result-item';
            item.innerHTML = `
                <div class="starsearch-result-name">${escapeHtml(star.name)}</div>
                <div class="starsearch-result-detail">${star.ra}, ${star.dec}</div>
                <div class="starsearch-result-detail">${star.mag !== null && star.mag !== undefined ? star.mag : '--'}, ${escapeHtml(star.type || '--')}</div>
                <div class="starsearch-result-keys">${escapeHtml(star.keys || '')}</div>`;
            item.addEventListener('click', () => selectSearchResult(star));
            content.appendChild(item);
        });
    }
    popup.classList.remove('hidden');
}

/** 検索結果を選択 */
function selectSearchResult(star) {
    selectedSearchStar = star;
    document.getElementById('input-starsearch-name').value = star.name;
    document.getElementById('input-starsearch-radec').value = `${star.ra}, ${star.dec}`;
    closeStarSearchPopup();
}

/** 検索ポップアップを閉じる */
function closeStarSearchPopup() {
    document.getElementById('starsearch-popup').classList.add('hidden');
}

/** 検索結果をMy天体に登録 */
function registerSearchStar() {
    const name = document.getElementById('input-starsearch-name').value.trim();
    const radecStr = document.getElementById('input-starsearch-radec').value.trim();
    if (!name || !radecStr) return alert('天体名と赤経赤緯を入力してください');
    const parts = radecStr.split(',').map(s => s.trim());
    if (parts.length !== 2) return alert('赤経赤緯の形式が不正です');
    const ra = parseFloat(parts[0]);
    const dec = parseFloat(parts[1]);
    if (isNaN(ra) || isNaN(dec)) return alert('赤経赤緯の値が不正です');
    if (!confirm(`検索天体をMy天体に登録しますか？(天体名は書き換えられます。)`)) return;
    if (addMyStar(name, ra, dec)) {
        // 入力フィールドをクリア
        document.getElementById('input-starsearch-name').value = '';
        document.getElementById('input-starsearch-radec').value = '';
        selectedSearchStar = null;
    }
}

// ============================================================
// バックアップ / インポート
// ============================================================

function exportBackup() {
    if (!confirm('Homeボタン、推し山ボタン、表示天体、My天体、My観測点、My目的点、My辻検索、設定のリストをバックアップファイルに全て出力しますか？')) return;
    const data = {
        backupDate: new Date().toISOString(),
        homeStart: appState.homeStart,
        homeEnd: appState.homeEnd,
        bodies: appState.bodies.filter(b => !b.isCustom).map(b => ({
            id: b.id, visible: b.visible, color: b.color, isDashed: b.isDashed
        })),
        myStars: appState.myStars,
        myObservations: appState.myObservations,
        myTargets: appState.myTargets,
        myTsujiSearches: appState.myTsujiSearches,
        settings: {
            refractionEnabled: appState.refractionEnabled,
            meteo: { p: appState.meteo.p, t: appState.meteo.t, l: appState.meteo.l }
        }
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soranotsuji-バックアップ-${formatFileDateTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importBackup() {
    if (!confirm('Homeボタン、推し山ボタン、表示天体、My天体、My観測点、My目的点、My辻検索、設定のリストをバックアップファイルから全て上書き入力・登録しますか？')) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.homeStart) appState.homeStart = data.homeStart;
                if (data.homeEnd) appState.homeEnd = data.homeEnd;
                if (data.bodies && Array.isArray(data.bodies)) {
                    data.bodies.forEach(b => {
                        const existing = appState.bodies.find(x => x.id === b.id && !x.isCustom);
                        if (existing) {
                            if (b.visible !== undefined) existing.visible = b.visible;
                            if (b.color !== undefined) existing.color = b.color;
                            if (b.isDashed !== undefined) existing.isDashed = b.isDashed;
                        }
                    });
                }
                if (data.myStars && Array.isArray(data.myStars)) {
                    appState.myStars = data.myStars;
                    syncMyStarsToBodies();
                }
                if (data.myObservations && Array.isArray(data.myObservations)) appState.myObservations = data.myObservations;
                if (data.myTargets && Array.isArray(data.myTargets)) appState.myTargets = data.myTargets;
                if (data.myTsujiSearches && Array.isArray(data.myTsujiSearches)) appState.myTsujiSearches = data.myTsujiSearches;
                if (data.settings) {
                    if (data.settings.refractionEnabled !== undefined) appState.refractionEnabled = data.settings.refractionEnabled;
                    if (data.settings.meteo) {
                        if (data.settings.meteo.p !== undefined) appState.meteo.p = data.settings.meteo.p;
                        if (data.settings.meteo.t !== undefined) appState.meteo.t = data.settings.meteo.t;
                        if (data.settings.meteo.l !== undefined) appState.meteo.l = data.settings.meteo.l;
                    }
                }
                saveAppState();
                syncUIFromState();
                // Homeボタン/推し山ボタンの押下状態を homeStart/homeEnd の有無で更新
                const btnRegStart = document.getElementById('btn-reg-start');
                const btnRegEnd = document.getElementById('btn-reg-end');
                if (appState.homeStart) {
                    btnRegStart.classList.add('active');
                    btnRegStart.title = '登録済みの観測点を呼び出し';
                } else {
                    btnRegStart.classList.remove('active');
                    btnRegStart.title = '';
                }
                if (appState.homeEnd) {
                    btnRegEnd.classList.add('active');
                    btnRegEnd.title = '登録済みの目的点を呼び出し';
                } else {
                    btnRegEnd.classList.remove('active');
                    btnRegEnd.title = '';
                }
                renderCelestialList();
                renderMyStarsList();
                renderMyPointsList('obs');
                renderMyPointsList('tgt');
                renderMyTsujiSearches();
                updateMyPointMarkers();
                updateAll();
                alert('バックアップファイルからインポートしました。');
            } catch (err) {
                alert('バックアップファイルの読み込みに失敗しました: ' + err.message);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
}

// ============================================================
// My観測点 / My目的点 — 共通関数
// ============================================================

let myObsDirty = false;
let myTgtDirty = false;
let myPointMarkerLayer = null; // マーカー用レイヤー

/** 型情報を返す */
function myPointConfig(type) {
    if (type === 'obs') return {
        list: () => appState.myObservations,
        setList: (v) => { appState.myObservations = v; },
        prefix: 'myobs', label: '観測点', labelFull: 'My観測点',
        markerColor: '#4CAF50', locKey: 'start',
        getDirty: () => myObsDirty, setDirty: (v) => { myObsDirty = v; }
    };
    return {
        list: () => appState.myTargets,
        setList: (v) => { appState.myTargets = v; },
        prefix: 'mytgt', label: '目的点', labelFull: 'My目的点',
        markerColor: '#FF9800', locKey: 'end',
        getDirty: () => myTgtDirty, setDirty: (v) => { myTgtDirty = v; }
    };
}

/** ID自動採番 (1〜1000の空き最小値) */
function getNextMyPointId(type) {
    const cfg = myPointConfig(type);
    const usedIds = new Set(cfg.list().map(p => p.id));
    for (let i = 1; i <= 1000; i++) { if (!usedIds.has(i)) return i; }
    return null;
}

/** dirty flag 更新 → 「全て登録」ボタンのスタイル変更 */
function setMyPointDirty(type, val) {
    const cfg = myPointConfig(type);
    cfg.setDirty(val);
    const btn = document.getElementById(`btn-${cfg.prefix}-regall`);
    if (btn) {
        if (val) { btn.classList.add('dirty'); }
        else { btn.classList.remove('dirty'); }
    }
}

/** リスト描画 */
function renderMyPointsList(type) {
    const cfg = myPointConfig(type);
    const container = document.getElementById(`${cfg.prefix}-list`);
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);
    const points = cfg.list();
    if (points.length === 0) {
        container.innerHTML = `<div class="mystars-empty">${cfg.labelFull}は登録されていません</div>`;
        return;
    }
    points.forEach((pt, idx) => {
        const row = document.createElement('div');
        row.className = 'mypoint-row';
        row.innerHTML = `
            <hr class="tsujisearch-separator">
            <div class="mypoint-row-header">
                <input type="radio" name="${cfg.prefix}-select" value="${pt.id}" class="mystars-radio" ${idx === 0 ? 'checked' : ''}>
                <span class="mypoint-id">ID:${String(pt.id).padStart(4, ' ')}</span>
            </div>
            <div class="control-row">
                <input type="text" class="mypoint-name" value="${escapeHtml(pt.name)}" placeholder="${cfg.label}名" maxlength="150" data-id="${pt.id}" autocomplete="off">
            </div>
            <div class="control-row">
                <input type="text" class="mypoint-latlng" value="${pt.lat !== null && pt.lat !== undefined ? pt.lat + ', ' + pt.lng : ''}" placeholder="地名 住所 緯度,経度" maxlength="150" data-id="${pt.id}" autocomplete="off">
            </div>
            <div class="control-row">
                <label class="mypoint-label">標高:</label>
                <input type="number" class="mypoint-elev" value="${pt.elev !== null && pt.elev !== undefined ? pt.elev : ''}" placeholder="標高" step="0.1" data-id="${pt.id}">
                <label class="mypoint-label">高さ:</label>
                <input type="number" class="mypoint-height" value="${pt.height !== null && pt.height !== undefined ? pt.height : ''}" placeholder="高さ" step="0.1" data-id="${pt.id}">
            </div>
            <div class="control-row">
                <label class="mypoint-label">メモ:</label>
                <input type="text" class="mypoint-memo" value="${escapeHtml(pt.memo || '')}" placeholder="メモ(150文字)" maxlength="150" data-id="${pt.id}" autocomplete="off">
            </div>`;
        // イベント: 名前変更
        row.querySelector('.mypoint-name').addEventListener('input', () => setMyPointDirty(type, true));
        row.querySelector('.mypoint-name').addEventListener('change', (e) => {
            pt.name = e.target.value.trim();
            saveAppState();
            setMyPointDirty(type, true);
        });
        // イベント: 緯度経度変更 (Enter で地名検索 or 数値入力)
        const latlngInput = row.querySelector('.mypoint-latlng');
        latlngInput.addEventListener('keydown', async (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const val = latlngInput.value.trim();
            if (!val) return;
            // 緯度,経度 形式か判定
            const parts = val.split(',').map(s => s.trim());
            if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
                pt.lat = parseFloat(parts[0]);
                pt.lng = parseFloat(parts[1]);
                latlngInput.value = `${pt.lat}, ${pt.lng}`;
                // 標高取得
                const elev = await getElevation(pt.lat, pt.lng);
                pt.elev = elev !== null ? elev : 0;
                row.querySelector('.mypoint-elev').value = pt.elev;
                saveAppState();
                setMyPointDirty(type, true);
            } else {
                // 地名検索
                const results = await searchLocation(val);
                if (results && results.length > 0) {
                    showLocationPicker(results, async (selected) => {
                        pt.lat = selected.lat;
                        pt.lng = selected.lon;
                        latlngInput.value = `${pt.lat}, ${pt.lng}`;
                        const elev = await getElevation(pt.lat, pt.lng);
                        pt.elev = elev !== null ? elev : 0;
                        row.querySelector('.mypoint-elev').value = pt.elev;
                        saveAppState();
                        setMyPointDirty(type, true);
                    });
                } else {
                    alert('該当する場所が見つかりませんでした');
                }
            }
        });
        latlngInput.addEventListener('input', () => setMyPointDirty(type, true));
        // blur時に直接編集された数値を反映 (Enter押下を経由しない編集対応)
        latlngInput.addEventListener('change', () => {
            const val = latlngInput.value.trim();
            if (!val) {
                pt.lat = null;
                pt.lng = null;
                saveAppState();
                setMyPointDirty(type, true);
                return;
            }
            const parts = val.split(',').map(s => s.trim());
            if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
                pt.lat = parseFloat(parts[0]);
                pt.lng = parseFloat(parts[1]);
                saveAppState();
                setMyPointDirty(type, true);
            }
            // 非数値(地名)の場合はpt.lat/lngを更新しない(Enterで地名検索してもらう)
        });
        // イベント: 標高/高さ変更
        row.querySelector('.mypoint-elev').addEventListener('change', (e) => {
            pt.elev = parseFloat(e.target.value) || 0;
            saveAppState();
            setMyPointDirty(type, true);
        });
        row.querySelector('.mypoint-height').addEventListener('change', (e) => {
            pt.height = parseFloat(e.target.value) || 0;
            saveAppState();
            setMyPointDirty(type, true);
        });
        row.querySelector('.mypoint-memo').addEventListener('change', (e) => {
            pt.memo = e.target.value.trim();
            saveAppState();
            setMyPointDirty(type, true);
        });
        container.appendChild(row);
    });
}

/** 位置反映 */
function applyMyPoint(type) {
    const cfg = myPointConfig(type);
    const id = getSelectedMyPointId(type);
    if (id === null) return alert(`${cfg.label}を選択してください`);
    const pt = cfg.list().find(p => p.id === id);
    if (!pt || pt.lat === null || pt.lat === undefined) return alert('緯度経度が設定されていません');
    if (!confirm(`${cfg.label}（ID:${id}、${pt.name}）を位置情報メニューと地図に反映しますか？`)) return;
    const locKey = cfg.locKey;
    const totalElev = (pt.elev || 0) + (pt.height || 0);
    appState[locKey] = { lat: pt.lat, lng: pt.lng, elev: totalElev };
    if (locKey === 'start') {
        appState.startApiElev = pt.elev || 0;
        appState.startHeight = pt.height || 0;
    } else {
        appState.endApiElev = pt.elev || 0;
        appState.endHeight = pt.height || 0;
    }
    saveAppState();
    updateAll();
    // 地図の中心を移動
    if (typeof map !== 'undefined') map.setView([pt.lat, pt.lng], map.getZoom());
}

/** 観測点取得 / 目的点取得 */
function getMyPointFromLocation(type) {
    const cfg = myPointConfig(type);
    if (!confirm(`現在の位置情報（緯度経度・標高・高さ）を${cfg.labelFull}リストに追加しますか？`)) return;
    const id = getNextMyPointId(type);
    if (id === null) return alert(`${cfg.labelFull}の登録上限(1000件)に達しています`);
    const locKey = cfg.locKey;
    const loc = appState[locKey];
    const apiElev = locKey === 'start' ? appState.startApiElev : appState.endApiElev;
    const height = locKey === 'start' ? appState.startHeight : appState.endHeight;
    cfg.list().push({
        id, name: `新規${cfg.label}名`,
        lat: loc.lat, lng: loc.lng,
        elev: apiElev, height: height, memo: ''
    });
    saveAppState();
    setMyPointDirty(type, true);
    renderMyPointsList(type);
}

/** 全て登録 */
function registerAllMyPoints(type) {
    const cfg = myPointConfig(type);
    const points = cfg.list();
    // 未入力チェック
    for (const pt of points) {
        if (!pt.name || pt.lat === null || pt.lat === undefined || pt.lng === null || pt.lng === undefined) {
            document.getElementById(`${cfg.prefix}-error`).innerHTML =
                `<span class="mypoint-error-text">${cfg.label}ID:${pt.id}に未入力のものがあります。入力するか、行削除してください。</span>`;
            return;
        }
    }
    document.getElementById(`${cfg.prefix}-error`).innerHTML = '';
    if (!confirm(`現在の${cfg.labelFull}リストをローカルストレージに登録しますか？`)) return;
    points.forEach(pt => {
        pt.name = (pt.name || '').replace(/,/g, '，');
        pt.memo = (pt.memo || '').replace(/,/g, '，');
        if (typeof pt.lat === 'string') pt.lat = parseFloat(toHalfWidth(String(pt.lat)));
        if (typeof pt.lng === 'string') pt.lng = parseFloat(toHalfWidth(String(pt.lng)));
    });
    saveAppState();
    setMyPointDirty(type, false);
    updateMyPointMarkers();
    alert(`${cfg.labelFull}を登録しました`);
}

/** 行追加 */
function addMyPointRow(type) {
    const cfg = myPointConfig(type);
    if (cfg.list().length >= 1000) return alert(`${cfg.labelFull}の登録上限(1000件)に達しています`);
    if (!confirm(`${cfg.labelFull}リストの末尾に${cfg.label}の行を追加しますか？`)) return;
    const id = getNextMyPointId(type);
    if (id === null) return;
    // 選択中の行の次に挿入
    const selId = getSelectedMyPointId(type);
    const idx = selId !== null ? cfg.list().findIndex(p => p.id === selId) : -1;
    const newPt = { id, name: '', lat: null, lng: null, elev: null, height: 0, memo: '' };
    if (idx >= 0) {
        cfg.list().splice(idx + 1, 0, newPt);
    } else {
        cfg.list().push(newPt);
    }
    saveAppState();
    setMyPointDirty(type, true);
    renderMyPointsList(type);
    // 新しい行を選択
    const radio = document.querySelector(`input[name="${cfg.prefix}-select"][value="${id}"]`);
    if (radio) radio.checked = true;
}

/** 行削除 */
function deleteMyPointRow(type) {
    const cfg = myPointConfig(type);
    const id = getSelectedMyPointId(type);
    if (id === null) return alert(`削除する${cfg.label}を選択してください`);
    const pt = cfg.list().find(p => p.id === id);
    if (!pt) return;
    if (!confirm(`${cfg.labelFull}リストの${cfg.label}（ID:${id}、${pt.name || ''}）を削除しますか？`)) return;
    cfg.setList(cfg.list().filter(p => p.id !== id));
    saveAppState();
    setMyPointDirty(type, true);
    renderMyPointsList(type);
}

/** 上に移動 */
function moveMyPointUp(type) {
    const cfg = myPointConfig(type);
    const id = getSelectedMyPointId(type);
    if (id === null) return;
    const idx = cfg.list().findIndex(p => p.id === id);
    if (idx <= 0) return;
    const list = cfg.list();
    [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
    saveAppState();
    setMyPointDirty(type, true);
    renderMyPointsList(type);
    const radio = document.querySelector(`input[name="${cfg.prefix}-select"][value="${id}"]`);
    if (radio) radio.checked = true;
}

/** 下に移動 */
function moveMyPointDown(type) {
    const cfg = myPointConfig(type);
    const id = getSelectedMyPointId(type);
    if (id === null) return;
    const list = cfg.list();
    const idx = list.findIndex(p => p.id === id);
    if (idx < 0 || idx >= list.length - 1) return;
    [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
    saveAppState();
    setMyPointDirty(type, true);
    renderMyPointsList(type);
    const radio = document.querySelector(`input[name="${cfg.prefix}-select"][value="${id}"]`);
    if (radio) radio.checked = true;
}

/** 選択中のID取得 */
function getSelectedMyPointId(type) {
    const cfg = myPointConfig(type);
    const radio = document.querySelector(`input[name="${cfg.prefix}-select"]:checked`);
    return radio ? parseInt(radio.value) : null;
}

/** CSV入力 */
function importMyPointsCsv(type) {
    const cfg = myPointConfig(type);
    if (!confirm(`${cfg.labelFull}リストにCSVファイルから全て上書き入力・登録しますか？`)) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const text = ev.target.result;
                const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
                if (lines.length < 2) return alert('CSVファイルにデータがありません');
                if (lines.length > 1001) return alert('CSVの上限は1000件です');
                const newPoints = [];
                const usedIds = new Set();
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',');
                    if (cols.length < 6) { alert(`${i + 1}行目: 列数が不足しています(6列必要)`); return; }
                    const id = parseInt(toHalfWidth(cols[0].trim()));
                    const name = cols[1].trim();
                    const lat = parseFloat(toHalfWidth(cols[2].trim()));
                    const lng = parseFloat(toHalfWidth(cols[3].trim()));
                    let elev = cols[4].trim() === '' ? null : parseFloat(toHalfWidth(cols[4].trim()));
                    const height = parseFloat(toHalfWidth(cols[5].trim())) || 0;
                    const memo = (cols[6] !== undefined ? cols[6] : '').trim();
                    if (isNaN(id) || id < 1 || id > 1000) { alert(`${i + 1}行目: IDが無効です(1〜1000)`); return; }
                    if (usedIds.has(id)) { alert(`${i + 1}行目: ID ${id} が重複しています`); return; }
                    if (isNaN(lat) || isNaN(lng)) { alert(`${i + 1}行目: 緯度/経度が無効です`); return; }
                    usedIds.add(id);
                    // 標高が空の場合は後で取得
                    newPoints.push({ id, name, lat, lng, elev, height, memo });
                }
                // 標高が未設定の場合は取得
                for (const pt of newPoints) {
                    if (pt.elev === null || isNaN(pt.elev)) {
                        const el = await getElevation(pt.lat, pt.lng);
                        pt.elev = el !== null ? el : 0;
                    }
                }
                cfg.setList(newPoints);
                saveAppState();
                setMyPointDirty(type, false);
                renderMyPointsList(type);
                updateMyPointMarkers();
                alert(`${newPoints.length}件の${cfg.labelFull}を登録しました`);
            } catch (err) {
                alert('CSVの読み込みに失敗しました: ' + err.message);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
}

/** 追加CSV入力 (既存リストに追加) */
function appendMyPointsCsv(type) {
    const cfg = myPointConfig(type);
    if (!confirm(`${cfg.labelFull}リストにCSVファイルから"追加"入力・登録しますか？`)) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const text = ev.target.result;
                const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
                if (lines.length < 2) return alert('CSVファイルにデータがありません');

                const existingList = cfg.list();
                const csvEntries = [];
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',');
                    if (cols.length < 6) { alert(`${i + 1}行目: 列数が不足しています(6列必要)`); return; }
                    const id = parseInt(toHalfWidth(cols[0].trim()));
                    const name = cols[1].trim();
                    const lat = parseFloat(toHalfWidth(cols[2].trim()));
                    const lng = parseFloat(toHalfWidth(cols[3].trim()));
                    let elev = cols[4].trim() === '' ? null : parseFloat(toHalfWidth(cols[4].trim()));
                    const height = parseFloat(toHalfWidth(cols[5].trim())) || 0;
                    const memo = (cols[6] !== undefined ? cols[6] : '').trim();
                    if (isNaN(id) || id < 1 || id > 1000) { alert(`${i + 1}行目: IDが無効です(1〜1000)`); return; }
                    if (isNaN(lat) || isNaN(lng)) { alert(`${i + 1}行目: 緯度/経度が無効です`); return; }
                    csvEntries.push({ id, name, lat, lng, elev, height, memo });
                }

                // CSV内のID重複チェック
                const csvIds = new Set();
                for (const entry of csvEntries) {
                    if (csvIds.has(entry.id)) { alert(`CSV内でID ${entry.id} が重複しています`); return; }
                    csvIds.add(entry.id);
                }

                let addedCount = 0;
                for (const entry of csvEntries) {
                    // 上限チェック
                    if (existingList.length >= 1000) { alert(`${cfg.labelFull}の登録上限(1000件)に達しています`); return; }

                    // 標高が未設定の場合は取得
                    if (entry.elev === null || isNaN(entry.elev)) {
                        const el = await getElevation(entry.lat, entry.lng);
                        entry.elev = el !== null ? el : 0;
                    }
                    
                    // 緯度/経度/標高/高さが全て同じ既存エントリがあればスキップ
                    const duplicate = existingList.some(p =>
                        p.lat === entry.lat && p.lng === entry.lng &&
                        p.elev === entry.elev && p.height === entry.height
                    );
                    if (duplicate) continue;

                    // ID重複チェック
                    if (existingList.some(p => p.id === entry.id)) {
                        const ok = confirm(`${cfg.label}(ID:${entry.id}、${entry.name})は、IDが重複しています。新規にIDを採番しますか？(OK→採番する、キャンセル→処理終了)`);
                        if (!ok) return;
                        entry.id = getNextMyPointId(type);
                        if (entry.id === null) { alert(`${cfg.labelFull}の登録上限(1000件)に達しています`); return; }
                    }

                    existingList.push(entry);
                    addedCount++;
                }

                saveAppState();
                setMyPointDirty(type, false);
                renderMyPointsList(type);
                updateMyPointMarkers();
                alert(`${addedCount}件の${cfg.labelFull}を追加しました`);
            } catch (err) {
                alert('CSVの読み込みに失敗しました: ' + err.message);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
}

/** CSV出力 */
function exportMyPointsCsv(type) {
    const cfg = myPointConfig(type);
    if (cfg.list().length === 0) return alert(`${cfg.labelFull}が登録されていません`);
    if (!confirm(`${cfg.labelFull}リストの登録内容をCSVファイルに出力しますか？`)) return;
    const bom = '\uFEFF';
    let csv = bom + `${cfg.label}ID,${cfg.label}名,緯度,経度,標高,高さ,メモ\r\n`;
    cfg.list().forEach(pt => {
        csv += `${pt.id},${pt.name},${pt.lat},${pt.lng},${pt.elev !== null ? pt.elev : ''},${pt.height},${pt.memo || ''}\r\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soranotsuji-${cfg.labelFull}-${formatFileDateTime()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

/** URL取得 */
function getMyPointUrl(type) {
    const cfg = myPointConfig(type);
    const id = getSelectedMyPointId(type);
    if (id === null) return alert(`${cfg.label}を選択してください`);
    const pt = cfg.list().find(p => p.id === id);
    if (!pt || pt.lat === null) return alert('緯度経度が設定されていません');
    const baseUrl = buildBaseUrl();
    const params = new URLSearchParams();
    params.set('mode', 'preview');
    if (cfg.locKey === 'start') {
        params.set('startLat', String(pt.lat));
        params.set('startLng', String(pt.lng));
        params.set('startApiElv', String(pt.elev || 0));
        params.set('startElv', String(pt.height || 0));
    } else {
        params.set('endLat', String(pt.lat));
        params.set('endLng', String(pt.lng));
        params.set('endApiElv', String(pt.elev || 0));
        params.set('endElv', String(pt.height || 0));
    }
    const url = `${baseUrl}?${params.toString()}`;
    navigator.clipboard.writeText(url).then(() => {
        alert(`${cfg.labelFull}リストの${cfg.label}（ID:${id}、${pt.name}）を開くURLをクリップボードにコピーしました。`);
    }).catch(() => {
        alert('クリップボードへのコピーに失敗しました');
    });
}

/** マーカー更新 (My観測点 + My目的点) */
function updateMyPointMarkers() {
    if (!myPointMarkerLayer) {
        myPointMarkerLayer = L.layerGroup().addTo(map);
    }
    myPointMarkerLayer.clearLayers();
    // My観測点マーカー (緑)
    appState.myObservations.forEach(pt => {
        if (pt.lat === null || pt.lat === undefined) return;
        const icon = L.divIcon({
            className: '',
            html: '<div class="location-marker location-marker-myobs"></div>',
            iconSize: [24, 24], iconAnchor: [12, 24], popupAnchor: [0, -24]
        });
        const marker = L.marker([pt.lat, pt.lng], { icon }).addTo(myPointMarkerLayer);
        marker.bindPopup(`
            <b>My観測点</b><br>
            ${escapeHtml(pt.name)}<br>
            ID: ${pt.id}<br>
            緯度: ${pt.lat}°<br>
            経度: ${pt.lng}°<br>
            標高: ${pt.elev !== null ? pt.elev : '--'} m<br>
            高さ: ${pt.height || 0} m
        `);
        marker.on('click', () => {
            appState.start = { lat: pt.lat, lng: pt.lng, elev: (pt.elev || 0) + (pt.height || 0) };
            appState.startApiElev = pt.elev || 0;
            appState.startHeight = pt.height || 0;
            saveAppState();
            updateAll();
        });
    });
    // My目的点マーカー (橙)
    appState.myTargets.forEach(pt => {
        if (pt.lat === null || pt.lat === undefined) return;
        const icon = L.divIcon({
            className: '',
            html: '<div class="location-marker location-marker-mytgt"></div>',
            iconSize: [24, 24], iconAnchor: [12, 24], popupAnchor: [0, -24]
        });
        const marker = L.marker([pt.lat, pt.lng], { icon }).addTo(myPointMarkerLayer);
        marker.bindPopup(`
            <b>My目的点</b><br>
            ${escapeHtml(pt.name)}<br>
            ID: ${pt.id}<br>
            緯度: ${pt.lat}°<br>
            経度: ${pt.lng}°<br>
            標高: ${pt.elev !== null ? pt.elev : '--'} m<br>
            高さ: ${pt.height || 0} m
        `);
        marker.on('click', () => {
            appState.end = { lat: pt.lat, lng: pt.lng, elev: (pt.elev || 0) + (pt.height || 0) };
            appState.endApiElev = pt.elev || 0;
            appState.endHeight = pt.height || 0;
            saveAppState();
            updateAll();
        });
    });
}

// ============================================================
// My辻検索 — 共通関数
// ============================================================

let myTsujiDirty = false;

/** dirty flag 更新 → 「全て登録」ボタンのスタイル変更 */
function setMyTsujiDirty(val) {
    myTsujiDirty = val;
    const btn = document.getElementById('btn-mytsuji-regall');
    if (btn) {
        if (val) { btn.classList.add('dirty'); }
        else { btn.classList.remove('dirty'); }
    }
}

/** 空きID番号の最小値を返す (1〜1000) */
function getNextMyTsujiId() {
    const usedIds = new Set(appState.myTsujiSearches.map(t => t.id));
    for (let i = 1; i <= 1000; i++) { if (!usedIds.has(i)) return i; }
    return null;
}

/** 選択中のID取得 */
function getSelectedMyTsujiId() {
    const radio = document.querySelector('input[name="mytsuji-select"]:checked');
    return radio ? parseInt(radio.value) : null;
}

/** オフセット方位距離・視高距離を再計算して返す */
function recalcMyTsujiOffsetDist(t) {
    const obs = appState.myObservations.find(o => o.id === t.obsId);
    const tgt = appState.myTargets.find(g => g.id === t.tgtId);
    if (!obs || !tgt || obs.lat == null || tgt.lat == null) return { azDist: 0, altDist: 0 };
    const dist = L.latLng(obs.lat, obs.lng).distanceTo(L.latLng(tgt.lat, tgt.lng));
    const azDist = dist * Math.tan((t.offsetAz || 0) * Math.PI / 180);
    const altDist = dist * Math.tan((t.offsetAlt || 0) * Math.PI / 180);
    return { azDist, altDist };
}

/** 行追加/削除/移動ボタンの活性状態を更新 */
function updateMyTsujiButtonStates() {
    const list = appState.myTsujiSearches;
    const addBtn = document.getElementById('btn-mytsuji-addrow');
    const delBtn = document.getElementById('btn-mytsuji-delrow');
    const upBtn = document.getElementById('btn-mytsuji-up');
    const dnBtn = document.getElementById('btn-mytsuji-down');
    if (addBtn) addBtn.disabled = list.length >= 1000;
    if (delBtn) delBtn.disabled = list.length === 0;
    if (upBtn) upBtn.disabled = list.length < 2;
    if (dnBtn) dnBtn.disabled = list.length < 2;
}

/** 位置情報メニューの観測点と一致するMy観測点IDを返す。なければ新規追加してそのIDを返す */
function findOrCreateMyObsFromCurrent() {
    const loc = appState.start;
    const apiElev = appState.startApiElev;
    const height = appState.startHeight;
    const match = appState.myObservations.find(o =>
        o.lat === loc.lat && o.lng === loc.lng &&
        o.elev === apiElev && o.height === height
    );
    if (match) return match.id;
    const newId = getNextMyPointId('obs');
    if (newId === null) { alert('My観測点の登録上限(1000件)に達しています'); return null; }
    appState.myObservations.push({
        id: newId, name: '新規観測点名',
        lat: loc.lat, lng: loc.lng,
        elev: apiElev, height: height, memo: ''
    });
    saveAppState();
    setMyPointDirty('obs', true);
    renderMyPointsList('obs');
    if (typeof updateMyPointMarkers === 'function') updateMyPointMarkers();
    return newId;
}

/** 位置情報メニューの目的点と一致するMy目的点IDを返す。なければ新規追加してそのIDを返す */
function findOrCreateMyTgtFromCurrent() {
    const loc = appState.end;
    const apiElev = appState.endApiElev;
    const height = appState.endHeight;
    const match = appState.myTargets.find(g =>
        g.lat === loc.lat && g.lng === loc.lng &&
        g.elev === apiElev && g.height === height
    );
    if (match) return match.id;
    const newId = getNextMyPointId('tgt');
    if (newId === null) { alert('My目的点の登録上限(1000件)に達しています'); return null; }
    appState.myTargets.push({
        id: newId, name: '新規目的点名',
        lat: loc.lat, lng: loc.lng,
        elev: apiElev, height: height, memo: ''
    });
    saveAppState();
    setMyPointDirty('tgt', true);
    renderMyPointsList('tgt');
    if (typeof updateMyPointMarkers === 'function') updateMyPointMarkers();
    return newId;
}

/** 行追加 (空の辻検索情報) */
function addMyTsujiRow() {
    if (appState.myTsujiSearches.length >= 1000) return alert('My辻検索の登録上限(1000件)に達しています');
    if (!confirm('My辻検索リストの末尾に辻検索の行を追加しますか？')) return;
    const id = getNextMyTsujiId();
    if (id === null) return;
    const selId = getSelectedMyTsujiId();
    const idx = selId !== null ? appState.myTsujiSearches.findIndex(t => t.id === selId) : -1;
    const newT = {
        id, name: '', days: 365, bodyIds: 'Sun:Moon',
        obsId: null, tgtId: null,
        baseAz: null, baseAlt: null,
        offsetAz: 0, offsetAlt: 0,
        toleranceAz: 15, toleranceAlt: 15,
        moonFilter: false, moonBase: 15, moonTolerance: 2,
        accuracyFilter: false, accDblCircle: false, accCircle: false, accTriangle: false, accDash: false,
        checked: false, memo: ''
    };
    if (idx >= 0) appState.myTsujiSearches.splice(idx + 1, 0, newT);
    else appState.myTsujiSearches.push(newT);
    saveAppState();
    setMyTsujiDirty(true);
    renderMyTsujiSearches();
    const radio = document.querySelector(`input[name="mytsuji-select"][value="${id}"]`);
    if (radio) radio.checked = true;
}

/** 行削除 */
function deleteMyTsujiRow() {
    const id = getSelectedMyTsujiId();
    if (id === null) return alert('削除するMy辻検索を選択してください');
    const t = appState.myTsujiSearches.find(x => x.id === id);
    if (!t) return;
    if (!confirm(`My辻検索リストの辻検索（ID:${id}、${t.name || ''}）を削除しますか？`)) return;
    appState.myTsujiSearches = appState.myTsujiSearches.filter(x => x.id !== id);
    saveAppState();
    setMyTsujiDirty(true);
    renderMyTsujiSearches();
}

/** 上に移動 */
function moveMyTsujiUp() {
    const id = getSelectedMyTsujiId();
    if (id === null) return;
    const list = appState.myTsujiSearches;
    const idx = list.findIndex(t => t.id === id);
    if (idx <= 0) return;
    [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
    saveAppState();
    setMyTsujiDirty(true);
    renderMyTsujiSearches();
    const radio = document.querySelector(`input[name="mytsuji-select"][value="${id}"]`);
    if (radio) radio.checked = true;
}

/** 下に移動 */
function moveMyTsujiDown() {
    const id = getSelectedMyTsujiId();
    if (id === null) return;
    const list = appState.myTsujiSearches;
    const idx = list.findIndex(t => t.id === id);
    if (idx < 0 || idx >= list.length - 1) return;
    [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
    saveAppState();
    setMyTsujiDirty(true);
    renderMyTsujiSearches();
    const radio = document.querySelector(`input[name="mytsuji-select"][value="${id}"]`);
    if (radio) radio.checked = true;
}

/** 辻検索取得: 現在の辻検索メニューの内容を1件のMy辻検索として追加 */
function getMyTsujiFromTsujiSearch() {
    if (appState.myTsujiSearches.length >= 1000) return alert('My辻検索の登録上限(1000件)に達しています');
    if (!confirm('現在の観測点/目的点の位置情報（緯度経度・標高・高さ）と、辻検索情報を、My辻検索リストに追加しますか？')) return;
    const id = getNextMyTsujiId();
    if (id === null) return;
    const obsId = findOrCreateMyObsFromCurrent();
    if (obsId === null) return;
    const tgtId = findOrCreateMyTgtFromCurrent();
    if (tgtId === null) return;
    appState.myTsujiSearches.push({
        id,
        name: '新規辻検索名',
        days: appState.tsujiSearchDays,
        bodyIds: appState.bodies.filter(b => b.visible).map(b => b.id).join(':'),
        obsId, tgtId,
        baseAz: appState.tsujiSearchBaseAz,
        baseAlt: appState.tsujiSearchBaseAlt,
        offsetAz: appState.tsujiSearchOffsetAz,
        offsetAlt: appState.tsujiSearchOffsetAlt,
        toleranceAz: appState.tsujiSearchToleranceAz,
        toleranceAlt: appState.tsujiSearchToleranceAlt,
        moonFilter: appState.tsujiMoonFilterEnabled,
        moonBase: appState.tsujiMoonBase,
        moonTolerance: appState.tsujiMoonTolerance,
        accuracyFilter: appState.tsujiAccuracyFilterEnabled,
        accDblCircle: appState.tsujiAccDblCircle,
        accCircle: appState.tsujiAccCircle,
        accTriangle: appState.tsujiAccTriangle,
        accDash: appState.tsujiAccDash,
        checked: false, memo: ''
    });
    saveAppState();
    setMyTsujiDirty(true);
    renderMyTsujiSearches();
    const radio = document.querySelector(`input[name="mytsuji-select"][value="${id}"]`);
    if (radio) radio.checked = true;
}

/** 全て登録: バリデーション + dirty flag クリア */
function registerAllMyTsuji() {
    const list = appState.myTsujiSearches;
    for (const t of list) {
        if (!t.name || t.days == null || !t.bodyIds ||
            t.obsId == null || t.tgtId == null ||
            t.baseAz == null || t.baseAlt == null) {
            document.getElementById('mytsuji-error').innerHTML =
                `<span class="mypoint-error-text">辻検索ID:${t.id}に未入力のものがあります。入力するか、行削除してください。</span>`;
            return;
        }
    }
    document.getElementById('mytsuji-error').innerHTML = '';
    if (!confirm('現在のMy辻検索リストをローカルストレージに登録しますか？')) return;
    list.forEach(t => {
        t.name = (t.name || '').replace(/,/g, '，');
        t.memo = (t.memo || '').replace(/,/g, '，');
    });
    saveAppState();
    setMyTsujiDirty(false);
    alert('My辻検索を登録しました');
}

/** 一括選択/一括解除トグル */
function toggleAllMyTsuji() {
    const btn = document.getElementById('btn-mytsuji-toggle-all');
    const isPressed = btn.classList.contains('mytsuji-toggle-active');
    const newState = !isPressed;
    if (newState) {
        btn.textContent = '一括解除';
        btn.classList.add('mytsuji-toggle-active');
    } else {
        btn.textContent = '一括選択';
        btn.classList.remove('mytsuji-toggle-active');
    }
    appState.myTsujiSearches.forEach(t => { t.checked = newState; });
    saveAppState();
    renderMyTsujiSearches();
}

/** 行エラー表示エリアにメッセージを設定 (空なら非表示) */
function renderMyTsujiRowError(row, messages) {
    const err = row.querySelector('.mytsuji-row-error');
    if (!err) return;
    if (!messages || messages.length === 0) {
        err.innerHTML = '';
    } else {
        err.innerHTML = `<span class="mypoint-error-text">${messages.join(' / ')}</span>`;
    }
}

/** 観測点ID/目的点IDの存在チェック。エラー配列を返す */
function validateMyTsujiRow(t, row) {
    const errors = [];
    if (t.obsId != null) {
        const obs = appState.myObservations.find(o => o.id === t.obsId);
        if (!obs) errors.push(`観測点ID:${t.obsId}はMy観測点リストに存在しません`);
    }
    if (t.tgtId != null) {
        const tgt = appState.myTargets.find(g => g.id === t.tgtId);
        if (!tgt) errors.push(`目的点ID:${t.tgtId}はMy目的点リストに存在しません`);
    }
    renderMyTsujiRowError(row, errors);
    return errors.length === 0;
}

/** 観測点ID/目的点IDから基準方位角/視高度を計算し、appState上の t を直接更新 (DOM非依存) */
function calcMyTsujiBaseValues(t) {
    if (t.obsId == null || t.tgtId == null) return false;
    const obs = appState.myObservations.find(o => o.id === t.obsId);
    const tgt = appState.myTargets.find(g => g.id === t.tgtId);
    if (!obs || !tgt || obs.lat == null || tgt.lat == null) return false;
    const obsElev = (obs.elev || 0) + (obs.height || 0);
    const tgtElev = (tgt.elev || 0) + (tgt.height || 0);
    const dist = L.latLng(obs.lat, obs.lng).distanceTo(L.latLng(tgt.lat, tgt.lng));
    const az = calculateBearing(obs.lat, obs.lng, tgt.lat, tgt.lng);
    const alt = calculateApparentAltitude(dist, obsElev, tgtElev);
    t.baseAz = az;
    t.baseAlt = alt;
    return true;
}

/** 観測点ID/目的点IDから基準方位角/視高度を自動計算して appState と行DOM に反映 */
function autoCalcMyTsujiBase(t, row) {
    if (!calcMyTsujiBaseValues(t)) return;
    const azInput = row.querySelector('.mytsuji-base-az');
    const altInput = row.querySelector('.mytsuji-base-alt');
    if (azInput) azInput.value = t.baseAz != null ? t.baseAz.toFixed(4) : '';
    if (altInput) altInput.value = t.baseAlt != null ? t.baseAlt.toFixed(4) : '';
}

// ============================================================
// My辻検索 — CSV入出力 (Phase B)
// ============================================================

/** CSV 1行分をMy辻検索オブジェクトにパース。エラー時はalert + null。 */
function parseMyTsujiCsvLine(cols, lineNum) {
    if (cols.length < 6) { alert(`${lineNum}行目: 列数が不足しています(最低6列必要)`); return null; }
    const id = parseInt(toHalfWidth(cols[0].trim()));
    if (isNaN(id) || id < 1 || id > 1000) { alert(`${lineNum}行目: 辻検索IDが無効です(1〜1000)`); return null; }
    const name = cols[1].trim();  // 全角保持
    if (!name) { alert(`${lineNum}行目: 辻検索名が空です`); return null; }
    const days = parseInt(toHalfWidth(cols[2].trim()));
    if (isNaN(days) || days < 1 || days > 36500) { alert(`${lineNum}行目: 検索期間が無効です(1〜36500)`); return null; }
    const bodyIds = toHalfWidth(cols[3].trim());
    if (!bodyIds) { alert(`${lineNum}行目: 天体IDが空です`); return null; }
    const obsId = parseInt(toHalfWidth(cols[4].trim()));
    if (isNaN(obsId) || obsId < 1 || obsId > 1000) { alert(`${lineNum}行目: 観測点IDが無効です(1〜1000)`); return null; }
    const tgtId = parseInt(toHalfWidth(cols[5].trim()));
    if (isNaN(tgtId) || tgtId < 1 || tgtId > 1000) { alert(`${lineNum}行目: 目的点IDが無効です(1〜1000)`); return null; }
    // 7-8列目: 基準方位角/視高度 (空なら null で後から再計算)
    const baseAzStr = (cols[6] ?? '').trim();
    const baseAltStr = (cols[7] ?? '').trim();
    const baseAz = baseAzStr === '' ? null : parseFloat(toHalfWidth(baseAzStr));
    const baseAlt = baseAltStr === '' ? null : parseFloat(toHalfWidth(baseAltStr));
    if (baseAz !== null && isNaN(baseAz)) { alert(`${lineNum}行目: 基準方位角が無効です`); return null; }
    if (baseAlt !== null && isNaN(baseAlt)) { alert(`${lineNum}行目: 基準視高度が無効です`); return null; }
    // 9-15列目: 省略可。省略時はデフォルト値
    const parseNumOr = (v, def) => {
        if (v == null || v.trim() === '') return def;
        const n = parseFloat(toHalfWidth(v.trim()));
        return isNaN(n) ? def : n;
    };
    const offsetAz = parseNumOr(cols[8], 0);
    const offsetAlt = parseNumOr(cols[9], 0);
    const toleranceAz = Math.min(Math.max(parseNumOr(cols[10], 15), 0), 360);
    const toleranceAlt = Math.min(Math.max(parseNumOr(cols[11], 15), 0), 360);
    // 13-15列目: 月齢フィルタ/基準月齢/許容範囲月齢 (省略時デフォルト)
    let moonFilter = false;
    if (cols[12] != null) {
        const v = toHalfWidth(cols[12].trim()).toUpperCase();
        moonFilter = (v === 'ON' || v === '1' || v === 'TRUE');
    }
    const moonBase = Math.min(Math.max(parseNumOr(cols[13], 15), 0), 30);
    const moonTolerance = Math.min(Math.max(parseNumOr(cols[14], 2), 0), 15);
    // 16-20列目: 精度フィルタ (省略時はfalse)
    const parseBoolOr = (v) => {
        if (v == null) return false;
        const s = toHalfWidth(v.trim()).toUpperCase();
        return (s === 'ON' || s === '1' || s === 'TRUE');
    };
    const accuracyFilter = parseBoolOr(cols[15]);
    const accDblCircle = parseBoolOr(cols[16]);
    const accCircle = parseBoolOr(cols[17]);
    const accTriangle = parseBoolOr(cols[18]);
    const accDash = parseBoolOr(cols[19]);
    // 21列目: メモ (省略時は空文字)
    const memo = (cols[20] ?? '').trim();
    return {
        id, name, days, bodyIds,
        obsId, tgtId,
        baseAz, baseAlt,
        offsetAz, offsetAlt,
        toleranceAz, toleranceAlt,
        moonFilter, moonBase, moonTolerance,
        accuracyFilter, accDblCircle, accCircle, accTriangle, accDash,
        checked: false, memo
    };
}

/** 全CSV入力 (リスト全置換) */
function importMyTsujiCsv() {
    if (!confirm('My辻検索リストにCSVファイルから全て上書き入力・登録しますか？')) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const text = ev.target.result;
                const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
                if (lines.length < 2) return alert('CSVファイルにデータがありません');
                if (lines.length > 1001) return alert('CSVの上限は1000件です(ヘッダー行を除く)');
                const newList = [];
                const usedIds = new Set();
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',');
                    const t = parseMyTsujiCsvLine(cols, i + 1);
                    if (!t) return;
                    if (usedIds.has(t.id)) { alert(`${i + 1}行目: 辻検索ID ${t.id} が重複しています`); return; }
                    usedIds.add(t.id);
                    // 基準方位角/視高度が空なら観測点ID/目的点IDから再計算
                    if (t.baseAz === null || t.baseAlt === null) {
                        calcMyTsujiBaseValues(t);
                    }
                    newList.push(t);
                }
                appState.myTsujiSearches = newList;
                saveAppState();
                setMyTsujiDirty(false);
                renderMyTsujiSearches();
                alert(`${newList.length}件のMy辻検索を登録しました`);
            } catch (err) {
                alert('CSVの読み込みに失敗しました: ' + err.message);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
}

/** 追加CSV入力 (既存リストに追加) */
function appendMyTsujiCsv() {
    if (!confirm('My辻検索リストにCSVファイルから"追加"入力・登録しますか？')) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const text = ev.target.result;
                const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
                if (lines.length < 2) return alert('CSVファイルにデータがありません');

                // 全行パース
                const csvEntries = [];
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(',');
                    const t = parseMyTsujiCsvLine(cols, i + 1);
                    if (!t) return;
                    csvEntries.push(t);
                }
                // CSV内ID重複チェック
                const csvIds = new Set();
                for (const entry of csvEntries) {
                    if (csvIds.has(entry.id)) { alert(`CSV内で辻検索ID ${entry.id} が重複しています`); return; }
                    csvIds.add(entry.id);
                }

                const existingList = appState.myTsujiSearches;
                let addedCount = 0;

                // 重複判定(辻検索IDと辻検索名以外が全て一致)
                const isContentDup = (a, b) =>
                    a.days === b.days && a.bodyIds === b.bodyIds &&
                    a.obsId === b.obsId && a.tgtId === b.tgtId &&
                    a.baseAz === b.baseAz && a.baseAlt === b.baseAlt &&
                    a.offsetAz === b.offsetAz && a.offsetAlt === b.offsetAlt &&
                    a.toleranceAz === b.toleranceAz && a.toleranceAlt === b.toleranceAlt &&
                    a.moonFilter === b.moonFilter &&
                    a.moonBase === b.moonBase && a.moonTolerance === b.moonTolerance;

                for (const entry of csvEntries) {
                    if (existingList.length >= 1000) { alert('My辻検索の登録上限(1000件)に達しています'); break; }
                    // 基準方位角/視高度が空なら再計算
                    if (entry.baseAz === null || entry.baseAlt === null) {
                        calcMyTsujiBaseValues(entry);
                    }
                    // 内容重複ならスキップ
                    if (existingList.some(x => isContentDup(x, entry))) continue;
                    // ID重複: 採番するか確認
                    if (existingList.some(x => x.id === entry.id)) {
                        const ok = confirm(`辻検索(ID:${entry.id}、${entry.name})は、IDが重複しています。新規にIDを採番しますか？(OK→採番する、キャンセル→処理終了)`);
                        if (!ok) break;
                        const newId = getNextMyTsujiId();
                        if (newId === null) { alert('My辻検索の登録上限(1000件)に達しています'); break; }
                        entry.id = newId;
                    }
                    existingList.push(entry);
                    addedCount++;
                }

                saveAppState();
                setMyTsujiDirty(false);
                renderMyTsujiSearches();
                alert(`${addedCount}件のMy辻検索を追加しました`);
            } catch (err) {
                alert('CSVの読み込みに失敗しました: ' + err.message);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
}

/** CSV出力 */
function exportMyTsujiCsv() {
    if (appState.myTsujiSearches.length === 0) return alert('My辻検索が登録されていません');
    if (!confirm('My辻検索リストの登録内容をCSVファイルに出力しますか？')) return;
    const bom = '\uFEFF';
    let csv = bom + '辻検索ID,辻検索名,検索期間,天体ID,観測点ID,目的点ID,基準方位角,基準視高度,オフセット方位角,オフセット視高度,許容範囲方位角,許容範囲視高度,月齢フィルタ,基準月齢,許容範囲月齢,精度フィルタ,精度◎フィルタ,精度○フィルタ,精度△フィルタ,精度-フィルタ,メモ\r\n';
    appState.myTsujiSearches.forEach(t => {
        csv += [
            t.id,
            t.name ?? '',
            t.days ?? '',
            t.bodyIds ?? '',
            t.obsId ?? '',
            t.tgtId ?? '',
            t.baseAz ?? '',
            t.baseAlt ?? '',
            t.offsetAz ?? 0,
            t.offsetAlt ?? 0,
            t.toleranceAz ?? 15,
            t.toleranceAlt ?? 15,
            t.moonFilter ? 'ON' : 'OFF',
            t.moonBase ?? 15,
            t.moonTolerance ?? 2,
            t.accuracyFilter ? 'ON' : 'OFF',
            t.accDblCircle ? 'ON' : 'OFF',
            t.accCircle ? 'ON' : 'OFF',
            t.accTriangle ? 'ON' : 'OFF',
            t.accDash ? 'ON' : 'OFF',
            t.memo ?? ''
        ].join(',') + '\r\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soranotsuji-My辻検索-${formatFileDateTime()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================
// My辻検索 — URL取得 (Phase C-1)
// ============================================================

/** URL取得: ポップアップで3種類のURLを選択 */
function getMyTsujiUrl() {
    const id = getSelectedMyTsujiId();
    if (id === null) return alert('URL取得するMy辻検索を選択してください');
    const t = appState.myTsujiSearches.find(x => x.id === id);
    if (!t) return;
    const obs = appState.myObservations.find(o => o.id === t.obsId);
    const tgt = appState.myTargets.find(g => g.id === t.tgtId);
    if (!obs || !tgt) return alert('観測点または目的点がMy観測点/My目的点リストに存在しません');
    toggleUrlPanel('mytsuji');
}

/** My辻検索のURLをビルドしてクリップボードにコピー */
function copyMyTsujiSearchUrl(includeDateTime) {
    const id = getSelectedMyTsujiId();
    if (id === null) return;
    const t = appState.myTsujiSearches.find(x => x.id === id);
    if (!t) return;
    const obs = appState.myObservations.find(o => o.id === t.obsId);
    const tgt = appState.myTargets.find(g => g.id === t.tgtId);
    if (!obs || !tgt) return;

    const d = appState.currentDate;
    const params = new URLSearchParams();
    if (includeDateTime === 'fixed') {
        params.set('date', formatDateForUrl(d));
        params.set('time', formatTimeForUrl(d));
        params.set('timeZone', getLocalTimezoneOffsetString());
    } else if (includeDateTime === 'semi-fixed') {
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        params.set('date', `0000${mm}${dd}`);
        params.set('time', formatTimeForUrl(d));
        params.set('timeZone', getLocalTimezoneOffsetString());
    }
    params.set('startLat', String(obs.lat));
    params.set('startLng', String(obs.lng));
    params.set('startApiElv', String(obs.elev ?? 0));
    params.set('startElv', String(obs.height ?? 0));
    params.set('endLat', String(tgt.lat));
    params.set('endLng', String(tgt.lng));
    params.set('endApiElv', String(tgt.elev ?? 0));
    params.set('endElv', String(tgt.height ?? 0));
    (t.bodyIds || '').split(':').forEach(bid => {
        const v = bid.trim();
        if (v) params.append('starId', v);
    });
    params.set('tsujiSearchDays', String(t.days ?? 365));
    if (t.baseAz != null) params.set('tsujiAz', String(t.baseAz));
    if (t.baseAlt != null) params.set('tsujiAlt', String(t.baseAlt));
    params.set('tsujiAzOffset', String(t.offsetAz ?? 0));
    params.set('tsujiAltOffset', String(t.offsetAlt ?? 0));
    params.set('tsujiAzTolerance', String(t.toleranceAz ?? 15));
    params.set('tsujiAltTolerance', String(t.toleranceAlt ?? 15));
    params.set('tsujiMoonFilter', t.moonFilter ? 'true' : 'false');
    params.set('tsujiMoonBase', String(t.moonBase ?? 15));
    params.set('tsujiMoonTolerance', String(t.moonTolerance ?? 2));
    params.set('tsujiAccuracyFilter', t.accuracyFilter ? 'true' : 'false');
    params.set('tsujiAccDblCircle', t.accDblCircle ? 'true' : 'false');
    params.set('tsujiAccCircle', t.accCircle ? 'true' : 'false');
    params.set('tsujiAccTriangle', t.accTriangle ? 'true' : 'false');
    params.set('tsujiAccDash', t.accDash ? 'true' : 'false');
    params.set('mode', 'tsujisearch');

    const url = buildBaseUrl() + '?' + params.toString();
    navigator.clipboard.writeText(url).then(() => {
        alert(`My辻検索リストの辻検索（ID:${t.id}、${t.name || ''}）を開くURLをクリップボードにコピーしました。`);
    }).catch(err => {
        console.error('clipboard error:', err);
        prompt('URLをコピーしてください:', url);
    });
}

// ============================================================
// My辻検索 — 一括計算 (Phase C-2)
// ============================================================

/** 単一のMy辻検索行を実行し、body単位の結果配列を返す */
async function executeSingleMyTsujiSearch(t, searchStartMsOverride, snapshotObs, snapshotTgt) {
    const obsSource = snapshotObs || appState.myObservations;
    const tgtSource = snapshotTgt || appState.myTargets;
    const obs = obsSource.find(o => o.id === t.obsId);
    const tgt = tgtSource.find(g => g.id === t.tgtId);
    if (!obs || !tgt) return null;

    const observerData = {
        lat: obs.lat,
        lng: obs.lng,
        elev: (obs.elev || 0) + (obs.height || 0)
    };
    const refractionEnabled = appState.refractionEnabled;
    let searchStartMs;
    if (searchStartMsOverride != null) {
        searchStartMs = searchStartMsOverride;
    } else {
        const searchStart = new Date(appState.currentDate);
        searchStart.setHours(0, 0, 0, 0);
        searchStartMs = searchStart.getTime();
    }
    const MAX_RESULTS_PER_BODY = 36500;

    const targetAz = ((t.baseAz || 0) + (t.offsetAz || 0) + 360) % 360;
    const targetAlt = (t.baseAlt || 0) + (t.offsetAlt || 0);
    const toleranceAz = t.toleranceAz || 15;
    const toleranceAlt = t.toleranceAlt || 15;

    const bodyIds = (t.bodyIds || '').split(':').map(s => s.trim()).filter(Boolean);
    const bodies = bodyIds.map(bid => appState.bodies.find(b => b.id === bid)).filter(Boolean);
    if (bodies.length === 0) return { tsuji: t, obs, tgt, bodyResults: [] };

    const bodyResults = [];
    for (const body of bodies) {
        let bodyMsg;
        if (isFixedStar(body.id)) {
            const rd = getFixedStarRaDec(body.id);
            bodyMsg = { id: body.id, fixed: true, ra: rd.ra, dec: rd.dec };
        } else {
            bodyMsg = { id: body.id, fixed: false };
        }

        const chunkSize = Math.ceil(t.days / TSUJI_NUM_WORKERS);
        const chunkPromises = [];
        const chunkWorkers = [];
        for (let w = 0; w < TSUJI_NUM_WORKERS; w++) {
            const dayStart = w * chunkSize;
            if (dayStart >= t.days) break;
            const dayEnd = Math.min(dayStart + chunkSize, t.days);
            const worker = new Worker('tsuji-search-worker.js');
            chunkWorkers.push(worker);
            tsujiActiveWorkers.push(worker);
            const p = new Promise((resolve) => {
                worker.onmessage = (e) => {
                    if (e.data && e.data.error) resolve({ results: [], dayStart, dayEnd });
                    else resolve(e.data);
                };
                worker.onerror = () => resolve({ results: [], dayStart, dayEnd });
                worker.postMessage({
                    body: bodyMsg, observerData, refractionEnabled,
                    targetAz, targetAlt, toleranceAz, toleranceAlt,
                    searchStartMs, dayStart, dayEnd,
                    maxResults: MAX_RESULTS_PER_BODY
                });
            });
            chunkPromises.push(p);
        }
        const chunkResults = await Promise.all(chunkPromises);
        chunkWorkers.forEach(w => { try { w.terminate(); } catch(_) {} });
        tsujiActiveWorkers = tsujiActiveWorkers.filter(w => !chunkWorkers.includes(w));

        chunkResults.sort((a, b) => a.dayStart - b.dayStart);
        const flatResults = [];
        let limitReached = false;
        for (const ch of chunkResults) {
            for (const r of ch.results) {
                flatResults.push({
                    time: new Date(r.timeMs),
                    azimuth: r.azimuth,
                    altitude: r.altitude,
                    dist: r.dist
                });
                if (flatResults.length >= MAX_RESULTS_PER_BODY) { limitReached = true; break; }
            }
            if (limitReached) break;
        }
        bodyResults.push({ body, results: flatResults, limitReached });
    }
    return { tsuji: t, obs, tgt, bodyResults };
}

/** 結果オブジェクトの配列に装飾情報(symbol/moonAge/moonIcon/dateStr/timeStr)を付加。
 *  月齢フィルタで除外される行は null として filter */
function decorateMyTsujiResults(results) {
    const moonIcons = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
    return results.map(r => {
        const phase = Astronomy.MoonPhase(r.time);
        const moonAge = (phase / 360) * SYNODIC_MONTH;
        const moonIcon = moonIcons[Math.round(phase / 45) % 8];
        let symbol;
        if (r.dist <= 0.125) symbol = '◎';
        else if (r.dist <= 0.25) symbol = '○';
        else if (r.dist <= 1.0) symbol = '△';
        else symbol = '-';
        if (r.tsuji.moonFilter && !isMoonAgeInRange(moonAge, r.tsuji.moonBase ?? 15, r.tsuji.moonTolerance ?? 2)) return null;
        if (r.tsuji.accuracyFilter) {
            const allowed = [];
            if (r.tsuji.accDblCircle) allowed.push('◎');
            if (r.tsuji.accCircle) allowed.push('○');
            if (r.tsuji.accTriangle) allowed.push('△');
            if (r.tsuji.accDash) allowed.push('-');
            if (allowed.length > 0 && !allowed.includes(symbol)) return null;
        }
        const dt = r.time;
        const dow = ['日','月','火','水','木','金','土'][dt.getDay()];
        const dateStr = `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')}(${dow})`;
        const timeStr = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}:${String(dt.getSeconds()).padStart(2,'0')}`;
        const observer = new Astronomy.Observer(r.obs.lat, r.obs.lng, (r.obs.elev || 0) + (r.obs.height || 0));
        const angularRadius = getBodyAngularRadius(r.body.id, dt, observer);
        return { ...r, symbol, dateStr, timeStr, moonAge, moonIcon, angularRadius };
    }).filter(Boolean);
}

/** 一括計算 — チェック済みMy辻検索を全て実行し、結果を専用パネルに表示 */
async function runBatchMyTsujiSearch() {
    const checked = appState.myTsujiSearches.filter(t => t.checked);
    if (checked.length === 0) return alert('一括計算するMy辻検索をチェックしてください');
    if (!confirm('チェックされた辻検索を実行しますか？')) return;

    showTsujiPanelForMyTsuji('My辻検索結果');
    const content = document.getElementById('tsujisearch-content');
    const statusEl = document.getElementById('tsujisearch-status');
    content.innerHTML = '';

    tsujiActiveWorkers.forEach(w => { try { w.terminate(); } catch(_) {} });
    tsujiActiveWorkers = [];

    // 計算開始時の日時・観測点・目的点を固定 (計算中にユーザーが変更しても影響しない)
    const batchStartDate = new Date(appState.currentDate);
    batchStartDate.setHours(0, 0, 0, 0);
    const batchStartMs = batchStartDate.getTime();
    const snapshotObs = JSON.parse(JSON.stringify(appState.myObservations));
    const snapshotTgt = JSON.parse(JSON.stringify(appState.myTargets));

    const allResults = [];
    for (let i = 0; i < checked.length; i++) {
        const t = checked[i];
        statusEl.textContent = `⏳ 実行中... ${i+1}/${checked.length} (ID:${t.id} ${t.name || ''})`;
        const res = await executeSingleMyTsujiSearch(t, batchStartMs, snapshotObs, snapshotTgt);
        if (!res) continue;
        for (const br of res.bodyResults) {
            for (const r of br.results) {
                allResults.push({
                    tsuji: t, obs: res.obs, tgt: res.tgt,
                    body: br.body,
                    time: r.time, azimuth: r.azimuth, altitude: r.altitude, dist: r.dist
                });
            }
        }
    }

    const decorated = decorateMyTsujiResults(allResults);
    statusEl.textContent = `${decorated.length}件`;
    if (decorated.length === 0) {
        content.innerHTML = '<div style="padding:8px;color:#999;">該当する日時はありません</div>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'td-table';
    table.innerHTML = `<thead><tr>
        <th>辻検索ID</th><th>辻検索名</th>
        <th>天体ID</th><th>天体名</th>
        <th>観測点ID</th><th>観測点名</th>
        <th>目的点ID</th><th>目的点名</th>
        <th>精度記号</th><th>精度角距離</th>
        <th>日付</th><th>辻時刻</th>
        <th>月齢</th><th>月齢アイコン</th>
        <th>方位角</th><th>視高度</th><th>視半径</th>
    </tr></thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');

    const renderMyTsujiResultRow = (r) => {
        const tr = document.createElement('tr');
        tr.className = 'td-data-row';
        tr.style.color = r.body.color;
        const angRDisplay = BODY_RADIUS_KM[r.body.id] ? r.angularRadius.toFixed(3) + '°' : '-.---°';
        tr.innerHTML = `
            <td>${r.tsuji.id}</td>
            <td>${escapeHtml(r.tsuji.name || '')}</td>
            <td>${escapeHtml(r.body.id)}</td>
            <td>${escapeHtml(r.body.name || '')}</td>
            <td>${r.obs.id ?? ''}</td>
            <td>${escapeHtml(r.obs.name || '')}</td>
            <td>${r.tgt.id ?? ''}</td>
            <td>${escapeHtml(r.tgt.name || '')}</td>
            <td>${r.symbol}</td>
            <td>${r.dist.toFixed(5)}°</td>
            <td>${r.dateStr}</td>
            <td>${r.timeStr}</td>
            <td>${r.moonAge.toFixed(1)}</td>
            <td>${r.moonIcon}</td>
            <td>${r.azimuth.toFixed(4)}°</td>
            <td>${r.altitude.toFixed(4)}°</td>
            <td>${angRDisplay}</td>`;
        tr.addEventListener('click', () => {
            appState.startApiElev = r.obs.elev || 0;
            appState.startHeight = r.obs.height || 0;
            appState.start = { lat: r.obs.lat, lng: r.obs.lng, elev: appState.startApiElev + appState.startHeight };
            appState.endApiElev = r.tgt.elev || 0;
            appState.endHeight = r.tgt.height || 0;
            appState.end = { lat: r.tgt.lat, lng: r.tgt.lng, elev: appState.endApiElev + appState.endHeight };
            appState.currentDate = new Date(r.time);
            syncUIFromState();
            updateAll();
        });
        return tr;
    };

    decorated.forEach(r => tbody.appendChild(renderMyTsujiResultRow(r)));
    content.appendChild(table);

    const symbolRank = { '◎': 0, '○': 1, '△': 2, '-': 3 };
    setupTableSort(table, decorated, [
        { label: '辻検索ID', compare: (a, b) => a.tsuji.id - b.tsuji.id },
        { label: '辻検索名', compare: (a, b) => (a.tsuji.name || '').localeCompare(b.tsuji.name || '') },
        { label: '天体ID', compare: (a, b) => a.body.id.localeCompare(b.body.id) },
        { label: '天体名', compare: (a, b) => (a.body.name || '').localeCompare(b.body.name || '') },
        { label: '観測点ID', compare: (a, b) => (a.obs.id ?? 0) - (b.obs.id ?? 0) },
        { label: '観測点名', compare: (a, b) => (a.obs.name || '').localeCompare(b.obs.name || '') },
        { label: '目的点ID', compare: (a, b) => (a.tgt.id ?? 0) - (b.tgt.id ?? 0) },
        { label: '目的点名', compare: (a, b) => (a.tgt.name || '').localeCompare(b.tgt.name || '') },
        { label: '精度記号', compare: (a, b) => (symbolRank[a.symbol] ?? 9) - (symbolRank[b.symbol] ?? 9) },
        { label: '精度角距離', compare: (a, b) => a.dist - b.dist },
        { label: '日付', compare: (a, b) => a.time - b.time },
        { label: '辻時刻', compare: (a, b) => a.timeStr.localeCompare(b.timeStr) },
        { label: '月齢', compare: (a, b) => a.moonAge - b.moonAge },
        { label: '月齢アイコン', compare: (a, b) => a.moonIcon.localeCompare(b.moonIcon) },
        { label: '方位角', compare: (a, b) => a.azimuth - b.azimuth },
        { label: '視高度', compare: (a, b) => a.altitude - b.altitude },
        { label: '視半径', compare: (a, b) => a.angularRadius - b.angularRadius },
    ], renderMyTsujiResultRow);
}

// ============================================================
// My辻検索 — File取得 (Phase C-3)
// ============================================================

/** Date を HH:mm:ss 形式にフォーマット (null時は '--:--:--') */
function fmtHms(d) {
    if (!d) return '--:--:--';
    const x = d instanceof Date ? d : (d.date || d);
    return `${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}:${String(x.getSeconds()).padStart(2,'0')}`;
}

/** decorated 結果1件分をCSV行の配列へ変換 */
function buildMyTsujiCsvRow(r) {
    const dt = r.time;
    const startOfDay = new Date(dt);
    startOfDay.setHours(0, 0, 0, 0);
    const observer = new Astronomy.Observer(r.obs.lat, r.obs.lng, (r.obs.elev || 0) + (r.obs.height || 0));

    let sr, ss, mr, ms;
    try {
        sr = Astronomy.SearchRiseSet('Sun', observer, +1, startOfDay, 1);
        ss = Astronomy.SearchRiseSet('Sun', observer, -1, startOfDay, 1);
        mr = Astronomy.SearchRiseSet('Moon', observer, +1, startOfDay, 2);
        ms = Astronomy.SearchRiseSet('Moon', observer, -1, startOfDay, 2);
    } catch (_) {}

    let astroDawn, nautDawn, yoake, civilDawn, civilDusk, higure, nautDusk, astroDusk;
    try {
        astroDawn = Astronomy.SearchAltitude('Sun', observer, +1, startOfDay, 1, -18);
        nautDawn  = Astronomy.SearchAltitude('Sun', observer, +1, startOfDay, 1, -12);
        yoake     = Astronomy.SearchAltitude('Sun', observer, +1, startOfDay, 1, -7.361111);
        civilDawn = Astronomy.SearchAltitude('Sun', observer, +1, startOfDay, 1, -6);
        civilDusk = Astronomy.SearchAltitude('Sun', observer, -1, startOfDay, 1, -6);
        higure    = Astronomy.SearchAltitude('Sun', observer, -1, startOfDay, 1, -7.361111);
        nautDusk  = Astronomy.SearchAltitude('Sun', observer, -1, startOfDay, 1, -12);
        astroDusk = Astronomy.SearchAltitude('Sun', observer, -1, startOfDay, 1, -18);
    } catch (_) {}

    let raStr = '', decStr = '';
    try {
        const eq = Astronomy.Equator(r.body.id, dt, observer, true, true);
        raStr = eq.ra.toFixed(6) + 'h';
        decStr = eq.dec.toFixed(6) + '°';
    } catch (_) {}

    const angR = getBodyAngularRadius(r.body.id, dt, observer);
    const angRStr = BODY_RADIUS_KM[r.body.id] ? angR.toFixed(3) + '°' : '';

    // プレビューURL (mode=preview)
    const urlParams = new URLSearchParams();
    urlParams.set('date', formatDateForUrl(dt));
    urlParams.set('time', formatTimeForUrl(dt));
    urlParams.set('timeZone', getLocalTimezoneOffsetString());
    urlParams.set('startLat', String(r.obs.lat));
    urlParams.set('startLng', String(r.obs.lng));
    urlParams.set('startApiElv', String(r.obs.elev ?? 0));
    urlParams.set('startElv', String(r.obs.height ?? 0));
    urlParams.set('endLat', String(r.tgt.lat));
    urlParams.set('endLng', String(r.tgt.lng));
    urlParams.set('endApiElv', String(r.tgt.elev ?? 0));
    urlParams.set('endElv', String(r.tgt.height ?? 0));
    urlParams.append('starId', r.body.id);
    urlParams.set('mode', 'preview');
    const previewUrl = buildBaseUrl() + '?' + urlParams.toString();

    const dowStr = `${dt.getFullYear()}年${String(dt.getMonth()+1).padStart(2,'0')}月${String(dt.getDate()).padStart(2,'0')}日(${['日','月','火','水','木','金','土'][dt.getDay()]})`;

    return [
        r.tsuji.id,
        r.tsuji.name ?? '',
        dowStr,
        fmtHms(sr), fmtHms(ss), fmtHms(mr), fmtHms(ms),
        r.moonAge.toFixed(1),
        r.moonIcon,
        fmtHms(astroDawn), fmtHms(nautDawn), fmtHms(yoake), fmtHms(civilDawn),
        fmtHms(sr), fmtHms(ss),
        fmtHms(civilDusk), fmtHms(higure), fmtHms(nautDusk), fmtHms(astroDusk),
        r.body.id, r.body.name ?? '',
        decStr, raStr,
        r.obs.id, r.obs.name ?? '',
        (r.obs.lat ?? 0).toFixed(6) + '°',
        (r.obs.lng ?? 0).toFixed(6) + '°',
        (r.obs.elev ?? 0).toFixed(1) + 'm',
        (r.obs.height ?? 0).toFixed(1) + 'm',
        r.tgt.id, r.tgt.name ?? '',
        (r.tgt.lat ?? 0).toFixed(6) + '°',
        (r.tgt.lng ?? 0).toFixed(6) + '°',
        (r.tgt.elev ?? 0).toFixed(1) + 'm',
        (r.tgt.height ?? 0).toFixed(1) + 'm',
        r.symbol,
        r.dist.toFixed(5) + '°',
        fmtHms(dt),
        r.azimuth.toFixed(4) + '°',
        r.altitude.toFixed(4) + '°',
        angRStr,
        r.tsuji.memo ?? '',
        previewUrl
    ];
}

/** File取得 — チェック済みMy辻検索を実行し、結果をCSVダウンロード */
async function fileBatchMyTsujiSearch() {
    const checked = appState.myTsujiSearches.filter(t => t.checked);
    if (checked.length === 0) return alert('File取得するMy辻検索をチェックしてください');
    if (!confirm('チェックされた辻検索を実行し、結果をCSVでFile取得しますか？')) return;

    showTsujiPanelForMyTsuji('My辻検索結果 (File出力)');
    const statusEl = document.getElementById('tsujisearch-status');
    document.getElementById('tsujisearch-content').innerHTML = '';

    tsujiActiveWorkers.forEach(w => { try { w.terminate(); } catch(_) {} });
    tsujiActiveWorkers = [];

    // 計算開始時の日時・観測点・目的点を固定 (計算中にユーザーが変更しても影響しない)
    const batchStartDate = new Date(appState.currentDate);
    batchStartDate.setHours(0, 0, 0, 0);
    const batchStartMs = batchStartDate.getTime();
    const snapshotObs = JSON.parse(JSON.stringify(appState.myObservations));
    const snapshotTgt = JSON.parse(JSON.stringify(appState.myTargets));

    const allResults = [];
    for (let i = 0; i < checked.length; i++) {
        const t = checked[i];
        statusEl.textContent = `⏳ File出力処理中... ${i+1}/${checked.length} (ID:${t.id} ${t.name || ''})`;
        const res = await executeSingleMyTsujiSearch(t, batchStartMs, snapshotObs, snapshotTgt);
        if (!res) continue;
        for (const br of res.bodyResults) {
            for (const r of br.results) {
                allResults.push({
                    tsuji: t, obs: res.obs, tgt: res.tgt,
                    body: br.body,
                    time: r.time, azimuth: r.azimuth, altitude: r.altitude, dist: r.dist
                });
            }
        }
    }

    const decorated = decorateMyTsujiResults(allResults);
    if (decorated.length === 0) {
        statusEl.textContent = '0件';
        return alert('該当する日時はありません');
    }

    statusEl.textContent = `${decorated.length}件 (CSV生成中…)`;

    const header = [
        '辻検索ID','辻検索名','日付','日の出時刻','日の入時刻','月の出時刻','月の入時刻',
        '月齢','月齢アイコン',
        '天文薄明[始]時刻','航海薄明[始]時刻','夜明時刻','常用薄明[始]時刻',
        '日の出時刻','日の入時刻',
        '常用薄明[終]時刻','日暮時刻','航海薄明[終]時刻','天文薄明[終]時刻',
        '天体ID','天体名','天体赤緯','天体赤経',
        '観測点ID','観測点名','観測点緯度','観測点経度','観測点標高','観測点高',
        '目的点ID','目的点名','目的点緯度','目的点経度','目的点標高','目的点高',
        '精度記号','精度角距離',
        '辻時刻','方位角','視高度','視半径',
        'メモ','プレビューURL'
    ];
    const esc = v => {
        const s = String(v ?? '');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
        return s;
    };
    const bom = '\uFEFF';
    let csv = bom + header.map(esc).join(',') + '\r\n';
    decorated.forEach(r => {
        csv += buildMyTsujiCsvRow(r).map(esc).join(',') + '\r\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soranotsuji-My辻検索結果-${formatFileDateTime()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    statusEl.textContent = `${decorated.length}件 (CSV出力完了)`;
}

/** リスト描画 (Phase A-3: イベントハンドラ追加) */
function renderMyTsujiSearches() {
    const container = document.getElementById('mytsuji-list');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);
    const list = appState.myTsujiSearches;
    if (list.length === 0) {
        container.innerHTML = `<div class="mystars-empty">My辻検索は登録されていません</div>`;
        return;
    }
    list.forEach((t, idx) => {
        const row = document.createElement('div');
        row.className = 'mypoint-row';
        const moonDisabled = t.moonFilter ? '' : 'disabled';
        row.innerHTML = `
            <hr class="tsujisearch-separator">
            <div class="mypoint-row-header">
                <input type="radio" name="mytsuji-select" value="${t.id}" class="mystars-radio" ${idx === 0 ? 'checked' : ''}>
                <input type="checkbox" class="body-checkbox mytsuji-check" data-id="${t.id}" ${t.checked ? 'checked' : ''}>
                <span class="mypoint-id">ID:${String(t.id).padStart(4, ' ')}</span>
            </div>
            <div class="control-row">
                <input type="text" class="mytsuji-name" value="${escapeHtml(t.name || '')}" placeholder="辻検索名" maxlength="150" data-id="${t.id}" autocomplete="off">
            </div>
            <div class="control-row">
                <label class="mytsuji-label">検索期間(日):</label>
                <input type="number" class="mytsuji-days" value="${t.days !== undefined ? t.days : ''}" placeholder="検索期間(日:最大36500)" step="1" min="1" max="36500" data-id="${t.id}">
            </div>
            <div class="control-row">
                <label class="mytsuji-label">天体ID:</label>
                <input type="text" class="mytsuji-bodyids" value="${escapeHtml(t.bodyIds || '')}" placeholder="天体ID:天体ID:..." maxlength="150" data-id="${t.id}">
            </div>
            <div class="control-row">
                <label class="mytsuji-label">観測点ID:</label>
                <input type="number" class="mytsuji-obsid" value="${t.obsId !== undefined && t.obsId !== null ? t.obsId : ''}" placeholder="観測点ID(数字)" step="1" min="1" max="1000" data-id="${t.id}">
                <label class="mytsuji-label">目的点ID:</label>
                <input type="number" class="mytsuji-tgtid" value="${t.tgtId !== undefined && t.tgtId !== null ? t.tgtId : ''}" placeholder="目的点ID(数字)" step="1" min="1" max="1000" data-id="${t.id}">
            </div>
            <div class="mytsuji-row-error"></div>
            <div class="control-row">
                <label class="mytsuji-label">基準方位角(°):</label>
                <input type="number" class="mytsuji-base-az" value="${t.baseAz !== undefined && t.baseAz !== null ? t.baseAz.toFixed(4) : ''}" placeholder="基準方位角(°)" step="0.0001" min="0" max="360" data-id="${t.id}">
                <label class="mytsuji-label">基準視高度(°):</label>
                <input type="number" class="mytsuji-base-alt" value="${t.baseAlt !== undefined && t.baseAlt !== null ? t.baseAlt.toFixed(4) : ''}" placeholder="基準視高度(°)" step="0.0001" min="-360" max="360" data-id="${t.id}">
            </div>
            <div class="control-row">
                <label class="mytsuji-label">オフセット方位角(°):</label>
                <input type="number" class="mytsuji-offset-az" value="${t.offsetAz !== undefined && t.offsetAz !== null ? t.offsetAz : 0}" placeholder="オフセット方位角(°)" step="0.0001" min="-360" max="360" data-id="${t.id}">
                <label class="mytsuji-label">オフセット視高度(°):</label>
                <input type="number" class="mytsuji-offset-alt" value="${t.offsetAlt !== undefined && t.offsetAlt !== null ? t.offsetAlt : 0}" placeholder="オフセット視高度(°)" step="0.0001" min="-360" max="360" data-id="${t.id}">
            </div>
            <div class="control-row">
                <label class="mytsuji-label">オフセット方位距離(m):</label>
                <input type="number" class="mytsuji-offset-az-dist elev-readonly" value="0" readonly step="0.1" data-id="${t.id}">
                <label class="mytsuji-label">オフセット視高距離(m):</label>
                <input type="number" class="mytsuji-offset-alt-dist elev-readonly" value="0" readonly step="0.1" data-id="${t.id}">
            </div>
            <div class="control-row">
                <label class="mytsuji-label">許容範囲方位角(°): ±</label>
                <input type="number" class="mytsuji-tol-az" value="${t.toleranceAz !== undefined && t.toleranceAz !== null ? t.toleranceAz : 15}" placeholder="許容範囲方位角(°)" step="0.1" min="0" max="360" data-id="${t.id}">
                <label class="mytsuji-label">許容範囲視高度(°): ±</label>
                <input type="number" class="mytsuji-tol-alt" value="${t.toleranceAlt !== undefined && t.toleranceAlt !== null ? t.toleranceAlt : 15}" placeholder="許容範囲視高度(°)" step="0.1" min="0" max="360" data-id="${t.id}">
            </div>
            <hr class="tsujisearch-separator">
            <div class="control-row left-row">
                <input type="checkbox" class="body-checkbox mytsuji-moon-filter" data-id="${t.id}" ${t.moonFilter ? 'checked' : ''}>
                <label>月齢フィルタ</label>
            </div>
            <div class="control-row">
                <label class="mytsuji-label">基準月齢:</label>
                <input type="number" class="mytsuji-moon-base" value="${t.moonBase !== undefined && t.moonBase !== null ? t.moonBase : 15}" placeholder="基準月齢" step="0.1" min="0" max="30" data-id="${t.id}" ${moonDisabled}>
                <label class="mytsuji-label">許容範囲月齢: ±</label>
                <input type="number" class="mytsuji-moon-tol" value="${t.moonTolerance !== undefined && t.moonTolerance !== null ? t.moonTolerance : 2}" placeholder="許容範囲月齢±" step="0.1" min="0" max="15" data-id="${t.id}" ${moonDisabled}>
            </div>
            <hr class="tsujisearch-separator">
            <div class="control-row left-row">
                <input type="checkbox" class="body-checkbox mytsuji-acc-filter" data-id="${t.id}" ${t.accuracyFilter ? 'checked' : ''}>
                <label>精度フィルタ</label>
            </div>
            <div class="control-row left-row">
                <input type="checkbox" class="body-checkbox mytsuji-acc-dbl-circle" data-id="${t.id}" ${t.accDblCircle ? 'checked' : ''} ${t.accuracyFilter ? '' : 'disabled'}> <label class="tsuji-acc-label">:◎</label>
                <input type="checkbox" class="body-checkbox mytsuji-acc-circle" data-id="${t.id}" ${t.accCircle ? 'checked' : ''} ${t.accuracyFilter ? '' : 'disabled'}> <label class="tsuji-acc-label">:○</label>
                <input type="checkbox" class="body-checkbox mytsuji-acc-triangle" data-id="${t.id}" ${t.accTriangle ? 'checked' : ''} ${t.accuracyFilter ? '' : 'disabled'}> <label class="tsuji-acc-label">:△</label>
                <input type="checkbox" class="body-checkbox mytsuji-acc-dash" data-id="${t.id}" ${t.accDash ? 'checked' : ''} ${t.accuracyFilter ? '' : 'disabled'}> <label class="tsuji-acc-label">:-</label>
            </div>
            <div class="control-row">
                <label class="mytsuji-label">メモ:</label>
                <input type="text" class="mytsuji-memo" value="${escapeHtml(t.memo || '')}" placeholder="メモ(150文字)" maxlength="150" data-id="${t.id}" autocomplete="off">
            </div>`;

        // 初期表示でオフセット距離を計算 + ID検証
        const { azDist, altDist } = recalcMyTsujiOffsetDist(t);
        row.querySelector('.mytsuji-offset-az-dist').value = azDist.toFixed(1);
        row.querySelector('.mytsuji-offset-alt-dist').value = altDist.toFixed(1);
        validateMyTsujiRow(t, row);

        // ヘルパー: 行内の指定クラスを持つ要素にchangeハンドラを登録
        const onChange = (cls, fn) => {
            const el = row.querySelector('.' + cls);
            if (el) el.addEventListener('change', fn);
        };
        const updateDist = () => {
            const r = recalcMyTsujiOffsetDist(t);
            row.querySelector('.mytsuji-offset-az-dist').value = r.azDist.toFixed(1);
            row.querySelector('.mytsuji-offset-alt-dist').value = r.altDist.toFixed(1);
        };

        onChange('mytsuji-name', e => { t.name = e.target.value.trim(); saveAppState(); setMyTsujiDirty(true); });
        onChange('mytsuji-days', e => {
            const v = Math.min(Math.max(parseInt(e.target.value) || 365, 1), 36500);
            t.days = v; e.target.value = v; saveAppState(); setMyTsujiDirty(true);
        });
        onChange('mytsuji-bodyids', e => { t.bodyIds = e.target.value.trim(); saveAppState(); setMyTsujiDirty(true); });
        onChange('mytsuji-obsid', e => {
            const v = parseInt(e.target.value);
            t.obsId = isNaN(v) ? null : v;
            if (validateMyTsujiRow(t, row)) autoCalcMyTsujiBase(t, row);
            saveAppState(); setMyTsujiDirty(true); updateDist();
        });
        onChange('mytsuji-tgtid', e => {
            const v = parseInt(e.target.value);
            t.tgtId = isNaN(v) ? null : v;
            if (validateMyTsujiRow(t, row)) autoCalcMyTsujiBase(t, row);
            saveAppState(); setMyTsujiDirty(true); updateDist();
        });
        onChange('mytsuji-base-az', e => {
            const v = parseFloat(e.target.value);
            t.baseAz = isNaN(v) ? null : v;
            saveAppState(); setMyTsujiDirty(true);
        });
        onChange('mytsuji-base-alt', e => {
            const v = parseFloat(e.target.value);
            t.baseAlt = isNaN(v) ? null : v;
            saveAppState(); setMyTsujiDirty(true);
        });
        onChange('mytsuji-offset-az', e => {
            t.offsetAz = parseFloat(e.target.value) || 0;
            e.target.value = t.offsetAz;
            saveAppState(); setMyTsujiDirty(true); updateDist();
        });
        onChange('mytsuji-offset-alt', e => {
            t.offsetAlt = parseFloat(e.target.value) || 0;
            e.target.value = t.offsetAlt;
            saveAppState(); setMyTsujiDirty(true); updateDist();
        });
        onChange('mytsuji-tol-az', e => {
            t.toleranceAz = Math.min(Math.max(parseFloat(e.target.value) || 15, 0), 360);
            e.target.value = t.toleranceAz;
            saveAppState(); setMyTsujiDirty(true);
        });
        onChange('mytsuji-tol-alt', e => {
            t.toleranceAlt = Math.min(Math.max(parseFloat(e.target.value) || 15, 0), 360);
            e.target.value = t.toleranceAlt;
            saveAppState(); setMyTsujiDirty(true);
        });
        onChange('mytsuji-moon-filter', e => {
            t.moonFilter = e.target.checked;
            row.querySelector('.mytsuji-moon-base').disabled = !t.moonFilter;
            row.querySelector('.mytsuji-moon-tol').disabled = !t.moonFilter;
            saveAppState(); setMyTsujiDirty(true);
        });
        onChange('mytsuji-moon-base', e => {
            t.moonBase = Math.min(Math.max(parseFloat(e.target.value) || 15, 0), 30);
            e.target.value = t.moonBase;
            saveAppState(); setMyTsujiDirty(true);
        });
        onChange('mytsuji-moon-tol', e => {
            t.moonTolerance = Math.min(Math.max(parseFloat(e.target.value) || 2, 0), 15);
            e.target.value = t.moonTolerance;
            saveAppState(); setMyTsujiDirty(true);
        });
        onChange('mytsuji-acc-filter', e => {
            t.accuracyFilter = e.target.checked;
            row.querySelector('.mytsuji-acc-dbl-circle').disabled = !t.accuracyFilter;
            row.querySelector('.mytsuji-acc-circle').disabled = !t.accuracyFilter;
            row.querySelector('.mytsuji-acc-triangle').disabled = !t.accuracyFilter;
            row.querySelector('.mytsuji-acc-dash').disabled = !t.accuracyFilter;
            saveAppState(); setMyTsujiDirty(true);
        });
        onChange('mytsuji-acc-dbl-circle', e => { t.accDblCircle = e.target.checked; saveAppState(); setMyTsujiDirty(true); });
        onChange('mytsuji-acc-circle', e => { t.accCircle = e.target.checked; saveAppState(); setMyTsujiDirty(true); });
        onChange('mytsuji-acc-triangle', e => { t.accTriangle = e.target.checked; saveAppState(); setMyTsujiDirty(true); });
        onChange('mytsuji-acc-dash', e => { t.accDash = e.target.checked; saveAppState(); setMyTsujiDirty(true); });
        onChange('mytsuji-check', e => { t.checked = e.target.checked; saveAppState(); });
        onChange('mytsuji-memo', e => { t.memo = e.target.value.trim(); saveAppState(); setMyTsujiDirty(true); });

        container.appendChild(row);
    });
    updateMyTsujiButtonStates();
}

// リスト・パレット
function renderCelestialList() {
    const list = document.getElementById('celestial-list');
    if (!list) return;
    list.innerHTML = '';
    
    appState.bodies.forEach(body => {
        if(body.isCustom) return; 
        const li = document.createElement('li');
        const dashClass = body.isDashed ? 'dashed' : 'solid';
        li.innerHTML = `
            <input type="checkbox" class="body-checkbox" ${body.visible ? 'checked' : ''}>
            <div class="style-indicator ${dashClass}" style="color: ${escapeHtml(body.color)};"></div>
            <div class="body-info">
                <span class="body-name-label">${escapeHtml(body.name)}</span>
                <span class="body-name-id">ID: ${escapeHtml(body.id)}</span>
                <span id="radec-${escapeHtml(body.id)}" class="body-detail-text">赤経 --h / 赤緯 --°</span>
                <span id="riseset-${escapeHtml(body.id)}" class="body-detail-text">出時刻 --:--:-- / 入時刻 --:--:--</span>
                <span id="transit-${escapeHtml(body.id)}" class="body-detail-text">南中時 --:--:-- / 視半径 --°</span>
                <span id="data-${escapeHtml(body.id)}" class="body-detail-text">方位角 --° / 視高度 --°</span>
            </div>`;
        li.querySelector('.body-checkbox').addEventListener('change', function() {
            toggleVisibility(body.id, this.checked);
        });
        li.querySelector('.style-indicator').addEventListener('click', function() {
            openPalette(body.id);
        });
        list.appendChild(li);
    });
}

function toggleVisibility(id, checked) {
    const body = appState.bodies.find(b => b.id === id);
    if(body) {
        body.visible = checked;
        saveAppState();
        updateAll();
    }
}

function openPalette(id) {
    editingBodyId = id;
    const p = document.getElementById('style-palette');
    const c = document.getElementById('palette-colors');
    c.innerHTML = '';
    
    COLOR_MAP.forEach(col => {
        const d = document.createElement('div');
        d.className = 'color-btn';
        d.style.backgroundColor = col.code;
        d.onclick = () => { applyColor(col.code); };
        c.appendChild(d);
    });
    p.classList.remove('hidden');
}

function applyColor(code) {
    const b = appState.bodies.find(x => x.id === editingBodyId);
    if(b) {
        b.color = code;
        // My天体側にも同期
        const myStar = appState.myStars.find(s => String(s.id) === editingBodyId);
        if (myStar) myStar.color = code;
        closePalette();
        saveAppState();
        renderCelestialList();
        renderMyStarsList();
        updateAll();
    }
}

function applyLineStyle(type) {
    const b = appState.bodies.find(x => x.id === editingBodyId);
    b.isDashed = (type === 'dashed');
    // My天体側にも同期
    const myStar = appState.myStars.find(s => String(s.id) === editingBodyId);
    if (myStar) myStar.isDashed = (type === 'dashed');
    closePalette();
    saveAppState();
    renderCelestialList();
    renderMyStarsList();
    updateAll();
}

// 設定登録 (大気差係数など)
function registerSettings() {
    const iK = document.getElementById('input-refraction-k');
    const iP = document.getElementById('input-meteo-p');
    const iT = document.getElementById('input-meteo-t');
    const iL = document.getElementById('input-meteo-l');
    const val = iK.value.trim();

    // 空欄の場合はmeteoを標準値にリセット
    if (val === '') {
        appState.meteo = { p: STD_P, t: STD_T, l: STD_L };
        iP.value = STD_P;
        iT.value = STD_T;
        iL.value = STD_L;
    } else {
        const p = parseFloat(iP.value);
        const t = parseFloat(iT.value);
        const l = parseFloat(iL.value);
        if (isNaN(p) || isNaN(t) || isNaN(l)) {
            return alert('気象パラメータに有効な数値を入力してください');
        }
        appState.meteo = { p, t, l };
    }

    // 常にmeteoからKを再計算
    const k = calculateKFromMeteo(appState.meteo.p, appState.meteo.t, appState.meteo.l);
    appState.refractionK = k;
    iK.value = k.toFixed(4);
    alert(`大気差補正係数を ${k.toFixed(4)} に設定しました`);

    saveAppState();
    updateAll(); // 再計算して描画更新
}

function resetBodyStyle() {
    if (!editingBodyId) return;
    const def = DEFAULT_BODIES.find(x => x.id === editingBodyId);
    const body = appState.bodies.find(x => x.id === editingBodyId);
    if (!body) return;
    if (def) {
        body.color = def.color;
        body.isDashed = def.isDashed;
    } else {
        // My天体のデフォルト: 薄紫、破線
        body.color = '#DDA0DD';
        body.isDashed = true;
    }
    // My天体側にも同期
    const myStar = appState.myStars.find(s => String(s.id) === editingBodyId);
    if (myStar) { myStar.color = body.color; myStar.isDashed = body.isDashed; }
    closePalette();
    saveAppState();
    renderCelestialList();
    renderMyStarsList();
    updateAll();
}

function closePalette() {
    document.getElementById('style-palette').classList.add('hidden');
    editingBodyId = null;
}

// 標高
function toggleElevation() {
    const btn = document.getElementById('btn-elevation');
    const pnl = document.getElementById('elevation-panel');
    appState.isElevationActive = !appState.isElevationActive;

    if (appState.isElevationActive) {
        btn.classList.add('active');
        pnl.classList.remove('hidden');
        startElevationFetch();
    } else {
        btn.classList.remove('active');
        pnl.classList.add('hidden');
        _elevFetchGeneration++;
        document.getElementById('progress-overlay').classList.add('hidden');
    }
    syncBottomPanels();
}

// --- 辻検索 入力連動 ---
// 位置が変わった場合のみ再計算（ユーザーの手動入力値を保護）
function updateTsujiSearchInputs() {
    const posKey = `${appState.start.lat},${appState.start.lng},${appState.start.elev}|${appState.end.lat},${appState.end.lng},${appState.end.elev}`;
    if (posKey === appState._lastTsujiPosKey) return;
    appState._lastTsujiPosKey = posKey;

    const dist = L.latLng(appState.start.lat, appState.start.lng)
                  .distanceTo(L.latLng(appState.end.lat, appState.end.lng));
    const az = calculateBearing(appState.start.lat, appState.start.lng,
                                appState.end.lat, appState.end.lng);
    const alt = calculateApparentAltitude(dist, appState.start.elev, appState.end.elev);
    appState.tsujiSearchBaseAz = az;
    appState.tsujiSearchBaseAlt = alt;
    document.getElementById('input-tsuji-az').value = az.toFixed(4);
    document.getElementById('input-tsuji-alt').value = alt.toFixed(4);
    saveAppState();
    updateOffsetDistances();
}

/** オフセット方位距離・視高距離を再計算してUIに反映 */
function updateOffsetDistances() {
    const dist = L.latLng(appState.start.lat, appState.start.lng)
                  .distanceTo(L.latLng(appState.end.lat, appState.end.lng));
    const azDist = dist * Math.tan(appState.tsujiSearchOffsetAz * Math.PI / 180);
    const altDist = dist * Math.tan(appState.tsujiSearchOffsetAlt * Math.PI / 180);
    document.getElementById('input-tsuji-az-offset-dist').value = parseFloat(azDist.toFixed(1));
    document.getElementById('input-tsuji-alt-offset-dist').value = parseFloat(altDist.toFixed(1));
}

/** 月齢フィルタのUI状態を更新 (入力可否) */
function updateTsujiMoonFilterUI() {
    const enabled = appState.tsujiMoonFilterEnabled;
    document.getElementById('input-tsuji-moon-base').disabled = !enabled;
    document.getElementById('input-tsuji-moon-tolerance').disabled = !enabled;
}

function updateTsujiAccuracyFilterUI() {
    const enabled = appState.tsujiAccuracyFilterEnabled;
    document.getElementById('chk-tsuji-acc-dbl-circle').disabled = !enabled;
    document.getElementById('chk-tsuji-acc-circle').disabled = !enabled;
    document.getElementById('chk-tsuji-acc-triangle').disabled = !enabled;
    document.getElementById('chk-tsuji-acc-dash').disabled = !enabled;
}

/** 月齢が基準月齢±許容範囲の範囲内かどうか（月齢はSYNODIC_MONTHで循環） */
function isMoonAgeInRange(moonAge, base, tolerance) {
    const S = SYNODIC_MONTH;
    // 循環を考慮した最短距離
    let diff = Math.abs(moonAge - base);
    if (diff > S / 2) diff = S - diff;
    return diff <= tolerance;
}

// --- 辻検索 ---
/** 辻検索パネルをMy辻検索結果表示用に開く (startTsujiSearchを呼ばず、ヘッダーテキストを差し替える) */
function showTsujiPanelForMyTsuji(titleText) {
    appState.isTsujiSearchActive = true;
    document.getElementById('btn-tsuji-search').classList.add('active');
    document.getElementById('tsujisearch-panel').classList.remove('hidden');
    document.getElementById('tsujisearch-header').innerHTML =
        `${titleText} <span id="tsujisearch-status"></span>`;
    syncBottomPanels();
}

function toggleTsujiSearch() {
    appState.isTsujiSearchActive = !appState.isTsujiSearchActive;
    const btn = document.getElementById('btn-tsuji-search');
    const pnl = document.getElementById('tsujisearch-panel');

    if (appState.isTsujiSearchActive) {
        btn.classList.add('active');
        pnl.classList.remove('hidden');
        document.getElementById('tsujisearch-header').innerHTML = '辻検索結果 <span id="tsujisearch-status"></span>';
        startTsujiSearch();
    } else {
        btn.classList.remove('active');
        pnl.classList.add('hidden');
        appState.tsujiSearchGeneration++;
    }
    syncBottomPanels();
}

function syncBottomPanels() {
    const tdPnl = document.getElementById('tsujisearch-panel');
    if (appState.isTsujiSearchActive && appState.isElevationActive) {
        tdPnl.classList.add('with-elevation');
    } else {
        tdPnl.classList.remove('with-elevation');
    }
}


// --- テーブルソート ヘルパー ---
function setupTableSort(table, rowData, columns, renderRowFn, extraRows) {
    const ths = Array.from(table.querySelectorAll('thead th'));
    const tbody = table.querySelector('tbody');
    let sortColIdx = -1;
    let sortAsc = true;

    ths.forEach((th, idx) => {
        th.addEventListener('click', () => {
            if (sortColIdx === idx) {
                sortAsc = !sortAsc;
            } else {
                sortColIdx = idx;
                sortAsc = true;
            }
            ths.forEach((h, i) => {
                h.textContent = columns[i].label + (i === sortColIdx ? (sortAsc ? '▲' : '▼') : '');
            });
            rowData.sort((a, b) => {
                const cmp = columns[idx].compare(a, b);
                return sortAsc ? cmp : -cmp;
            });
            tbody.innerHTML = '';
            rowData.forEach(d => tbody.appendChild(renderRowFn(d)));
            if (extraRows) extraRows.forEach(r => tbody.appendChild(r));
        });
    });
}

// --- 辻検索 ヘルパー ---
function isAzimuthInRange(az, targetAz, tolerance) {
    let diff = az - targetAz;
    diff = ((diff + 540) % 360) - 180;
    return Math.abs(diff) <= tolerance;
}

// --- 辻検索 Web Worker 並行化 ---
const TSUJI_NUM_WORKERS = Math.max(1, Math.min(navigator.hardwareConcurrency || 4, 8));
let tsujiActiveWorkers = []; // キャンセル時に terminate するための参照保持

// --- 辻検索 コア検索ロジック ---
async function startTsujiSearch() {
    const generation = ++appState.tsujiSearchGeneration;
    const contentEl = document.getElementById('tsujisearch-content');
    const statusEl = document.getElementById('tsujisearch-status');
    contentEl.innerHTML = '';
    statusEl.textContent = '(検索中…)';

    const observerData = { lat: appState.start.lat, lng: appState.start.lng, elev: appState.start.elev };
    const baseAz = appState.tsujiSearchBaseAz;
    const offsetAz = appState.tsujiSearchOffsetAz;
    const toleranceAz = appState.tsujiSearchToleranceAz;
    const baseAlt = appState.tsujiSearchBaseAlt;
    const offsetAlt = appState.tsujiSearchOffsetAlt;
    const toleranceAlt = appState.tsujiSearchToleranceAlt;
    const searchDays = appState.tsujiSearchDays;

    // オフセットを加算した検索中心
    const targetAz = (baseAz + offsetAz + 360) % 360;
    const targetAlt = baseAlt + offsetAlt;

    if (isNaN(baseAz) || isNaN(toleranceAz) || isNaN(baseAlt) || isNaN(toleranceAlt)) {
        statusEl.textContent = '(入力値エラー)';
        contentEl.innerHTML = '<div style="padding:8px;color:#f99;">方位角・視高度・許容範囲を正しく入力してください</div>';
        return;
    }

    const refractionEnabled = appState.refractionEnabled;
    const visibleBodies = appState.bodies.filter(b => b.visible);
    const searchStart = new Date(appState.currentDate);
    searchStart.setHours(0, 0, 0, 0);
    const searchStartMs = searchStart.getTime();
    const MAX_RESULTS_PER_BODY = 36500;
    const totalResults = [];

    // 既存ワーカーをクリーンアップ（前回の検索が残っていれば中断）
    tsujiActiveWorkers.forEach(w => { try { w.terminate(); } catch(_) {} });
    tsujiActiveWorkers = [];

    for (let bi = 0; bi < visibleBodies.length; bi++) {
        if (generation !== appState.tsujiSearchGeneration) {
            tsujiActiveWorkers.forEach(w => { try { w.terminate(); } catch(_) {} });
            tsujiActiveWorkers = [];
            return;
        }

        const body = visibleBodies[bi];

        // body を Worker に渡す形に変換（fixed star は ra/dec を抽出）
        let bodyMsg;
        if (isFixedStar(body.id)) {
            const rd = getFixedStarRaDec(body.id);
            bodyMsg = { id: body.id, fixed: true, ra: rd.ra, dec: rd.dec };
        } else {
            bodyMsg = { id: body.id, fixed: false };
        }

        // 日数を NUM_WORKERS 個のチャンクに分割
        const chunkSize = Math.ceil(searchDays / TSUJI_NUM_WORKERS);
        const chunkPromises = [];
        const chunkWorkers = [];
        for (let w = 0; w < TSUJI_NUM_WORKERS; w++) {
            const dayStart = w * chunkSize;
            if (dayStart >= searchDays) break;
            const dayEnd = Math.min(dayStart + chunkSize, searchDays);

            const worker = new Worker('tsuji-search-worker.js');
            chunkWorkers.push(worker);
            tsujiActiveWorkers.push(worker);

            const p = new Promise((resolve) => {
                worker.onmessage = (e) => {
                    if (e.data && e.data.error) {
                        console.error('tsuji worker error:', e.data.error);
                        resolve({ results: [], dayStart, dayEnd });
                    } else {
                        resolve(e.data);
                    }
                };
                worker.onerror = (err) => {
                    console.error('tsuji worker onerror:', err.message || err);
                    resolve({ results: [], dayStart, dayEnd });
                };
                worker.postMessage({
                    body: bodyMsg,
                    observerData,
                    refractionEnabled,
                    targetAz, targetAlt,
                    toleranceAz, toleranceAlt,
                    searchStartMs,
                    dayStart,
                    dayEnd,
                    maxResults: MAX_RESULTS_PER_BODY,
                });
            });
            chunkPromises.push(p);
        }

        statusEl.textContent = `(検索中… ${body.name} ${bi + 1}/${visibleBodies.length})`;
        const chunkResults = await Promise.all(chunkPromises);

        // この天体のワーカーは役目終了
        chunkWorkers.forEach(w => { try { w.terminate(); } catch(_) {} });
        tsujiActiveWorkers = tsujiActiveWorkers.filter(w => !chunkWorkers.includes(w));

        if (generation !== appState.tsujiSearchGeneration) {
            tsujiActiveWorkers.forEach(w => { try { w.terminate(); } catch(_) {} });
            tsujiActiveWorkers = [];
            return;
        }

        // チャンク結果を dayStart 順にマージし、MAX_RESULTS_PER_BODY で打ち切る
        chunkResults.sort((a, b) => a.dayStart - b.dayStart);
        const bodyResults = [];
        let bodyLimitReached = false;
        for (const ch of chunkResults) {
            for (const r of ch.results) {
                bodyResults.push({
                    time: new Date(r.timeMs),
                    azimuth: r.azimuth,
                    altitude: r.altitude,
                    dist: r.dist,
                });
                if (bodyResults.length >= MAX_RESULTS_PER_BODY) {
                    bodyLimitReached = true;
                    break;
                }
            }
            if (bodyLimitReached) break;
        }

        totalResults.push({ body, results: bodyResults, limitReached: bodyLimitReached });
        statusEl.textContent = `(検索中… ${bi + 1}/${visibleBodies.length} 天体完了)`;
    }

    tsujiActiveWorkers = [];
    if (generation !== appState.tsujiSearchGeneration) return;

    // 結果表示用の observer を再構築（後段の getBodyAngularRadius 等で利用）
    const observer = new Astronomy.Observer(observerData.lat, observerData.lng, observerData.elev);

    // 結果表示
    const totalCount = totalResults.reduce((sum, t) => sum + t.results.length, 0);

    if (totalCount === 0) {
        statusEl.textContent = `(0件)`;
        contentEl.innerHTML = '<div style="padding:8px;color:#999;">該当する日時はありません</div>';
        return;
    }

    // ソート用データをフラットに事前計算
    const symbolRank = { '◎': 0, '○': 1, '△': 2, '-': 3 };
    const rowData = [];
    const extraRows = [];

    totalResults.forEach(({ body, results, limitReached }) => {
        results.forEach(r => {
            let symbol;
            if (r.dist <= 0.125) symbol = '◎';       // ±0.125° (誤差範囲0.25°、視半径以内)
            else if (r.dist <= 0.25) symbol = '○';   // ±0.25° (誤差範囲0.5°、視直径以内)
            else if (r.dist <= 1.0) symbol = '△';    // ±1° (誤差範囲2°、視直径×4以内)
            else symbol = '-';

            const dt = r.time;
            const dow = ['日','月','火','水','木','金','土'][dt.getDay()];
            const dateStr = `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}(${dow})`;
            const timeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}:${String(dt.getSeconds()).padStart(2, '0')}`;

            const angR = getBodyAngularRadius(body.id, dt, observer);

            // 月齢と月齢アイコンは全天体で辻時刻の月の状態を表示
            const phase = Astronomy.MoonPhase(dt);
            const moonAge = (phase / 360) * SYNODIC_MONTH;
            const icons = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
            const moonIcon = icons[Math.round(phase / 45) % 8];

            // 月齢フィルタが有効な場合は範囲外をスキップ
            if (appState.tsujiMoonFilterEnabled &&
                !isMoonAgeInRange(moonAge, appState.tsujiMoonBase, appState.tsujiMoonTolerance)) {
                return;
            }

            // 精度フィルタが有効な場合はチェックされた記号以外をスキップ
            if (appState.tsujiAccuracyFilterEnabled) {
                const allowed = [];
                if (appState.tsujiAccDblCircle) allowed.push('◎');
                if (appState.tsujiAccCircle) allowed.push('○');
                if (appState.tsujiAccTriangle) allowed.push('△');
                if (appState.tsujiAccDash) allowed.push('-');
                if (allowed.length > 0 && !allowed.includes(symbol)) return;
            }

            rowData.push({
                body, symbol, dateStr, timeStr, dateObj: dt,
                dist: r.dist, azimuth: r.azimuth, altitude: r.altitude,
                angularRadius: angR, moonAge, moonIcon
            });
        });

        if (limitReached) {
            const tr = document.createElement('tr');
            tr.style.color = body.color;
            tr.innerHTML = `<td colspan="11">${escapeHtml(body.name)}: and more…</td>`;
            extraRows.push(tr);
        }
    });

    statusEl.textContent = `(${rowData.length}件)`;
    if (rowData.length === 0) {
        contentEl.innerHTML = '<div style="padding:8px;color:#999;">フィルタの結果、該当する日時はありません</div>';
        return;
    }

    const renderRow = (r) => {
        const tr = document.createElement('tr');
        tr.className = 'td-data-row';
        tr.style.color = r.body.color;
        const angRDisplay = BODY_RADIUS_KM[r.body.id] ? r.angularRadius.toFixed(3) + '°' : '-.---°';
        tr.innerHTML = `<td>${escapeHtml(r.body.id)}</td><td>${escapeHtml(r.body.name)}</td><td>${r.symbol}</td><td>${r.dist.toFixed(5)}°</td><td>${r.dateStr}</td><td>${r.timeStr}</td><td>${r.moonAge.toFixed(1)}</td><td>${r.moonIcon}</td><td>${r.azimuth.toFixed(4)}°</td><td>${r.altitude.toFixed(4)}°</td><td>${angRDisplay}</td>`;
        tr.addEventListener('click', () => {
            appState.currentDate = new Date(r.dateObj);
            syncUIFromState();
            updateAll();
        });
        return tr;
    };

    const table = document.createElement('table');
    table.className = 'td-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>天体ID</th><th>天体名</th><th>精度記号</th><th>精度角距離</th><th>日付</th><th>辻時刻</th><th>月齢</th><th>月齢アイコン</th><th>方位角</th><th>視高度</th><th>視半径</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    rowData.forEach(r => tbody.appendChild(renderRow(r)));
    extraRows.forEach(r => tbody.appendChild(r));
    table.appendChild(tbody);
    contentEl.appendChild(table);

    setupTableSort(table, rowData, [
        { label: '天体ID', compare: (a, b) => a.body.id.localeCompare(b.body.id) },
        { label: '天体名', compare: (a, b) => {
            const ia = appState.bodies.findIndex(bo => bo.id === a.body.id);
            const ib = appState.bodies.findIndex(bo => bo.id === b.body.id);
            return ia - ib;
        }},
        { label: '精度記号', compare: (a, b) => (symbolRank[a.symbol] ?? 9) - (symbolRank[b.symbol] ?? 9) },
        { label: '精度角距離', compare: (a, b) => a.dist - b.dist },
        { label: '日付', compare: (a, b) => a.dateObj - b.dateObj },
        { label: '辻時刻', compare: (a, b) => a.timeStr.localeCompare(b.timeStr) },
        { label: '月齢', compare: (a, b) => a.moonAge - b.moonAge },
        { label: '月齢アイコン', compare: (a, b) => a.moonIcon.localeCompare(b.moonIcon) },
        { label: '方位角', compare: (a, b) => a.azimuth - b.azimuth },
        { label: '視高度', compare: (a, b) => a.altitude - b.altitude },
        { label: '視半径', compare: (a, b) => a.angularRadius - b.angularRadius },
    ], renderRow, extraRows);
}

async function startElevationFetch() {
    appState.elevationData.points = [];
    const s = L.latLng(appState.start.lat, appState.start.lng);
    const e = L.latLng(appState.end.lat, appState.end.lng);
    const dist = s.distanceTo(e);
    const steps = 2000;
    const intervalM = dist / steps;
    appState.elevationData.intervalM = intervalM; // グラフ表示用に保持

    for(let i=0; i<=steps; i++) {
        const r = i/steps;
        appState.elevationData.points.push({
            lat: s.lat + (e.lat - s.lat)*r,
            lng: s.lng + (e.lng - s.lng)*r,
            dist: (dist * r) / 1000, // km単位
            elev: null,
            fetched: false
        });
    }
    appState.elevationData.index = 0;
    document.getElementById('progress-overlay').classList.remove('hidden');
    updateProgress(0, 0, appState.elevationData.points.length);

    // タイルベースのバッチ処理で標高を取得
    await fetchAllElevations(appState.elevationData.points, (fetched, total) => {
        const pct = Math.floor((fetched / total) * 100);
        updateProgress(pct, fetched, total);
        drawProfileGraph();
    });

    document.getElementById('progress-overlay').classList.add('hidden');
    drawProfileGraph();
}

function updateProgress(pct, cur, tot) {
    document.getElementById('progress-bar').style.width = pct + "%";
    document.getElementById('progress-text').innerText = `${pct}% (${cur}/${tot} タイル処理中...)`;
}

function drawProfileGraph() {
    const cvs = document.getElementById('elevation-canvas');
    const ctx = cvs.getContext('2d');
    const w = cvs.width = cvs.clientWidth;
    const h = cvs.height = cvs.clientHeight;
    const pts = appState.elevationData.points.filter(p => p.fetched);
    
    if(pts.length === 0) return;
    
    const elevs = pts.map(p => p.elev);
    const minE = Math.min(0, ...elevs);
    const maxE = Math.max(100, ...elevs);
    
    const pad = {l:40, r:10, t:20, b:20};
    const gw = w - pad.l - pad.r;
    const gh = h - pad.t - pad.b;
    const maxD = appState.elevationData.points[appState.elevationData.points.length-1].dist;
    
    const toX = d => pad.l + (d/maxD)*gw;
    const toY = e => pad.t + gh - ((e - minE)/(maxE - minE))*gh;

    ctx.strokeStyle = '#444';
    ctx.beginPath();
    for(let i=0; i<=4; i++) {
        const y = toY(minE + (maxE-minE)*(i/4));
        ctx.moveTo(pad.l, y);
        ctx.lineTo(w-pad.r, y);
        ctx.fillStyle='#aaa';
        ctx.fillText(Math.round(minE+(maxE-minE)*(i/4)), 2, y+3);
    }
    ctx.stroke();

    // グラフ上部に間隔情報を表示
    const intervalM = appState.elevationData.intervalM;
    if (intervalM !== undefined) {
        ctx.fillStyle = '#aaa';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${intervalM.toFixed(1)}m間隔 2000地点`, w - pad.r, pad.t - 5);
        ctx.textAlign = 'start';
    }

    if(pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(toX(pts[0].dist), toY(pts[0].elev));
        for(let i=1; i<pts.length; i++) {
            ctx.lineTo(toX(pts[i].dist), toY(pts[i].elev));
        }
        ctx.strokeStyle='#00ff00';
        ctx.lineWidth=2;
        ctx.stroke();
        
        ctx.lineTo(toX(pts[pts.length-1].dist), pad.t+gh);
        ctx.lineTo(toX(pts[0].dist), pad.t+gh);
        ctx.fillStyle='rgba(0,255,0,0.1)';
        ctx.fill();

        // 見通し線（赤）: 観測点標高 → 目的点標高
        const startElev = appState.start.elev;
        const endElev = appState.end.elev;
        ctx.beginPath();
        ctx.moveTo(toX(pts[0].dist), toY(startElev));
        ctx.lineTo(toX(pts[pts.length - 1].dist), toY(endElev));
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function initVisitorCounter() {
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
    // 計算中表示
    setCounterDisplay('-', '-', '-', '-');

    // soranotsuji.net からのアクセスのみカウントアップ
    const isProductionSite = (location.hostname === 'soranotsuji.net');
    const action = (isProductionSite && appState.lastVisitDate !== todayStr) ? 'visit' : 'get';
    fetchVisitorData(action, todayStr);
}

function fetchVisitorData(action, todayStr) {
    fetch(`${GAS_API_URL}?action=${action}`).then(r=>r.json()).then(d => {
        if (d.error === 'lock_busy') {
            // ロック解除待ち表示 → 3秒後リトライ
            setCounterDisplay('- -', '- -', '- -', '- -');
            setTimeout(() => fetchVisitorData(action, todayStr), 3000);
            return;
        }
        if (d.error === 'no_sheet') {
            // シート無し表示
            setCounterDisplay('- - -', '- - -', '- - -', '- - -');
            return;
        }
        if (d.error) return;

        if (action === 'visit') {
            appState.lastVisitDate = todayStr;
            saveAppState();
        }
        visitorData = d;
        setCounterDisplay(d.today, d.yesterday, d.yearTotal, d.lastYearTotal);
    }).catch(() => {
        setCounterDisplay('- - -', '- - -', '- - -', '- - -');
    });
}

function setCounterDisplay(today, yesterday, year, last) {
    document.getElementById('cnt-today').innerText = today;
    document.getElementById('cnt-yesterday').innerText = yesterday;
    document.getElementById('cnt-year').innerText = year;
    document.getElementById('cnt-last').innerText = last;
}

function showGraph(type) {
    if(!visitorData) return;
    document.getElementById('graph-modal').classList.remove('hidden');
    document.getElementById('graph-title').innerText = (type==='current') ? "今年の推移" : "昨年の推移";

    // dailyLogが未取得ならaction=detailでfetchしてから描画
    if (!visitorData.dailyLog) {
        fetch(`${GAS_API_URL}?action=detail`).then(r=>r.json()).then(d => {
            if (!d.error) {
                visitorData.dailyLog = d.dailyLog;
                visitorData.lastYearLog = d.lastYearLog;
            }
            drawGraph(type);
        }).catch(() => drawGraph(type));
    } else {
        drawGraph(type);
    }
}

function drawGraph(type) {
    const cvs = document.getElementById('visitor-canvas');
    const ctx = cvs.getContext('2d');
    const w = cvs.width = cvs.clientWidth;
    const h = cvs.height = 300;

    const data = (type==='current') ? visitorData.dailyLog : visitorData.lastYearLog;
    if(!data || data.length===0) {
        ctx.fillStyle = '#333';
        ctx.font = "20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No Data", w/2, h/2);
        return;
    }

    const maxVal = Math.max(10, ...data.map(d=>d.count));
    const pad = 40;
    const gw = w - pad*2;
    const gh = h - pad*2;

    ctx.strokeStyle='#ccc';
    ctx.strokeRect(pad, pad, gw, gh);

    ctx.beginPath();
    ctx.strokeStyle='#007bff';
    ctx.lineWidth=2;

    data.forEach((d, i) => {
        const x = pad + (i/(data.length-1||1))*gw;
        const y = (pad+gh) - (d.count/maxVal)*gh;
        if(i===0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        ctx.fillStyle = '#007bff';
        ctx.fillRect(x-2, y-2, 4, 4);
    });
    ctx.stroke();

    ctx.fillStyle='#333';
    ctx.textAlign = "right";
    ctx.fillText(maxVal, pad-10, pad+10);
    ctx.fillText(0, pad-10, h-pad);
}

function closeGraph() {
    document.getElementById('graph-modal').classList.add('hidden');
}

function togglePanel() {
    document.getElementById('control-panel').classList.toggle('minimized');
}

function toggleSection(id) {
    document.getElementById(id).classList.toggle('closed');
}

function toggleHelp() {
    const modal = document.getElementById('help-modal');
    if(modal) modal.classList.toggle('hidden');
}

// ============================================================
// URL取得・復元
// ============================================================

function buildBaseUrl() {
    return window.location.origin + window.location.pathname;
}

// 日時をdessin仕様フォーマットに変換するヘルパー
function formatDateForUrl(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
}
function formatTimeForUrl(d) {
    return `${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;
}

// ブラウザのタイムゾーンオフセットを+0900形式で返す
function getLocalTimezoneOffsetString() {
    const offset = new Date().getTimezoneOffset(); // JSTなら-540
    const sign = offset <= 0 ? '+' : '-';
    const abs = Math.abs(offset);
    const h = String(Math.floor(abs / 60)).padStart(2, '0');
    const m = String(abs % 60).padStart(2, '0');
    return `${sign}${h}${m}`;
}

// +0900形式をパースして分単位(JSTなら+540)で返す
function parseTimezoneOffsetMinutes(tzString) {
    const match = tzString.match(/^([+-])(\d{2})(\d{2})$/);
    if (!match) return 540; // デフォルトJST
    const sign = match[1] === '+' ? 1 : -1;
    return sign * (parseInt(match[2]) * 60 + parseInt(match[3]));
}

// 共通のURLパラメータを構築するヘルパー
function buildCommonUrlParams(dateTimeMode = 'fixed') {
    const d = appState.currentDate;
    const params = new URLSearchParams();
    if (dateTimeMode === 'fixed' || dateTimeMode === true) {
        params.set('date', formatDateForUrl(d));
        params.set('time', formatTimeForUrl(d));
        params.set('timeZone', getLocalTimezoneOffsetString());
    } else if (dateTimeMode === 'semi-fixed') {
        // 年を0000にして月日時は固定
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        params.set('date', `0000${mm}${dd}`);
        params.set('time', formatTimeForUrl(d));
        params.set('timeZone', getLocalTimezoneOffsetString());
    }
    params.set('startLat', String(appState.start.lat));
    params.set('startLng', String(appState.start.lng));
    params.set('startApiElv', String(appState.startApiElev));
    params.set('startElv', String(appState.startHeight));
    params.set('endLat', String(appState.end.lat));
    params.set('endLng', String(appState.end.lng));
    params.set('endApiElv', String(appState.endApiElev));
    params.set('endElv', String(appState.endHeight));

    // 表示天体: starIdを複数指定
    const visibleBodies = appState.bodies.filter(b => b.visible);
    visibleBodies.forEach(b => {
        params.append('starId', b.id);
        // My天体の場合は追加情報を付与
        if (b.isCustom) {
            const myStar = appState.myStars.find(s => String(s.id) === b.id);
            if (myStar) {
                params.append('starName', myStar.name);
                params.append('starRa', String(myStar.ra));
                params.append('starDec', String(myStar.dec));
                params.append('starColor', myStar.color);
                params.append('starIsDashed', myStar.isDashed ? '1' : '0');
            }
        }
    });

    return params;
}

// URL取得ポップアップダイアログ
let urlPickerMode = null; // 'location' or 'tsuji'

function toggleUrlPanel(type) {
    const picker = document.getElementById('url-picker');
    const fixedLabel = document.getElementById('url-picker-fixed-label');
    const semiFixedLabel = document.getElementById('url-picker-semi-fixed-label');

    const d = appState.currentDate;
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const mi = String(d.getMinutes()).padStart(2,'0');
    const ss = String(d.getSeconds()).padStart(2,'0');

    fixedLabel.textContent = `日時固定(${d.getFullYear()}年${mm}月${dd}日${hh}:${mi}:${ss})`;
    semiFixedLabel.textContent = `日時半固定(アクセス年の${mm}月${dd}日${hh}:${mi}:${ss})`;
    urlPickerMode = type;
    picker.classList.remove('hidden');
}

function closeUrlPicker() {
    document.getElementById('url-picker').classList.add('hidden');
    urlPickerMode = null;
}

function copyLocationUrl(includeDateTime) {
    const params = buildCommonUrlParams(includeDateTime);
    params.set('mode', 'preview');

    const url = buildBaseUrl() + '?' + params.toString();
    navigator.clipboard.writeText(url).then(() => {
        alert('現在の状態で宙の辻を開くURLをクリップボードにコピーしました。');
    });
}

function copyTsujiSearchUrl(includeDateTime) {
    const params = buildCommonUrlParams(includeDateTime);
    params.set('mode', 'tsujisearch');

    params.set('tsujiSearchDays', String(appState.tsujiSearchDays));
    params.set('tsujiAz', String(appState.tsujiSearchBaseAz));
    params.set('tsujiAlt', String(appState.tsujiSearchBaseAlt));
    params.set('tsujiAzOffset', String(appState.tsujiSearchOffsetAz));
    params.set('tsujiAltOffset', String(appState.tsujiSearchOffsetAlt));
    params.set('tsujiAzTolerance', String(appState.tsujiSearchToleranceAz));
    params.set('tsujiAltTolerance', String(appState.tsujiSearchToleranceAlt));
    params.set('tsujiMoonFilter', appState.tsujiMoonFilterEnabled ? 'true' : 'false');
    params.set('tsujiMoonBase', String(appState.tsujiMoonBase));
    params.set('tsujiMoonTolerance', String(appState.tsujiMoonTolerance));
    params.set('tsujiAccuracyFilter', appState.tsujiAccuracyFilterEnabled ? 'true' : 'false');
    params.set('tsujiAccDblCircle', appState.tsujiAccDblCircle ? 'true' : 'false');
    params.set('tsujiAccCircle', appState.tsujiAccCircle ? 'true' : 'false');
    params.set('tsujiAccTriangle', appState.tsujiAccTriangle ? 'true' : 'false');
    params.set('tsujiAccDash', appState.tsujiAccDash ? 'true' : 'false');

    const url = buildBaseUrl() + '?' + params.toString();
    navigator.clipboard.writeText(url).then(() => {
        alert('現在の辻検索を開くURLをクリップボードにコピーしました。');
    });
}

function restoreFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('mode')) return;

    const mode = params.get('mode');

    // 位置情報
    if (params.has('startLat')) { const v = parseFloat(params.get('startLat')); if (!isNaN(v)) appState.start.lat = v; }
    if (params.has('startLng')) { const v = parseFloat(params.get('startLng')); if (!isNaN(v)) appState.start.lng = v; }
    if (params.has('startApiElv')) { const v = parseFloat(params.get('startApiElv')); if (!isNaN(v)) appState.startApiElev = v; }
    if (params.has('startElv')) { const v = parseFloat(params.get('startElv')); if (!isNaN(v)) appState.startHeight = v; }
    if (params.has('endLat')) { const v = parseFloat(params.get('endLat')); if (!isNaN(v)) appState.end.lat = v; }
    if (params.has('endLng')) { const v = parseFloat(params.get('endLng')); if (!isNaN(v)) appState.end.lng = v; }
    if (params.has('endApiElv')) { const v = parseFloat(params.get('endApiElv')); if (!isNaN(v)) appState.endApiElev = v; }
    if (params.has('endElv')) { const v = parseFloat(params.get('endElv')); if (!isNaN(v)) appState.endHeight = v; }

    // 日時 (YYYYMMDD, hhmmss) — date/timeが存在する場合のみ日時を復元しsetNow()をスキップ
    if (params.has('date')) {
        appState._restoredFromUrl = true;
        const s = params.get('date');
        if (s.length === 8) {
            let y = parseInt(s.substring(0, 4));
            const m = parseInt(s.substring(4, 6)) - 1, d = parseInt(s.substring(6, 8));
            if (y === 0) y = new Date().getFullYear(); // 日時半固定: アクセス年に置換
            appState.currentDate.setFullYear(y, m, d);
        }
    }
    if (params.has('time')) {
        appState._restoredFromUrl = true;
        const s = params.get('time');
        if (s.length >= 4) {
            const h = parseInt(s.substring(0, 2)), m = parseInt(s.substring(2, 4));
            const sec = s.length >= 6 ? parseInt(s.substring(4, 6)) : 0;
            appState.currentDate.setHours(h, m, sec, 0);
        }
    }

    // タイムゾーン補正: URL作成者と閲覧者のオフセット差を補正
    if (params.has('date') || params.has('time')) {
        const urlTzString = params.has('timeZone') ? params.get('timeZone') : '+0900';
        const urlOffsetMin = parseTimezoneOffsetMinutes(urlTzString);
        const localOffsetMin = -new Date().getTimezoneOffset();
        const diffMin = urlOffsetMin - localOffsetMin;
        if (diffMin !== 0) {
            appState.currentDate.setMinutes(appState.currentDate.getMinutes() - diffMin);
        }
    }

    // 表示天体 (starId複数指定対応)
    const starIds = params.getAll('starId');
    const starNames = params.getAll('starName');
    const starRas = params.getAll('starRa');
    const starDecs = params.getAll('starDec');
    const starColors = params.getAll('starColor');
    const starIsDasheds = params.getAll('starIsDashed');
    if (starIds.length > 0) {
        // URLに含まれるMy天体を復元
        let customIdx = 0;
        starIds.forEach(sid => {
            // 既定天体かどうかチェック
            const existing = appState.bodies.find(b => b.id === sid && !b.isCustom);
            if (existing) {
                existing.visible = true;
            } else if (customIdx < starNames.length) {
                // My天体としてURLから復元
                const ra = parseFloat(starRas[customIdx]);
                const dec = parseFloat(starDecs[customIdx]);
                const name = starNames[customIdx];
                const color = starColors[customIdx] || '#DDA0DD';
                const isDashed = starIsDasheds[customIdx] === '1';
                if (!isNaN(ra) && !isNaN(dec) && name) {
                    // 同じ赤経赤緯の既存My天体があるか検索
                    const sameRaDec = appState.myStars.find(s => s.ra === ra && s.dec === dec);
                    if (sameRaDec) {
                        // 既存の同一座標天体を表示ONにする
                        sameRaDec.visible = true;
                    } else {
                        // 新規追加: IDの衝突があれば新しいIDを採番
                        let id = parseInt(sid);
                        if (isNaN(id) || appState.myStars.some(s => s.id === id)) {
                            id = getNextMyStarId();
                        }
                        if (id !== null) {
                            appState.myStars.push({ id, name, ra, dec, visible: true, color, isDashed });
                        }
                    }
                }
                customIdx++;
            }
        });
        // 既定天体のvisible状態を設定
        appState.bodies.forEach(b => {
            if (!b.isCustom) {
                b.visible = starIds.includes(b.id);
            }
        });
        syncMyStarsToBodies();
    }

    // 辻検索パラメータ (mode=tsujisearchの時のみ)
    if (mode === 'tsujisearch') {
        if (params.has('tsujiSearchDays')) { const v = parseInt(params.get('tsujiSearchDays')); if (!isNaN(v)) appState.tsujiSearchDays = v; }
        if (params.has('tsujiAz')) { const v = parseFloat(params.get('tsujiAz')); if (!isNaN(v)) appState.tsujiSearchBaseAz = v; }
        if (params.has('tsujiAlt')) { const v = parseFloat(params.get('tsujiAlt')); if (!isNaN(v)) appState.tsujiSearchBaseAlt = v; }
        if (params.has('tsujiAzOffset')) { const v = parseFloat(params.get('tsujiAzOffset')); if (!isNaN(v)) appState.tsujiSearchOffsetAz = v; }
        if (params.has('tsujiAltOffset')) { const v = parseFloat(params.get('tsujiAltOffset')); if (!isNaN(v)) appState.tsujiSearchOffsetAlt = v; }
        if (params.has('tsujiAzTolerance')) { const v = parseFloat(params.get('tsujiAzTolerance')); if (!isNaN(v)) appState.tsujiSearchToleranceAz = v; }
        if (params.has('tsujiAltTolerance')) { const v = parseFloat(params.get('tsujiAltTolerance')); if (!isNaN(v)) appState.tsujiSearchToleranceAlt = v; }
        if (params.has('tsujiMoonFilter')) { appState.tsujiMoonFilterEnabled = params.get('tsujiMoonFilter') === 'true'; }
        if (params.has('tsujiMoonBase')) { const v = parseFloat(params.get('tsujiMoonBase')); if (!isNaN(v)) appState.tsujiMoonBase = v; }
        if (params.has('tsujiMoonTolerance')) { const v = parseFloat(params.get('tsujiMoonTolerance')); if (!isNaN(v)) appState.tsujiMoonTolerance = v; }
        if (params.has('tsujiAccuracyFilter')) { appState.tsujiAccuracyFilterEnabled = params.get('tsujiAccuracyFilter') === 'true'; }
        if (params.has('tsujiAccDblCircle')) { appState.tsujiAccDblCircle = params.get('tsujiAccDblCircle') === 'true'; }
        if (params.has('tsujiAccCircle')) { appState.tsujiAccCircle = params.get('tsujiAccCircle') === 'true'; }
        if (params.has('tsujiAccTriangle')) { appState.tsujiAccTriangle = params.get('tsujiAccTriangle') === 'true'; }
        if (params.has('tsujiAccDash')) { appState.tsujiAccDash = params.get('tsujiAccDash') === 'true'; }
    }

    // 標高(elev)を再計算: elev = apiElev + height
    appState.start.elev = appState.startApiElev + appState.startHeight;
    appState.end.elev = appState.endApiElev + appState.endHeight;

    // mode=tsujisearchの場合は辻検索を自動実行（UIが準備できた後に）
    if (mode === 'tsujisearch') {
        appState._pendingTsujiSearch = true;
    }
}