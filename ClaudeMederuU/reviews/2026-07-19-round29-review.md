# レビュー記録 2026-07-19 — 第29ラウンド差分(v1.32.0 本体地図MapLibre移行R5=辻メッシュ)

コミット前の差分(辻メッシュ表示の移行。最重量ラウンド)に対する3視点レビュー+検証で確定した事項の記録。

## 体制

- **視点1: 仕様適合** — 計画書R5(imageOverlay×2のimageソース化・ホバー/クリックの再結線)との突き合わせ
- **視点2: 正確性** — 画像の位置(bounds四隅)・金ドットのクリック/ホバー・ポップアップの
  固定/解除・表示切替・エンジン間の操作差(クリック伝播)
- **視点3: 回帰リスク** — hasLayer5箇所の置換・_tmShowPixelPopupのR1ガード撤去・フラグOFF不変

## 確定した事項と対処

### 1. 【実バグ発見・修正】MapLibre 4.xのImageSource.updateImageはcoordinatesを反映しない(視点2)

- `updateImage({url, coordinates})`のcoordinatesは無視され、画像が初期化時のダミー座標に
  描かれる(検証S1で発見: ソースのcoordinatesが[0,0]のまま)。**`setCoordinates()`の併用**で解決。
  imageソースを動的に動かす場合の必須ノウハウとして記録する。

### 2. 【エンジン差異の吸収】マーカー/ポップアップのクリックは地図へ伝播する(視点2)

- Leafletはマーカー/ポップアップのクリックを地図クリックへ伝播させないが、MapLibreの
  DOMマーカー/ポップアップは伝播する(コンテナ上のリスナーで拾われる)。伝播すると
  「ピンのポップアップ操作+画素ポップアップ表示」等が同時に起きるため、`_glAddMarker`と
  `_glTmOpenPopup`でstopPropagation(click/dblclick)を一括で仕掛けた(interactive:falseは除く)。
- circleレイヤ(金ドット)はDOMでないため、一般クリック側でqueryRenderedFeaturesを使い
  「ドット上のクリックは一般処理へ流さない」とした(Leafletのマーカー優先と同じ挙動)。

### 3. 【設計】レイヤ表示状態の問い合わせを_tmLayerShown('mesh'|'gold')に集約(視点3)

- `map.hasLayer(...)`による表示判定5箇所(画素ポップアップ×2・ホバー×2・観測点詳細×1)を
  共通関数に置換。Leaflet=hasLayer/MapLibre=visibilityフラグを一元化し、R6のLeaflet撤去時は
  この1箇所を畳むだけで済む。

### 4. 【修正済み(テスト側)】合成メッシュのフィールド不足と手順依存(視点2)

- 合成_tsujiMeshCalcにgridPos(画素→グリッド位置。辻マーカー画像の描画で使用)が無く
  TypeError。実検索が作るフィールドの棚卸し漏れで、テスト側に追加した。
- ホバー精細化(_tmRefinePixelTime)は辻時刻コントロール初期化後に呼ばれる前提
  (_tmCtrlDay0がnullならnull=Leafletでも同じ)。SETUPにctrl状態を追加した。
- ポップアップの検証はDOMの先頭要素でなく`_glTmPopup`/`_glTmHoverTip`の参照から読む
  (ホバーチップと本ポップアップが併存するため)。

## 学び

- 画像オーバーレイの移植は「URL更新」と「座標更新」のAPIが別(updateImage/setCoordinates)。
  片方だけだと位置ズレ・初期座標残りが起こるため、検証は必ず「ソースに反映された座標」を見る。
- イベント伝播の既定はライブラリ毎に逆になり得る(Leaflet=遮断/MapLibre=伝播)。
  操作系の移植では「1クリックで何が起きるか」を数え上げて検証項目にする(S3のnoPopupなど)。
