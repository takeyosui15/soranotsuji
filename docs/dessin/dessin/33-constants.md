# デッサン（dessin）
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
## 数の単一情報源 (sora-constants.js)
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------

### まず一言で:
- 地球の大きさ・大気差・観測者・標高タイル・可視判定の既定値と、「どこでも同じでなければならない小さな式」を `sora-constants.js` に1度だけ書く。
  本体(index.html)は `<script src="sora-constants.js">`、ワーカーは `importScripts('sora-constants.js')`、Nodeの道具は `require()` で同じ `SORA` を読む。
  値を変えるときはそこだけを変える(APP_VERSIONと同じ考え方)。

### 経緯(第157・依頼者):
- 「プログラムの中で繰り返し使われる同じ意味の定数は、1箇所を直すと他も直るようにしておきましょう。関数のインターフェースを見直して、なるべく定数は持たないように。持つならメイン関数で。ワーカーもインターフェースを見直した方がよい。地球の半径とか、気差係数とか」。
- きっかけは第156の気差係数: 大気差補正オフのときのkが、可視マップのその場計算は0.132・他の7箇所は0と、同じ量に2つの流儀があった。
- 棚卸しの結果(第157・AIの監査): 物理・幾何の定数の出現は本体約70箇所・ワーカー4本で27箇所・道具16箇所。量としては11群(下の表)と、重複して実装された関数4種(局所半径×2・ハバーサイン×3・視高度↔距離×2・標高の復号×3)。
  「同じ量に別の値」が3件(赤道半径6378137を球の半径として使う航程線/球面の終点・静的資産の道具の球半径6371000とアプリの局所半径6371014・補正オフのk)。

### 設計の原則(リーダブルコードの実践):
1. **値は1箇所**: `SORA.EARTH.*` `SORA.REFRACTION.*` `SORA.OBSERVER.*` `SORA.VISIBILITY.*` `SORA.DEM.*`。名前は「何の値か」が読める英語(`WGS84_SEMI_MAJOR_M`。`EARTH_RADIUS`のように意味が2つに割れる名前を作らない)。
2. **式は同じ関数**: ビット列まで同じでなければならない式(ハバーサイン・1画素の長さ・大円の補間・局所半径・Kの式)は `SORA.*()` の1本に置き、本体とワーカーがそれを呼ぶ。
   「同じ式を2箇所に書いて演算の順序を揃える」運用(第116〜)を、「同じ関数を呼ぶ」に変えた。
3. **設定を読むのは本体の1関数**: `refractionKInUse()`(=設定メニューに表示されている値。第158: オン=気象条件から算出(既定)・オフ=0=気差なし。第157の「オフ=0.132」は依頼者の方針変更で取り下げ)。計算の核(`_visJudgeCore`・ワーカー)は値を引数/メッセージで受け、`appState` を読まない。
4. **ワーカーの既定値は単一情報源から**: ワーカーに「黙って動く既定」を書かない。本体は常に明示して渡し、ワーカーの既定は `SORA` の値だけ(第157で kashimap-worker の 15/10/1.5 を `SORA.VISIBILITY/OBSERVER` に)。
5. **凍結値は触らない**: 短縮URL辞書v16の `'&meteoL=0.0065'` などの種は「発行済みURLの復号」のための凍結リテラル。定数参照にしない。

### 定数の表(第157時点):
| 群 | 名前 | 値 | 使う所 |
|---|---|---|---|
| 地球 | `EARTH.WGS84_SEMI_MAJOR_M` | 6378137 | 局所半径・Vincenty(辻ライン)・メルカトルの縮尺の元 |
| 地球 | `EARTH.WGS84_SEMI_MINOR_M` | 6356752.3142 | 局所半径・Vincenty |
| 地球 | `EARTH.WGS84_FLATTENING` | 1/298.257223563 | Vincenty |
| 地球 | `EARTH.HAVERSINE_RADIUS_M` | 6371000 | ハバーサイン距離(Leaflet互換の凍結値)・辻メッシュの1度あたりm・道具の球半径 |
| 地球 | `EARTH.EQUATOR_CIRCUMFERENCE_M` | 40075016.686 | メルカトルの1画素の長さ(2π·aで導出しない=リテラルのまま。刻みの個数が変わると判定が変わる) |
| 大気差 | `REFRACTION.K_STANDARD` | 0.132 | 測量標準のK(標準気象でのK)。静的資産の道具の既定とヘルプの目安。第158から本体の計算では使わない(大気差補正オフ=K=0) |
| 大気差 | `REFRACTION.STD_PRESSURE_HPA` / `STD_TEMPERATURE_C` / `STD_LAPSE_RATE_K_PER_M` | 1013.25 / 15 / 0.0125 | 気象条件の既定(リセット・移行判定) |
| 大気差 | `REFRACTION.ISA_LAPSE_RATE_K_PER_M` | 0.0065 | 旧既定(保存データの移行判定) |
| 大気差 | `REFRACTION.K_FORMULA_FACTOR` / `K_FORMULA_GRADIENT` | 503 / 0.034 | K ≈ 503·P/T²·(0.034−Γ) |
| 観測者 | `OBSERVER.EYE_HEIGHT_M` | 1.5 | 可視マップの観測者・観測点の高さの既定 |
| 可視判定 | `VISIBILITY.EXCLUDE_TARGET_M` / `EXCLUDE_OBSERVER_M` | 15 / 10 | 除外範囲の既定(基本オプション・ワーカー・道具) |
| 可視判定 | `VISIBILITY.SUMMIT_BAND_M` / `SUMMIT_SEARCH_M` / `SUMMIT_UP_M` | 300 / 3000 / 100 | 山頂部(帯・探索半径・「山頂でない」判定) |
| 可視判定 | `VISIBILITY.PATH_CHUNK` | 64 | 統一可視判定の区間(大円を直線で近似する長さ≈128m) |
| 標高タイル | `DEM.GSI_TILE_BASE` | cyberjapandata.gsi.go.jp/xyz/ | タイルのURL |
| 標高タイル | `DEM.GSI_INVALID_CODE` / `GSI_CODE_WRAP` / `GSI_UNIT_M` | 0x800000 / 0x1000000 / 0.01 | PNGの符号 |
| 標高タイル | `DEM.GRID_NODATA` / `GRID_OFFSET_M` / `GRID_SCALE` | 65535 / 100 / 10 | ワーカー・道具のUint16格子 |
| 標高タイル | `DEM.FINE_ZOOM` / `COARSE_ZOOM` | 15 / 14 | DEM5A/5B/5C と DEM10B のズーム |
| 標高タイル | `DEM.JAPAN_BBOX` | 20〜46N・122〜156E | 地理院のタイルがある範囲(海=海面0mの判定もこの中だけ) |

