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
*/

// --- 1. グローバル変数 ---
let map; 
let linesLayer; 
let locationLayer; 
let dpLayer; 
let moveTimer = null; 

// GASのウェブアプリURL
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzq94EkeZgbWlFb65cb1WQcRrRVi2Qpd_i60NvJWx6BB6Qxpb-30GD7TSzZptpRYxYL/exec"; 

let visitorData = null; 

// デフォルト値
const DEFAULT_START_LATLNG = { lat: 35.658449, lng: 139.745536 };
const DEFAULT_START_ELEV = 150.0;
const DEFAULT_END_LATLNG = { lat: 35.360776, lng: 138.727299 };
const DEFAULT_END_ELEV = 3776.0;

let startLatLng = DEFAULT_START_LATLNG; 
let startElev = DEFAULT_START_ELEV; 
let endLatLng = DEFAULT_END_LATLNG; 
let endElev = DEFAULT_END_ELEV; 

let isElevationActive = false;
let elevationDataPoints = []; 
let fetchIndex = 0;
let fetchTimer = null;

let isDPActive = true;

const POLARIS_RA = 2.5303; 
const POLARIS_DEC = 89.2641; 
const SUBARU_RA = 3.79;
const SUBARU_DEC = 24.12;
const ALNILAM_RA = 5.603; 
const ALNILAM_DEC = -1.202;

const SYNODIC_MONTH = 29.53059; 
const EARTH_RADIUS = 6378137;

// 大気差なし（幾何学的計算）にするため 0 に設定
const REFRACTION_K = 0;

let myStarRA = ALNILAM_RA;
let myStarDec = ALNILAM_DEC;

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

let bodies = [
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
];

let editingBodyId = null;
let currentRiseSetData = {};

// --- 2. 起動処理 ---

window.onload = function() {
    console.log("宙の辻: 起動");

    loadMyStarSettings();
    loadLocationSettings(); 

    const mapElement = document.getElementById('map');
    if (mapElement) {
        const gsiStdLayer = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
            attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>',
            maxZoom: 18
        });
        const gsiPhotoLayer = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/ort/{z}/{x}/{y}.jpg', {
            attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>',
            maxZoom: 18
        });
        const gsiPaleLayer = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
            attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>',
            maxZoom: 18
        });
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        });

        map = L.map('map', {
            center: [startLatLng.lat, startLatLng.lng],
            zoom: 9, 
            layers: [gsiStdLayer], 
            zoomControl: false
        });

        map.attributionControl.addAttribution('標高データ: &copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>');

        L.control.layers({ 
            "標準(地理院)": gsiStdLayer, 
            "写真(地理院)": gsiPhotoLayer,
            "淡色(地理院)": gsiPaleLayer,
            "OSM": osmLayer 
        }, null, { position: 'topleft' }).addTo(map);

        L.control.zoom({ position: 'topleft' }).addTo(map);
        L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map);
        
        linesLayer = L.layerGroup().addTo(map);
        locationLayer = L.layerGroup().addTo(map);
        dpLayer = L.layerGroup().addTo(map);

        map.on('click', onMapClick);
    }

    setupUIEvents();
    
    // UI初期値設定
    document.getElementById('input-start-elev').value = startElev;
    document.getElementById('input-end-elev').value = endElev;
    document.getElementById('input-mystar-radec').value = `${myStarRA},${myStarDec}`;
    
    const myBody = bodies.find(b => b.id === 'MyStar');
    if(myBody) {
        document.getElementById('chk-mystar').checked = myBody.visible;
        const indicator = document.getElementById('style-MyStar');
        if(indicator) {
            indicator.style.color = myBody.color;
            indicator.className = `style-indicator ${myBody.isDashed ? 'dashed' : 'solid'}`;
        }
    }

    if (isDPActive) {
        const btn = document.getElementById('btn-dp');
        if (btn) btn.classList.add('active');
    }

    updateLocationDisplay();
    // 既定を日の出時刻に設定
    setSunrise(); 
    renderCelestialList(); 
    
    window.addEventListener('resize', () => {
        if(isElevationActive) drawProfileGraph();
    });

    setTimeout(() => {
        if(map) map.invalidateSize();
        updateCalculation();
        initVisitorCounter();
    }, 500);
};

// --- 3. UIイベント設定 ---

