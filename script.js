/*
宙の辻 - Sora no Tsuji
Copyright (c) 2026 Sora no Tsuji Project
Released under the MIT License.
*/

// --- 1. グローバル変数 ---
let map; 
let linesLayer; 
let locationLayer; // 出発地・目的地・ライン描画用
let moveTimer = null; // 自動進行用タイマー

// 位置情報管理用
let startLatLng = { lat: 35.65858, lng: 139.74543 }; // 初期値: 東京タワー
let endLatLng = { lat: 35.360776, lng: 138.727299 }; // 初期値: 富士山

// 北極星 (Polaris) の座標 (J2000)
const POLARIS_RA = 2.5303; 
const POLARIS_DEC = 89.2641; 

// すばる (Pleiades / M45) の座標 (J2000)
const SUBARU_RA = 3.79;
const SUBARU_DEC = 24.12;

const SYNODIC_MONTH = 29.53059; 

// カラーパレット定義
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

// 表示天体リスト
let bodies = [
    { id: 'Sun',     name: '太陽',   color: '#FF0000', isDashed: false, visible: true },
    { id: 'Moon',    name: '月',     color: '#FFFF00', isDashed: false, visible: true },
    { id: 'Mercury', name: '水星',   color: '#00BFFF', isDashed: false, visible: true },
    { id: 'Venus',   name: '金星',   color: '#FFC0CB', isDashed: false, visible: true },
    { id: 'Mars',    name: '火星',   color: '#FFA500', isDashed: false, visible: true },
    { id: 'Jupiter', name: '木星',   color: '#A52A2A', isDashed: false, visible: true },
    { id: 'Saturn',  name: '土星',   color: '#008000', isDashed: false, visible: true },
    { id: 'Uranus',  name: '天王星', color: '#ADFF2F', isDashed: true,  visible: false },
    { id: 'Neptune', name: '海王星', color: '#4B0082', isDashed: true,  visible: false },
    { id: 'Pluto',   name: '冥王星', color: '#800080', isDashed: true,  visible: false },
    { id: 'Polaris', name: '北極星', color: '#000000', isDashed: true,  visible: false },
    { id: 'Subaru',  name: 'すばる', color: '#0000FF', isDashed: false, visible: true }
];

let editingBodyId = null;
let currentRiseSetData = {};

// --- 2. 起動処理 ---

window.onload = function() {
    console.log("宙の辻: 起動");

    const mapElement = document.getElementById('map');
    if (mapElement) {
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        });

        const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        });

        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        });

        const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
        });

        map = L.map('map', {
            center: [startLatLng.lat, startLatLng.lng],
            zoom: 9,
            layers: [osmLayer],
            zoomControl: false
        });

        map.attributionControl.addAttribution('標高データ: &copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>');

        L.control.layers({ "標準": osmLayer, "ダーク": darkLayer, "衛星写真": satelliteLayer, "地形図": topoLayer }, null, { position: 'topleft' }).addTo(map);
        L.control.zoom({ position: 'topleft' }).addTo(map);
        L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map);
        
        linesLayer = L.layerGroup().addTo(map);
        locationLayer = L.layerGroup().addTo(map);

        map.on('click', onMapClick);
    }

    setupUIEvents();
    
    // 初期表示
    updateLocationDisplay();
    setNow();
    renderCelestialList();
    
    setTimeout(() => {
        if(map) map.invalidateSize();
        updateCalculation();
    }, 500);
};

