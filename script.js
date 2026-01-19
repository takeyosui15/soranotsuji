/*
宙の辻 - Sora no Tsuji
Copyright (c) 2026 Sora no Tsuji Project
Released under the MIT License.
*/

// --- 1. グローバル変数 ---
let map; 
let linesLayer; 

const POLARIS_RA = 2.5303; 
const POLARIS_DEC = 89.2641; 

const COLOR_MAP = [
    { name: '桃', code: '#FFC0CB' }, { name: '橙', code: '#FFA500' },
    { name: '黄', code: '#FFFF00' }, { name: '黄緑', code: '#ADFF2F' },
    { name: '緑', code: '#008000' }, { name: '青', code: '#0000FF' },
    { name: '藍', code: '#4B0082' }, { name: '紫', code: '#800080' },
    { name: '茶', code: '#A52A2A' }, { name: '黒', code: '#000000' }
];

let bodies = [
    { id: 'Sun',     name: '太陽',   color: '#FFA500', isDashed: false, visible: true },
    { id: 'Moon',    name: '月',     color: '#FFFF00', isDashed: false, visible: true },
    { id: 'Mercury', name: '水星',   color: '#0000FF', isDashed: true,  visible: false },
    { id: 'Venus',   name: '金星',   color: '#FFFF00', isDashed: false, visible: true },
    { id: 'Mars',    name: '火星',   color: '#FF0000', isDashed: false, visible: true },
    { id: 'Jupiter', name: '木星',   color: '#A52A2A', isDashed: false, visible: false },
    { id: 'Saturn',  name: '土星',   color: '#ADFF2F', isDashed: false, visible: false },
    { id: 'Uranus',  name: '天王星', color: '#0000FF', isDashed: true,  visible: false },
    { id: 'Neptune', name: '海王星', color: '#4B0082', isDashed: true,  visible: false },
    { id: 'Pluto',   name: '冥王星', color: '#800080', isDashed: true,  visible: false },
    { id: 'Polaris', name: '北極星', color: '#000000', isDashed: true,  visible: true }
];

let editingBodyId = null;
let currentRiseSetData = {};

// --- 2. 起動処理 ---

window.onload = function() {
    console.log("宙の辻: 起動");

    // 地図初期化
    const mapElement = document.getElementById('map');
    if (mapElement) {
        map = L.map('map').setView([35.681236, 139.767125], 6);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map);
        linesLayer = L.layerGroup().addTo(map);
        
        // 地図操作終了時に再計算
        map.on('moveend', updateCalculation);
    }

    // UI初期化
    const now = new Date();
    const dateInput = document.getElementById('date-input');
    const timeSlider = document.getElementById('time-slider');
    
    if (dateInput && timeSlider) {
        const yyyy = now.getFullYear();
        const mm = ('00' + (now.getMonth() + 1)).slice(-2);
        const dd = ('00' + now.getDate()).slice(-2);
        dateInput.value = `${yyyy}-${mm}-${dd}`;
        
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        timeSlider.value = currentMinutes;
    }

    if (dateInput) dateInput.addEventListener('change', updateCalculation);
    if (timeSlider) timeSlider.addEventListener('input', updateCalculation);
    
    document.querySelectorAll('input[name="time-jump"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if(e.target.checked) jumpToEvent(e.target.value);
        });
    });

    renderCelestialList();
    
    // 初期描画（地図の準備を少し待つ）
    setTimeout(() => {
        if(map) map.invalidateSize();
        updateCalculation();
    }, 500);
};


// --- 3. 計算ロジック ---

function updateCalculation() {
    if (!map || !linesLayer) return;

    const dInput = document.getElementById('date-input');
    const tSlider = document.getElementById('time-slider');
    if (!dInput || !tSlider) return;

    const dateStr = dInput.value;
    if (!dateStr) return;
    const timeVal = parseInt(tSlider.value);
    const hours = Math.floor(timeVal / 60);
    const minutes = timeVal % 60;
    const timeStr = `${('00' + hours).slice(-2)}:${('00' + minutes).slice(-2)}`;
    
    const displayEl = document.getElementById('time-display');
    if(displayEl) displayEl.innerText = timeStr;

    // 現在の日時（方位・高度計算用）
    const calcDate = new Date(`${dateStr}T${timeStr}:00`);
    // その日の0時（日の出計算用）
    const startOfDay = new Date(calcDate);
    startOfDay.setHours(0, 0, 0, 0);

    // 観測地の取得 (防御的に数値変換)
    let lat = 35.681236; 
    let lng = 139.767125;
    try {
        const center = map.getCenter();
        lat = Number(center.lat);
        lng = Number(center.lng);
    } catch(e) {
        console.warn("地図座標取得エラー");
    }

    // ライブラリチェック
    if (typeof Astronomy === 'undefined') return;

    // 正規のObserver作成 (高さ0m)
    let observer;
    try {
        observer = new Astronomy.Observer(lat, lng, 0);
    } catch(e) {
        console.error("Observer作成エラー", e);
        return;
    }

    // 描画クリア
    linesLayer.clearLayers();

    // 各天体の位置計算
    bodies.forEach(body => {
        const infoEl = document.getElementById(`info-${body.id}`);
        try {
            let equatorCoords;
            if (body.id === 'Polaris') {
                equatorCoords = { ra: POLARIS_RA, dec: POLARIS_DEC };
            } else {
                equatorCoords = Astronomy.Equator(body.id, calcDate, observer, false, true);
            }
            const horizon = Astronomy.Horizon(calcDate, observer, equatorCoords.ra, equatorCoords.dec, 'normal');
            
            if (infoEl) infoEl.innerText = `方位:${horizon.azimuth.toFixed(1)}° / 高度:${horizon.altitude.toFixed(1)}°`;
            
            if (body.visible) drawDirectionLine(lat, lng, horizon.azimuth, horizon.altitude, body);

        } catch (e) {
            // 計算エラー時はスキップ
        }
    });

    // 日の出・日の入り等の計算
    calculateRiseSet(calcDate, startOfDay, observer);
}

