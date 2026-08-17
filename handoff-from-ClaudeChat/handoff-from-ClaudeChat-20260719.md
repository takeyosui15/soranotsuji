# order-20260719: 宙検索・宙断面ビュー 仕様叩き台

> claude.ai での調査セッション（2026-07-19）のまとめ。
> Claude Code での実装検討の出発点（叩き台）として使う。

## 0. 背景・ゴール

- 宙の辻（開発版: https://takeyosui15.github.io/soranotsuji-dev/ ）に **「宙検索」** を追加したい
- 星空が見えるかどうかの空模様を **点数化** し、観測点×目的点ごとにスコアをリストアップ・検索できるようにする
- SCW（ https://supercweather.com ）のように **高度別の雲量** を扱い、**光害** も範囲を限定して数値化し、**先の予報** で予定を立てられるようにする
- **無料** で実現する。既存方針どおり **クライアントサイド完結**（GitHub Pages、サーバーレス）
- 注: SCW 自体は API 非公開（気象庁 GPV の可視化サイト）。同系統データを無料 API で取得する

## 1. データソース（調査結果）

### 1.1 Open-Meteo — 雲量・予報の本命

- ドキュメント: https://open-meteo.com/en/docs/jma-api
- 無料（非商用、目安 1日1万コール）、API キー不要、**CORS 対応**（ブラウザ直 fetch 可）、データは CC BY 4.0（クレジット必須）
- `/v1/jma`: 気象庁 GSM（全球 0.5°、11日先まで）+ MSM（日本域 5km、1時間刻み、4日先）。SCW と同系統の気象庁モデル
- **3層雲量がスコア計算の主役**（MSM の正規プロダクト）:
  - `cloud_cover_low`（〜3km）/ `cloud_cover_mid`（3〜8km）/ `cloud_cover_high`（8km〜）
- 複数地点バッチ可: `latitude=35.1,35.6&longitude=139.2,138.9` → グリッドスキャンのコール節約
- `forecast_days` 最大 11。それ以降は汎用 `/v1/forecast`（best_match）で最大 16 日（精度低下、傾向把握用）
- `elevation` パラメータで観測点標高を明示指定可（デフォルトは 90m DEM ダウンスケーリング。山頂観測点で有効）

リクエスト例:

```
https://api.open-meteo.com/v1/jma?latitude=35.77&longitude=139.47
  &hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m
  &timezone=Asia/Tokyo
```

#### 気圧面データ（断面ビュー・詳細分析用）

7変数 × 16面（1000/975/950/925/900/850/800/700/600/500/400/300/250/200/150/100 hPa ≒ 海抜110m〜15.8km）。
変数名は `{変数}_{気圧面}hPa` 形式。

| 変数 | 内容 | 備考 |
|---|---|---|
| `temperature_XXXhPa` | 気温 (°C) | |
| `relative_humidity_XXXhPa` | 相対湿度 (%) | |
| `dew_point_XXXhPa` | 露点 (°C) | 湿数 T−Td が雲の出やすさ指標 |
| `cloud_cover_XXXhPa` | 雲量 (%) | JMA は気圧面雲量を直接提供せず RH から Sundqvist(1989) 近似。low/mid/high と不一致あり → **スコアには使わず可視化用** |
| `wind_speed_XXXhPa` | 風速 | 300hPa 風速 → ジェット気流 → シーイング悪化の推定 |
| `wind_direction_XXXhPa` | 風向 (°) | |
| `geopotential_height_XXXhPa` | その面の実高度（海抜m） | 気圧面高度は変動するのでこれで取得 |

- MSM 気圧面: 約 11km 格子・3時間刻み・4日分（地上変数の 5km・1時間刻みより粗い）
- 応用: 観測点標高 > 950hPa 面高度 → 「眼下は雲海・頭上は快晴」の検出

#### 補助 API（同じく Open-Meteo・無料）

- Air Quality API: AOD（エアロゾル光学的厚さ）→ 透明度の指標
- Historical (ERA5) API（1940年〜）: 過去雲量から時期×場所の **晴天率統計** → 予報範囲外の長期計画用

### 1.2 7Timer! ASTRO — シーイング・透明度

```
https://www.7timer.info/bin/api.pl?lon=139.47&lat=35.77&product=astro&output=json
```

- 無料・キー不要。3時間刻み・3日分
- 雲量 1-9 / シーイング 1-8（0.5″未満〜2.5″超）/ 透明度 1-8 / リフト指数など
- GFS ベースで格子が粗く応答も遅め → 全点スキャンでなく **選択地点の詳細パネル用**
- **CORS は実機で要確認**（NG なら Cloudflare Workers 無料枠でプロキシ）

