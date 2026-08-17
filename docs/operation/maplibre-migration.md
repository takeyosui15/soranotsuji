# 本体地図のMapLibre移行 実施計画書(手順3〜4)

> **✅ 計画完了(2026-07-20 v1.34.0)**: 手順1〜4の全工程が完了し、地図はMapLibre GL JSに
> 一本化された(Leaflet撤去済み)。本書は経緯の記録として保存する。

地図全面移行計画(Leaflet → MapLibre GL JS → 将来Custom Layerでthree.js資産の注入)の
**手順3=本体地図の機能単位の段階移行**の実施計画です。
手順1(宙検索データ層)・手順2(宙断面ビューでのMapLibre初導入)は完了済み(v1.22〜v1.27)。

## 方針(2026-07-19 その5の回答で合意済み)

- **一発置換はしない。**機能群単位で「1ラウンド=1機能群」を移行する。
- **URLフラグ `?maplibre=1` で新旧を切り替え**られるようにし、移行中も既定はLeafletのまま。
  全機能群の移行完了+実機確認の後に既定をMapLibreへ切り替え、最後にLeafletを撤去(手順4)。
- 座標順([lat,lng]⇄[lng,lat])と addTo/remove の差は**薄いアダプタ(数十行)**で吸収する。
- 各ラウンドはローカルハーネス(vendor+モック)で移行前後の挙動を検証してからコミットする。

## 現状の依存の棚卸し(2026-07-19実測)

- `map.*` 呼び出し約50箇所 / `L.*` 約70箇所(script.js)
- 宙断面ビューで実証済みの共有資産: 地理院ラスタソース・gsidemプロトコル(DEM→terrain-RGB)・
  swiftshader環境でのヘッドレス検証ノウハウ

| # | 機能群 | 主な依存 | 移行方法 | 難易度 |
|---|---|---|---|---|
| 1 | ベース地図+コントロール | タイル4種(地理院 標準/淡色/写真+OSM)・レイヤ切替/ズーム/スケール/照準⌖/パン▲▼・クリックで地点移動・recenterPointInView | rasterソース×4+setStyleではなくlayer可視切替・IControl化・projectはアダプタ | 中 |
| 2 | マーカー/ポップアップ | 観測点/目的点/My地点/優辻/🎆等のdivIcon+HTMLポップアップ(locationLayer/myPointMarkerLayer) | maplibregl.Marker(element)+Popup。レイヤグループはアダプタの配列管理に置換 | 中 |
| 3 | 辻ライン(dp) | dpLayer(ポリライン+時刻マーカー群)・dp365LayerByBody | GeoJSONソース+lineレイヤ(天体毎にfeature分割)+circleレイヤ | 中 |
| 4 | 辻検索/宙検索オーバーレイ | 辻マーカー・視界扇形+標本点(_ssMapLayer) | GeoJSONソース+fill/circleレイヤ | 小 |
| 5 | 辻メッシュ | imageOverlay×2(Canvas画像)+Canvasレンダラのcircle群+独自ヒットテスト | imageソース(GPU合成で高速化見込み)+ヒットテストは自前mathのため流用可 | 大 |

## ラウンド割り(1ラウンド=1機能群。順序どおり)

1. **R1: アダプタ+機能群1** — `?maplibre=1`時に本体地図をMapLibreで生成。アダプタ
   (`mapAdapter`: setView/panTo/getZoom/project/unproject/on(click)/座標順変換)を新設し、
   機能群1の呼び出しをアダプタ経由に置換。未移行機能はフラグ時に安全に無効化+「移行中」表示。
   **【完了 v1.28.0】** 安全無効化は「シャドウLeaflet地図」方式で実装:
   フラグON時、未移行機能の描画先として非表示のLeaflet地図(タイル読込なし・通信なし)を
   用意し、既存の`L.*`/`map.*`約120箇所を一切変更せずに落とさない(見えないだけ)。
   可視のMapLibre側は moveend でシャドウの視野を追従させ、内部計算の整合を保つ。
   機能群毎の移行(R2〜R5)は「シャドウへの描画をMapLibre描画に差し替える」作業になり、
   R6でシャドウ地図ごとLeafletを撤去する。検証: tests/verify109.js(19チェック)。
2. **R2: 機能群2(マーカー/ポップアップ)** — フラグ時のマーカー全種を移行。
   **【完了 v1.29.0】** 観測点/目的点(ポップアップ付き)・観測点-目的点の2本線(GeoJSON line)・
   My観測点/My目的点(ポップアップ+クリック適用)・🎆+ばらつき範囲円(fill)。
   マーカーは`_glMarkerGroups`(layerGroup相当のグループ管理)で保持。
   divIconのCSS transform(ピン形状の回転)とMapLibreの位置決めインラインtransformが
   衝突するため、**マーカー要素は必ずラッパーdivで包む**(重要な移植ノウハウ)。
   優辻マーカーは辻メッシュ機能の一部のためR5で移行する。検証: tests/verify110.js(14チェック)。
