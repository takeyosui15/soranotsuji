/*
宙の辻 - Sora no Tsuji
Copyright (c) 2026 Sora no Tsuji Project
Released under the MIT License.
*/
// --- 1. 定数・初期設定 ---

// 北極星 (Polaris) の位置データ (J2000.0)
// Astronomy Engineには主要惑星以外の恒星データが組み込まれていないため定義します
const POLARIS_RA = 2.5303; // Right Ascension (hours)
const POLARIS_DEC = 89.2641; // Declination (degrees)

// 色の定義 (日本語名とCSS色の対応)
const COLOR_MAP = [
    { name: '桃', code: '#FFC0CB' }, { name: '橙', code: '#FFA500' },
    { name: '黄', code: '#FFFF00' }, { name: '黄緑', code: '#ADFF2F' },
    { name: '緑', code: '#008000' }, { name: '青', code: '#0000FF' },
    { name: '藍', code: '#4B0082' }, { name: '紫', code: '#800080' },
    { name: '茶', code: '#A52A2A' }, { name: '黒', code: '#000000' }
];

// 天体リストの初期データ
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

// 描画用レイヤー管理
const linesLayer = L.layerGroup().addTo(map);

// 現在選択中の天体ID（パレット用）
let editingBodyId = null;

// --- 2. 初期化処理 ---

// スケール追加（左下）
L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map);

// 今日の日付をセット
const now = new Date();
document.getElementById('date-input').valueAsDate = now;
// スライダー初期値 (今の時刻)
const currentMinutes = now.getHours() * 60 + now.getMinutes();
document.getElementById('time-slider').value = currentMinutes;

// リスト生成
renderCelestialList();
// 初回計算
updateCalculation();

// イベントリスナー設定
document.getElementById('date-input').addEventListener('change', updateCalculation);
document.getElementById('time-slider').addEventListener('input', updateCalculation);

// ラジオボタンの変更監視（ショートカット）
document.querySelectorAll('input[name="time-jump"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        if(e.target.checked) jumpToEvent(e.target.value);
    });
});


// --- 3. メイン計算 & 描画処理 ---

function updateCalculation() {
    // 日時の取得
    const dateStr = document.getElementById('date-input').value;
    const timeVal = parseInt(document.getElementById('time-slider').value);
    
    // 時刻表示更新
    const hours = Math.floor(timeVal / 60);
    const minutes = timeVal % 60;
    const timeStr = `${('00' + hours).slice(-2)}:${('00' + minutes).slice(-2)}`;
    document.getElementById('time-display').innerText = timeStr;

    // 計算用Dateオブジェクト生成
    const calcDate = new Date(`${dateStr}T${timeStr}:00`);
    
    // 地図の中心（観測地）
    const center = map.getCenter();
    const observer = new Astronomy.Observer(center.lat, center.lng, 0); // 高さ0mと仮定

    // レイヤーのクリア
    linesLayer.clearLayers();

    // 各天体の計算と描画
    bodies.forEach(body => {
        // UI上の情報更新用要素
        const infoEl = document.getElementById(`info-${body.id}`);
        
        // Astronomy Engineでの計算
        let equatorCoords;
        if (body.id === 'Polaris') {
            // 北極星は固定座標から現在の視位置を計算（簡易版）
            // 厳密には歳差運動などを考慮すべきですが、Astronomy.Equatorを使うと便利
            // ここではJ2000座標をそのまま使って簡易計算させます
            equatorCoords = new Astronomy.EquatorCoords(POLARIS_RA, POLARIS_DEC);
        } else {
            // 惑星・太陽・月
            equatorCoords = Astronomy.Equator(body.id, calcDate, observer, false, true);
        }

        // 地平座標（方位・高度）への変換
        const horizon = Astronomy.Horizon(calcDate, observer, equatorCoords.ra, equatorCoords.dec, 'normal');
        
        // データを保存（後でリスト表示更新に使用）
        body.azimuth = horizon.azimuth;
        body.altitude = horizon.altitude;

        // リストのテキスト更新
        if (infoEl) {
            infoEl.innerText = `方位:${horizon.azimuth.toFixed(1)}° / 高度:${horizon.altitude.toFixed(1)}°`;
        }

        // 地図への描画（チェックが入っている場合のみ）
        if (body.visible) {
            drawDirectionLine(center, horizon.azimuth, horizon.altitude, body);
        }
    });

    // 太陽・月の出没時刻計算（ショートカット用）
    updateRiseSetTimes(calcDate, observer);
}

