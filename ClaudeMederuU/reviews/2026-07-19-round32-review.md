# レビュー記録 2026-07-20 — 第32ラウンド差分(v1.34.0 手順4=Leaflet完全撤去)

地図全面移行計画の最終工程(Leaflet撤去)の実施記録。実機確認(v1.33.1で全項目OK)を受けて実施した。

## 撤去したもの

- leafletのscript/linkタグ(index.html)・グローバル`L`への依存 約120箇所
- エンジン分岐 `USE_MAPLIBRE`(約40分岐)とシャドウLeaflet地図(受け皿)
- Leaflet時代の描画本体: initMapのLeaflet部・マーカー/線/メッシュ/オーバーレイの旧実装・
  dp365LayerByBody等のlayerGroup管理・`_tmHoverTooltip`等のLeafletオブジェクト
- `?maplibre=0/1`は**無視される**(過去の共有URLに付いていても無害)

## 置き換え/移植

- **距離計算**: L.latLng().distanceTo()の純計算10箇所を`_geoDistM`(Leaflet CRS.Earth.distance
  互換のHaversine。R=6371000)へ。**式と半径を変えないことで可視判定・距離表示の数値を凍結**
  (東京→大阪=403.06kmをverify116の回帰値として固定)。
- **コントロールの地スタイル**: `.leaflet-bar`(白ボタン/角丸/影)相当をstyle.cssの`.gl-bar`へ移植。
- **検索範囲bounds**: L.latLngBounds→プレーンオブジェクト`{west,east,north,south}`。

## 発見・修正した潜在バグ

- 辻メッシュ詳細リストの行ジャンプ(`_tmJumpToHit`)に`_tmObsMarker.openPopup()`(Leaflet API)が
  残っており、MapLibreマーカーではTypeError→観測点ポップアップが開かなかった(R5からの残り)。
  `togglePopup()`+isOpenガードに修正。**「旧APIの残り」はgrepの語彙(openPopup等)を撤去チェック
  リスト化して洗うのが有効**(verify116のV0で仕組み化)。

## テスト資産の移植

- 旧verify96〜108はフラグ無しに戻し、**全てMapLibre上で従来のチェックにPASS**させた。
  Leaflet内部を検査していた3本のみ等価チェックへ移植:
  99(_fwMapMarker→.fw-map-icon DOM+fw-circleソース)・103(_ssMapLayer→ss-fan/ss-pointsソース)・
  105(同)。109〜114の「Leaflet側」検証は「旧フラグは無視される」検証へ書き換え。
- verify113のドットクリックのフレーク(描画完了前のクリック)を、queryRenderedFeaturesの
  ポーリング待ちで恒久対策。
- 新設verify116: ソース検査(leafletタグ/L.*なし)・実行環境検査(Lグローバル/シャドウ/leaflet-DOMなし)・
  _geoDistM凍結値・.gl-bar移植・主要操作一連・旧フラグ無視(10チェック)。

## 学び

- **撤去の検証は「無いことのテスト」を作る**: 機能テストは残置物を検出できない。
  ソースgrep(タグ/API語彙)と実行環境(グローバル/DOMクラス)の両面で「無い」を固定すると、
  将来の逆流(うっかりLeaflet APIを書く)も検出できる。
- 数値を変えない置換は「同じ式+凍結値の回帰」で守る。ライブラリ互換の距離式は
  精度改善(WGS84化)の誘惑があるが、既存の判定値が変わるため意図的にHaversineを維持した
  (改善するなら別途、判定閾値と合わせて設計する)。