3. **R3: 機能群3(辻ライン)**
   **【完了 v1.30.0】** 方位線(linesLayer相当)も本ラウンドで移行(線描画で一括)。
   破線種はデータ駆動にできないため**dash種別キー+種別毎レイヤのfilter**で描き分け
   (実線/点線/破線/一点鎖線/二点鎖線の5種)。dashArrayのpx値はMapLibreでは
   **線幅倍の単位**になるため÷線幅で換算。時刻ラベルはLeafletと同じDOMマーカー、
   時刻点はcircleレイヤ。辻ライン365は「bodyId毎のfeatureキャッシュ+表示集合+RAF合流の
   setData」でLeafletのlayerGroup切替(計算済みは即表示・計算中は逐次追加)を再現。
   検証: tests/verify111.js(9チェック)。
4. **R4: 機能群4(辻検索/宙検索オーバーレイ)**
   **【完了 v1.31.0】** 宙検索の視界扇形(fill+line)+扇形標本点(circle。塗り=行選択時の
   雲量着色をデータ駆動)+ホバーツールチップ(mousemove/mouseleaveのPopup)。
   「辻マーカー」は辻検索ではなく辻メッシュ機能の要素(集合マーカー/ピン)のためR5で移行。
   検証: tests/verify112.js(7チェック)。
5. **R5: 機能群5(辻メッシュ)** — 最重量。imageソース化とホバー/クリックの再結線。
   **【完了 v1.32.0】** メッシュ画像/辻マーカー画像はimageソース+rasterレイヤ
   (`raster-resampling: nearest`でpixelated相当)。**MapLibre 4.xのupdateImageは
   coordinatesを反映しない**ため`setCoordinates`併用が必須(検証で発見した実バグ)。
   金ドット(最大5000)はcircleレイヤ+レイヤイベント(クリック=観測点設定/ホバー=ツールチップ)。
   優辻ピンはDOMマーカー。マーカー/ポップアップのクリックは地図へ伝播しないよう
   stopPropagationで遮断(Leafletは既定で遮断される差異)。金ドット上の一般クリックは
   queryRenderedFeaturesで抑止。レイヤ表示状態はmap.hasLayerの代わりに共通の問い合わせ口
   `_tmLayerShown('mesh'|'gold')`に集約。検証: tests/verify113.js(14チェック)。
6. **R6: 既定切替+手順4(Leaflet撤去)** — 実機確認後に既定をMapLibreへ。Leafletのタグ・
   アダプタの旧分岐・`L.*`を撤去し、ズーム連続値化などの挙動差を最終調整。
   **【既定切替 完了 v1.33.0】** 本体地図の既定エンジンをMapLibreへ切替。
   `?maplibre=0`で旧Leaflet地図に戻せる(実機確認期間の保険。共有URLには乗らない)。
   移行中バッジは撤去。localStorage/短縮URLの状態は両エンジン共通(跨いでも保持)。
   検証: tests/verify114.js(7チェック)。旧Leaflet挙動のverify96〜108は
   `?maplibre=0`を明示して歴史的挙動を検証し続ける。
   **【手順4=Leaflet撤去 完了 v1.34.0】** 実機確認(v1.33.1で全項目OK)の後に実施。
   - `?maplibre=0/1`分岐(USE_MAPLIBRE)・シャドウ地図・`L.*`約120箇所・leafletタグを全撤去
     (旧フラグは無視される=過去の共有URLでも無害)
   - 純math用途のL.latLng().distanceTo()はLeaflet互換Haversine(`_geoDistM`。R=6371000)へ置換し
     従来の数値を凍結(東京→大阪=403.06kmをverify116で回帰固定)
   - 地図コントロールの地スタイル(白ボタン/角丸/影)は旧leaflet.css相当を`style.css`の`.gl-bar`へ移植
   - 旧verify96〜108はフラグ無しに戻し、**全てMapLibre上で従来のチェックにPASS**
     (Leaflet内部を見ていた3本[99/103/105]はGLソース/DOMの等価チェックへ移植)
   - 副産物: 辻メッシュ詳細リストの行ジャンプで観測点ポップアップが開かない潜在バグ
     (Leaflet APIのopenPopup残り)を発見・修正
   - 検証: tests/verify116.js(10チェック)+全20本265チェックPASS

## 検証方法

- 各ラウンドで `tests/verify1NN.js` を追加: フラグOFF(Leaflet)の全回帰+フラグON(MapLibre)の
  同等性チェック(操作+状態+可能ならスクリーンショット比較)。
- スマホ実機(たけちゃんさんのMac/スマホ)での操作感確認は、機能群1と5の完了時に依頼する。

## 留意点(その5の回答から再掲)

- 座標順の取りこぼしは「南極沖に観測点」型のバグになる — アダプタ境界でのみ変換し、
  アプリ内部は従来どおり[lat,lng]で統一する。
- MapLibreのズームは連続値(0.25刻みスナップなし)。`getZoom()`前提のロジックは要再確認
  (辻メッシュのz14/z15計算は自前mathのため無影響)。
- ペイロード増(Leaflet約42KB→MapLibre約230KB gzip)は、手順4のLeaflet撤去で相殺される。