// --- 3. UIイベント設定 ---
function setupUIEvents() {
    const dateInput = document.getElementById('date-input');
    const timeInput = document.getElementById('time-input');
    const timeSlider = document.getElementById('time-slider');
    const moonInput = document.getElementById('moon-age-input');

    if (dateInput) dateInput.addEventListener('change', updateCalculation);
    
    if (timeSlider) {
        timeSlider.addEventListener('input', () => {
            const val = parseInt(timeSlider.value);
            const h = Math.floor(val / 60);
            const m = val % 60;
            if(timeInput) timeInput.value = `${('00' + h).slice(-2)}:${('00' + m).slice(-2)}`;
            updateCalculation();
        });
    }

    if (timeInput) {
        timeInput.addEventListener('input', () => {
            if (!timeInput.value) return;
            const [h, m] = timeInput.value.split(':').map(Number);
            if (!isNaN(h) && !isNaN(m)) {
                if(timeSlider) timeSlider.value = h * 60 + m;
                updateCalculation();
            }
        });
    }

    if (moonInput) {
        moonInput.addEventListener('change', (e) => {
            const targetAge = parseFloat(e.target.value);
            if (!isNaN(targetAge)) searchMoonAge(targetAge);
        });
    }

    const btnNow = document.getElementById('btn-now');
    if(btnNow) btnNow.onclick = setNow;
    
    const btnMove = document.getElementById('btn-move');
    if(btnMove) btnMove.onclick = toggleMove;

    document.getElementById('btn-date-prev').onclick = () => addDay(-1);
    document.getElementById('btn-date-next').onclick = () => addDay(1);
    document.getElementById('btn-time-prev').onclick = () => addMinute(-1);
    document.getElementById('btn-time-next').onclick = () => addMinute(1);
    document.getElementById('btn-moon-prev').onclick = () => addMoonMonth(-1);
    document.getElementById('btn-moon-next').onclick = () => addMoonMonth(1);

    document.querySelectorAll('input[name="time-jump"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if(e.target.checked) jumpToEvent(e.target.value);
        });
    });

    const btnGps = document.getElementById('btn-gps');
    if(btnGps) {
        btnGps.onclick = () => {
            if (!navigator.geolocation) {
                alert('お使いのブラウザは位置情報をサポートしていません。');
                return;
            }
            navigator.geolocation.getCurrentPosition((pos) => {
                startLatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                map.setView(startLatLng, 10);
                updateLocationDisplay();
                updateCalculation();
            }, (err) => {
                alert('位置情報を取得できませんでした。');
            });
        };
    }

    // --- テキストボックス入力 (座標パース または 地名検索) ---
    const inputStart = document.getElementById('input-start-latlng');
    const inputEnd = document.getElementById('input-end-latlng');

    const parseInput = (val) => {
        // カンマが含まれていれば座標とみなす
        if (val.indexOf(',') === -1) return null;
        const clean = val.replace(/[\(\)\s]/g, ''); 
        const parts = clean.split(',');
        if (parts.length === 2) {
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
        }
        return null;
    };

    const handleLocationInput = async (val, isStart) => {
        if(!val) return;
        
        let coords = parseInput(val);
        
        // 座標としてパースできなければ地名検索 (Nominatim)
        if (!coords) {
            const results = await searchLocation(val);
            if(results && results.length > 0) {
                // 検索結果の1件目を使用
                coords = { 
                    lat: parseFloat(results[0].lat), 
                    lng: parseFloat(results[0].lon) 
                };
            } else {
                alert("場所が見つかりませんでした: " + val);
                return;
            }
        }

        if(coords) {
            if(isStart) {
                startLatLng = coords;
                document.getElementById('radio-start').checked = true; // ラジオ自動切り替え
                updateCalculation(); // 観測地更新
            } else {
                endLatLng = coords;
                document.getElementById('radio-end').checked = true; // ラジオ自動切り替え
            }
            updateLocationDisplay();
            fitBoundsToLocations(); // 地図範囲の自動調整
        }
    };

    if(inputStart) {
        inputStart.addEventListener('change', () => {
            handleLocationInput(inputStart.value, true);
        });
    }

    if(inputEnd) {
        inputEnd.addEventListener('change', () => {
            handleLocationInput(inputEnd.value, false);
        });
    }
}

// --- 4. 地図クリック処理 & 位置情報表示 ---

function onMapClick(e) {
    const modeStart = document.getElementById('radio-start').checked;
    
    if (modeStart) {
        startLatLng = e.latlng;
        updateCalculation(); 
    } else {
        endLatLng = e.latlng;
    }
    updateLocationDisplay();
}

// 両地点が収まるように地図を調整
function fitBoundsToLocations() {
    if(!map) return;
    const bounds = L.latLngBounds([startLatLng, endLatLng]);
    map.fitBounds(bounds, { padding: [50, 50] });
}

// Nominatim APIで地名検索
async function searchLocation(query) {
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch(e) {
        console.error("Search error:", e);
        return null;
    }
}

