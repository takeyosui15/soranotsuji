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
Version 1.11.4 - 2026-02-07: fix: 初期表示を現在日時に修正
Version 1.11.3 - 2026-02-07: fix: 計算不具合等修正
Version 1.11.2 - 2026-02-06: style: 大気差補正Kの文言・表示修正
Version 1.11.1 - 2026-02-05: fix: 設定セクションのUI修正
Version 1.11.0 - 2026-02-05: feat: REFRACTION_K設定機能追加; 各種UI改善
Version 1.10.1 - 2026-02-05: Minor fixes and REFRACTION_K adjustment
Version 1.10.0 - 2026-02-05: Great-circle route line appended on map; Calculation optimization
Version 1.9.1 - 2026-02-05: Style fixes and minor adjustments
Version 1.9.0 - 2026-02-05: Minor feature and apparent altitude appended in popup
Version 1.8.10 - 2026-02-05: Style fixes and timestamp interval adjustment
Version 1.0.0 - 2026-01-29: Initial release
*/

// ============================================================
// 1. 定数定義
// ============================================================

const STORAGE_KEY = 'soranotsuji_app'; // 唯一の保存キー
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzq94EkeZgbWlFb65cb1WQcRrRVi2Qpd_i60NvJWx6BB6Qxpb-30GD7TSzZptpRYxYL/exec"; 
const SYNODIC_MONTH = 29.53058886; // 朔望月 (日数)
const EARTH_RADIUS = 6378137;
const REFRACTION_K = 0.0; // 大気差補正定数: 0.132

const POLARIS_RA = 2.5303;
const POLARIS_DEC = 89.2641; 
const SUBARU_RA = 3.79;
const SUBARU_DEC = 24.12;
const ALNILAM_RA = 5.603;
const ALNILAM_DEC = -1.202;

const DEFAULT_START = { lat: 35.658449, lng: 139.745536, elev: 150.0 };
const DEFAULT_END = { lat: 35.360776, lng: 138.727299, elev: 3774.9 };

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
    // 現在表示中の場所
    start: { ...DEFAULT_START },
    end:   { ...DEFAULT_END },
    
    // 登録された場所 (Homeボタンで呼び出す場所)
    homeStart: null,
    homeEnd:   null,

    // 日時
    currentDate: new Date(),
    
    // My天体
    myStar: { ra: ALNILAM_RA, dec: ALNILAM_DEC },

    // 大気差補正係数 (初期値は定数から)
    refractionK: REFRACTION_K,

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
        { id: 'Subaru',  name: 'すばる', color: '#0000FF', isDashed: false, visible: false },
        { id: 'MyStar',  name: 'My天体', color: '#DDA0DD', isDashed: false, visible: false, isCustom: true }
    ],

    // 機能フラグ
    isMoving: false,
    isDPActive: true,
    isElevationActive: false,

    // 内部制御用 (保存不要)
    timers: { move: null, fetch: null },
    elevationData: { points: [], index: 0 },
    riseSetCache: {}
};

let visitorData = null; 
let editingBodyId = null;
let currentRiseSetData = {}; 


// ============================================================
// 3. 初期化プロセス
// ============================================================