関数: `calculateKFromMeteo(P,T,Γ)` `getLocalEarthRadius(lat)` `inv2ReffFor(latA,latB,k)` `haversineDistanceM(...)` `metersPerPixel(lat,zoom)` `insideJapan(lat,lng)` `greatCirclePath(lat1,lng1,lat2,lng2).at(f)`。

### 第157で入れた分(トランシェ1〜2と、3のうちK):
- 本体の `EARTH_RADIUS` `REFRACTION_K` `STD_P/T/L` `STD_L_OLD` `WGS84_SEMI_MAJOR/MINOR` `SB_SEARCH_M` `SB_UP_M` `TSUJIMESH_ZOOM` `_GSI_BBOX` と `APP_DEFAULTS` の除外/山頂部の既定は `SORA` の別名に(値はここに書かない)。
- `_geoDistM` `calculateKFromMeteo` `getLocalEarthRadius` `_pointInsideJapan` は `SORA` の関数を呼ぶだけに。1画素の長さの式(9箇所)は `SORA.metersPerPixel` か `SORA.EARTH.EQUATOR_CIRCUMFERENCE_M`(演算の順序を変えない)。
- `refractionKInUse()` を本体に1本。「オフ=0」の7箇所と可視マップの `_kmComputeK` を全部これに。係数欄の表示も同じ関数。
- ワーカー: tm-vis(ハバーサイン・刻み・大円)、kashimap(NODATA・BBOX・URL・1画素・既定値・metaの半径を実際の値に)、dp-line(WGS84・局所半径)。道具: 既定値・球半径・1画素・索引の zooms。
- テスト: verify182 N1 でハバーサインと1画素の長さが旧式とビット一致することを常設で見張る。
- レビューで追加: 辻メッシュの帯域分割(本体側 Cmax/jS/jE)も `SORA.VISIBILITY.PATH_CHUNK`(64の生の数が1箇所残っていた)。設定メニューの大気差の部品を appState に合わせる処理は `syncRefractionUiFromState()` 1本(起動時+古い形式のバックアップ取り込み)。基準視高度の自動算出の鍵 `_basePosKey()` にK。

### 残り(次のトランシェ。数値が変わるものは依頼者の判断):
- [ ] 標高の復号 `_elevFromRGB`(本体)・sora-terrain-worker・gsidemプロトコルの3実装を `SORA` の1関数に(gsidem版は無効値を0にする仕様差を保つ)。Terrarium→GSIの正規化も。
- [ ] `calculateDistanceForAltitudes` / `calculateApparentAltitude` に k を引数で渡す(今は中で `refractionKInUse()` を読む)。本体と辻ラインのワーカーの同名関数を1本に。
- [ ] ワーカーの既定値を撤去して「渡し忘れはエラー」に(今は `SORA` の既定で動く)。
- [ ] 【数値が変わる】`EARTH_RADIUS`(赤道半径)を球の半径として使う3箇所(航程線の終点・宙の窓の球面の終点・建物タイルの半径)を 6371000 にそろえるか(100kmで約100mの位置の差)。
- [ ] 【数値が変わる】静的資産の道具の `inv2R` の基底を 6371000 からアプリと同じ局所半径(富士山で6371014)にそろえるか(相対差2e-6。資産の再生成を伴う)。
- [ ] 【数値が変わる】`getHorizonDip` の経験定数 1.776′/√m(R と k≈0.13 を暗黙に含む)を `√(2h/Reff)` の導出式にして k に連動させるか。
- [x] 天体の見かけ高度の大気差(Astronomy.Horizon の 'normal')は astronomy-engine 内蔵の標準大気で、設定の気圧・気温は反映されない。地上のKとは別の量であることを設定のヘルプに書いた(第157)。**第158: 別のチェック「気差オプション」(appState.astroRefraction・既定オン)に分けた。ワーカーへは astroRefraction で渡す。**
- [ ] 辻検索/辻メッシュのワーカーの 0.35°/分(安全スキップ)の重複(物理定数ではない)。