// 地図上に線を引く
function drawDirectionLine(center, azimuth, altitude, body) {
    // 線の長さを決める（地図の表示範囲に基づく簡易計算）
    // 実際には「無限遠」の方向を示すため、画面外に出る長さがあれば十分
    const lengthKm = 5000; // 十分長い距離
    
    // 方位角から終点座標を計算 (Geodesicな計算ではないが、メルカトル図法上で直感的な方向へ)
    // ※Leafletの標準座標系では、真北=0度、時計回り。三角関数は数学的な0度(東)・反時計回りなので変換必要
    // 方位θ(北0,時計回り) -> 数学角(東0,反時計回り) = 90 - θ
    const rad = (90 - azimuth) * (Math.PI / 180);
    // 簡易的に緯度経度を加算（高緯度では誤差が出ますが、「方向」を見る分には許容範囲）
    // 正確にやるならGeodesicライブラリが必要ですが、今回はシンプルに直線を引きます
    // Leafletはメルカトルなので、角度そのままでは歪みますが、短い範囲ならOK。
    // 「宙の辻」のこだわりとして、少し正確に終点を計算してみます。
    
    // 終点の簡易計算 (1度あたり約111km)
    const dLat = (lengthKm / 111) * Math.sin(rad);
    const dLng = (lengthKm / (111 * Math.cos(center.lat * Math.PI / 180))) * Math.cos(rad);
    
    const endPos = [center.lat + dLat, center.lng + dLng];

    // スタイル決定
    const opacity = altitude < 0 ? 0.3 : 1.0; // 地平線下は薄く
    const dashArray = body.isDashed ? '10, 10' : null;

    L.polyline([center, endPos], {
        color: body.color,
        weight: 3,
        opacity: opacity,
        dashArray: dashArray
    }).addTo(linesLayer);
}

// 日の出・日の入り等の計算とラジオボタンへのセット
function updateRiseSetTimes(date, observer) {
    // Astronomy.SearchRiseSet(body, date, observer, direction, limit_days)
    // direction: +1=Rise, -1=Set
    
    const sunRise = Astronomy.SearchRiseSet('Sun', date, observer, +1, 0);
    const sunSet  = Astronomy.SearchRiseSet('Sun', date, observer, -1, 0);
    const moonRise = Astronomy.SearchRiseSet('Moon', date, observer, +1, 0);
    const moonSet  = Astronomy.SearchRiseSet('Moon', date, observer, -1, 0);

    // 時刻フォーマット関数
    const fmt = (astroTime) => {
        if (!astroTime) return "--:--";
        const d = astroTime.date; // JS Date object
        return `${('00' + d.getHours()).slice(-2)}:${('00' + d.getMinutes()).slice(-2)}`;
    };

    // 表示更新
    document.getElementById('time-sunrise').innerText = fmt(sunRise);
    document.getElementById('time-sunset').innerText = fmt(sunSet);
    document.getElementById('time-moonrise').innerText = fmt(moonRise);
    document.getElementById('time-moonset').innerText = fmt(moonSet);
    
    // 月齢計算 (Phase angleから推定)
    const moonPhase = Astronomy.MoonPhase(date);
    // 角度(0-360)を月齢(0-29.5)に簡易変換
    const moonAge = (moonPhase / 360) * 29.53;
    document.getElementById('moon-age-val').innerText = moonAge.toFixed(1);

    // イベント用データの保持（ラジオボタンクリック時に使用）
    window.currentRiseSetData = {
        sunrise: sunRise ? sunRise.date : null,
        sunset: sunSet ? sunSet.date : null,
        moonrise: moonRise ? moonRise.date : null,
        moonset: moonSet ? moonSet.date : null
    };
}

// ショートカットジャンプ機能
function jumpToEvent(eventType) {
    const data = window.currentRiseSetData;
    if (!data || !data[eventType]) return;

    const targetDate = data[eventType];
    // スライダーをその時刻に合わせる
    const minutes = targetDate.getHours() * 60 + targetDate.getMinutes();
    document.getElementById('time-slider').value = minutes;
    
    // 計算更新（ラジオボタンは選択されたまま）
    updateCalculation();
}


// --- 4. UI生成・パレット操作 ---

// 天体リストのHTML生成
function renderCelestialList() {
    const list = document.getElementById('celestial-list');
    list.innerHTML = '';

    bodies.forEach(body => {
        const li = document.createElement('li');
        
        // 線種クラス
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

// パネル開閉
function togglePanel() {
    const content = document.getElementById('panel-content');
    const icon = document.getElementById('toggle-icon');
    content.classList.toggle('closed');
    icon.innerText = content.classList.contains('closed') ? '▼' : '▲';
}

// --- パレット関連 ---

function openPalette(bodyId) {
    editingBodyId = bodyId;
    const palette = document.getElementById('style-palette');
    
    // 色ボタンの生成
    const colorContainer = document.getElementById('palette-colors');
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
    document.getElementById('style-palette').classList.add('hidden');
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
    // リスト再描画と地図更新
    renderCelestialList();
    updateCalculation();
    closePalette();
}