window.onload = function() {
    console.log("宙の辻: 起動 (V1.11.4)");

    // 1. 古いデータを削除 (Clean up)
    cleanupOldStorage();

    // 2. 設定読み込み
    loadAppState();

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

    document.getElementById('input-mystar-radec').value = `${appState.myStar.ra},${appState.myStar.dec}`;
    reflectMyStarUI();

    // リストを生成
    renderCelestialList();
    
    // ツールチップ設定
    setupTooltips();

    // 起動時は「現在日時」にセット
    setNow();

    // リサイズ対応
    window.addEventListener('resize', () => {
        if(appState.isElevationActive) {
            drawProfileGraph();
        }
    });

    setTimeout(initVisitorCounter, 1000);
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
        attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>',
        maxZoom: 18
    });
    const gsiPhoto = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/ort/{z}/{x}/{y}.jpg', {
        attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>',
        maxZoom: 18
    });
    const gsiPale = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>',
        maxZoom: 18
    });
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
    });

    map = L.map('map', {
        center: [appState.start.lat, appState.start.lng],
        zoom: 9, 
        layers: [gsiStd], 
        zoomControl: false
    });
    map.attributionControl.addAttribution('標高・住所: &copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>,地名: &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>');

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
        tInput.value = `${('00' + h).slice(-2)}:${('00' + m).slice(-2)}`;
        syncStateFromUI();
        updateAll();
    });

    tInput.addEventListener('input', () => {
        uncheckTimeShortcuts();
        if (!tInput.value) return;
        const [h, m] = tInput.value.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) {
            tSlider.value = h * 60 + m;
            syncStateFromUI();
            updateAll();
        }
    });

    // 月齢入力 (30以上で0にリセット)
    document.getElementById('moon-age-input').addEventListener('change', (e) => {
        let targetAge = parseFloat(e.target.value);
        if (isNaN(targetAge)) return;
        
        // 30以上になったら0に戻す (サイクルさせる)
        if (targetAge >= 30) {
            targetAge = 0;
            e.target.value = 0;
        }
        
        searchMoonAge(targetAge);
    });

    // ボタン類
    document.getElementById('btn-now').onclick = setNow;
    document.getElementById('btn-move').onclick = toggleMove;
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

    // 登録ボタン
    document.getElementById('btn-reg-start').onclick = () => registerLocation('start');
    document.getElementById('btn-reg-end').onclick = () => registerLocation('end');

    // 座標入力 (changeイベント)
    const iStart = document.getElementById('input-start-latlng');
    const iEnd = document.getElementById('input-end-latlng');
    iStart.addEventListener('change', () => handleLocationInput(iStart.value, true));
    iEnd.addEventListener('change', () => handleLocationInput(iEnd.value, false));

    // 標高入力
    document.getElementById('input-start-elev').addEventListener('change', (e) => {
        appState.start.elev = parseFloat(e.target.value) || 0;
        saveAppState();
        updateAll(); 
    });
    document.getElementById('input-end-elev').addEventListener('change', (e) => {
        appState.end.elev = parseFloat(e.target.value) || 0;
        saveAppState();
        updateAll();
    });

    // My天体登録
    document.getElementById('btn-mystar-reg').onclick = registerMyStar;
    document.getElementById('chk-mystar').addEventListener('change', (e) => toggleVisibility('MyStar', e.target.checked));
    
    // 大気差補正設定
    document.getElementById('btn-reg-settings').onclick = registerSettings;
    // 起動時の値を入力欄に表示 (設定されている場合)
    if (appState.refractionK !== undefined) {
        document.getElementById('input-refraction-k').value = appState.refractionK;
    }
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
        bodies: appState.bodies,
        myStar: appState.myStar,
        refractionK: appState.refractionK,
        isDPActive: appState.isDPActive,
        lastVisitDate: appState.lastVisitDate
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
            if(saved.myStar) appState.myStar = saved.myStar;
            if(saved.refractionK !== undefined) appState.refractionK = saved.refractionK;
            if(saved.isDPActive !== undefined) appState.isDPActive = saved.isDPActive;
            if(saved.lastVisitDate) appState.lastVisitDate = saved.lastVisitDate;
            
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
            appState.start = { ...DEFAULT_START };
        } else {
            appState.end = { ...DEFAULT_END };
        }
        
        saveAppState(); // 変更を保存
        updateAll();    // ★画面(入力欄・マーカー)を更新
        
        // ★親切機能: 地図もその場所へ移動させる
        const target = (type === 'start') ? appState.start : appState.end;
        map.setView([target.lat, target.lng], 10);

        btn.classList.remove('active');
        btn.title = `${type==='start'?'観測点':'目的点'}の初期値を登録`;
        
        alert('初期値をリセットし、デフォルトに戻しました');
        return;
    }

    // 2. 呼び出し (登録データがある場合)
    if (hasRegistered) {
        // 登録データを現在地に適用
        if(type === 'start') {
            appState.start = { ...appState.homeStart };
            document.getElementById('radio-start').checked = true;
        } else {
            appState.end = { ...appState.homeEnd };
            document.getElementById('radio-end').checked = true;
        }
        
        saveAppState(); // 移動した状態を保存
        updateAll();
        
        // ★修正: fitBounds(全体表示) ではなく setView(その場所に移動)
        // これにより、観測点を呼び出したときに目的点まで引いてしまうのを防ぐ
        const target = (type === 'start') ? appState.start : appState.end;
        map.setView([target.lat, target.lng], 10);
        
        alert('登録済みの場所を呼び出しました');
    }

    // 3. 登録 (登録データがない場合)
    else {
        // 現在地を登録データとして保存
        if(type === 'start') {
            appState.homeStart = { ...appState.start };
        } else {
            appState.homeEnd = { ...appState.end };
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
        appState.currentDate = new Date(`${dStr}T${tStr}:00`);
    }
}

