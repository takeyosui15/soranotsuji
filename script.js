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

Version 1.8.6 - Moon Rise/Set time Fix
*/

// ============================================================
// 1. 定数定義
// ============================================================

const STORAGE_KEY = 'soranotsuji_app'; // 唯一の保存キー
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzq94EkeZgbWlFb65cb1WQcRrRVi2Qpd_i60NvJWx6BB6Qxpb-30GD7TSzZptpRYxYL/exec"; 
const SYNODIC_MONTH = 29.53059; 
const EARTH_RADIUS = 6378137;
const REFRACTION_K = 0;

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
    console.log("宙の辻: 起動 (V1.8.6)");

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
    
    // 起動時は「日の出」にセット
    setSunrise(); 

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

    const shiftD = (d) => addDay(d);
    const shiftM = (m) => addMonth(m);
    const shiftT = (m) => addMinute(m);
    
    document.getElementById('btn-date-prev').onclick = () => shiftD(-1);
    document.getElementById('btn-date-next').onclick = () => shiftD(1);
    document.getElementById('btn-month-prev').onclick = () => shiftM(-1);
    document.getElementById('btn-month-next').onclick = () => shiftM(1);
    document.getElementById('btn-time-prev').onclick = () => shiftT(-1);
    document.getElementById('btn-time-next').onclick = () => shiftT(1);
    document.getElementById('btn-hour-prev').onclick = () => shiftT(-60);
    document.getElementById('btn-hour-next').onclick = () => shiftT(60);
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
        saveAppState(); // 即時保存
        updateAll(); 
    });
    document.getElementById('input-end-elev').addEventListener('change', (e) => {
        appState.end.elev = parseFloat(e.target.value) || 0;
        saveAppState();
        updateAll();
    });

    document.getElementById('btn-mystar-reg').onclick = registerMyStar;
    document.getElementById('chk-mystar').addEventListener('change', (e) => toggleVisibility('MyStar', e.target.checked));
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
        saveAppState();
        
        btn.classList.remove('active');
        btn.title = `${type==='start'?'観測点':'目的点'}の初期値を登録`;
        alert('初期値をリセットしました');
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
    // フォーカス中は値を書き換えない
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
    
    L.marker(sPt).addTo(locationLayer).bindPopup(createLocationPopup("観測点", appState.start, appState.end));
    L.marker(ePt).addTo(locationLayer).bindPopup(createLocationPopup("目的点", appState.end, appState.start));
    
    L.polyline([sPt, ePt], {
        color: 'black',
        weight: 6,
        opacity: 0.8
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
            const eq = Astronomy.Equator(body.id, obsDate, observer, false, true);
            ra = eq.ra;
            dec = eq.dec;
        }

        const hor = Astronomy.Horizon(obsDate, observer, ra, dec, null);

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
    const observer = new Astronomy.Observer(appState.end.lat, appState.end.lng, appState.end.elev);

    appState.bodies.forEach(body => {
        if (!body.visible) return;
        const pPrev = calculateDPPathPoints(datePrev, body, observer);
        const pNext = calculateDPPathPoints(dateNext, body, observer);
        const pCurr = calculateDPPathPoints(baseDate, body, observer);
        
        drawDPPath(pPrev, body.color, '4, 12', false);
        drawDPPath(pNext, body.color, '4, 12', false);
        drawDPPath(pCurr, body.color, '12, 12', true);
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
    uncheckTimeShortcuts();
    const currentPhase = Astronomy.MoonPhase(appState.currentDate);
    const roughTarget = new Date(appState.currentDate.getTime() + dir * SYNODIC_MONTH * 86400000);
    const searchStart = new Date(roughTarget.getTime() - 5 * 86400000);
    const res = Astronomy.SearchMoonPhase(currentPhase, searchStart, 10);
    
    if(res && res.date) {
        appState.currentDate = res.date; 
    } else {
        appState.currentDate = roughTarget;
    }
    syncUIFromState(); 
    updateAll();
}

function searchMoonAge(age) {
    uncheckTimeShortcuts();
    const phase = (age / SYNODIC_MONTH) * 360.0;
    const res = Astronomy.SearchMoonPhase(phase, appState.currentDate, 30);
    
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
    const endPos = computeDestination(lat, lng, azimuth, 5000);
    const opacity = altitude < 0 ? 0.3 : 1.0; 
    const dashArray = body.isDashed ? '10, 10' : null;
    
    L.polyline([[lat, lng], endPos], {
        color: body.color,
        weight: 6,
        opacity: opacity,
        dashArray: dashArray
    }).addTo(linesLayer);
}

function computeDestination(lat, lng, az, km) {
    const rad = (90 - az) * (Math.PI / 180);
    const dLat = (km / 111) * Math.sin(rad);
    const dLng = (km / (111 * Math.cos(lat * Math.PI / 180))) * Math.cos(rad);
    return [lat + dLat, lng + dLng];
}

function calculateDPPathPoints(targetDate, body, observer) {
    const path = [];
    const startOfDay = new Date(targetDate.getTime());
    startOfDay.setHours(0, 0, 0, 0);
    const valElev = appState.start.elev;
    const dip = getHorizonDip(valElev);
    const limit = -(dip + 0.27 + 0.1); 

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
            const eq = Astronomy.Equator(body.id, time, observer, false, true);
            r = eq.ra;
            d = eq.dec;
        }
        
        const hor = Astronomy.Horizon(time, observer, r, d, null);
        
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
        
        if (withMarkers && p.time.getMinutes() % 10 === 0) {
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

function calculateDistanceForAltitudes(celestialAltDeg, hObs, hTarget) {
    const altRad = celestialAltDeg * Math.PI / 180;
    const a = (1 - REFRACTION_K) / (2 * EARTH_RADIUS);
    const b = Math.tan(altRad);
    const c = -(hTarget - hObs);
    const disc = b * b - 4 * a * c;
    if (disc < 0) return -1; 
    return (-b + Math.sqrt(disc)) / (2 * a);
}

function getDestinationVincenty(lat1, lon1, az, dist) {
    const a = 6378137;
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
    return `
        <b>${title}</b><br>
        緯度: ${pos.lat.toFixed(5)}<br>
        経度: ${pos.lng.toFixed(5)}<br>
        標高: ${pos.elev} m<br>
        相手まで: ${(dist/1000).toFixed(2)} km<br>
        方位: ${az.toFixed(1)}°
    `;
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
    
    for (let m = 0; m <= 1440; m += 10) {
        const time = new Date(start + m * 60000);
        const hor = Astronomy.Horizon(time, observer, ra, dec, null);
        const alt = hor.altitude;
        if (prevAlt !== null) {
            if (prevAlt < 0 && alt >= 0) {
                rise = getCrossingTime(start + (m-10)*60000, start + m*60000, prevAlt, alt);
            } else if (prevAlt >= 0 && alt < 0) {
                set = getCrossingTime(start + (m-10)*60000, start + m*60000, prevAlt, alt);
            }
        }
        prevAlt = alt;
    }
    return {
        rise: rise ? formatTime(rise) : "--:--",
        set: set ? formatTime(set) : "--:--"
    };
}

function getCrossingTime(t1, t2, alt1, alt2) {
    return new Date(t1 + (t2 - t1) * ((0 - alt1) / (alt2 - alt1)));
}

function getHorizonDip(elev) {
    if (!elev || elev <= 0) return 0;
    const val = EARTH_RADIUS / (EARTH_RADIUS + elev);
    return (val >= 1) ? 0 : Math.acos(val) * (180 / Math.PI);
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
    
    const data = visitorData.dailyLog;
    document.getElementById('graph-title').innerText = (type==='current') ? "今年の推移" : "昨年の推移";
    if(type!=='current' || data.length===0) {
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
        ctx.fillRect(x-2, y-2, 4, 4);
    });
    ctx.stroke();
    
    ctx.fillStyle='#333';
    ctx.fillText(maxVal, pad-20, pad+10);
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