# レビュー記録 2026-07-20 — 第34ラウンド差分(v1.36.0 封鎖UIのHTML分離+ボタンサイズ統一)

リリース準備の細部対応(封鎖UIの物理削除・コントロールボタンの寸法統一)の記録。

## 1. 封鎖UIのindex.htmlからの物理削除(forecast-features.htmlへ分離)

- **要望**: 非表示(class hidden)ではなくindex.htmlからボタン/メニューを削除したい。
- **課題**: 単純削除すると、①開発継続(?forecast=1)の術を失う ②封鎖機能を検証する10本の
  テスト資産が全滅する。
- **方式**: 封鎖3機能のUI 5ブロック(宙検索メニュー110行・My宙検索メニュー31行・宙断面ボタン行・
  結果パネル2つ=計約160行)を`forecast-features.html`へ**template要素として退避**し、
  index.htmlには空スロット`<div id="ff-slot-*" class="hidden">`のみ残した。
  開発時(?forecast=1)は`loadForecastFeatures()`がfetch+DOMParserで各スロットへ注入する。
  **注入をinitのsetupUI()より前にawaitする**ことで、既存の配線コード(全てnullガード済み)が
  無改修でそのまま効く。既定ページのDOMには封鎖機能の要素が一切存在しない。
- 抽出はdivの開閉数を数える機械処理で行い、取り違えを防いだ(メニューはヘッダdiv+内容divの
  2ブロック連続、ボタンは親のcontrol-row行ごと)。

## 2. コントロールボタンのサイズ統一(29px)

- **事象**: 左上コントロールの正方形の一辺がまちまち — 自作ボタン(⌖/レイヤ切替/パン)は
  旧Leaflet踏襲の26px、MapLibre標準のズームボタンは29px。
- **対処**: 全て**29px(MapLibre標準)に統一**。ライブラリ側のボタンをいじるより自作側を
  合わせる方が将来のmaplibre更新に強く、タッチ目標も広がる。レイヤリストの展開位置も追従。
- 検証は「左上コンテナ内の全a/button要素のcomputed width/heightのユニーク集合が
  {29px×29px}の1種であること」で固定(verify118 X2。今後ボタンを足してもサイズ逸脱を検出)。

## 3. テスト保守

- verify107 D0(index.htmlに宙断面UIがある表明)→ forecast-features.html参照へ。
- verify116 V4(26px)→ 29pxへ。verify117 W1(hidden表明)→「DOMに存在しない」表明へ。
- ハーネス同期(sync-apptest.py)にforecast-features.htmlを追加(注入のfetch先)。
- 新設verify118(9チェック): ソース検査(index.htmlに封鎖要素なし/スロット5個/退避5ブロック)・
  既定DOM検査・8ボタン29px統一・?forecast=1の注入復元/配線/宙断面/説明文復帰。

## 学び

- 「削除したいが開発は続けたい」は**退避+注入**で両立できる(templateはscriptを実行せず
  安全に持ち運べる。注入をセットアップ前に置けば配線コードは無改修)。
- 寸法統一の回帰は個別値でなく「ユニーク集合が1種」で書くと、要素追加にも強い表明になる。