function syncUIFromState() {
    const d = appState.currentDate;
    const yyyy = d.getFullYear();
    const mm = ('00'+(d.getMonth()+1)).slice(-2);
    const dd = ('00'+d.getDate()).slice(-2);
    const h = ('00'+d.getHours()).slice(-2);
    const m = ('00'+d.getMinutes()).slice(-2);
    
    document.getElementById('date-input').value = `${yyyy}-${mm}-${dd}`;
    document.getElementById('time-input').value = `${h}:${m}`;
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
    
}

function updateLocationDisplay() {
    locationLayer.clearLayers();

    const fmt = (pos) => `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
    
    if(document.activeElement.id !== 'input-start-latlng') {
        document.getElementById('input-start-latlng').value = fmt(appState.start);
    }
    if(document.activeElement.id !== 'input-end-latlng') {
        document.getElementById('input-end-latlng').value = fmt(appState.end);
    }
    
    document.getElementById('input-start-elev').value = appState.start.elev;
    document.getElementById('input-end-elev').value = appState.end.elev;

    const sPt = L.latLng(appState.start.lat, appState.start.lng);
    const ePt = L.latLng(appState.end.lat, appState.end.lng);
    
    // マーカーの設置
    L.marker(sPt).addTo(locationLayer).bindPopup(createLocationPopup("観測点", appState.start, appState.end));
    L.marker(ePt).addTo(locationLayer).bindPopup(createLocationPopup("目的点", appState.end, appState.start));
    
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
        
        if (body.id === 'Polaris') {
            ra = POLARIS_RA;
            dec = POLARIS_DEC;
        } else if (body.id === 'Subaru') {
            ra = SUBARU_RA;
            dec = SUBARU_DEC;
        } else if (body.id === 'MyStar') {
            ra = appState.myStar.ra;
            dec = appState.myStar.dec;
        } else {
            const eq = Astronomy.Equator(body.id, obsDate, observer, true, true);
            ra = eq.ra;
            dec = eq.dec;
        }

        const hor = Astronomy.Horizon(obsDate, observer, ra, dec, "normal");

        let riseStr = "--:--";
        let setStr = "--:--";
        
        if (['Polaris', 'Subaru', 'MyStar'].includes(body.id)) {
            const times = searchStarRiseSet(ra, dec, observer, startOfDay);
            riseStr = times.rise;
            setStr = times.set;
        } else {
            try {
                const rise = Astronomy.SearchRiseSet(body.id, observer, +1, startOfDay, 2);
                const set  = Astronomy.SearchRiseSet(body.id, observer, -1, startOfDay, 2);
                riseStr = rise ? formatTime(rise.date, startOfDay) : "--:--";
                setStr = set ? formatTime(set.date, startOfDay) : "--:--";
            } catch(e){}
        }
        
        if (riseStr === "--:--" && setStr === "--:--" && hor.altitude > 0) {
            riseStr = "00:00";
            setStr = "00:00"; 
        }

        const dataEl = document.getElementById(`data-${body.id}`);
        if (dataEl) {
            dataEl.innerText = `出 ${riseStr} / 入 ${setStr} / 方位 ${hor.azimuth.toFixed(0)}° / 高度 ${hor.altitude.toFixed(0)}°`;
        }

        if (body.visible) {
            drawDirectionLine(appState.start.lat, appState.start.lng, hor.azimuth, hor.altitude, body);
        }
    });

    updateShortcutsData(startOfDay, observer);
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
    });
}


// ============================================================
// 7. ロジック・ヘルパー
// ============================================================

async function handleLocationInput(val, isStart) {
    if(!val) return;
    
    let coords = parseInput(val); 
    if (!coords) {
        const results = await searchLocation(val); 
        if(results && results.length > 0) {
            coords = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
        } else {
            console.log("Location not found:", val); 
            return; 
        }
    }

    if(coords) {
        const elev = await getElevation(coords.lat, coords.lng);
        const validElev = (elev !== null) ? elev : 0;
        
        if(isStart) {
            appState.start = { ...coords, elev: validElev };
            document.getElementById('radio-start').checked = true;
        } else {
            appState.end = { ...coords, elev: validElev };
            document.getElementById('radio-end').checked = true;
        }
        
        const inputId = isStart ? 'input-start-latlng' : 'input-end-latlng';
        document.getElementById(inputId).blur(); 
        
        map.setView(coords, 10);
        saveAppState(); 
        updateAll();
    }
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


// ------------------------------------------------------
// 操作系ハンドラ
// ------------------------------------------------------

function setSunrise() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    try {
        const obs = new Astronomy.Observer(appState.start.lat, appState.start.lng, appState.start.elev);
        const sr = Astronomy.SearchRiseSet('Sun', obs, +1, startOfDay, 1);
        if(sr) {
            appState.currentDate = sr.date;
        } else {
            appState.currentDate = now;
        }
    } catch(e) {
        appState.currentDate = now;
    }
    document.getElementById('jump-sunrise').checked = true;
    syncUIFromState();
    updateAll();
}

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

// 月齢検索ロジック(*** 改良の余地あり ***)
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
    // ただし、大幅に減った場合 (例: 29->0) は「次のサイクル(新月)」への以降なので未来を探す。
    // 閾値を「半月分(約15日)」として判定します。
    if (diff < 0 && diff > -15) {
        // 例: 15 -> 14 (差は -1) : 過去に戻る
        // 検索開始位置を「約1ヶ月前」にずらすことで、直近の過去を見つける
        searchStartDate = new Date(appState.currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    else if (diff > 15) {
        // 例: 1 -> 29 (差は +28) : 誤って過去の月末に行きたい場合などを考慮し、ここも過去検索にしておくと自然
        searchStartDate = new Date(appState.currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // 3. 検索実行
    const targetPhase = (targetAge / SYNODIC_MONTH) * 360.0;
    
    // 検索期間を少し広めに(45日)とって、確実にヒットさせる
    const res = Astronomy.SearchMoonPhase(targetPhase, searchStartDate, 45);
    
    if(res && res.date) { 
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

function toggleMove() {
    const btn = document.getElementById('btn-move');
    appState.isMoving = !appState.isMoving;
    
    if (appState.isMoving) { 
        btn.classList.add('active'); 
        appState.timers.move = setInterval(() => addDay(1), 1000); 
    } else { 
        btn.classList.remove('active'); 
        clearInterval(appState.timers.move); 
    }
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
            if(elev !== null) appState.start.elev = elev;
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
        
        if (['Polaris', 'Subaru', 'MyStar'].includes(body.id)) {
            if(body.id === 'Polaris') {
                r = POLARIS_RA;
                d = POLARIS_DEC;
            } else if(body.id === 'Subaru') {
                r = SUBARU_RA;
                d = SUBARU_DEC;
            } else {
                r = appState.myStar.ra;
                d = appState.myStar.dec;
            }
        } else {
            const eq = Astronomy.Equator(body.id, time, observer, true, true);
            r = eq.ra;
            d = eq.dec;
        }
        
        const hor = Astronomy.Horizon(time, observer, r, d, "normal");
        
        if (hor.altitude > limit) {
            const dist = calculateDistanceForAltitudes(hor.altitude, valElev, appState.end.elev);
            if (dist > 0 && dist <= 350000) {
                path.push({ dist: dist, az: hor.azimuth, time: time });
            }
        }
    }
    return path;
}

function drawDPPath(points, color, dashArray, withMarkers) {
    if (points.length === 0) return;
    const targetPt = appState.end;
    let segments = [];
    let currentSegment = [];
    
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const obsAz = (p.az + 180) % 360; 
        const dest = getDestinationVincenty(targetPt.lat, targetPt.lng, obsAz, p.dist);
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
            
            const timeStr = formatTime(p.time);
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

/**
 * 2つの高度(観測者・ターゲット)と地球の丸みを考慮して、
 * 指定された見かけの高度角(alt)で見える「地上の水平距離」を逆算する
 * * 原理: 地球中心(C)-観測者(O)-ターゲット(T) の3点で三角形を作る
 * * 1. 既知の辺: r1(地球+観測者), r2(地球+ターゲット)
 * 2. 既知の角: θobs = 90° + 高度角(alt)
 * 3. 正弦定理 (r2 / sin(θobs) = r1 / sin(θtarget)) を使って、
 * ターゲット側の内角(θtarget)を導き出す
 * 4. 三角形の内角の和(180°)から、地球中心角(γ)を決定する: γ = 180° - θobs - θtarget
 * 5. 弧の長さ L = R * γ で地上の距離を算出する
 * * @param {number} celestialAltDeg 見かけの高度角 (度)
 * @param {number} hObs 観測者の標高 (m)
 * @param {number} hTarget ターゲットの標高 (m)
 */
function calculateDistanceForAltitudes(celestialAltDeg, hObs, hTarget) {
    // 地球半径 (定数より取得)
    const R = EARTH_RADIUS;
    
    // 気差係数 (設定値を考慮。通常0だが、厳密な測量計算用に残す)
    // 厳密な光路計算において、気差は「地球の半径が少し大きく見える」としてモデル化されることが多いです
    // R_eff = R / (1 - k)
    const k = (appState.refractionK !== undefined) ? appState.refractionK : REFRACTION_K;
    const Reff = R / (1 - k);

    // 地球中心からの距離
    const r1 = Reff + hObs;
    const r2 = Reff + hTarget;

    // 観測点での天頂角 (90度 - 高度角)
    // 天体高度 celestailAltDeg は地平線からの角度。
    // 三角形の計算では、鉛直方向(地球中心方向)からの角度を使うと計算しやすい。
    // 観測点における「地球中心→観測点」のベクトルと「視線」のなす角は 90 + alt
    const altRad = celestialAltDeg * Math.PI / 180;
    const thetaObs = (Math.PI / 2) + altRad;

    // --- 正弦定理 (Law of Sines) ---
    // r2 / sin(thetaObs) = r1 / sin(thetaTarget)
    // sin(thetaTarget) = r1 * sin(thetaObs) / r2
    
    const sinThetaTarget = (r1 * Math.sin(thetaObs)) / r2;

    // sinが1を超える＝ターゲットが高すぎて/遠すぎて物理的にその角度では見えない（地平線の下など）
    if (sinThetaTarget > 1 || sinThetaTarget < -1) {
        return -1; 
    }

    // ターゲット地点での角度 (arcsin)
    // ただし、鈍角・鋭角の判定が必要だが、視線が上向きか下向きかで幾何学的に定まる。
    // ここでは単純化して、三角形の内角の和 (180度 = PI) から中心角 gamma を求めるアプローチをとる。
    
    const thetaTarget = Math.asin(sinThetaTarget);

    // 三角形の内角の和は π
    // 中心角 gamma = π - thetaObs - thetaTarget
    // ※注意: asinは -PI/2 ~ PI/2 を返すが、三角形の内角としてはこれで整合する範囲
    
    let gamma = Math.PI - thetaObs - thetaTarget;

    // gammaが負になるケース（計算上のエラーや、同一点に近い場合）を排除
    if (gamma < 0) {
        // 特別なケース: altが90度に近い、またはr1, r2の位置関係によるもの
        // 厳密にはここに来る前にフィルタリングされるべきだが、安全策として
        return -1;
    }

    // --- 距離の算出 ---
    // ここで求めた gamma は「光の経路（または視線）」における中心角。
    // 地図上にプロットするために必要なのは「実際の地球表面(標高0m)での移動距離」。
    // したがって、元の地球半径 R を掛ける。（Reffではない）
    
    const surfaceDist = R * gamma;

    return surfaceDist;
}

function getDestinationVincenty(lat1, lon1, az, dist) {
    const a = EARTH_RADIUS;
    const f = 1 / 298.257223563;
    const b = a * (1 - f); 
    
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;
    
    const alpha1 = az * toRad;
    const sinAlpha1 = Math.sin(alpha1);
    const cosAlpha1 = Math.cos(alpha1);
    
    const tanU1 = (1 - f) * Math.tan(lat1 * toRad);
    const cosU1 = 1 / Math.sqrt((1 + tanU1 * tanU1));
    const sinU1 = tanU1 * cosU1;
    
    const sigma1 = Math.atan2(tanU1, cosAlpha1);
    const sinAlpha = cosU1 * sinAlpha1;
    const cosSqAlpha = 1 - sinAlpha * sinAlpha;
    const uSq = cosSqAlpha * (a * a - b * b) / (b * b);
    
    const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));

    let sigma = dist / (b * A);
    let sigmaP = 2 * Math.PI;
    let cos2SigmaM;
    let sinSigma;
    let cosSigma;
    let deltaSigma;
    let iterLimit = 100;
    
    do {
        cos2SigmaM = Math.cos(2 * sigma1 + sigma);
        sinSigma = Math.sin(sigma);
        cosSigma = Math.cos(sigma);
        deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) - B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
        sigmaP = sigma;
        sigma = dist / (b * A) + deltaSigma;
    } while (Math.abs(sigma - sigmaP) > 1e-12 && --iterLimit > 0);

    if (iterLimit === 0) return { lat: lat1, lng: lon1 };

    const tmp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1;
    const lat2 = Math.atan2(sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1, (1 - f) * Math.sqrt(sinAlpha * sinAlpha + tmp * tmp));
    const lambda = Math.atan2(sinSigma * sinAlpha1, cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1);
    const C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    const L = lambda - (1 - C) * f * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
    
    return { lat: lat2 * toDeg, lng: lon1 + L * toDeg };
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

// ★追加: 2点間の大圏コース(最短経路)上の座標配列を返す (1km間隔)
function calculateGreatCirclePoints(start, end) {
    const points = [];
    const R = EARTH_RADIUS;
    
    // ラジアン変換
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;
    const phi1 = start.lat * toRad;
    const lam1 = start.lng * toRad;
    const phi2 = end.lat * toRad;
    const lam2 = end.lng * toRad;

    // 球面上の距離(中心角 delta)を算出
    const dLam = lam2 - lam1;
    const cosDelta = Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(dLam);
    const delta = Math.acos(Math.max(-1, Math.min(1, cosDelta))); // 数値誤差対策

    // 距離(m)
    const dist = R * delta;
    
    // ステップ数: 1km(1000m)おき。最低でも始点・終点の2点は確保
    const stepMeters = 1000; 
    const steps = Math.max(1, Math.ceil(dist / stepMeters));

    // 球面線形補間 (Slerp) で各点を計算
    for (let i = 0; i <= steps; i++) {
        const f = i / steps; // 進行割合 (0.0 ～ 1.0)
        
        let A, B;
        const sinDelta = Math.sin(delta);
        
        if (sinDelta > 1e-6) {
            A = Math.sin((1 - f) * delta) / sinDelta;
            B = Math.sin(f * delta) / sinDelta;
        } else {
            A = 1 - f;
            B = f;
        }

        const x = A * Math.cos(phi1) * Math.cos(lam1) + B * Math.cos(phi2) * Math.cos(lam2);
        const y = A * Math.cos(phi1) * Math.sin(lam1) + B * Math.cos(phi2) * Math.sin(lam2);
        const z = A * Math.sin(phi1) + B * Math.sin(phi2);

        const phi = Math.atan2(z, Math.sqrt(x*x + y*y));
        const lam = Math.atan2(y, x);

        points.push([phi * toDeg, lam * toDeg]);
    }
    
    return points;
}

async function onMapClick(e) {
    const isStart = document.getElementById('radio-start').checked;
    const elev = await getElevation(e.latlng.lat, e.latlng.lng);
    const val = (elev !== null) ? elev : 0;
    
    if (isStart) {
        appState.start = { lat: e.latlng.lat, lng: e.latlng.lng, elev: val };
    } else {
        appState.end = { lat: e.latlng.lat, lng: e.latlng.lng, elev: val };
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

async function searchLocation(query) {
    if (!query) return null;

    // 前後の空白を削除
    const q = query.trim();

    // ★修正: 数値のみ（緯度だけ入力など）の場合は検索しない
    // これにより、郵便番号やルート番号として解釈されて海外に飛ぶのを防ぐ
    // 正規表現: 先頭から末尾まで「数字」と「ドット(.)」と「マイナス(-)」だけで構成されているか
    if (/^[\d\.\-\s]+$/.test(q)) {
        console.warn("数値のみの入力のため、地名検索をスキップしました:", q);
        return null; // 何もせず終了
    }
    try {
        const urlOsm = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
        const resOsm = await fetch(urlOsm);
        const dataOsm = await resOsm.json();
        if (dataOsm && dataOsm.length > 0) return dataOsm;

        const urlGsi = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`;
        const resGsi = await fetch(urlGsi);
        const dataGsi = await resGsi.json();
        if (!dataGsi || dataGsi.length === 0) return [];

        return dataGsi.map(item => ({
            lat: item.geometry.coordinates[1],
            lon: item.geometry.coordinates[0],
            display_name: item.properties.title
        }));
    } catch(e) {
        console.error(e);
        return null;
    }
}