### 1.3 光害 — 静的データを前処理して同梱

時間変化しないので API でなく静的アセット化する。

| ソース | 形式 | 年 | ライセンス | 備考 |
|---|---|---|---|---|
| Falchi 2016 世界光害アトラス (GFZ) | GeoTIFF（人工輝度 mcd/m² の数値） | 2015 | 非商用条件・要クレジット | doi:10.5880/GFZ.1.4.2016.001。数値そのままなので **実装が最も楽** |
| Lorenz Atlas 2024 | PNG（1/120° ≒ 900m 格子） | 2024 | 明示なし（クレジット必須、再配布時は作者へ一報推奨） | https://djlorenz.github.io/astronomy/lp/ 。サイト全体が公開 GitHub リポジトリ（djlorenz/djlorenz.github.io）。アジア域マップ（5N-75N, 60E-180E）に日本が入る。国境なし版を色→ゾーンデコード（ゾーン+1 = 光害3倍、サブゾーン a/b = √3倍） |
| VIIRS VNP46A4/VJ146A4 | .h5 / GeoTIFF | 毎年 | CC0 | 地上光の放射輝度であり「空の明るさ」ではない → スコア用途には非推奨 |

- lightpollutionmap.info のタイル直叩きは規約 NG（有償 API 契約が必要）。目視確認用のみ
- **SQM 変換式**（自然光 22.0 mag/arcsec² = 0.171168465 mcd/m² と仮定）:
  - `total = artificial + 0.171168465` [mcd/m²]
  - `SQM = log10(total / 108000000) / (-0.4)`
  - SQM → NELM、Bortle への対応表あり（lightpollutionmap.info help 参照）

### 1.4 月明かり

- Astronomy Engine で自前計算（月齢・輝面比・月高度）。外部データ不要

## 2. スコア設計（案）

乗算型（どれか一つが致命的なら 0 点。SCW 的な直感に合う）:

```
晴天度 = (1 − 1.00·C_low)(1 − 0.85·C_mid)(1 − 0.40·C_high)   // 巻雲は星が透けるので軽め
宙スコア = 晴天度
         × f(透明度: AOD・湿度)
         × f(月: 高度 × 輝面比)
         × f(光害: SQM)
         × f(対象天体の高度条件)
```

- 重み・関数形は要調整（→ §5 検討ポイント）
- UI: MSM 本領の直近 2〜3 日と、4日目以降（GSM/GFS 系）で **信頼度を色分け** 表示

## 3. 実装方針

### 3.1 キャッシュ（IndexedDB、サーバー不要）

- IndexedDB はブラウザ内蔵のクライアントサイド DB。**サーバーサイドスクリプト不要**。GitHub Pages 静的構成のまま使える
- localStorage との違い: 非同期・大容量（数百MB規模）・JS オブジェクトをそのまま保存可
- キー: モデル + 小数2桁丸め座標（MSM 5km 格子なのでそれ以上細かくしてもヒットする格子は同じ）
- TTL: 2〜3時間（MSM の更新周期は 3時間毎）
- 予報キャッシュはローカル使い捨て。**Google Drive 同期の対象外**（観測点リストは同期対象、という整理）
- iPhone Safari は長期未使用でストレージ削除の可能性があるが、キャッシュなので再取得すれば良い