function calculateRiseSet(currentDate, startOfDay, observer) {
    try {
        // SearchRiseSet(body, observer, direction, date, limit_days)
        // 引数の順番を修正済み
        const sunRise = Astronomy.SearchRiseSet('Sun', observer, +1, startOfDay, 1);
        const sunSet  = Astronomy.SearchRiseSet('Sun', observer, -1, startOfDay, 1);
        const moonRise = Astronomy.SearchRiseSet('Moon', observer, +1, startOfDay, 1);
        const moonSet  = Astronomy.SearchRiseSet('Moon', observer, -1, startOfDay, 1);

        const fmt = (astroTime) => {
            if (!astroTime || !astroTime.date) return "--:--";
            const d = astroTime.date;
            return `${('00' + d.getHours()).slice(-2)}:${('00' + d.getMinutes()).slice(-2)}`;
        };

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if(el) el.innerText = val;
        };

        setVal('time-sunrise', fmt(sunRise));
        setVal('time-sunset', fmt(sunSet));
        setVal('time-moonrise', fmt(moonRise));
        setVal('time-moonset', fmt(moonSet));
        
        const moonPhase = Astronomy.MoonPhase(currentDate);
        const moonAge = (moonPhase / 360) * 29.53;
        setVal('moon-age-val', moonAge.toFixed(1));

        currentRiseSetData = {
            sunrise: sunRise ? sunRise.date : null,
            sunset: sunSet ? sunSet.date : null,
            moonrise: moonRise ? moonRise.date : null,
            moonset: moonSet ? moonSet.date : null
        };

    } catch(e) {
        console.error("Rise/Set Calculation Error:", e);
    }
}

function drawDirectionLine(lat, lng, azimuth, altitude, body) {
    const lengthKm = 5000;
    const rad = (90 - azimuth) * (Math.PI / 180);
    
    const dLat = (lengthKm / 111) * Math.sin(rad);
    const dLng = (lengthKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.cos(rad);
    
    const endPos = [lat + dLat, lng + dLng];

    const opacity = altitude < 0 ? 0.3 : 1.0; 
    const dashArray = body.isDashed ? '10, 10' : null;

    L.polyline([[lat, lng], endPos], {
        color: body.color,
        weight: 3,
        opacity: opacity,
        dashArray: dashArray
    }).addTo(linesLayer);
}


// --- 4. UI操作 ---

function jumpToEvent(eventType) {
    const data = currentRiseSetData;
    if (!data || !data[eventType]) return;

    const targetDate = data[eventType];
    const minutes = targetDate.getHours() * 60 + targetDate.getMinutes();
    
    const slider = document.getElementById('time-slider');
    if(slider) {
        slider.value = minutes;
        updateCalculation();
    }
}

function renderCelestialList() {
    const list = document.getElementById('celestial-list');
    if (!list) return;
    list.innerHTML = '';

    bodies.forEach(body => {
        const li = document.createElement('li');
        const dashClass = body.isDashed ? 'dashed' : 'solid';
        
        li.innerHTML = `
            <input type="checkbox" class="body-checkbox" 
                   ${body.visible ? 'checked' : ''} 
                   onchange="toggleVisibility('${body.id}', this.checked)">
            
            <div class="style-indicator ${dashClass}" 
                 style="color: ${body.color};"
                 onclick="openPalette('${body.id}')"></div>
            
            <div class="body-info">
                <span class="body-name">${body.name}</span>
                <span id="info-${body.id}" class="body-data">--</span>
            </div>
        `;
        list.appendChild(li);
    });
}

function toggleVisibility(id, isChecked) {
    const body = bodies.find(b => b.id === id);
    if (body) {
        body.visible = isChecked;
        updateCalculation();
    }
}

function togglePanel() {
    const content = document.getElementById('panel-content');
    const icon = document.getElementById('toggle-icon');
    if (content && icon) {
        content.classList.toggle('closed');
        icon.innerText = content.classList.contains('closed') ? '▼' : '▲';
    }
}

function openPalette(bodyId) {
    editingBodyId = bodyId;
    const palette = document.getElementById('style-palette');
    const colorContainer = document.getElementById('palette-colors');
    
    if(!palette || !colorContainer) return;

    colorContainer.innerHTML = '';
    COLOR_MAP.forEach(c => {
        const btn = document.createElement('div');
        btn.className = 'color-btn';
        btn.style.backgroundColor = c.code;
        btn.onclick = () => applyColor(c.code);
        colorContainer.appendChild(btn);
    });

    palette.classList.remove('hidden');
}

function closePalette() {
    const palette = document.getElementById('style-palette');
    if(palette) palette.classList.add('hidden');
    editingBodyId = null;
}

function applyColor(colorCode) {
    if (!editingBodyId) return;
    const body = bodies.find(b => b.id === editingBodyId);
    body.color = colorCode;
    finishStyleEdit();
}

function applyLineStyle(styleType) {
    if (!editingBodyId) return;
    const body = bodies.find(b => b.id === editingBodyId);
    body.isDashed = (styleType === 'dashed');
    finishStyleEdit();
}

function finishStyleEdit() {
    renderCelestialList();
    updateCalculation();
    closePalette();
}