async function getElevation(lat, lng) {
    try {
        const url = `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lng}&lat=${lat}&outtype=JSON`;
        const res = await fetch(url);
        const data = await res.json();
        return (data && data.elevation !== "-----") ? data.elevation : 0;
    } catch(e) {
        console.error(e);
        return null;
    }
}

function createLocationPopup(title, pos, target) {
    const az = calculateBearing(pos.lat, pos.lng, target.lat, target.lng);
    const dist = L.latLng(pos.lat, pos.lng).distanceTo(L.latLng(target.lat, target.lng));
    
    // ★追加: 視高度を計算
    const alt = calculateApparentAltitude(dist, pos.elev, target.elev);

    return `
        <b>${title}</b><br>
        緯度: ${pos.lat.toFixed(5)}°<br>
        経度: ${pos.lng.toFixed(5)}°<br>
        標高: ${pos.elev} m<br>
        相手距離: ${(dist/1000).toFixed(2)} km<br>
        相手方位: ${az.toFixed(1)}°<br>
        相手高度: ${alt.toFixed(2)}°
    `;
}

// ★追加: 2点間の距離と標高差から視高度(角度)を計算する関数
function calculateApparentAltitude(dist, hObs, hTarget) {
    if (dist <= 0) return 0; // 距離0の場合は0度とする
    
    const k = (appState.refractionK !== undefined) ? appState.refractionK : REFRACTION_K;

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

        currentRiseSetData = {
            sunrise: sr?.date,
            sunset: ss?.date,
            moonrise: mr?.date,
            moonset: ms?.date
        };
    } catch(e) {}
}