```js
const dbReady = new Promise((ok, ng) => {
  const req = indexedDB.open('soranotsuji-wx', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('fc');
  req.onsuccess = () => ok(req.result);
  req.onerror = () => ng(req.error);
});

const idb = async (mode, fn) => {
  const db = await dbReady;
  return new Promise((ok, ng) => {
    const r = fn(db.transaction('fc', mode).objectStore('fc'));
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ng(r.error);
  });
};

const TTL = 2 * 3600e3;  // MSM は3時間毎更新なので2時間で失効
async function getForecast(lat, lon) {
  const key = `jma:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = await idb('readonly', s => s.get(key));
  if (hit && Date.now() - hit.t < TTL) return hit.data;
  const url = `https://api.open-meteo.com/v1/jma?latitude=${lat}&longitude=${lon}`
    + '&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high&timezone=Asia/Tokyo';
  const data = await (await fetch(url)).json();
  await idb('readwrite', s => s.put({ t: Date.now(), data }, key));
  return data;
}
```

### 3.2 光害の前処理パイプライン（一回だけのオフライン作業）

1. Falchi GeoTIFF から日本域を切り出し: `gdal_translate -projwin 122 46 154 24 in.tif japan.tif`（W N E S = 東経122〜154、北緯24〜46）
2. mcd/m² → SQM に変換し、0.1 等刻み程度で Uint8 量子化
3. グレースケール PNG かバイナリ（数百KB 想定）としてリポジトリに同梱
4. 実行時: 緯度経度 → 配列インデックス → SQM を O(1) ルックアップ（外部依存ゼロ）
- 最新性重視なら Lorenz 2024 の Asia PNG（国境なし版）を色→ゾーンデコードして同じ形式に落とす

### 3.3 出典表記

- フッター等に: Open-Meteo（CC BY 4.0）/ 7Timer! / Falchi et al. 2016 (GFZ) または Lorenz Light Pollution Atlas 2024

## 4. 宙断面ビュー（MapLibre GL JS、発展機能）

- Leaflet は真上 2D 専用のため、**この画面のみ** MapLibre GL JS を使用。**全面移行はしない**（既存 Leaflet 画面は不変更。Leaflet→MapLibre→CesiumJS の段階論を踏襲。ラスタタイルは共用可）
- `pitch`（`maxPitch: 85`）で斜め俯瞰、`setTerrain` で地形立体化
- **fill-extrusion の `fill-extrusion-base` / `fill-extrusion-height`** に雲底・雲頂高度を与えると、地面から生えるのではなく **空中に浮かぶ半透明スラブ** が描ける
- 雲量グリッド（Open-Meteo 複数地点リクエスト）→ d3-contour（マーチングスクエア）で等値線ポリゴン化（閾値 30/60/90% で入れ子の等高線）→ 低層/中層/上層の高度帯に配置
- 発展形: 16 気圧面の `cloud_cover_XXXhPa` を `geopotential_height` の高度に薄板としてスタック → 文字通りの「輪切り」断面（SCW の断面図の 3D 展開）
- **鉛直誇張 ×3〜10 が必須**（雲高度〜12km は水平スケールに対し薄すぎる）。地形の exaggeration と係数を統一しないと山と雲の位置関係が嘘になる
- 半透明 fill-extrusion の重なりは描画順アーティファクトが出るが、opacity 0.3〜0.4 なら許容範囲
- 地形: 地理院標高タイル + maplibre-gl-gsi-terrain（無料）。ベースマップも地理院タイル/OSM で無料構成可
- 時間スライダー: GeoJSON ソースの `setData` 差し替えでアニメーション
- 将来: MapLibre の Custom Layer API に three.js シーンを注入可能 → **宙の窓のカメラ・シェーダー資産と合流** できる（ビルボード/ボリューム風シェーダーで雲の立体感はその段階で）

```js
const map = new maplibregl.Map({
  container: 'map', style: baseStyle,
  center: [139.5, 35.8], zoom: 8, pitch: 68, maxPitch: 85
});
const EX = 4;  // 鉛直誇張係数
map.addLayer({
  id: 'cloud-low', type: 'fill-extrusion', source: 'cloudLowGeoJSON',
  paint: {
    'fill-extrusion-color': '#a8c8e8',
    'fill-extrusion-base':   ['*', EX, ['get', 'base']],   // 雲底(m)
    'fill-extrusion-height': ['*', EX, ['get', 'top']],    // 雲頂(m)
    'fill-extrusion-opacity': 0.35
  }
});
```

## 5. 未決事項 / Claude Code との検討ポイント

- [ ] スコア関数の重みと形（雲3層・透明度・月・光害・天体高度の合成方法、パラメータ調整手段）
- [ ] グリッドスキャン設計: 対象範囲・格子間隔（0.1〜0.2°?）・バッチ分割・1日あたりコール数の見積もり
- [ ] 「観測点×目的点」のスコア定義: 観測点上空の空か、目的方向の空か。方位・仰角別の扱い
- [ ] 光害データの選択: Falchi 2015（楽・数値そのまま）vs Lorenz 2024（新しい・色デコード要）。量子化仕様
- [ ] 7Timer の CORS 実機確認
- [ ] UI 設計: 検索条件・結果リスト・信頼度表示・宙断面ビューへの画面遷移
- [ ] 既存機能（薄明計算・ゴールデンアワー/ブルーアワー・カメラ画角）との統合ポイント
- [ ] テスト設計と仕様書化（既存ワークフローの HANDOFF.md 運用に載せる）