async function getElevation(lat, lng) {
    try {
        const url = `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lng}&lat=${lat}&outtype=JSON`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.elevation !== undefined) {
            if (data.elevation === "-----") return 0;
            return data.elevation;
        }
    } catch(e) {
        console.error("Elevation fetch error:", e);
    }
    return null; 
}

async function updateLocationDisplay() {
    if (!locationLayer || !map) return;
    locationLayer.clearLayers();

    const fmt = (pos) => `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
    
    document.getElementById('input-start-latlng').value = fmt(startLatLng);
    document.getElementById('input-end-latlng').value = fmt(endLatLng);

    const startPt = L.latLng(startLatLng);
    const endPt = L.latLng(endLatLng);
    const distMeters = startPt.distanceTo(endPt);
    const distKm = (distMeters / 1000).toFixed(2);

    const startMarker = L.marker(startLatLng).addTo(locationLayer);
    const endMarker = L.marker(endLatLng).addTo(locationLayer);
    
    L.polyline([startLatLng, endLatLng], {
        color: 'black',
        weight: 3,
        opacity: 0.8
    }).addTo(locationLayer);

    const createPopupContent = (title, pos, distLabel, distVal, elevVal) => {
        const elevStr = (elevVal !== null) ? `${elevVal} m` : "--- m";
        return `
            <b>${title}</b><br>
            緯度: ${pos.lat.toFixed(6)}<br>
            経度: ${pos.lng.toFixed(6)}<br>
            標高: ${elevStr}<br>
            ${distLabel}: ${distVal} km
        `;
    };

    startMarker.bindPopup(createPopupContent("出発地", startLatLng, "目的地まで", distKm, "取得中..."));
    endMarker.bindPopup(createPopupContent("目的地", endLatLng, "出発地から", distKm, "取得中..."));

    const startElev = await getElevation(startLatLng.lat, startLatLng.lng);
    const endElev = await getElevation(endLatLng.lat, endLatLng.lng);

    startMarker.setPopupContent(createPopupContent("出発地", startLatLng, "目的地まで", distKm, startElev));
    endMarker.setPopupContent(createPopupContent("目的地", endLatLng, "出発地から", distKm, endElev));
}

// --- 5. 操作ロジック (既存) ---

function setNow() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = ('00' + (now.getMonth() + 1)).slice(-2);
    const dd = ('00' + now.getDate()).slice(-2);
    const dInput = document.getElementById('date-input');
    if(dInput) dInput.value = `${yyyy}-${mm}-${dd}`;
    
    const h = now.getHours();
    const m = now.getMinutes();
    const timeStr = `${('00' + h).slice(-2)}:${('00' + m).slice(-2)}`;
    const tInput = document.getElementById('time-input');
    const tSlider = document.getElementById('time-slider');
    if(tInput) tInput.value = timeStr;
    if(tSlider) tSlider.value = h * 60 + m;
    
    updateCalculation();
}

function toggleMove() {
    const btn = document.getElementById('btn-move');
    
    if (moveTimer) {
        clearInterval(moveTimer);
        moveTimer = null;
        if(btn) btn.classList.remove('active');
    } else {
        if(btn) btn.classList.add('active');
        moveTimer = setInterval(() => {
            addMinute(1);
        }, 1000);
    }
}

function addDay(days) {
    const dInput = document.getElementById('date-input');
    if(!dInput) return;
    const date = new Date(dInput.value);
    date.setDate(date.getDate() + days);
    
    const yyyy = date.getFullYear();
    const mm = ('00' + (date.getMonth() + 1)).slice(-2);
    const dd = ('00' + date.getDate()).slice(-2);
    dInput.value = `${yyyy}-${mm}-${dd}`;
    updateCalculation();
}

function addMinute(minutes) {
    const slider = document.getElementById('time-slider');
    if(!slider) return;
    let val = parseInt(slider.value) + minutes;
    if (val < 0) val = 1439;
    if (val > 1439) val = 0;
    slider.value = val;
    slider.dispatchEvent(new Event('input')); 
}

function addMoonMonth(direction) {
    const dInput = document.getElementById('date-input');
    const tSlider = document.getElementById('time-slider');
    if(!dInput || !tSlider) return;
    
    const dateStr = dInput.value;
    const timeVal = parseInt(tSlider.value);
    const h = Math.floor(timeVal / 60);
    const m = timeVal % 60;
    const current = new Date(`${dateStr}T${('00' + h).slice(-2)}:${('00' + m).slice(-2)}:00`);
    
    const moveMs = direction * SYNODIC_MONTH * 24 * 60 * 60 * 1000;
    const targetDate = new Date(current.getTime() + moveMs);
    
    const yyyy = targetDate.getFullYear();
    const mm = ('00' + (targetDate.getMonth() + 1)).slice(-2);
    const dd = ('00' + targetDate.getDate()).slice(-2);
    dInput.value = `${yyyy}-${mm}-${dd}`;
    
    const th = targetDate.getHours();
    const tm = targetDate.getMinutes();
    const timeStr = `${('00' + th).slice(-2)}:${('00' + tm).slice(-2)}`;
    document.getElementById('time-input').value = timeStr;
    tSlider.value = th * 60 + tm;
    updateCalculation();
}

function searchMoonAge(targetAge) {
    const dInput = document.getElementById('date-input');
    const tSlider = document.getElementById('time-slider');
    if(!dInput || !tSlider) return;

    const targetPhase = (targetAge / SYNODIC_MONTH) * 360.0;
    const dateStr = dInput.value;
    const timeVal = parseInt(tSlider.value);
    const h = Math.floor(timeVal / 60);
    const m = timeVal % 60;
    const current = new Date(`${dateStr}T${('00' + h).slice(-2)}:${('00' + m).slice(-2)}:00`);
    
    const result = Astronomy.SearchMoonPhase(targetPhase, current, 30);
    
    if (result && result.date) {
        const d = result.date;
        const yyyy = d.getFullYear();
        const mm = ('00' + (d.getMonth() + 1)).slice(-2);
        const dd = ('00' + d.getDate()).slice(-2);
        dInput.value = `${yyyy}-${mm}-${dd}`;
        
        const th = d.getHours();
        const tm = d.getMinutes();
        const timeStr = `${('00' + th).slice(-2)}:${('00' + tm).slice(-2)}`;
        document.getElementById('time-input').value = timeStr;
        tSlider.value = th * 60 + tm;
        updateCalculation();
    } else {
        alert("計算範囲内で見つかりませんでした。");
    }
}


// --- 6. 天体計算ロジック ---

function updateCalculation() {
    if (!map || !linesLayer) return;

    const dInput = document.getElementById('date-input');
    const tInput = document.getElementById('time-input');
    if (!dInput || !tInput) return;

    const dateStr = dInput.value;
    const timeStr = tInput.value;
    if (!dateStr || !timeStr) return;

    const calcDate = new Date(`${dateStr}T${timeStr}:00`);
    const startOfDay = new Date(calcDate);
    startOfDay.setHours(0, 0, 0, 0);

    // 観測地は常に StartLatLng を使用
    const lat = startLatLng.lat;
    const lng = startLatLng.lng;

    if (typeof Astronomy === 'undefined') return;

    let observer;
    try {
        observer = new Astronomy.Observer(lat, lng, 0);
    } catch(e) { return; }

    linesLayer.clearLayers();

    // 全天体ループ
    bodies.forEach(body => {
        // 1. 位置計算
        let equatorCoords;
        if (body.id === 'Polaris') {
            equatorCoords = { ra: POLARIS_RA, dec: POLARIS_DEC };
        } else if (body.id === 'Subaru') {
            equatorCoords = { ra: SUBARU_RA, dec: SUBARU_DEC };
        } else {
            equatorCoords = Astronomy.Equator(body.id, calcDate, observer, false, true);
        }
        const horizon = Astronomy.Horizon(calcDate, observer, equatorCoords.ra, equatorCoords.dec, 'normal');

        // 2. 出没計算
        let riseStr = "--:--";
        let setStr  = "--:--";

        if (body.id !== 'Polaris' && body.id !== 'Subaru') {
            try {
                const rise = Astronomy.SearchRiseSet(body.id, observer, +1, startOfDay, 1);
                const set  = Astronomy.SearchRiseSet(body.id, observer, -1, startOfDay, 1);
                const fmt = (evt) => evt ? `${('00'+evt.date.getHours()).slice(-2)}:${('00'+evt.date.getMinutes()).slice(-2)}` : null;
                riseStr = fmt(rise);
                setStr  = fmt(set);
            } catch(e) { }
        }

        if (!riseStr && !setStr) {
            if (horizon.altitude > 0) {
                riseStr = "00:00"; setStr  = "00:00";
            } else {
                riseStr = "--:--"; setStr  = "--:--";
            }
        }
        if (!riseStr) riseStr = "--:--";
        if (!setStr) setStr = "--:--";

        // 3. 画面表示の更新
        const dataEl = document.getElementById(`data-${body.id}`);
        if (dataEl) {
            dataEl.innerText = `出 ${riseStr} / 入 ${setStr} / 方位 ${horizon.azimuth.toFixed(0)}° / 高度 ${horizon.altitude.toFixed(0)}°`;
        }

        // 4. 線を描画
        if (body.visible) {
            drawDirectionLine(lat, lng, horizon.azimuth, horizon.altitude, body);
        }
    });

    updateShortcuts(startOfDay, observer);
    updateMoonInfo(calcDate);
}

function updateShortcuts(startOfDay, observer) {
    try {
        const sunRise = Astronomy.SearchRiseSet('Sun', observer, +1, startOfDay, 1);
        const sunSet  = Astronomy.SearchRiseSet('Sun', observer, -1, startOfDay, 1);
        const moonRise = Astronomy.SearchRiseSet('Moon', observer, +1, startOfDay, 1);
        const moonSet  = Astronomy.SearchRiseSet('Moon', observer, -1, startOfDay, 1);

        const fmt = (evt) => evt ? `${('00'+evt.date.getHours()).slice(-2)}:${('00'+evt.date.getMinutes()).slice(-2)}` : "--:--";

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if(el) el.innerText = val;
        };
        setVal('time-sunrise', fmt(sunRise));
        setVal('time-sunset', fmt(sunSet));
        setVal('time-moonrise', fmt(moonRise));
        setVal('time-moonset', fmt(moonSet));

        currentRiseSetData = {
            sunrise: sunRise ? sunRise.date : null,
            sunset: sunSet ? sunSet.date : null,
            moonrise: moonRise ? moonRise.date : null,
            moonset: moonSet ? moonSet.date : null
        };
    } catch(e) {}
}

function updateMoonInfo(date) {
    const phase = Astronomy.MoonPhase(date);
    const age = (phase / 360) * SYNODIC_MONTH;
    
    if (document.activeElement.id !== 'moon-age-input') {
        const moonInput = document.getElementById('moon-age-input');
        if(moonInput) moonInput.value = age.toFixed(1);
    }

    const iconIndex = Math.round(phase / 45) % 8;
    const icons = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
    const moonIcon = document.getElementById('moon-icon');
    if(moonIcon) moonIcon.innerText = icons[iconIndex];
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


// --- 7. UI操作関数 (リスト系) ---

function toggleSection(sectionId) {
    const content = document.getElementById(sectionId);
    const icon = document.getElementById('icon-' + sectionId);
    if (content && icon) {
        content.classList.toggle('closed');
        icon.innerText = content.classList.contains('closed') ? '▼' : '▲';
    }
}

function jumpToEvent(eventType) {
    const data = currentRiseSetData;
    if (!data || !data[eventType]) return;

    const targetDate = data[eventType];
    const h = targetDate.getHours();
    const m = targetDate.getMinutes();
    const tInput = document.getElementById('time-input');
    const tSlider = document.getElementById('time-slider');
    
    if(tInput) tInput.value = `${('00' + h).slice(-2)}:${('00' + m).slice(-2)}`;
    if(tSlider) tSlider.value = h * 60 + m;
    updateCalculation();
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
                <div class="body-header">
                    <span class="body-name">${body.name}</span>
                </div>
                <span id="data-${body.id}" class="body-detail-text">--:--</span>
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
    const panel = document.getElementById('control-panel');
    const icon = document.getElementById('toggle-icon');
    if (panel && icon) {
        panel.classList.toggle('minimized');
        icon.innerText = panel.classList.contains('minimized') ? '▼' : '▲';
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