function updateMoonInfo(date) {
    const phase = Astronomy.MoonPhase(date);
    const age = (phase / 360) * SYNODIC_MONTH;
    if (document.activeElement.id !== 'moon-age-input') {
        document.getElementById('moon-age-input').value = age.toFixed(1);
    }
    const icons = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
    document.getElementById('moon-icon').innerText = icons[Math.round(phase / 45) % 8];
}

function formatTime(date, baseDate) {
    if (!date) return "--:--";
    
    let h = date.getHours();
    const m = date.getMinutes();
    
    if (baseDate) {
        // 24時間以上経過しているかチェック (86400000ms = 24h)
        if (date.getTime() - baseDate.getTime() >= 86400000) {
            h += 24;
        }
    }
    
    return `${('00'+h).slice(-2)}:${('00'+m).slice(-2)}`;
}

function searchStarRiseSet(ra, dec, observer, startOfDay) {
    let rise = null;
    let set = null;
    let prevAlt = null;
    const start = startOfDay.getTime();
    
    for (let m = 0; m <= 1440; m += 1) { 
        const time = new Date(start + m * 60000);
        
        const hor = Astronomy.Horizon(time, observer, ra, dec, "normal"); 
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
        rise: rise ? formatTime(rise) : "--:--",
        set: set ? formatTime(set) : "--:--"
    };
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

// MyStar
function registerMyStar() {
    const val = document.getElementById('input-mystar-radec').value.trim();
    if(!val) { 
        appState.myStar = { ra: ALNILAM_RA, dec: ALNILAM_DEC }; 
    } else {
        const parts = val.split(',');
        if(parts.length === 2) { 
            appState.myStar = { ra: parseFloat(parts[0]), dec: parseFloat(parts[1]) }; 
        } else {
            return alert('形式エラー');
        }
    }
    saveAppState();
    updateAll();
}

function reflectMyStarUI() {
    const myBody = appState.bodies.find(b => b.id === 'MyStar');
    if(myBody) {
        const ind = document.getElementById('style-MyStar');
        ind.style.color = myBody.color;
        ind.className = `style-indicator ${myBody.isDashed ? 'dashed' : 'solid'}`;
        document.getElementById('chk-mystar').checked = myBody.visible;
    }
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
            <input type="checkbox" class="body-checkbox" ${body.visible ? 'checked' : ''} 
                   onchange="toggleVisibility('${body.id}', this.checked)">
            <div class="style-indicator ${dashClass}" style="color: ${body.color};"
                 onclick="openPalette('${body.id}')"></div>
            <div class="body-info">
                <div class="body-header"><span class="body-name">${body.name}</span></div>
                <span id="data-${body.id}" class="body-detail-text">--:--</span>
            </div>`;
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
        if(editingBodyId === 'MyStar') reflectMyStarUI();
        closePalette();
        saveAppState();
        renderCelestialList();
        updateAll();
    }
}

function applyLineStyle(type) {
    const b = appState.bodies.find(x => x.id === editingBodyId);
    b.isDashed = (type === 'dashed');
    if(editingBodyId === 'MyStar') reflectMyStarUI();
    closePalette();
    saveAppState();
    renderCelestialList();
    updateAll();
}

// 設定登録 (大気差係数など)
function registerSettings() {
    const input = document.getElementById('input-refraction-k');
    const val = input.value.trim();
    
    // 空欄の場合はリセット
    if (val === '') {
        appState.refractionK = REFRACTION_K; // 定数に戻す
        input.value = REFRACTION_K;
        alert(`大気差補正係数を初期値 (${REFRACTION_K}) にリセットしました`);
    } else {
        const k = parseFloat(val);
        if (isNaN(k) || k < 0) {
            return alert('有効な数値を入力してください (0以上)');
        }
        appState.refractionK = k;
        alert(`大気差補正係数を ${k} に設定しました`);
    }
    
    saveAppState();
    updateAll(); // 再計算して描画更新
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
        if(appState.timers.fetch) clearTimeout(appState.timers.fetch);
        document.getElementById('progress-overlay').classList.add('hidden');
    }
}

function startElevationFetch() {
    appState.elevationData.points = [];
    const s = L.latLng(appState.start.lat, appState.start.lng);
    const e = L.latLng(appState.end.lat, appState.end.lng);
    const dist = s.distanceTo(e);
    const steps = Math.floor(dist / 100);
    
    for(let i=0; i<=steps; i++) {
        const r = i/steps;
        appState.elevationData.points.push({
            lat: s.lat + (e.lat - s.lat)*r,
            lng: s.lng + (e.lng - s.lng)*r,
            dist: i*0.1,
            elev: null,
            fetched: false
        });
    }
    appState.elevationData.index = 0;
    document.getElementById('progress-overlay').classList.remove('hidden');
    updateProgress(0, 0, appState.elevationData.points.length);
    processFetchQueue();
}

function processFetchQueue() {
    if(!appState.isElevationActive || appState.elevationData.index >= appState.elevationData.points.length) {
        return document.getElementById('progress-overlay').classList.add('hidden');
    }
    
    const pt = appState.elevationData.points[appState.elevationData.index];
    getElevation(pt.lat, pt.lng).then(ev => {
        pt.elev = (ev !== null) ? ev : 0;
        pt.fetched = true;
        appState.elevationData.index++;
        updateProgress(Math.floor((appState.elevationData.index/appState.elevationData.points.length)*100), appState.elevationData.index, appState.elevationData.points.length);
        drawProfileGraph();
        if(appState.isElevationActive) {
            appState.timers.fetch = setTimeout(processFetchQueue, 3000);
        }
    });
}

function updateProgress(pct, cur, tot) {
    document.getElementById('progress-bar').style.width = pct + "%";
    const rem = (tot - cur) * 3;
    const h = Math.floor(rem/3600);
    const m = Math.floor((rem%3600)/60);
    const s = rem%60;
    document.getElementById('progress-text').innerText = `${pct}% (残 ${h>0?h+'h ':''}${m>0?m+'m ':''}${s}s)`;
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
    }
}

function initVisitorCounter() {
    const todayStr = new Date().toISOString().slice(0,10);
    // lastVisitDateはappStateで管理
    if (appState.lastVisitDate !== todayStr) {
        appState.lastVisitDate = todayStr;
        saveAppState();
        
        fetch(`${GAS_API_URL}?action=visit`).then(r=>r.json()).then(d => {
            if(!d.error) {
                visitorData = d;
                document.getElementById('cnt-today').innerText = d.today;
                document.getElementById('cnt-yesterday').innerText = d.yesterday;
                document.getElementById('cnt-year').innerText = d.yearTotal;
                document.getElementById('cnt-last').innerText = d.lastYearTotal;
            }
        });
    } else {
        fetch(`${GAS_API_URL}?action=get`).then(r=>r.json()).then(d => {
            if(!d.error) {
                visitorData = d;
                document.getElementById('cnt-today').innerText = d.today;
                document.getElementById('cnt-yesterday').innerText = d.yesterday;
                document.getElementById('cnt-year').innerText = d.yearTotal;
                document.getElementById('cnt-last').innerText = d.lastYearTotal;
            }
        });
    }
}

function showGraph(type) {
    if(!visitorData) return;
    document.getElementById('graph-modal').classList.remove('hidden');
    const cvs = document.getElementById('visitor-canvas');
    const ctx = cvs.getContext('2d');
    const w = cvs.width = cvs.clientWidth;
    const h = cvs.height = 300;
    
    const data = (type==='current') ? visitorData.dailyLog : visitorData.lastYearLog;
    document.getElementById('graph-title').innerText = (type==='current') ? "今年の推移" : "昨年の推移";
    if(!data || data.length===0) {
        ctx.fillStyle = '#333'; // 文字色も指定しておくと丁寧です
        ctx.font = "20px sans-serif";
        ctx.textAlign = "center"; // 中央揃え
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
    ctx.textAlign = "right"; // 右揃え
    ctx.fillText(maxVal, pad-10, pad+10); // 位置調整
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