function setupUIEvents() {
    const btnHelp = document.getElementById('btn-help');
    if(btnHelp) btnHelp.onclick = toggleHelp;

    const dateInput = document.getElementById('date-input');
    const timeInput = document.getElementById('time-input');
    const timeSlider = document.getElementById('time-slider');
    const moonInput = document.getElementById('moon-age-input');

    if (dateInput) dateInput.addEventListener('change', () => {
        uncheckTimeShortcuts(); // ★手動変更時に選択解除
        updateCalculation();
        if(isDPActive) updateDPLines();
    });
    if (timeSlider) {
        timeSlider.addEventListener('input', () => {
            uncheckTimeShortcuts(); // ★手動変更時に選択解除
            const val = parseInt(timeSlider.value);
            const h = Math.floor(val / 60);
            const m = val % 60;
            if(timeInput) timeInput.value = `${('00' + h).slice(-2)}:${('00' + m).slice(-2)}`;
            updateCalculation();
        });
    }
    if (timeInput) {
        timeInput.addEventListener('input', () => {
            uncheckTimeShortcuts(); // ★手動変更時に選択解除
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

    document.getElementById('btn-month-prev').onclick = () => addMonth(-1);
    document.getElementById('btn-date-prev').onclick = () => addDay(-1);
    document.getElementById('btn-date-next').onclick = () => addDay(1);
    document.getElementById('btn-month-next').onclick = () => addMonth(1);

    document.getElementById('btn-hour-prev').onclick = () => addMinute(-60);
    document.getElementById('btn-time-prev').onclick = () => addMinute(-1);
    document.getElementById('btn-time-next').onclick = () => addMinute(1);
    document.getElementById('btn-hour-next').onclick = () => addMinute(60);

    // ★修正: 月の移動ロジックを高精度版に変更
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

    const btnElev = document.getElementById('btn-elevation');
    if(btnElev) btnElev.onclick = toggleElevation;

    const btnDP = document.getElementById('btn-dp');
    if(btnDP) btnDP.onclick = toggleDP;

    const btnRegStart = document.getElementById('btn-reg-start');
    if(btnRegStart) {
        btnRegStart.onclick = () => {
            const inputVal = document.getElementById('input-start-latlng').value;
            const savedData = localStorage.getItem('soranotsuji_start');

            if(!inputVal) {
                localStorage.removeItem('soranotsuji_start');
                startLatLng = DEFAULT_START_LATLNG;
                startElev = DEFAULT_START_ELEV;
                btnRegStart.classList.remove('active');
                btnRegStart.title = "観測点の初期値をリセット";
                alert('観測点の初期値をリセットしました。');
            } else if (savedData) {
                try {
                    const data = JSON.parse(savedData);
                    if(data.lat && data.lng && data.elev !== undefined) {
                        startLatLng = { lat: data.lat, lng: data.lng };
                        startElev = data.elev;
                        updateLocationDisplay();
                        updateCalculation();
                        fitBoundsToLocations();
                        alert('登録済みの観測点を呼び出しました。');
                    }
                } catch(e) { console.error(e); }
            } else {
                const data = { lat: startLatLng.lat, lng: startLatLng.lng, elev: startElev };
                localStorage.setItem('soranotsuji_start', JSON.stringify(data));
                btnRegStart.classList.add('active');
                btnRegStart.title = "現在の観測点を初期値として登録";
                alert('現在の観測点を初期値として登録しました。');
            }
            updateLocationDisplay();
        };
    }

    const btnRegEnd = document.getElementById('btn-reg-end');
    if(btnRegEnd) {
        btnRegEnd.onclick = () => {
            const inputVal = document.getElementById('input-end-latlng').value;
            const savedData = localStorage.getItem('soranotsuji_end');

            if(!inputVal) {
                localStorage.removeItem('soranotsuji_end');
                endLatLng = DEFAULT_END_LATLNG;
                endElev = DEFAULT_END_ELEV;
                btnRegEnd.classList.remove('active');
                btnRegEnd.title = "目的地の初期値をリセット";
                alert('目的地の初期値をリセットしました。');
            } else if (savedData) {
                try {
                    const data = JSON.parse(savedData);
                    if(data.lat && data.lng && data.elev !== undefined) {
                        endLatLng = { lat: data.lat, lng: data.lng };
                        endElev = data.elev;
                        updateLocationDisplay();
                        if(isDPActive) updateDPLines();
                        fitBoundsToLocations();
                        alert('登録済みの目的地を呼び出しました。');
                    }
                } catch(e) { console.error(e); }
            } else {
                const data = { lat: endLatLng.lat, lng: endLatLng.lng, elev: endElev };
                localStorage.setItem('soranotsuji_end', JSON.stringify(data));
                btnRegEnd.classList.add('active');
                btnRegEnd.title = "現在の目的地を初期値として登録";
                alert('現在の目的地を初期値として登録しました。');
            }
            updateLocationDisplay();
        };
    }

    const inputStart = document.getElementById('input-start-latlng');
    const inputEnd = document.getElementById('input-end-latlng');

    const parseInput = (val) => {
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
        if (!coords) {
            const results = await searchLocation(val);
            if(results && results.length > 0) {
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
                document.getElementById('radio-start').checked = true;
                updateCalculation();
            } else {
                endLatLng = coords;
                document.getElementById('radio-end').checked = true;
                if(isDPActive) updateDPLines();
            }
            updateLocationDisplay(); 
            fitBoundsToLocations();
        }
    };

    if(inputStart) inputStart.addEventListener('change', () => handleLocationInput(inputStart.value, true));
    if(inputEnd) inputEnd.addEventListener('change', () => handleLocationInput(inputEnd.value, false));

    const inputStartElev = document.getElementById('input-start-elev');
    const inputEndElev = document.getElementById('input-end-elev');

    if(inputStartElev) {
        inputStartElev.addEventListener('change', () => {
            const val = parseFloat(inputStartElev.value);
            if(!isNaN(val)) {
                startElev = val;
                updateCalculation(); 
                updateLocationDisplay(false); 
            }
        });
    }

    if(inputEndElev) {
        inputEndElev.addEventListener('change', () => {
            const val = parseFloat(inputEndElev.value);
            if(!isNaN(val)) {
                endElev = val;
                if(isDPActive) updateDPLines(); 
                updateLocationDisplay(false);
            }
        });
    }

    const btnMyReg = document.getElementById('btn-mystar-reg');
    const inputMyRaDec = document.getElementById('input-mystar-radec');
    const chkMyStar = document.getElementById('chk-mystar');

    if(btnMyReg && inputMyRaDec) {
        btnMyReg.onclick = () => {
            const val = inputMyRaDec.value.trim();
            if(!val) {
                myStarRA = ALNILAM_RA;
                myStarDec = ALNILAM_DEC;
                inputMyRaDec.value = `${myStarRA},${myStarDec}`;
                localStorage.removeItem('soranotsuji_mystar');
            } else {
                const coords = parseInput(val);
                if(coords) {
                    myStarRA = coords.lat;
                    myStarDec = coords.lng;
                    localStorage.setItem('soranotsuji_mystar', JSON.stringify({ra: myStarRA, dec: myStarDec}));
                } else {
                    alert("形式エラー: RA,Dec (例: 5.603,-1.202)");
                    return;
                }
            }
            updateCalculation();
            if(isDPActive) updateDPLines();
        };
    }

    if(chkMyStar) {
        chkMyStar.addEventListener('change', (e) => {
            toggleVisibility('MyStar', e.target.checked);
        });
    }
}

function toggleHelp() {
    const modal = document.getElementById('help-modal');
    if(modal) {
        modal.classList.toggle('hidden');
    }
}

// --- 5. 地図クリック処理 & 位置情報表示 ---

function onMapClick(e) {
    const modeStart = document.getElementById('radio-start').checked;
    if (modeStart) {
        startLatLng = e.latlng;
        updateCalculation(); 
    } else {
        endLatLng = e.latlng;
        if(isDPActive) updateDPLines();
    }
    updateLocationDisplay(true);
}

function calculateBearing(startLat, startLng, destLat, destLng) {
    const toRad = deg => deg * Math.PI / 180;
    const toDeg = rad => rad * 180 / Math.PI;
    
    const lat1 = toRad(startLat);
    const lat2 = toRad(destLat);
    const dLng = toRad(destLng - startLng);

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    
    let brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
}

async function updateLocationDisplay(fetchElevation = true) {
    if (!locationLayer || !map) return;
    locationLayer.clearLayers();

    const fmt = (pos) => `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
    document.getElementById('input-start-latlng').value = fmt(startLatLng);
    document.getElementById('input-end-latlng').value = fmt(endLatLng);

    if (fetchElevation) {
        const sElev = await getElevation(startLatLng.lat, startLatLng.lng);
        const eElev = await getElevation(endLatLng.lat, endLatLng.lng);
        if(sElev !== null) startElev = sElev;
        if(eElev !== null) endElev = eElev;
    }

    document.getElementById('input-start-elev').value = startElev;
    document.getElementById('input-end-elev').value = endElev;

    const startPt = L.latLng(startLatLng);
    const endPt = L.latLng(endLatLng);
    const distMeters = startPt.distanceTo(endPt);
    const distKm = (distMeters / 1000).toFixed(2);

    const startMarker = L.marker(startLatLng).addTo(locationLayer);
    const endMarker = L.marker(endLatLng).addTo(locationLayer);
    
    L.polyline([startLatLng, endLatLng], {
        color: 'black',
        weight: 6, // 線を太く (6)
        opacity: 0.8
    }).addTo(locationLayer);

    const azToDest = calculateBearing(startLatLng.lat, startLatLng.lng, endLatLng.lat, endLatLng.lng);
    const azToStart = calculateBearing(endLatLng.lat, endLatLng.lng, startLatLng.lat, startLatLng.lng);

    const createPopupContent = (title, pos, distLabel, distVal, elevVal, azLabel, azVal) => {
        return `
            <b>${title}</b><br>
            緯度: ${pos.lat.toFixed(5)}<br>
            経度: ${pos.lng.toFixed(5)}<br>
            標高: ${elevVal} m<br>
            ${distLabel}: ${distVal} km<br>
            ${azLabel}: ${azVal.toFixed(1)}°
        `;
    };

    startMarker.bindPopup(createPopupContent(
        "観測点", startLatLng, "目的地まで", distKm, startElev, "目的地の方位", azToDest
    ));
    endMarker.bindPopup(createPopupContent(
        "目的地", endLatLng, "観測点から", distKm, endElev, "観測点の方位", azToStart
    ));
}

// --- 5. D/P 機能 (辻ライン) ---

function toggleDP() {
    const btn = document.getElementById('btn-dp');
    isDPActive = !isDPActive;
    
    if (isDPActive) {
        btn.classList.add('active');
        updateDPLines();
    } else {
        btn.classList.remove('active');
        dpLayer.clearLayers();
    }
}

function calculateDPPathPoints(targetDate, body, observer) {
    const path = [];
    const startOfDay = new Date(targetDate.getTime());
    startOfDay.setHours(0, 0, 0, 0);

    for (let m = 0; m < 1440; m++) {
        const time = new Date(startOfDay.getTime() + m * 60000);
        
        let r, d;
        if (body.id === 'Polaris') {
            r = POLARIS_RA; d = POLARIS_DEC;
        } else if (body.id === 'Subaru') {
            r = SUBARU_RA; d = SUBARU_DEC;
        } else if (body.id === 'MyStar') {
            r = myStarRA; d = myStarDec;
        } else {
            const eq = Astronomy.Equator(body.id, time, observer, false, true);
            r = eq.ra; d = eq.dec;
        }

        // null を使用して大気差なしの高度を取得
        const hor = Astronomy.Horizon(time, observer, r, d, null);
        
        // 眼高差を計算
        const valElev = parseFloat(startElev) || 0; // 数値化(安全策)
        const dip = getHorizonDip(valElev);
        
        // 太陽の視半径(約0.27度) + 眼高差 + マージン(0.1度)
        const limit = -(dip + 0.27 + 0.1); 

        if (hor.altitude > limit) {
            const dist = calculateDistanceForAltitudes(hor.altitude, valElev, endElev);
            if (dist > 0 && dist <= 350000) {
                path.push({ dist: dist, az: hor.azimuth, time: time });
            }
        }
    }
    return path;
}

function updateDPLines() {
    if (!isDPActive) return;
    dpLayer.clearLayers();

    const dInput = document.getElementById('date-input');
    const dateStr = dInput.value;
    const baseDate = new Date(dateStr + "T00:00:00");
    
    const datePrev = new Date(baseDate.getTime() - 24 * 60 * 60 * 1000);
    const dateNext = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);

    const observer = new Astronomy.Observer(endLatLng.lat, endLatLng.lng, endElev);

    bodies.forEach(body => {
        if (!body.visible) return;

        const pointsPrev = calculateDPPathPoints(datePrev, body, observer);
        const pointsNext = calculateDPPathPoints(dateNext, body, observer);
        const pointsCurr = calculateDPPathPoints(baseDate, body, observer);

        // 点線の視認性を上げるため '1' -> '4' に変更
        drawDPPath(pointsPrev, body.color, '4, 12', false);
        drawDPPath(pointsNext, body.color, '4, 12', false);
        
        // 当日（破線）: '12, 12'
        drawDPPath(pointsCurr, body.color, '12, 12', true);
    });
}

function calculateDistanceForAltitudes(celestialAltDeg, hObs, hTarget) {
    const altRad = celestialAltDeg * Math.PI / 180;
    // REFRACTION_K = 0 (大気差なし)
    const a = (1 - REFRACTION_K) / (2 * EARTH_RADIUS);
    const b = Math.tan(altRad);
    const c = -(hTarget - hObs);

    const disc = b * b - 4 * a * c;
    if (disc < 0) return -1; 

    const d = (-b + Math.sqrt(disc)) / (2 * a);
    return d;
}

// 計算精度を維持しつつ、確実に動作するよう定数定義に戻しました
function getDestinationVincenty(lat1, lon1, az, dist) {
    const a = 6378137; // 定義値（正確）
    const f = 1 / 298.257223563; // 定義値（正確）
    const b = a * (1 - f); // 計算で出す（最も高精度）

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
    let cos2SigmaM, sinSigma, cosSigma, deltaSigma;

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
    
    return {
        lat: lat2 * toDeg,
        lng: lon1 + L * toDeg
    };
}

function drawDPPath(points, color, dashArray, withMarkers) {
    if (points.length === 0) return;
    const targetPt = L.latLng(endLatLng);
    
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
            const hh = p.time.getHours();
            const mm = ('0' + p.time.getMinutes()).slice(-2);
            const timeStr = `${hh}:${mm}`;

            L.circleMarker(pt, {
                radius: 4,
                color: color,
                fillColor: color,
                fillOpacity: 1.0,
                weight: 1
            }).addTo(dpLayer);

            const textStyle = `font-size: 14px; font-weight: bold; color: ${color}; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; white-space: nowrap;`;
            
            L.marker(pt, {
                icon: L.divIcon({
                    className: 'dp-label-icon', 
                    html: `<div style="${textStyle}">${timeStr}</div>`,
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

function toggleElevation() {
    const btn = document.getElementById('btn-elevation');
    const panel = document.getElementById('elevation-panel');
    
    isElevationActive = !isElevationActive;
    
    if (isElevationActive) {
        btn.classList.add('active'); 
        panel.classList.remove('hidden');
        startElevationFetch();
    } else {
        btn.classList.remove('active');
        panel.classList.add('hidden');
        stopElevationFetch();
    }
}

function startElevationFetch() {
    generateProfilePoints(100); 
    
    fetchIndex = 0;
    const overlay = document.getElementById('progress-overlay');
    overlay.classList.remove('hidden');
    updateProgress(0, 0, elevationDataPoints.length);
    
    processFetchQueue();
}

function stopElevationFetch() {
    if (fetchTimer) {
        clearTimeout(fetchTimer);
        fetchTimer = null;
    }
    document.getElementById('progress-overlay').classList.add('hidden');
}

function generateProfilePoints(intervalMeters) {
    elevationDataPoints = [];
    const start = L.latLng(startLatLng);
    const end = L.latLng(endLatLng);
    const totalDist = start.distanceTo(end);
    
    const steps = Math.floor(totalDist / intervalMeters);
    
    for (let i = 0; i <= steps; i++) {
        const ratio = i / steps;
        const lat = start.lat + (end.lat - start.lat) * ratio;
        const lng = start.lng + (end.lng - start.lng) * ratio;
        
        elevationDataPoints.push({
            lat: lat,
            lng: lng,
            dist: (i * intervalMeters) / 1000, 
            elev: null, 
            fetched: false
        });
    }
    drawProfileGraph(); 
}

function processFetchQueue() {
    if (!isElevationActive) return;
    if (fetchIndex >= elevationDataPoints.length) {
        document.getElementById('progress-overlay').classList.add('hidden');
        return;
    }

    const pt = elevationDataPoints[fetchIndex];
    
    fetchElevationSingle(pt.lat, pt.lng).then(elev => {
        pt.elev = elev;
        pt.fetched = true;
        
        fetchIndex++;
        const percent = Math.floor((fetchIndex / elevationDataPoints.length) * 100);
        updateProgress(percent, fetchIndex, elevationDataPoints.length);
        drawProfileGraph();
        
        if (isElevationActive) {
            // 3秒間隔に変更
            fetchTimer = setTimeout(processFetchQueue, 3000); 
        }
    });
}

async function fetchElevationSingle(lat, lng) {
    const val = await getElevation(lat, lng);
    return val !== null ? val : 0;
}

function updateProgress(percent, current, total) {
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-text');
    if(bar) bar.style.width = percent + "%";
    
    if(text) {
        // 残り時間計算も3秒ベースに
        const remainingSeconds = (total - current) * 3;
        
        // 時・分・秒に変換
        const h = Math.floor(remainingSeconds / 3600);
        const m = Math.floor((remainingSeconds % 3600) / 60);
        const s = remainingSeconds % 60;
        
        let timeStr = "";
        if (h > 0) timeStr += `${h}h `;
        if (m > 0 || h > 0) timeStr += `${m}m `;
        timeStr += `${s}s`;

        text.innerText = `${percent}% : ${current} / ${total} ( 残り ${timeStr} )`;
    }
}

function drawProfileGraph() {
    const canvas = document.getElementById('elevation-canvas');
    const ctx = canvas.getContext('2d');
    
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w;
    canvas.height = h;
    
    ctx.clearRect(0, 0, w, h);
    
    if (elevationDataPoints.length === 0) return;

    const fetchedPoints = elevationDataPoints.filter(p => p.fetched);
    let minElev = 0;
    let maxElev = 4000; 
    
    if (fetchedPoints.length > 0) {
        const elevs = fetchedPoints.map(p => p.elev);
        minElev = Math.min(...elevs);
        maxElev = Math.max(...elevs);
    }
    const range = maxElev - minElev;
    const marginY = (range === 0) ? 100 : range * 0.1;
    const yMin = Math.max(0, minElev - marginY);
    const yMax = maxElev + marginY;
    
    const maxDist = elevationDataPoints[elevationDataPoints.length - 1].dist;
    
    const padLeft = 40;
    const padRight = 10;
    const padTop = 20;
    const padBottom = 20;
    const graphW = w - padLeft - padRight;
    const graphH = h - padTop - padBottom;

    const toX = (dist) => padLeft + (dist / maxDist) * graphW;
    const toY = (elev) => padTop + graphH - ((elev - yMin) / (yMax - yMin)) * graphH;

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<=4; i++) {
        const yVal = yMin + (yMax - yMin) * (i/4);
        const yPos = toY(yVal);
        ctx.moveTo(padLeft, yPos);
        ctx.lineTo(w - padRight, yPos);
        ctx.fillStyle = '#aaa';
        ctx.font = '10px sans-serif';
        ctx.fillText(Math.round(yVal) + 'm', 2, yPos + 3);
    }
    ctx.stroke();

    if (fetchedPoints.length > 1) {
        ctx.beginPath();
        ctx.moveTo(toX(fetchedPoints[0].dist), toY(fetchedPoints[0].elev));
        
        for (let i = 1; i < fetchedPoints.length; i++) {
            const p = fetchedPoints[i];
            ctx.lineTo(toX(p.dist), toY(p.elev));
        }
        
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.lineTo(toX(fetchedPoints[fetchedPoints.length-1].dist), padTop + graphH);
        ctx.lineTo(toX(fetchedPoints[0].dist), padTop + graphH);
        ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
        ctx.fill();
    }
}

// --- 7. 共通ヘルパー ---

function fitBoundsToLocations() {
    if(!map) return;
    const bounds = L.latLngBounds([startLatLng, endLatLng]);
    map.fitBounds(bounds, { padding: [50, 50] });
}

// ハイブリッド検索 (OSM -> GSI)
async function searchLocation(query) {
    try {
        // 1. まずOSM (Nominatim) で検索 (ランドマークに強い)
        const urlOsm = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
        const resOsm = await fetch(urlOsm);
        const dataOsm = await resOsm.json();

        if (dataOsm && dataOsm.length > 0) {
            return dataOsm; // ヒットしたらそれを返す
        }

        // 2. ヒットしなければ国土地理院 (住所検索) で検索 (住所に強い)
        const urlGsi = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`;
        const resGsi = await fetch(urlGsi);
        const dataGsi = await resGsi.json();

        if (!dataGsi || dataGsi.length === 0) return [];

        // 形式変換 (GSI -> OSM互換)
        return dataGsi.map(item => ({
            lat: item.geometry.coordinates[1],
            lon: item.geometry.coordinates[0],
            display_name: item.properties.title
        }));

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
    } catch(e) { console.error(e); }
    return null; 
}

function searchStarRiseSet(ra, dec, observer, startOfDay) {
    let rise = null;
    let set = null;
    const start = startOfDay.getTime();
    let prevAlt = null;
    for (let m = 0; m <= 1440; m += 10) {
        const time = new Date(start + m * 60000);
        // 表示用も null (大気差なし) に統一
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
    const fmt = (d) => d ? `${('00'+d.getHours()).slice(-2)}:${('00'+d.getMinutes()).slice(-2)}` : "--:--";
    return { rise: fmt(rise), set: fmt(set) };
}

function getCrossingTime(t1, t2, alt1, alt2) {
    const ratio = (0 - alt1) / (alt2 - alt1);
    const t = t1 + (t2 - t1) * ratio;
    return new Date(t);
}

function loadMyStarSettings() {
    const data = localStorage.getItem('soranotsuji_mystar');
    if(data) {
        try {
            const parsed = JSON.parse(data);
            if(parsed.ra !== undefined && parsed.dec !== undefined) {
                myStarRA = parsed.ra;
                myStarDec = parsed.dec;
            }
        } catch(e) {
            console.error("MyStar storage parse error", e);
        }
    }
}

// 位置情報を読み込む関数
function loadLocationSettings() {
    // 観測点
    const savedStart = localStorage.getItem('soranotsuji_start');
    if(savedStart) {
        try {
            const data = JSON.parse(savedStart);
            if(data.lat && data.lng && data.elev !== undefined) {
                startLatLng = { lat: data.lat, lng: data.lng };
                startElev = data.elev;
                
                const btn = document.getElementById('btn-reg-start');
                if(btn) {
                    btn.classList.add('active');
                    btn.title = "登録済みの観測点を呼び出し";
                }
            }
        } catch(e) { console.error(e); }
    }

    // 目的地
    const savedEnd = localStorage.getItem('soranotsuji_end');
    if(savedEnd) {
        try {
            const data = JSON.parse(savedEnd);
            if(data.lat && data.lng && data.elev !== undefined) {
                endLatLng = { lat: data.lat, lng: data.lng };
                endElev = data.elev;

                const btn = document.getElementById('btn-reg-end');
                if(btn) {
                    btn.classList.add('active');
                    btn.title = "登録済みの目的地を呼び出し";
                }
            }
        } catch(e) { console.error(e); }
    }
}

// 眼高差（Dip）を計算する関数 (度数法)
function getHorizonDip(elevation) {
    if (!elevation || elevation <= 0) return 0; // 数値以外・0以下は0を返す
    // 地球を真球と仮定した幾何学的計算
    // cos(θ) = R / (R + h)
    const val = EARTH_RADIUS / (EARTH_RADIUS + elevation);
    if (val >= 1) return 0; // エラー回避
    const dipRad = Math.acos(val);
    return dipRad * (180 / Math.PI); // ラジアン -> 度
}

// --- 以下、日時計算系ロジック (既存) ---

// 起動時に現在時刻ではなく日の出時刻をセットする関数
function setSunrise() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = ('00' + (now.getMonth() + 1)).slice(-2);
    const dd = ('00' + now.getDate()).slice(-2);
    
    // 日付を今日にセット
    const dInput = document.getElementById('date-input');
    if(dInput) dInput.value = `${yyyy}-${mm}-${dd}`;
    
    // 日の出時刻を計算
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    
    let h = 6, m = 0; // デフォルト
    try {
        const observer = new Astronomy.Observer(startLatLng.lat, startLatLng.lng, startElev);
        const sunRise = Astronomy.SearchRiseSet('Sun', observer, +1, startOfDay, 1);
        if(sunRise && sunRise.date) {
            h = sunRise.date.getHours();
            m = sunRise.date.getMinutes();
        }
    } catch(e) { console.error(e); }
    
    const timeStr = `${('00' + h).slice(-2)}:${('00' + m).slice(-2)}`;
    
    const tInput = document.getElementById('time-input');
    const tSlider = document.getElementById('time-slider');
    if(tInput) tInput.value = timeStr;
    if(tSlider) tSlider.value = h * 60 + m;

    // ラジオボタンを「日の出」にチェックを入れる
    const rBtn = document.getElementById('jump-sunrise');
    if(rBtn) rBtn.checked = true;

    updateCalculation();
    if(isDPActive) updateDPLines();
}

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
    
    uncheckTimeShortcuts(); // ★手動変更時に選択解除
    updateCalculation();
    if(isDPActive) updateDPLines();
}

function toggleMove() {
    const btn = document.getElementById('btn-move');
    if (moveTimer) {
        clearInterval(moveTimer);
        moveTimer = null;
        if(btn) btn.classList.remove('active');
    } else {
        if(btn) btn.classList.add('active');
        // 1分間隔から「1日」間隔へ
        moveTimer = setInterval(() => { addDay(1); }, 1000);
    }
}

function addMonth(months) {
    const dInput = document.getElementById('date-input');
    if(!dInput) return;
    const date = new Date(dInput.value);
    date.setMonth(date.getMonth() + months);
    
    const yyyy = date.getFullYear();
    const mm = ('00' + (date.getMonth() + 1)).slice(-2);
    const dd = ('00' + date.getDate()).slice(-2);
    dInput.value = `${yyyy}-${mm}-${dd}`;
    uncheckTimeShortcuts(); // ★手動変更時に選択解除
    updateCalculation();
    if(isDPActive) updateDPLines();
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
    uncheckTimeShortcuts(); // ★手動変更時に選択解除
    updateCalculation();
    if(isDPActive) updateDPLines();
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

// ★修正: 正確な月齢ジャンプ機能
function addMoonMonth(direction) {
    const dInput = document.getElementById('date-input');
    const tSlider = document.getElementById('time-slider');
    if(!dInput || !tSlider) return;
    
    // 現在の日時を取得
    const dateStr = dInput.value;
    const timeVal = parseInt(tSlider.value);
    const h = Math.floor(timeVal / 60);
    const m = timeVal % 60;
    const current = new Date(`${dateStr}T${('00' + h).slice(-2)}:${('00' + m).slice(-2)}:00`);

    // 1. 現在の月齢（位相）を取得 (0-360度)
    const currentPhase = Astronomy.MoonPhase(current);

    // 2. およその移動先日時を計算 (平均朔望月 29.53日分)
    const roughMoveMs = direction * SYNODIC_MONTH * 24 * 60 * 60 * 1000;
    const roughTargetDate = new Date(current.getTime() + roughMoveMs);

    // 3. 検索開始日時を設定 (およその日時から5日前から探せば確実)
    // Astronomy.SearchMoonPhase は start_date 以降で最初にその位相になる瞬間を探す
    const searchStartDate = new Date(roughTargetDate.getTime() - 5 * 24 * 60 * 60 * 1000);

    // 4. 正確な日時を検索 (検索範囲は10日もあれば十分)
    const result = Astronomy.SearchMoonPhase(currentPhase, searchStartDate, 10);

    if (result && result.date) {
        const targetDate = result.date;
        
        // 日付・時刻を更新
        const yyyy = targetDate.getFullYear();
        const mm = ('00' + (targetDate.getMonth() + 1)).slice(-2);
        const dd = ('00' + targetDate.getDate()).slice(-2);
        dInput.value = `${yyyy}-${mm}-${dd}`;
        
        const th = targetDate.getHours();
        const tm = targetDate.getMinutes();
        const timeStr = `${('00' + th).slice(-2)}:${('00' + tm).slice(-2)}`;
        
        const tInput = document.getElementById('time-input');
        if(tInput) tInput.value = timeStr;
        tSlider.value = th * 60 + tm;
        
        uncheckTimeShortcuts(); // ★手動変更時に選択解除
        updateCalculation();
        if(isDPActive) updateDPLines();
    } else {
        // 見つからなかった場合（エラー回避）は従来通り平均値で移動
        const fallbackDate = roughTargetDate;
        const yyyy = fallbackDate.getFullYear();
        const mm = ('00' + (fallbackDate.getMonth() + 1)).slice(-2);
        const dd = ('00' + fallbackDate.getDate()).slice(-2);
        dInput.value = `${yyyy}-${mm}-${dd}`;
        // 時刻はそのまま
        uncheckTimeShortcuts(); // ★手動変更時に選択解除
        updateCalculation();
        if(isDPActive) updateDPLines();
    }
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
        
        uncheckTimeShortcuts(); // ★手動変更時に選択解除
        updateCalculation();
        if(isDPActive) updateDPLines();
    } else {
        alert("計算範囲内で見つかりませんでした。");
    }
}

// 以下、updateCalculation, drawDirectionLine, renderCelestialList などを含む完全版
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
    const lat = startLatLng.lat;
    const lng = startLatLng.lng;
    if (typeof Astronomy === 'undefined') return;
    let observer;
    try {
        observer = new Astronomy.Observer(lat, lng, startElev);
    } catch(e) { return; }
    linesLayer.clearLayers();
    bodies.forEach(body => {
        let equatorCoords;
        if (body.id === 'Polaris') {
            equatorCoords = { ra: POLARIS_RA, dec: POLARIS_DEC };
        } else if (body.id === 'Subaru') {
            equatorCoords = { ra: SUBARU_RA, dec: SUBARU_DEC };
        } else if (body.id === 'MyStar') {
            equatorCoords = { ra: myStarRA, dec: myStarDec };
        } else {
            equatorCoords = Astronomy.Equator(body.id, calcDate, observer, false, true);
        }
        
        const horizon = Astronomy.Horizon(calcDate, observer, equatorCoords.ra, equatorCoords.dec, null);
        
        let riseStr = "--:--";
        let setStr  = "--:--";
        if (body.id === 'Polaris' || body.id === 'Subaru' || body.id === 'MyStar') {
            let r, d;
            if(body.id === 'Polaris') { r=POLARIS_RA; d=POLARIS_DEC; }
            else if(body.id === 'Subaru') { r=SUBARU_RA; d=SUBARU_DEC; }
            else { r=myStarRA; d=myStarDec; }
            const times = searchStarRiseSet(r, d, observer, startOfDay);
            riseStr = times.rise;
            setStr = times.set;
        } else {
            try {
                const rise = Astronomy.SearchRiseSet(body.id, observer, +1, startOfDay, 1);
                const set  = Astronomy.SearchRiseSet(body.id, observer, -1, startOfDay, 1);
                const fmt = (evt) => evt ? `${('00'+evt.date.getHours()).slice(-2)}:${('00'+evt.date.getMinutes()).slice(-2)}` : null;
                riseStr = fmt(rise);
                setStr  = fmt(set);
            } catch(e) { }
        }
        if (!riseStr) riseStr = "--:--";
        if (!setStr) setStr = "--:--";
        if (riseStr === "--:--" && setStr === "--:--") {
             if (horizon.altitude > 0) {
                 riseStr = "00:00"; setStr = "00:00"; 
             }
        }
        const dataEl = document.getElementById(`data-${body.id}`);
        if (dataEl) {
            dataEl.innerText = `出 ${riseStr} / 入 ${setStr} / 方位 ${horizon.azimuth.toFixed(0)}° / 高度 ${horizon.altitude.toFixed(0)}°`;
        }
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
    const lengthKm = 1000;
    const rad = (90 - azimuth) * (Math.PI / 180);
    const dLat = (lengthKm / 111) * Math.sin(rad);
    const dLng = (lengthKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.cos(rad);
    const endPos = [lat + dLat, lng + dLng];
    const opacity = altitude < 0 ? 0.3 : 1.0; 
    const dashArray = body.isDashed ? '10, 10' : null;
    L.polyline([[lat, lng], endPos], {
        color: body.color,
        weight: 6,
        opacity: opacity,
        dashArray: dashArray
    }).addTo(linesLayer);
}

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
        if(body.isCustom) return; 
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
        if (isDPActive) updateDPLines();
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
    if(editingBodyId === 'MyStar') {
        const ind = document.getElementById('style-MyStar');
        if(ind) ind.style.color = colorCode;
    }
    finishStyleEdit();
}
function applyLineStyle(styleType) {
    if (!editingBodyId) return;
    const body = bodies.find(b => b.id === editingBodyId);
    body.isDashed = (styleType === 'dashed');
    if(editingBodyId === 'MyStar') {
        const ind = document.getElementById('style-MyStar');
        if(ind) ind.className = `style-indicator ${body.isDashed ? 'dashed' : 'solid'}`;
    }
    finishStyleEdit();
}
function finishStyleEdit() {
    renderCelestialList();
    updateCalculation();
    if(isDPActive) updateDPLines();
    closePalette();
}

// --- 9. 訪問者カウンター機能 ---

function initVisitorCounter() {
    // ローカルストレージチェック
    const lastVisit = localStorage.getItem('soranotsuji_last_visit');
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${('00'+(today.getMonth()+1)).slice(-2)}-${('00'+today.getDate()).slice(-2)}`;
    
    let action = 'get'; // 基本はデータ取得のみ

    // 日付が変わっていたらカウントアップ要求
    if (lastVisit !== todayStr) {
        action = 'visit';
        localStorage.setItem('soranotsuji_last_visit', todayStr);
    }

    // GASへ通信
    fetch(`${GAS_API_URL}?action=${action}`)
        .then(response => response.json())
        .then(data => {
            if(data.error) {
                console.error("Counter Error:", data.error);
                return;
            }
            visitorData = data;
            updateCounterDisplay();
        })
        .catch(err => console.error("Fetch Error:", err));
}

// ★追加: ショートカットラジオボタンの選択解除用関数
function uncheckTimeShortcuts() {
    const radios = document.querySelectorAll('input[name="time-jump"]');
    radios.forEach(r => r.checked = false);
}

function updateCounterDisplay() {
    if (!visitorData) return;
    document.getElementById('cnt-today').innerText = visitorData.today;
    document.getElementById('cnt-yesterday').innerText = visitorData.yesterday;
    document.getElementById('cnt-year').innerText = visitorData.yearTotal;
    document.getElementById('cnt-last').innerText = visitorData.lastYearTotal;
}

// グラフ表示
function showGraph(type) {
    if (!visitorData || !visitorData.dailyLog) return;
    
    const modal = document.getElementById('graph-modal');
    modal.classList.remove('hidden');
    
    const canvas = document.getElementById('visitor-canvas');
    const ctx = canvas.getContext('2d');
    
    // キャンバスサイズ調整
    const w = canvas.clientWidth;
    const h = 300; 
    canvas.width = w;
    canvas.height = h;
    
    ctx.clearRect(0, 0, w, h);
    
    let data = visitorData.dailyLog;
    if (data.length === 0) return;

    document.getElementById('graph-title').innerText = 
        (type === 'current') ? "今年の訪問者数推移" : "昨年の訪問者数推移 (データなし)";

    if (type !== 'current') {
        ctx.fillStyle = "#666";
        ctx.textAlign = "center";
        ctx.fillText("データがありません", w/2, h/2);
        return;
    }

    // グラフ描画 (折れ線)
    const padding = 40;
    const graphW = w - padding * 2;
    const graphH = h - padding * 2;
    
    // 最大値検索
    let maxVal = 0;
    data.forEach(d => { if(d.count > maxVal) maxVal = d.count; });
    if(maxVal < 10) maxVal = 10; // 最低でも目盛り10

    // 枠線
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, h - padding);
    ctx.lineTo(w - padding, h - padding);
    ctx.stroke();

    // プロット
    ctx.strokeStyle = "#007bff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const daysInYear = 365;
    
    data.forEach((d, i) => {
        const x = padding + (i / (data.length - 1 || 1)) * graphW;
        const y = (h - padding) - (d.count / maxVal) * graphH;
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        
        ctx.fillStyle = "#007bff";
        ctx.fillRect(x - 2, y - 2, 4, 4);
    });
    ctx.stroke();
    
    // 最大値ラベル
    ctx.fillStyle = "#333";
    ctx.textAlign = "right";
    ctx.fillText(maxVal, padding - 5, padding + 10);
    ctx.fillText("0", padding - 5, h - padding);
}

function closeGraph() {
    document.getElementById('graph-modal').classList.add('hidden');
}