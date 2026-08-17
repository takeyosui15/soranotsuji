# 依頼・回答ログ

このファイルは、開発依頼と回答の記録用です。

## 運用ルール
- 依頼者が「## 依頼」セクションに依頼内容を記入
- Claudeが「### 回答」として回答を追記
- 完了した依頼はそのまま履歴として残す
- 依頼者は、依頼管理のため、Claudeのコミットハッシュを記録する
- order.mdが500行を超えたら、キリの良いところで、/order-log以下に保管する。

---


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show eb6a90e
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-29)
Claudeさん、ありがとうございます。
確認しました。

続いて、機能追加です。
`12-bodies.md`に天の川儀を追加しました。
実装をお願いいたします。
よくわからないところや、質問があれば、お願いいたします。

### 回答 (2026-06-29)
Takechanさん、おはようございます。天の川儀の実装を承りました。

要件に曖昧さがあったため、先に方針を確認させていただき、以下で合意しました。
- 描画: three.js（WebGL）でテクスチャ付き3D球体（天体写真を球面に合成）。
- 天体写真: 私がNASA等の無料・要帰属画像を選定しリポジトリに同梱（CORS回避）。右下に著作権表示。
- 進め方: 2フェーズに分割（A:メニュー改修 → B:天の川儀本体）。
- パネル共存: 天の川儀は標高グラフとは排他、辻検索結果とは同時表示可。
- UI: 天の川儀の開閉は「天の川儀」ボタン（標高グラフと同列）に一本化。表示天体メニューの専用チェックボックスは作りません（ご指摘どおり）。

**【フェーズA 完了】表示天体メニューへの「天の川」追加**
- 表示天体の先頭に「天の川」（既定非表示・線色:白・線種:実線）を追加。
- 代表点として天の川銀河の中心（いて座A*, J2000）を採用し、恒星と同じ仕組みに配線。これにより方位／方位角・視高度／出入・南中時／赤経・赤緯がすべて銀河中心の値で表示され、辻ライン（白・実線）も銀河中心方向で描けます。視半径は点光源のため「-.---°」。
- 既存ユーザーのlocalStorage（旧21天体）でも、起動時に既定へマージされるため自動で「天の川」が現れます（移行コード不要）。
- デッサン `12-bodies.md` を、専用チェックボックス記述からボタン式の記述へ更新。

**【フェーズB 予定】天の川儀（3D天体儀パネル）**
- 標高グラフと同じ画面下1/3に、three.jsで「天の川の環」を外側から俯瞰する3D天体儀を表示。
- 観測者の位置・日時に連動（恒星時＋緯度で球を回転）。地平線・東西南北・赤道座標の経緯線を重ね描き。
- NASAの全天マップ（赤道座標, パブリックドメイン）を球面テクスチャに合成、右下に出典表示。
- フェーズAのご確認後に着手いたします。気になる点があればお知らせください。

### 回答 (2026-06-29) フェーズB完了
フェーズB（天の川儀本体）を実装しました。

**実装内容**
- 「天の川儀」ボタン（標高グラフと同列）を新設。押すと画面下1/3に3D天体儀パネルを表示。
  - 標高グラフとは排他（一方を開くと他方を閉じる）、辻検索結果とは同時表示（辻検索パネルが上へ段積み）。
- three.js（WebGL, グローバルTHREE; UMD最終版 0.160.0 をCDN固定）で、赤道座標の全天テクスチャを貼った球を**外側から俯瞰**。マウス/タッチのドラッグで視点回転、ホイールでズーム。
- 観測者の緯度経度・標高と日時に連動して球を回転（`Astronomy.Horizon`から算出した「赤道座標→地平座標」回転を適用。回転の正しさはNode＋astronomy-engineで検算: 任意方向で誤差 ~1e-15、天頂が真上）。
- **地平線**（緑の大円）・**東西南北**（北は橙、他は青）・**赤道座標の経緯線**（赤経/赤緯グリッド）を重ね描き。日時・観測地を動かすと環も地平線も連動。
- 天の川の見た目（テクスチャ）について：**実装環境のネットワーク制限でNASA画像を取得・同梱できない**ため、ご承認どおり**プロシージャル生成（天の川の帯＋星＋銀河中心グロー）**で実装。`milkyway-skymap.jpg` をリポジトリに置けば自動で実写へ差し替わる構造（右下クレジットもNASA表記に自動切替）。現状は右下に「天の川: 模式図（生成）」と表示。
- ヘッドレスChromium（WebGL）で実描画を確認済み（スクリーンショットをチャットに添付）。

**今後**: 実写の天体写真をご用意・同梱いただければ自動で反映されます（NASA SVS「Deep Star Maps 2020」赤道座標版が候補）。天の川儀の見た目・操作感のご要望があれば調整します。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show bca38f7
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-29)
Claudeさん、ありがとうございます。
確認しました。

では、まず、実写の天体写真（NASA SVS「Deep Star Maps 2020」赤道座標版）に差し替えたいので、ダウンロード先を教えていただけないでしょうか。
そして、天の川儀のデッサンを`12-bodies.md`から`01-location.md`に移動して、デッサンの内容を細かく修正しましたので、それに合わせて実装をお願いいたします。

### 回答 (2026-06-29)
ダウンロード先のご案内と、改訂デッサン（01-location.md 項目18）への追従実装を行いました。

**■ 実写写真のダウンロード先（NASA SVS「Deep Star Maps 2020」）**
- 必ず**「赤道座標版（Starmap）」**を選んでください（「Milkyway …gal」は銀河座標版なので不可）。
- SVS公式: https://svs.gsfc.nasa.gov/4851/ （直リンク小サイズ `starmap_2020_4k_print.jpg` 1024×512。高解像度はOpenEXR）
- Wikimedia Commons（JPEGで任意解像度DL可・推奨）: `File:Deep Star Maps 2020 – Starmap 2020 64k.jpg`
- 取得後、**リポジトリ直下に `milkyway-skymap.jpg`** として置けば自動で実写に差し替わり、右下クレジットもNASA表記へ自動切替（推奨 ~2048〜4096px）。
- この赤道座標版は「0h RAが中央・RAは左へ増加」配置のため、実装側でテクスチャを水平反転整合（球UVに合わせ済み）。

**■ 改訂デッサンへの追従実装**
- ボタンラベル変更: 「標高グラフ」→**「標高」**、「天の川儀」→**「天の川」**（押下時=太字+黄色は既存スタイルで対応）。
- **両面/透過表示**: 球マテリアルを加算合成にし、内側からも透けて「天の川の環」が両面（手前＋裏側）で見えるように。
- **初期表示は毎回「北が上」**: 固定俯瞰カメラ（北=上・東=右）＋マスターGroupを開くたび回転リセット。ドラッグで全体回転、ホイールでズーム。
- **グリッド15°刻み**: 赤緯・赤経の経緯線を15°（赤経は1h）刻みに。
- **地平面の放射状線**: 地平面の中心から15°刻みの放射線（方位コンパス）を追加。
- **方位マーカー色**: 北=赤、東/西/南=水色。地平面と枠が交わる水平線（地平線円）=緑。
- ヘッドレスChromium（WebGL）で再描画確認済み（スクリーンショットをチャットに添付）。

実写画像を `milkyway-skymap.jpg` として置いていただければ自動反映されます。見た目（帯の明るさ・初期俯瞰角など）のご要望があれば調整します。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show a8449d2
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-29)
Claudeさん、ありがとうございます。
確認しました。

実写画像を `milkyway-skymap.jpg` として配置しました。
それから、天の川儀の詳細をもう少しブラッシュアップしました。
`01-location.md`をご参照ください。
また、天体表示のデッサンを少し変更しました。
`12-bodies.md`をご参照ください。
実装をお願いいたします。

### 回答 (2026-06-29)
配置いただいた実写画像の反映と、改訂デッサンへの追従を実装しました。

**■ 実写画像（NASA SVS Deep Star Maps 2020, 1024×512）**
- 自動で球面テクスチャに反映。UV整合（0h中央・RA左増加）も効いており、写真の天の川の帯と下記「天の川リング」が一致、銀河中心のバルジが赤マーカー位置と合致することを確認。右下クレジットはNASA表記に自動切替。加算合成での明るさも過剰なく良好でした。

**■ 天の川儀の追加表示（01-location.md 項目18 追記）**
- **天の川リング**: 銀河赤道(銀河座標の水平面)を白い太線で環状に表示（球面に沿った3Dの環、両面透過で裏側も見える）。
- **天の川方位線**: 地平面の中心から銀河中心（いて座付近）へ向かう白い太線。
- **交点の赤マーカー**: 天の川リングと天の川方位線の交点（=銀河中心）に赤い球マーカー。
- いずれも観測者の位置・日時に連動して回転。WebGLは線幅指定が効かないため太線は TubeGeometry で描画。

**■ 天体メニューの色変更（12-bodies.md 改訂）**
- 既定線色: 天の川 白→**紫(#800080)**、冥王星 紫→**灰(#808080)**。
- カラーパレットに**灰(#808080)を追加して全16色**、配置を**4×4**に変更。
- 既存ユーザーの保存済み線色は維持されます（既定変更は新規/未保存のみ反映）。

ヘッドレスChromium（WebGL, ローカルHTTP配信で同一オリジン）で実写＋新オーバーレイを確認済み（スクリーンショットをチャットに添付）。引き続き微調整のご要望があればお知らせください。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show a8449d2
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-29)
Claudeさん、ありがとうございます。
確認しました。
感謝です！
見やすくなりました。

もう少し手を加えるなら、折角の天の川の綺麗な写真なので、それを活かすように、天の川リングと天の川方位線をもう少し細くして、スタイリッシュにしたいです。
交点のマーカーももう少し小さくして、スタイリッシュにしていただけたらと思います。
よろしくお願いいたします。

### 回答 (2026-06-29)
天の川儀のオーバーレイを細くスタイリッシュに調整しました（実写写真がより映えるように）。
- 天の川リング: 太さ 約1/3に（TubeGeometry 半径 0.013→0.0045）。
- 天の川方位線: 細く（0.012→0.0035）。
- 交点の赤マーカー: 小さく（球半径 0.035→0.018）。
- リング＝写真の天の川の帯、赤マーカー＝銀河中心バルジ、の整列は維持。色・連動ロジックは変更なし。
- ヘッドレスChromium（WebGL, 同一オリジンHTTP配信で実写反映）で確認済み（スクリーンショットをチャットに添付）。

さらに細さ・サイズのお好みがあれば数値を微調整します。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 55176d3
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-29)
Claudeさん、ありがとうございます。
確認しました。
センスがバッチリですね！
ありがとうございます。

もう少しわかりやすくしたいので、方位30°目盛りも`01-location.md`に追加しました。
実装をお願いいたします。

### 回答 (2026-06-29)
天の川儀の地平線（緑の地平線円）に方位の度数目盛りを追加しました。
- 北=0°として30°おきに数字を表示（30/60/120/150/210/240/300/330）。
- 0/90/180/270は既存の方位文字「北東南西」が示すため、重複を避けて数字は8箇所（北の左右が330/30になる標準的なコンパス表記）。
- 薄い灰色の小さめ文字で、写真や方位文字と競合しないように。ドラッグ追従（地平系に固定、天球とは独立）。
- ヘッドレスChromium（WebGL, 同一オリジンHTTP配信で実写反映）で配置・向き（北=0°, 時計回り）を確認済み（スクリーンショットをチャットに添付）。

色・サイズ・刻み等のご要望があれば調整します。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show c1119d9
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-29)
Claudeさん、ありがとうございます。
確認しました。
OKです！

では、続いて、写真を撮る時に参考になる、観測点から目的点方向を観測した時のシミュレーションのプレビューが見れる「宙の窓」機能の追加です。
デッサン`00-overview.md`,`01-location.md`,`05-soranomado.md`を追加更新しました。
実装をお願いいたします。
`todo.md`も修正しました。

### 回答 (2026-06-29) 宙の窓 フェーズ1完了
大型機能のため3フェーズに分割（描画はthree.js/WebGL）で合意し、**フェーズ1**を実装しました。

**フェーズ構成**
- F1（今回）: メニュー＋光学計算＋パネル枠＋ボタン再編。
- F2: 天体プレビュー（視半径円・月の満ち欠け・十字マーク・軌跡・天の川写真背景。表示天体メニューの辻ラインチェックと連動）。
- F3: DEM地形（山稜線をカメラ視点で・グレースケール/白黒・フォーカスピーキング・魚眼）。

**フェーズ1の実装内容**
- ボタンを2段化（7段目=辻ライン/標高グラフ/天の川儀、8段目=辻検索/宙の窓）。ラベルを「標高グラフ」「天の川儀」に戻し、新「宙の窓」ボタンを追加。
- 「宙の窓」メニュー（折りたたみ）に約30コントロールを実装: センサーサイズ(15種)・アスペクト比・焦点距離(選択33値＋スライダー)・F値・ピント距離・各チェックボックス・基準/オフセット方位角視高度・視界範囲(テキスト⇄スライダー連動)・天体軌跡・画面中心。appState＋localStorage整合。
- 光学計算: 画角(水平/垂直/対角)・過焦点距離・合焦範囲・被写界深度を実時間表示（例: フルサイズ3:2/35mm→水平54.4°/垂直37.8°/対角63.4°。F8/ピント3mで被写界深度≒1.76m。Nodeで妥当性検算済み）。
- 基準方位角/視高度は観測点・目的点から自動算出（**辻検索とは非連動**の独立フィールド）。視界範囲の既定＝両点間距離km。
- プレビューパネル（画面下1/3）をthree.jsで新設。カメラを(基準＋オフセット方位角・視高度)へ向け、垂直画角=fov・ファインダーのアスペクト比でレターボックス枠を表示、画面中心に十字(+)。標高グラフ・天の川儀とは排他、辻検索結果とは同時表示（段積み）。日時/観測地変更・辻検索行選択で再描画。
- F1ではプレビュー内は空（背景＋枠＋十字）。F2/F3で中身を描画します。
- ヘッドレスChromium（WebGL）でパネル表示・ファインダー枠・中心十字・画角表示を確認（スクリーンショットをチャットに添付）。

フェーズ1をご確認のうえ、問題なければフェーズ2（天体プレビュー）に進みます。

### 回答 (2026-06-29) 宙の窓 フェーズ2完了
フェーズ2（天体プレビュー）を実装しました。three.jsで統一して描画しています。

**実装内容**
- **天の川写真の背景**: 観測者の空に合わせた背景天球（赤道座標スカイテクスチャ＝実写`milkyway-skymap.jpg`＋プロシージャル）。表示天体「天の川」がvisibleのとき表示。銀河中心方向にカメラを向けると、天の川の帯・銀河中心バルジが正しい位置に出ることを確認。
- **天体マーカー**（表示天体メニューの辻ラインチェック＝visibleと連動）:
  - 全天体に**中心十字(+)**（天体色・画面固定サイズ）。
  - 月以外で視半径を持つ天体（太陽・惑星）は**視半径の円**（天体色・半透明）。点光源（恒星等）は十字のみ。
  - **月**は満ち欠けを面積で描画（`Astronomy.Illumination`の照輝面比＋満ち欠け方向）し、**視半径の円を細線**で重ねるので、新月近傍で暗くても位置・サイズが分かる（中心十字も表示）。
- **軌跡**: 表示天体の中心の軌跡を日付±1日（96点）で天体色の細線で描画（天体軌跡チェックで切替）。日・位置・対象が変わった時のみ再計算（再生時の負荷抑制）。
- 既存のファインダー枠・画面中心十字・画角表示（F1）はそのまま。日時/観測地変更・辻検索行選択で再描画。
- ヘッドレスChromium（WebGL, 実写画像はローカルHTTP配信）で、(A)望遠で月の満ち欠け＋視半径円＋十字、(B)広角で銀河中心＝天の川写真背景、軌跡 を確認（スクリーンショットをチャットに添付）。

フェーズ2をご確認のうえ、問題なければフェーズ3（DEM地形：山稜線・グレースケール/白黒・フォーカスピーキング・魚眼）に進みます。

### 回答 (2026-06-29) 宙の窓 フェーズ3完了（宙の窓 全フェーズ完了）
フェーズ3（DEM地形）を実装し、宙の窓は全フェーズ（F1メニュー＋光学／F2天体プレビュー／F3地形）が揃いました。

**フェーズ3の実装内容**
- **DEM地形**: 視界範囲(km)・画角で決まる**扇形**を国土地理院DEMタイル（dem_png）で取得し、カメラ視点の前景として3Dメッシュ描画。タイルは一時キャッシュ、**視界範囲に応じた適応ズーム**でタイル数を抑制、扇が変わった時のみ非同期取得（取得中は%表示）。地球の**曲率落差**（屈折込み、30kmで約70m）を反映。
- **グレースケール/白黒2値**: ONで標高＋距離ヘイズの濃淡（山稜線が分かる）、OFFで一様トーンのシルエット。
- **フォーカスピーキング**: ピント合焦範囲（センサー・焦点距離・F値・ピント距離から算出）に入る地形を**赤**で表示。
- **フィッシュアイ**: バレル歪みのpost-processで魚眼風表示（近似。要望に応じ調整可）。
- 地形は天体・天の川背景を**遮蔽**（尾根の下は隠れる）。天体・日時の変更では地形を再取得せず、扇（位置・方位・画角・範囲）が変わった時のみ取得。
- **検証**: 実装環境はGSIタイルを遮断するため、**合成ハイトフィールド**でヘッドレスChromium（WebGL）レンダリングを確認（山稜線・グレースケール/白黒/ピーキング/遮蔽/魚眼。スクリーンショットをチャットに添付）。実DEM取得は既存タイルコードの再利用で**閲覧者ブラウザで動作**します。

これで「宙の窓」機能（全3フェーズ）が完成しました。ご確認のうえ、見た目・挙動のご要望（地形の精細さ、魚眼の強さ、各種既定値など）があれば調整いたします。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 82bd5ba
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-29)
Claudeさん、ありがとうございます。
確認しました。
助かります。
素敵です！

では、不具合を解消していきましょう♪
1. 辻検索に時間フィルタを追加した後から発生しているのですが、ローカルストレージの不整合が発生しているようです。前のバージョンからアップデートして、ローカルストレージがそのままだと、時間フィルタのコントロールが表示されなかったり、天の川と太陽と月を辻検索しても、検索結果に天の川の辻検索結果が表示されなかったりしました。バージョンアップするときに、ローカルストレージの不整合が元で、表示崩れや、機能不具合が起きているようです。原因をしっかり調査してから、問題の解決を行なってほしいです。
2. 天の川の帯の大きさが大きすぎるような気がします。Nikonの魚眼レンズで焦点距離10mmの場合は、対角の画角がちょうど180°です。また、Nikonの魚眼レンズで焦点距離16mmの場合は、対角の画角がちょうど170°です。また、Nikonの標準レンズで焦点距離35mmの場合は、対角の画角がちょうど62°です。
焦点距離の計算は、間違っていないでしょうか。また、元になったNASAの天体写真を撮影した時のカメラのレンズ情報は、参考にならないでしょうか。もしかしたら、NASAの天体写真は、何度も、露出を重ね合わせて、わかりやすいようにしたため、一般的なカメラで、写真撮影をすると、NASAの天体写真ほどは、天の川が広く大きく映らないかもしれません。原因を調査してください。

まずは、これらから、よろしくお願いいたします。

ローカルストレージ内容を添付します。

{"start":{"lat":36.3649903604405,"lng":137.7011117064,"elev":2920.5},"end":{"lat":36.3420704750035,"lng":137.64770622566,"elev":3170.2},"homeStart":null,"homeEnd":null,"bodies":[{"id":"MilkyWay","name":"天の川","color":"#800080","isDashed":false,"visible":true},{"id":"Sun","name":"太陽","color":"#FF0000","isDashed":false,"visible":true},{"id":"Moon","name":"月","color":"#FFFF00","isDashed":false,"visible":true},{"id":"Mercury","name":"水星","color":"#00BFFF","isDashed":false,"visible":false},{"id":"Venus","name":"金星","color":"#FFC0CB","isDashed":false,"visible":false},{"id":"Mars","name":"火星","color":"#FFA500","isDashed":false,"visible":false},{"id":"Jupiter","name":"木星","color":"#A52A2A","isDashed":false,"visible":false},{"id":"Saturn","name":"土星","color":"#008000","isDashed":false,"visible":false},{"id":"Uranus","name":"天王星","color":"#ADFF2F","isDashed":false,"visible":false},{"id":"Neptune","name":"海王星","color":"#4B0082","isDashed":false,"visible":false},{"id":"Pluto","name":"冥王星","color":"#800080","isDashed":false,"visible":false},{"id":"Polaris","name":"北極星","color":"#000000","isDashed":false,"visible":false},{"id":"Merak","name":"北斗七星メラク","color":"#654321","isDashed":false,"visible":false},{"id":"Mintaka","name":"オリオン座ミンタカ","color":"#FFFFFF","isDashed":false,"visible":false},{"id":"Subaru","name":"すばる","color":"#0000FF","isDashed":false,"visible":false},{"id":"M42","name":"オリオン大星雲M42","color":"#DDA0DD","isDashed":false,"visible":false},{"id":"Vega","name":"こと座ベガ","color":"#FFA500","isDashed":true,"visible":false},{"id":"Altair","name":"わし座アルタイル","color":"#008000","isDashed":true,"visible":false},{"id":"Deneb","name":"はくちょう座デネブ","color":"#FFD700","isDashed":true,"visible":false},{"id":"Betelgeuse","name":"オリオン座ベテルギウス","color":"#FF0000","isDashed":true,"visible":false},{"id":"Sirius","name":"おおいぬ座シリウス","color":"#00BFFF","isDashed":true,"visible":false},{"id":"Procyon","name":"こいぬ座プロキオン","color":"#ADFF2F","isDashed":true,"visible":false}],"myStars":[],"myObservations":[{"id":1,"name":"樅沢岳","lat":36.366550216376545,"lng":137.60788500308993,"elev":2750,"height":0,"memo":""},{"id":2,"name":"双六岳","lat":36.3718759200185,"lng":137.587122786322,"elev":2860,"height":0,"memo":""},{"id":3,"name":"鏡平山荘","lat":36.346076728325556,"lng":137.60397970676425,"elev":2291.6,"height":0,"memo":""},{"id":4,"name":"大天井岳","lat":36.3649903604405,"lng":137.7011117064,"elev":2920.5,"height":0,"memo":""},{"id":5,"name":"大天荘","lat":36.36363872149497,"lng":137.70329117774966,"elev":2873.8,"height":0,"memo":""},{"id":6,"name":"大天井ヒュッテ","lat":36.36284387310264,"lng":137.69595801830295,"elev":2644.2,"height":0,"memo":""},{"id":7,"name":"牛首展望台","lat":36.3625004,"lng":137.6926519,"elev":2762.5,"height":0,"memo":""},{"id":8,"name":"ヒュッテ西岳","lat":36.3357882695246,"lng":137.67997741699222,"elev":2673.3,"height":0,"memo":""},{"id":11,"name":"西岳","lat":36.3372402065483,"lng":137.679639470693,"elev":2755.1,"height":0,"memo":""},{"id":12,"name":"常念小屋","lat":36.33300526932938,"lng":137.7274686098099,"elev":2446.5,"height":0,"memo":""},{"id":13,"name":"笠ヶ岳","lat":36.315472519337,"lng":137.550350505795,"elev":2895.9,"height":0,"memo":""},{"id":14,"name":"笠ヶ岳山荘","lat":36.31764512290582,"lng":137.55116164684298,"elev":2810.6,"height":0,"memo":""},{"id":15,"name":"常念岳","lat":36.3255012675948,"lng":137.727642344221,"elev":2844.7,"height":0,"memo":""},{"id":16,"name":"黒部五郎岳","lat":36.3925697623592,"lng":137.53990089196,"elev":2837.6,"height":0,"memo":""},{"id":17,"name":"東天井岳","lat":36.3534063449304,"lng":137.715528593503,"elev":2811.9,"height":0,"memo":""},{"id":18,"name":"弓折岳","lat":36.3493759651145,"lng":137.59498465005,"elev":2588.2,"height":0,"memo":""}],"myTargets":[{"id":1,"name":"槍ヶ岳","lat":36.3420704750035,"lng":137.64770622566,"elev":3170.2,"height":0,"memo":""}],"myTsujiSearches":[{"id":1,"name":"パール槍ヶ岳(樅沢岳)100年","days":36500,"bodyIds":"Moon","obsId":1,"tgtId":1,"baseAz":127.3429,"baseAlt":5.331,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":true,"moonBase":15,"moonTolerance":3,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":2,"name":"パール槍ヶ岳(双六岳)100年","days":36500,"bodyIds":"Moon","obsId":2,"tgtId":1,"baseAz":121.4024,"baseAlt":2.7649,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":true,"moonBase":15,"moonTolerance":3,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":3,"name":"パール槍ヶ岳(鏡平山荘)100年","days":36500,"bodyIds":"Moon","obsId":3,"tgtId":1,"baseAz":96.4764,"baseAlt":12.5492,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":true,"moonBase":15,"moonTolerance":3,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":4,"name":"パール槍ヶ岳(大天井岳)100年","days":36500,"bodyIds":"Moon","obsId":4,"tgtId":1,"baseAz":241.9636,"baseAlt":2.6138,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":true,"moonBase":15,"moonTolerance":3,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":5,"name":"パール槍ヶ岳(大天荘)100年","days":36500,"bodyIds":"Moon","obsId":5,"tgtId":1,"baseAz":244.404,"baseAlt":3.5039,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":true,"moonBase":15,"moonTolerance":3,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":6,"name":"パール槍ヶ岳(大天井ヒュッテ)100年","days":36500,"bodyIds":"Moon","obsId":6,"tgtId":1,"baseAz":241.8875,"baseAlt":6.1055,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":true,"moonBase":15,"moonTolerance":3,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":7,"name":"パール槍ヶ岳(牛首展望台)100年","days":36500,"bodyIds":"Moon","obsId":7,"tgtId":1,"baseAz":240.5737,"baseAlt":5.0204,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":true,"moonBase":15,"moonTolerance":3,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":8,"name":"パール槍ヶ岳(ヒュッテ西岳)100年","days":36500,"bodyIds":"Moon","obsId":8,"tgtId":1,"baseAz":283.5956,"baseAlt":9.4732,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":true,"moonBase":15,"moonTolerance":3,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":9,"name":"パール槍ヶ岳(ヒュッテ大槍)100年","days":36500,"bodyIds":"Moon","obsId":9,"tgtId":1,"baseAz":304.4625,"baseAlt":21.083,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":true,"moonBase":15,"moonTolerance":3,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":10,"name":"パール槍ヶ岳(殺生ヒュッテ)100年","days":36500,"bodyIds":"Moon","obsId":10,"tgtId":1,"baseAz":327.1773,"baseAlt":34.8679,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":true,"moonBase":15,"moonTolerance":3,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":11,"name":"パール槍ヶ岳(槍ヶ岳山荘)100年","days":36500,"bodyIds":"Moon","obsId":11,"tgtId":1,"baseAz":63.9225,"baseAlt":61.403,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":true,"moonBase":15,"moonTolerance":3,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":12,"name":"パール槍ヶ岳(常念小屋)100年","days":36500,"bodyIds":"Moon","obsId":12,"tgtId":1,"baseAz":278.0544,"baseAlt":5.6956,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":true,"moonBase":15,"moonTolerance":3,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":13,"name":"パール槍ヶ岳(笠ヶ岳)100年","days":36500,"bodyIds":"Moon","obsId":13,"tgtId":1,"baseAz":71.2385,"baseAlt":1.6648,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":true,"moonBase":15,"moonTolerance":3,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":14,"name":"ダイヤモンド槍ヶ岳(樅沢岳)4年","days":1461,"bodyIds":"Sun","obsId":1,"tgtId":1,"baseAz":127.3883,"baseAlt":3.4234,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":15,"name":"ダイヤモンド槍ヶ岳(双六岳)4年","days":1461,"bodyIds":"Sun","obsId":2,"tgtId":1,"baseAz":121.4024,"baseAlt":2.7649,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":16,"name":"ダイヤモンド槍ヶ岳(鏡平山荘)4年","days":1461,"bodyIds":"Sun","obsId":3,"tgtId":1,"baseAz":96.4764,"baseAlt":12.5492,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":17,"name":"ダイヤモンド槍ヶ岳(大天井岳)4年","days":1461,"bodyIds":"Sun","obsId":4,"tgtId":1,"baseAz":241.9636,"baseAlt":2.6138,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":18,"name":"ダイヤモンド槍ヶ岳(大天荘)4年","days":1461,"bodyIds":"Sun","obsId":5,"tgtId":1,"baseAz":244.404,"baseAlt":3.5039,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":19,"name":"ダイヤモンド槍ヶ岳(大天井ヒュッテ)4年","days":1461,"bodyIds":"Sun","obsId":6,"tgtId":1,"baseAz":241.8875,"baseAlt":6.1055,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":20,"name":"ダイヤモンド槍ヶ岳(牛首展望台)4年","days":1461,"bodyIds":"Sun","obsId":7,"tgtId":1,"baseAz":240.5737,"baseAlt":5.0204,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":21,"name":"ダイヤモンド槍ヶ岳(ヒュッテ西岳)4年","days":1461,"bodyIds":"Sun","obsId":8,"tgtId":1,"baseAz":283.5956,"baseAlt":9.4732,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":22,"name":"ダイヤモンド槍ヶ岳(ヒュッテ大槍)4年","days":1461,"bodyIds":"Sun","obsId":9,"tgtId":1,"baseAz":304.4625,"baseAlt":21.083,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":23,"name":"ダイヤモンド槍ヶ岳(殺生ヒュッテ)4年","days":1461,"bodyIds":"Sun","obsId":10,"tgtId":1,"baseAz":327.1773,"baseAlt":34.8679,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":24,"name":"ダイヤモンド槍ヶ岳(槍ヶ岳山荘)4年","days":1461,"bodyIds":"Sun","obsId":11,"tgtId":1,"baseAz":63.9225,"baseAlt":61.403,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":25,"name":"ダイヤモンド槍ヶ岳(常念小屋)4年","days":1461,"bodyIds":"Sun","obsId":12,"tgtId":1,"baseAz":278.0544,"baseAlt":5.6956,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":26,"name":"ダイヤモンド槍ヶ岳(笠ヶ岳)4年","days":1461,"bodyIds":"Sun","obsId":13,"tgtId":1,"baseAz":71.2385,"baseAlt":1.6648,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":false,"accDblCircle":false,"accCircle":false,"accTriangle":false,"accDash":false,"checked":false,"memo":""},{"id":27,"name":"ダイヤモンド槍ヶ岳(樅沢岳)100年","days":36500,"bodyIds":"Sun","obsId":1,"tgtId":1,"baseAz":127.3883,"baseAlt":3.4234,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":true,"accDblCircle":true,"accCircle":true,"accTriangle":true,"accDash":false,"checked":true,"memo":""},{"id":28,"name":"ダイヤモンド槍ヶ岳(双六岳)100年","days":36500,"bodyIds":"Sun","obsId":2,"tgtId":1,"baseAz":121.4024,"baseAlt":2.7649,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":true,"accDblCircle":true,"accCircle":true,"accTriangle":true,"accDash":false,"checked":true,"memo":""},{"id":29,"name":"ダイヤモンド槍ヶ岳(鏡平山荘)100年","days":36500,"bodyIds":"Sun","obsId":3,"tgtId":1,"baseAz":96.4764,"baseAlt":12.5492,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":true,"accDblCircle":true,"accCircle":true,"accTriangle":true,"accDash":false,"checked":true,"memo":""},{"id":30,"name":"ダイヤモンド槍ヶ岳(大天井岳)100年","days":36500,"bodyIds":"Sun","obsId":4,"tgtId":1,"baseAz":241.9636,"baseAlt":2.6138,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":true,"accDblCircle":true,"accCircle":true,"accTriangle":true,"accDash":false,"checked":true,"memo":""},{"id":31,"name":"ダイヤモンド槍ヶ岳(大天荘)100年","days":36500,"bodyIds":"Sun","obsId":5,"tgtId":1,"baseAz":244.404,"baseAlt":3.5039,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":true,"accDblCircle":true,"accCircle":true,"accTriangle":true,"accDash":false,"checked":true,"memo":""},{"id":32,"name":"ダイヤモンド槍ヶ岳(大天井ヒュッテ)100年","days":36500,"bodyIds":"Sun","obsId":6,"tgtId":1,"baseAz":241.8875,"baseAlt":6.1055,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":true,"accDblCircle":true,"accCircle":true,"accTriangle":true,"accDash":false,"checked":true,"memo":""},{"id":33,"name":"ダイヤモンド槍ヶ岳(牛首展望台)100年","days":36500,"bodyIds":"Sun","obsId":7,"tgtId":1,"baseAz":240.5737,"baseAlt":5.0204,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":true,"accDblCircle":true,"accCircle":true,"accTriangle":true,"accDash":false,"checked":true,"memo":""},{"id":34,"name":"ダイヤモンド槍ヶ岳(ヒュッテ西岳)100年","days":36500,"bodyIds":"Sun","obsId":8,"tgtId":1,"baseAz":283.5956,"baseAlt":9.4732,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":true,"accDblCircle":true,"accCircle":true,"accTriangle":true,"accDash":false,"checked":true,"memo":""},{"id":35,"name":"ダイヤモンド槍ヶ岳(ヒュッテ大槍)100年","days":36500,"bodyIds":"Sun","obsId":9,"tgtId":1,"baseAz":304.4625,"baseAlt":21.083,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":true,"accDblCircle":true,"accCircle":true,"accTriangle":true,"accDash":false,"checked":true,"memo":""},{"id":36,"name":"ダイヤモンド槍ヶ岳(殺生ヒュッテ)100年","days":36500,"bodyIds":"Sun","obsId":10,"tgtId":1,"baseAz":327.1773,"baseAlt":34.8679,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":true,"accDblCircle":true,"accCircle":true,"accTriangle":true,"accDash":false,"checked":true,"memo":""},{"id":37,"name":"ダイヤモンド槍ヶ岳(槍ヶ岳山荘)100年","days":36500,"bodyIds":"Sun","obsId":11,"tgtId":1,"baseAz":63.9225,"baseAlt":61.403,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":true,"accDblCircle":true,"accCircle":true,"accTriangle":true,"accDash":false,"checked":true,"memo":""},{"id":38,"name":"ダイヤモンド槍ヶ岳(常念小屋)100年","days":36500,"bodyIds":"Sun","obsId":12,"tgtId":1,"baseAz":278.0544,"baseAlt":5.6956,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":true,"accDblCircle":true,"accCircle":true,"accTriangle":true,"accDash":false,"checked":true,"memo":""},{"id":39,"name":"ダイヤモンド槍ヶ岳(笠ヶ岳)100年","days":36500,"bodyIds":"Sun","obsId":13,"tgtId":1,"baseAz":71.2385,"baseAlt":1.6648,"offsetAz":0,"offsetAlt":0,"toleranceAz":15,"toleranceAlt":15,"moonFilter":false,"moonBase":15,"moonTolerance":2,"accuracyFilter":true,"accDblCircle":true,"accCircle":true,"accTriangle":true,"accDash":false,"checked":true,"memo":""}],"meteo":{"p":1013.25,"t":15,"l":0.0065},"refractionEnabled":false,"isDPActive":true,"locMode":"start","lastVisitDate":"2026-03-23","tsujiSearchBaseAz":242.06721301525772,"tsujiSearchOffsetAz":0,"tsujiSearchToleranceAz":2,"tsujiSearchBaseAlt":2.698368743745138,"tsujiSearchOffsetAlt":0,"tsujiSearchToleranceAlt":2,"tsujiSearchDays":365,"tsujiMoonFilterEnabled":false,"tsujiMoonBase":15,"tsujiMoonTolerance":3,"tsujiAccuracyFilterEnabled":true,"tsujiAccDblCircle":true,"tsujiAccCircle":true,"tsujiAccTriangle":true,"tsujiAccDash":true,"tsujiElevationOption":false,"tsujiElevOK":false,"tsujiElevNG":false,"tsujiTimeFilter":false,"tsujiStartMode":"sunset","tsujiStartTime":"00:00","tsujiStartPrePost":false,"tsujiStartPrePostDir":"before","tsujiStartOffset":"00:00","tsujiEndMode":"sunrise","tsujiEndTime":"00:00","tsujiEndPrePost":false,"tsujiEndPrePostDir":"before","tsujiEndOffset":"00:00","soraSensorKey":"fullframe","soraAspectW":3,"soraAspectH":2,"soraFocal":250,"soraFNumberIdx":9,"soraFocusDist":3344,"soraFisheye":false,"soraPeaking":true,"soraGrayscale":true,"soraBaseAz":242.06721301525772,"soraBaseAlt":2.6947073140631437,"soraOffsetAz":0,"soraOffsetAlt":0,"soraViewRange":5,"soraTraj":true,"soraCenterCross":true,"startApiElev":2920.5,"endApiElev":3170.2,"startHeight":0,"endHeight":0}

・バージョンは、v1.20.1からのバージョンアップです。
・時間フィルタのコントロールが表示されない問題は、結局、reset.htmlを実行したら、解消されました。しかし、ユーザーに安易にreset.htmlを実行するように案内するのは、今までローカルストレージに保存された、My観測点やMy目的点、My辻検索の情報をCSVに吐き出す前に、削除してしまう恐れがあるため、なるべくしたくないです。

### 回答 (2026-06-29) 不具合調査と対策（localStorage堅牢化＋reset安全化）
共有いただいたlocalStorageとv1.20.1という情報をもとに、しっかり調査しました。

**■ 調査結果**
- **不具合2（天の川が辻検索結果に出ない）→ 仕様（不具合ではありません）**。
  - 共有データの目標は槍ヶ岳(←大天井岳)で**基準方位角242°・視高度2.7°**。一方、天の川（銀河中心）はこの地点で**最大高度24.6°・地平線上に出る方位は127〜233°**だけで、**方位233°で沈みます**。目標の242°には届かないので**0件が正解**です（太陽・月は1年かけてその方位を通るので結果が出ます）。Node＋astronomy-engineで検算しました。
- **不具合1（時間フィルタ非表示等）→ 現行コードでは再現せず**。
  - 実アプリを忠実に再現する検証環境を構築（Leaflet/GeographicLib/Astronomy/three を同梱）し、**v1.20.1相当の旧localStorage**（天の川天体なし・sora/時間フィルタ項目なし・obsId 9,10のダングリング参照あり）を注入して起動。結果は**時間フィルタのコントロール正常表示・天の川も既定からマージ・JSエラーなし**で、報告の崩れは再現しませんでした。
  - 旧データを更に「時間フィルタON＋現行に無い旧モード値」にすると、コントロールは表示されるものの**モードのラジオが未選択**になる軽微な不整合のみ確認しました。
  - → 現行コードは旧localStorageを概ね安全に扱えており、報告の崩れは**reset.htmlで消えた特定の壊れた状態**が原因の可能性が高いです（再現データが残っていれば追加調査します）。

**■ 対策（堅牢化＋データ安全化）**
1. **読み込み時の防御的正規化** `normalizeAppState()` を追加（`loadAppState` から毎回・冪等で実行）。
   - 時間フィルタのモード（現行に無い旧値→既定へ）・前後方向・時刻形式を補正（確認した「ラジオ未選択」を解消）。
   - 宙の窓の数値（焦点距離・F値・ピント距離・アスペクト・視界範囲）を範囲・型に補正。真偽値・センサーキーも検証。
   - localStorageに**スキーマ版数 `appSchema`** を付与（将来のマイグレーション/診断用）。
   - 表示天体は従来の「既定配列へマージ」方式で全既定天体が常に存在するため天の川等は維持。
2. **reset.html をデータ安全化**（resetでデータを失わないように）。
   - 「**全データをJSONでバックアップ（ダウンロード）**」ボタンを消去ボタンの上に追加（生localStorageの完全コピー）。
   - 「**バックアップJSONから復元**」ボタンを追加（ファイルから書き戻し）。
   - 消去前のバックアップを促す警告文を追加（アプリ内「バックアップ」やCSV出力も案内）。
3. **検証**: 実アプリ・ハーネスで、不正モード値→既定に補正されラジオが選択されること、旧データでも回帰がないこと、reset.htmlのバックアップ/復元が機能することを確認。

これで、今後のバージョンアップで旧localStorageが残っていても**自己修復**し、万一resetする場合も**データを失わずに済みます**。再現する壊れた状態のデータが手に入れば、さらに正確に原因特定します。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 493737c
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-30)
Claudeさん、ありがとうございます。
確認しました。
調査を感謝です！

では、引き続き、不具合を解消していきましょう♪

1. 表示天体メニューで、天の川の線種をリセットすると、紫の実線ではなくて、薄紫の破線になってしまう。
2. スマホで、宙の窓を表示すると、プレビュー画面が外枠と画面内でズレる。
3. 視界範囲に応じたプレビューになっていない。視界範囲を観測点からの距離0kmから、観測点からの相手距離をkmに切り上げした数値の距離までを初期値として、手前の山の輪郭や、手前に伸びる尾根筋が立体的に3Dで分かるように、手前の観測点からの距離に応じてグレースケールで描画したり、視界範囲内の最高標高を白色とした、標高によりグレースケールで描画したり、太陽の位置が分かっているので、そこを光源とした影をつけるなどして、何らかの陰影をつけて、立体的に3Dで分かるように表示する。レンダリングに時間がかかるようであれば、進捗のバーを出せば良い。ワーカープールで、並列並行非同期処理する。デッサンもそのように修正する。
4. 宙の窓メニューの画角の3つの表示が画面からはみ出るので、1行にまとめる。H:43.5° V:30.1° D:48.2°のように表示する。

### 回答 (2026-06-30) 不具合4件 解消
ご報告の4件すべてに対応しました（原因を特定→修正→ヘッドレスChromiumで検証）。

**1. 天の川リセットが薄紫破線になる → 修正**
- 原因: リセット用の既定スタイル定義 `DEFAULT_BODIES` が古く14天体しか無く、天の川（MilkyWay）等の新天体が含まれていませんでした。該当しない天体は「My天体の既定（薄紫・破線）」に落ちる実装のため、天の川が薄紫破線になっていました。
- 対策: `DEFAULT_BODIES` を全22組込天体の完全な一覧（天の川＝紫`#800080`・実線 など現行の既定と一致）に更新し、表示天体配列をこの定義から生成する**単一情報源**にしました。天の川のリセットが**紫の実線**に正しく戻ります（My天体は従来どおり薄紫・破線が既定）。

**2. スマホでプレビューが外枠とズレる → 修正**
- 原因: 高解像度画面（devicePixelRatio>1）で、WebGLの描画範囲指定にデバイスピクセル座標を渡していました。three.js は内部でさらに画素比を掛けるため**二重に拡大**され、プレビュー内容だけが枠から右下へズレていました（PC=等倍では無症状）。
- 対策: 描画範囲をHTMLの枠と同じ**CSS（論理）ピクセル**で指定するよう統一。devicePixelRatio=1/2/3 のいずれでも、描画内容・ファインダー枠・中心十字が一致することを確認しました（通常表示・魚眼表示の両方）。

**3. 視界範囲に応じた立体的な3Dプレビュー → 実装**
- **視界範囲の初期値**: 観測点〜相手（目的点）距離を**切り上げ**たkm（0km〜その距離）にしました（従来は四捨五入）。
- **太陽光ヒルシェード＋標高グレーで立体表示**: 手前の山の輪郭・尾根筋が立体的に分かるよう、地形に陰影を付けました。「視界範囲内の最高標高を白とした標高グレー」に、「太陽の位置を光源としたヒルシェード（陰影）」を重ねています。日時が夜間で太陽が地平線下のときも、太陽**方位**を保ったまま光源高度を底上げして尾根のレリーフを維持します。グレースケールOFFでは一様グレー＋陰影の純レリーフ表示になります。
- **ワーカープールで並列取得＋進捗バー**: DEM標高タイルの取得・PNGデコード・標高化を新規ワーカー（`sora-terrain-worker.js`）の**プールで並列並行非同期処理**します。取得中はプレビュー上端に**進捗バー**を表示します（ワーカー/OffscreenCanvas非対応環境はメインスレッド逐次にフォールバック）。
- デッサン `05-soranomado.md` も上記仕様に更新しました。
- 検証: 合成標高でヒルシェードの立体感・標高グレー・太陽方位による陰影変化・魚眼・フォーカスピーキング(赤)を確認。ワーカーが dem_png を正しく標高デコードし、プールが並列に解決し、進捗バーが進むことも確認しました（実DEM取得は閲覧者ブラウザで動作）。

**4. 画角が画面からはみ出る → 修正**
- 「画角」を1行にまとめ、`H:43.5° V:30.1° D:48.2°` の形式で表示するようにしました（狭い画面でも収まります）。

ご確認のうえ、陰影の強さ・進捗バーの見せ方・既定値などのご希望があれば微調整します。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show c700ad7
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-30)
Claudeさん、めちゃめちゃ頑張りましたね！
ありがとうございます！

確認しました。
バッチリOKです！

続いて、細かな修正と確認をします。

1. 修正
宙の窓の基準方位角と基準視高度は、角度なので、小数点以下4桁に統一する。
宙の窓のオフセット方位角とオフセット視高度も、角度なので、小数点以下4桁に統一するが、ステップは、0.5°刻みにする。

2. 修正
index.htmlの著作権表示に私の個人名をソースコードの著作権と同じように記載する。
例:中央揃えで2行にする。
&copy; 2026- Takeyoshi Watanabe
Sora no Tsuji Project - v1.20.1

3. 修正
全天儀、標高グラフ、宙の窓、辻検索のトグルボタンをオンオフした場合は、画面の残りの表示されている領域の中心へ、観測点が分かりやすいように地図が移動する。
デッサンもそのように修正する。

4. 修正
宙の窓のアスペクト比の初期値が横3:縦2にする。
デッサンもそのように修正する。

5. 確認
辻ライン365や辻検索などの全てのワーカープールのプールサイズは、CPU数+1になっているか。

よろしくお願いいたします。

### 回答 (2026-06-30) 細かな修正4件＋プールサイズ確認
ご依頼の5件、すべて対応しました（ヘッドレスChromiumで数値・表示を検証）。

**1. 角度を小数点以下4桁に統一 → 対応**
- 宙の窓の基準方位角/基準視高度・オフセット方位角/オフセット視高度の表示を**小数点以下4桁**に統一しました（例: 基準方位角 250.6720°、オフセット −2.0000°）。
- 基準の入力ステップを 0.0001°（4桁入力可）に、オフセットは **0.5°刻み**のまま（ご指定どおり）。

**2. 著作権表示に個人名を2行で記載 → 対応**
- フッターをソースの著作権ヘッダーと同様に、中央揃え2行にしました。
  ```
  © 2026- Takeyoshi Watanabe
  Sora no Tsuji Project - v1.20.1
  ```

**3. トグルで観測点を可視領域の中央へ地図移動 → 対応**
- 全天儀(天の川儀)・標高グラフ・宙の窓・辻検索のトグルをON/OFFすると、**パネルで隠れていない残りの表示領域の中央**へ観測点が来るよう地図をパンします（ズーム率は変えずパンのみ）。
- パネルは下から1/3ずつ積み上がる前提で、隠れ高さ（1/3 or 辻検索併用で2/3）に応じて中央位置を計算。全パネルを閉じると画面全体の中央へ戻ります。
- 検証: 観測点のコンテナ座標が、全閉=画面中央(H/2)、1パネル=可視中央(H/3)、辻検索併用=可視中央(H/6) に一致することを数値確認。デッサン `01-location.md`（共通機能）にも追記しました。

**4. アスペクト比の初期値を 横3:縦2 に → 対応**
- 宙の窓のアスペクト比の初期値を **3:2**（横長）にしました（新規/リセット時。既存の保存値は維持）。ファインダー枠が3:2の横長で表示されることを確認。デッサン `05-soranomado.md` も更新。

**5. 全ワーカープールのプールサイズが CPU数+1 か（確認）→ 対応（CPU数+1へ統一）**
- 確認結果: 従来は3プールとも `min(CPU数, 30)`（＝実質CPU数・上限30）で、**CPU数+1にはなっていませんでした**。
- ご指示により、辻ライン365・辻検索・宙の窓地形の3プールすべてを **CPU数+1（上限31）** に統一しました（`Math.max(1, Math.min((CPU数||6)+1, 31))`）。I/O待ちの間も全コアを使い切れる定番値です。検証環境(CPU=4)で各プール=5 になることを確認。

ご確認のうえ、地図パンのアニメーションや既定値などのご希望があれば微調整します。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 1446c89
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-30)
Claudeさん、ありがとうございます！
確認しました。

まだ、微修正をします。

1. 修正
宙の窓の表示天体の中心の十字記号(+)は、焦点距離が長くなると、拡大されて十字記号の線が太くなってしまうので、焦点距離を変更しても、画面中心の十字記号と同じくらいの大きさに固定表示する。

2. 修正
宙の窓の表示天体の軌跡が、日時情報の日付(前後1日を含む)の範囲となっているが、時間の範囲を0:00から23:59としたい。
そうすると、軌跡の線が3本表示されるであろうから。現状では、2本になっている。

よろしくお願いいたします。

### 回答 (2026-06-30) 宙の窓 微修正2件
ご依頼の2件、対応しました（ヘッドレスChromiumで数値・表示を検証）。

**1. 表示天体の中心十字(+)を焦点距離に依らず固定サイズに → 対応**
- 原因: 中心十字は `sizeAttenuation:false` のスプライトで固定スケールでしたが、この種のスプライトの画面サイズは `1/tan(画角/2)` に比例するため、焦点距離を長くする（画角が狭くなる）と画面上で拡大し、線も太く見えていました。
- 対策: スケールを `tan(画角/2)` ＆ ファインダー高さから逆算し、**画面上のピクセルサイズが一定（≈画面中心の十字と同程度）**になるよう固定しました。焦点距離（35mm/200mm/800mm）を変えても十字は常に同じ大きさ・同じ線の太さで表示されます。
- ※天体の視半径円・月の満ち欠けは「実際の見かけの大きさ」の表現なので、従来どおりズーム連動のまま（焦点距離を伸ばすと大きく表示）です。

**2. 表示天体の軌跡を各日0:00〜23:59の3本に → 対応**
- 原因: 従来は「現在時刻−1日〜+1日」の48時間を**1本の連続線**で描いていたため、見え方が2本になっていました。
- 対策: **前日・当日・翌日のそれぞれを 0:00〜23:59 で1本ずつ＝計3本**の線として描画するようにしました。可視天体ごとに3本（例: 太陽のみ表示で3本、太陽＋月で6本）描かれることを確認しました。
- デッサン `05-soranomado.md` の軌跡の記述にも「各日0:00〜23:59を1本ずつ＝計3本」を追記しました。

ご確認のうえ、十字の大きさ（現在は中心十字と同程度）や軌跡の見せ方のご希望があれば微調整します。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 1446c89
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-30)
Claudeさん、ありがとうございます！
確認しました。

1. 修正
天の川儀のボタン名を「全天儀」に変更する。
デッサンも、網羅して修正する。

2. 修正
位置情報メニューのURLボタンを押下したときに取得できるURLから、プレビューモード(mode=preview)で、辻ラインの表示/非表示、標高グラフの表示/非表示、全天儀の表示/非表示、宙の窓の表示/非表示の記憶/復元ができるように、キーを作成して、デッサン`00-overview.md`を修正する。

3. 修正
宙の窓の画面左下の中心と画角情報は削除する。ごめんなさい🙇

4. 確認
宙の窓の画面中心が、基準方位角と基準視高度で指定される目的点と一致しているかどうか。
微妙に上にずれているような気がします。

よろしくお願いいたします。

### 回答 (2026-06-30) 全天儀改名・URL状態保存・左下情報削除・中心一致確認
ご依頼の4件、対応しました（ヘッドレスChromiumで検証）。

**1. 「天の川儀」→「全天儀」改名 → 対応**
- ボタン名を「全天儀」に変更。コード(index.html/script.js/style.css)とデッサン(01-location.md/05-soranomado.md)の「天の川儀」を網羅的に「全天儀」へ。天体としての「天の川」(天の川リング・天の川方位線・天の川写真等)はそのまま維持。内部ID(btn-milkyway等)は不変。

**2. URLでパネル表示状態を保存/復元 → 対応**
- 位置情報メニューの「URL」(mode=preview)に、辻ライン・標高グラフ・全天儀・宙の窓の表示/非表示を保存するキー(`dp`/`elevation`/`milkyway`/`soramado`、true/false)を追加。
- そのURLでアクセスすると各状態を復元します（標高グラフ/全天儀/宙の窓は排他のため1つだけ開く。辻ラインは地図上に再描画）。
- デッサン `00-overview.md` のURL仕様表に4キーを追記。
- 検証: 生成URLに4キーが入ること、URLロードで該当パネルが開く/辻ラインが描画されることを確認。

**3. 宙の窓 画面左下の中心・画角情報を削除 → 対応**
- 左下のキャプション（「中心 方位… / 画角 …」）を削除しました。プレビューがすっきりします。
- ※three.js読込失敗時のエラー表示の枠だけは残し、通常時は非表示にしています。

**4. 画面中心が目的点(基準方位角・基準視高度)と一致しているか → 確認結果: 一致しています**
- 数値検証の結果、目的点方向 `_smDir(基準方位角, 基準視高度)` はカメラ像の**ちょうど中心(NDC≒0, 誤差10^-16)**に投影され、画面中心十字とズレなく一致していました（透視投影の像中心＝lookAt方向のため、画角・焦点距離に依らず常に中央）。
- 「微妙に上にずれて見える」要因の可能性: ①オフセット視高度が0以外だと中心＝基準＋オフセットになり意図的にずれます（既定は0。メニューでご確認を）。②プレビューに「目的点そのもののマーカー」が無いため、前景の山の稜線を基準に見ると、わずかな見かけのズレを感じることがあります。
- ご希望でしたら、画面中心に来る**目的点マーカー（小さな印）**を追加して、目で一致を確認できるようにできます。ご検討ください。

ご確認のうえ、目的点マーカーの追加可否など、ご要望をお聞かせください。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 265e258
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-30)
Claudeさん、ありがとうございます！
確認しました。
素敵です！
ありがとうございます。

まだまだ、修正は続きます！

1. 修正
宙の窓の目的点に、目的点マーカを十字記号で表示する。

2. 修正
デッサンのURLキーのstarIdにMilkyWayがないので、デッサンに反映する。

3. 修正
位置情報メニューのURL取得ボタンと辻検索のURL取得ボタンで、プレビューを辻ライン、全天儀、標高グラフ、宙の窓、辻検索と組み合わせて、記憶・復元できるようにする。
デッサンにも反映する。

4. 修正
全天儀の天の川画像には、milkyway-skymap.jpgを使用するが、宙の窓の天の川写真は、高解像度のmilkyway-skymap_4k-8bit.jpgを使用する。

5. 質問
今後、基本オプションメニューを作成して、
—
・全天儀
NASA(https://svs.gsfc.nasa.gov/4851/)からダウンロードした天の川の写真を表示/非表示するチェックボックスを付ける。
NASA(https://svs.gsfc.nasa.gov/4851/)からダウンロードした各星座の星座線(constellation-figures-skymap.tif)の写真を表示/非表示するチェックボックスを付ける。
NASA(https://svs.gsfc.nasa.gov/4851/)からダウンロードした各星座の星座領域(constellation-bounds-skymap.tif)の写真を表示/非表示するチェックボックスを付ける。
—
というようなことをやりたいが、星座線と星座領域の画像のフォーマットは、JPEGとTIFFのどちらが良いか。
3種類重ね合わせるが、どのフォーマットが良いか。

よろしくお願いいたします。

### 回答 (2026-06-30) 目的点マーカー・URLキー拡張・天の川画像分離＋形式の助言
4件の修正に対応し、質問5にお答えします（ヘッドレスChromiumで検証）。

**1. 宙の窓に目的点マーカー（十字記号）→ 対応**
- 目的点（基準方位角・基準視高度＝観測点から目的点を見た方向）に**赤い十字(+)**を表示しました（地図の目的点マーカーと同じ赤）。地形に隠れず常に見え、焦点距離・画面サイズに依らず一定の大きさです。
- オフセットが0なら画面中心の白い十字とぴったり重なり、オフセットを付けると赤十字が目的点の位置を示します（中心＝基準＋オフセット）。デッサン `05-soranomado.md` にも追記。

**2. デッサンのURLキー starId に MilkyWay → 対応**
- `00-overview.md` の starId 一覧の先頭に `MilkyWay` を追記しました。

**3. 位置情報URL・辻検索URL の両方でパネル状態を記憶・復元 → 対応**
- 両方のURL取得ボタンで、**辻ライン・標高グラフ・全天儀・宙の窓・辻検索**の表示状態を保存（`dp/elevation/milkyway/soramado/tsujisearch`、true/false）。共通化したので mode=preview / mode=tsujisearch の双方で機能します。
- URLアクセス時に各状態を復元（標高グラフ/全天儀/宙の窓は排他で1つ、辻ラインは地図、辻検索は併用可）。デッサン `00-overview.md` のURL表も更新（4キーを両モード有効化＋`tsujisearch`行を追加）。

**4. 天の川画像の使い分け → 対応**
- 宙の窓の背景球＝**高解像度 `milkyway-skymap_4k-8bit.jpg`**、全天儀＝`milkyway-skymap.jpg`（小サイズ）に分離しました。検証で各画像が正しくリクエストされることを確認。

**5. 質問への回答（星座線・星座領域の画像フォーマット）**
- **TIFFはブラウザで直接表示できません**（`<img>`/WebGLテクスチャ非対応）。必ず変換が必要です。
- **天の川（下地・不透明）**: JPEG（または WebP）でOK。透明不要で軽量。
- **星座線・星座領域（重ね合わせ）**: 透過が必須（背景を透かして下地に重ねる）。**JPEGは透明を扱えません**。→ **PNG（アルファ付き）か WebP（アルファ付き・より軽量）** を推奨します。
  - 特に「星座線」が白線＋黒背景なら、**JPEG＋加算合成（AdditiveBlending）**で黒を実質透明化する軽量な手もあります（three.jsで容易、ファイルも小さい）。ただし「星座領域」の半透明塗りには不向きなので、領域はアルファPNG/WebPが無難です。
- **3枚重ねの推奨構成**: 下地＝JPEG（or WebP）、上2枚＝**WebP（アルファ）**が容量・品質ともにベストバランス。最大互換性重視なら上2枚＝PNG。基本オプションメニューでの3チェックボックス（表示/非表示）は、各レイヤーを個別のテクスチャ平面/球として重ね、blending/transparentで制御する形で実装できます。
- ご希望の方針が決まれば、基本オプションメニューと3レイヤー重ね合わせを実装します。

ご確認のうえ、目的点マーカーの色や、星座画像の形式方針など、ご要望をお聞かせください。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show f298c71
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-30)
Claudeさん、ありがとうございます！
確認しました。
質問への回答をありがとうございます。

私の方で用意できた画像は、JPEG画像をPNG画像に変換したものです。
PNG画像にアルファレイヤーがあるかどうかは、未確認です。
Macのプレビューから書き出しをしました。
アルファレイヤーがあるかどうかご確認ください。

1. 修正
全天儀の天の川画像には、PNG画像で、milkyway-skymap.pngを使用し、宙の窓の天の川写真は、高解像度のmilkyway-skymap_4k-8bit.pngを使用する。

2. 修正
全天儀をドラッグした時に、動きが逆になっているような気がする。
全天儀の内側を掴んで動かしているようだが、外側から俯瞰して操作したいので、全天儀の外側を掴んで動かすようにしたい。

修正をお願いいたします。

### 回答 (2026-06-30) 天の川画像のPNG化・全天儀ドラッグの外側掴み・PNGアルファ確認
2件の修正に対応し、アルファの確認結果をお伝えします（ヘッドレスChromiumで検証）。

**1. 天の川画像をPNGに → 対応**
- 全天儀＝`milkyway-skymap.png`、宙の窓＝高解像度 `milkyway-skymap_4k-8bit.png` に切り替えました。検証で各PNGが正しくリクエストされ、エラー無く描画されることを確認。
- ※旧JPG（milkyway-skymap.jpg / _4k-8bit.jpg）は未使用になります。リポジトリ整理のため削除してよければ、次回まとめて削除します（容量削減になります）。

**2. 全天儀のドラッグを外側掴みに → 対応**
- 水平方向の回転が逆（内側を掴む感じ）になっていたのを反転し、**球の外側を掴んで回す操作感**にしました。右へドラッグ→手前の面が右へ、下へドラッグ→手前の面が下へ、と指に追従します（実ドラッグで前面マーカーの追従を数値確認）。

**3. PNGのアルファレイヤー確認 → 結果: いずれもアルファ無し**
- 画像のIHDR（カラータイプ）を検査しました:
  - `milkyway-skymap.png`(1024×512) / `milkyway-skymap_4k-8bit.png`(4096×2048) = **RGB（アルファ無し）**。→ 背景用途なので不透明で問題ありません。
  - `constellation_figures_skymap.png`(星座線) / `constellation_bounds_skymap.png`(星座領域)(各1024×512) = **グレースケール（アルファ無し）**。
- 重ね合わせについて: 星座線・星座領域は**アルファが無くても、加算合成(AdditiveBlending)で黒を実質透明化**して天の川の上に重ねられます（白線が光って見える表現。線画に好適）。
  - 半透明の「塗り」で領域を表現したい場合は、アルファ付き（RGBAのPNG/WebP）への書き出しが必要です。Macプレビューの「書き出し」では、元のJPEGにアルファが無いとPNGにもアルファは付きません（背景を透過させるには画像編集ソフトで透明背景にして書き出す必要があります）。
- 次の基本オプションメニュー＋3レイヤー重ね合わせは、この方針（線・領域＝加算合成 or アルファ画像）で実装できます。ご希望をお聞かせください。

ご確認のうえ、旧JPGの削除可否・星座重ね合わせの方針など、ご指示をお願いいたします。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show dd56cb2
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-30)
Claudeさん、ありがとうございます.
確認しました。

以前の要望にあったWebPフォーマットにAdobeのイラストレーターを使用して、JPEGから変換しました。
ご活用ください。

1. 修正
全天儀の天の川画像には、WebP画像で、milkyway-skymap.webpを使用し、宙の窓の天の川写真は、高解像度のmilkyway-skymap_4k-8bit.webpを使用する。

よろしくお願いいたします。

### 回答 (2026-06-30) 天の川画像をWebPに変更
ご用意いただいたWebP画像（Illustratorで変換）に切り替えました（ヘッドレスChromiumで検証）。

**1. 天の川画像をWebPに → 対応**
- 全天儀＝`milkyway-skymap.webp`、宙の窓＝高解像度 `milkyway-skymap_4k-8bit.webp` に切り替えました。
- 検証: 両WebPが正しくリクエスト（200）され、全天儀・宙の窓ともに**透過アーティファクト無く**、JSエラー0件で描画されることを確認しました。

**補足（画像の確認結果）**
- 追加いただいたWebPはいずれも VP8X 形式で、**アルファチャンネル付き**でした。
  - `milkyway-skymap.webp`(434KB) / `milkyway-skymap_4k-8bit.webp`(7.4MB)＝背景は不透明な天の川写真なので描画に影響なし（PNGより軽量で◎）。
  - **`constellation_figures_skymap.webp`（星座線）/ `constellation_bounds_skymap.webp`（星座領域）も アルファ付き** ＝今後の星座重ね合わせ（基本オプションメニュー）に**そのまま使えます**。透過で天の川の上に綺麗に重ねられます。
- これで、次は「基本オプションメニュー＋3レイヤー（天の川／星座線／星座領域）の表示チェックボックス」を、アルファ付きWebPの重ね合わせで実装できます。ご希望のタイミングでお申し付けください。

ご確認のうえ、未使用になった旧PNG/JPG（milkyway-skymap.{png,jpg} / _4k-8bit.{png,jpg}）の削除や、星座重ね合わせの実装など、ご指示をお願いいたします。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show d0bb8e0
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-30)
Claudeさん、ありがとうございます.
確認しました。

1. 修正
全天儀の天の川画像には、WebP画像で、milkyway-skymap.webpを使用し、宙の窓の天の川写真は、高解像度のmilkyway-skymap_4k.webp(このファイル名が修正)を使用する。

ファイル名と画像ファイルが差し替えられております。
よろしくお願いいたします。

### 回答 (2026-06-30) 宙の窓の4K画像ファイル名を milkyway-skymap_4k.webp に修正
ファイル名の変更に追従しました（ヘッドレスChromiumで検証）。

**1. 画像ファイル名の差し替え → 対応**
- 宙の窓の天の川写真の参照を、新ファイル名 **`milkyway-skymap_4k.webp`** に修正しました（旧 `milkyway-skymap_4k-8bit.webp` は削除済み）。
- 全天儀は `milkyway-skymap.webp`（変更なし）。
- 検証: 宙の窓が `milkyway-skymap_4k.webp`(200)、全天儀が `milkyway-skymap.webp`(200) をリクエストし、旧名の参照・404は無し、JSエラー0件で描画されることを確認しました。
- 旧画像（JPG/PNG/旧webp）を整理いただきありがとうございます。リポジトリがすっきりしました。

ご確認のうえ、次の作業（基本オプションメニュー＋星座3レイヤー重ね合わせ 等）のご希望があればお申し付けください。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 67332f3
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-30)
Claudeさん、ありがとうございます.
確認しました。

1. 修正
宙の窓に「天の川の環」の線を天体色で表示する。天の川の中心座標も、他の天体と同じように天体色の十字記号を表示する。

### 回答 (2026-06-30) 宙の窓に「天の川の環」＋中心の十字を天体色で表示
ご依頼に対応しました（ヘッドレスChromiumで検証）。

**1. 天の川の環＋中心十字を天体色で表示 → 対応**
- **天の川の環**: 銀河赤道(b=0)の大円を、天の川の天体色（既定＝紫 #800080）の線で描画しました。背景の天の川写真と**同じ座標変換（地平座標）**で生成しているため、写真の天の川の帯に**ピタリと整列**します（スクショ参照：紫の線が天の川の帯に沿って表示）。
- **天の川の中心の十字**: 銀河中心（いて座 Sgr A* 付近）に、他の天体と同じ**天体色の十字記号**（焦点距離・画面サイズに依らず一定サイズ）を表示しました。
- 表示天体メニューで天の川の色を変えると、環の線も中心の十字もその色に追従します。天の川の表示をOFFにすると環・十字も消えます。
- 環は時刻・観測地・色が変わった時のみ再計算（キャッシュ）し、オフセット操作などでは再計算しないので軽快です。地形より奥にあるため、手前の山に隠れる部分は隠れます。
- デッサン `05-soranomado.md` にも追記しました。

**検証（JSエラー0件）**
- 環の線が天の川写真の帯に整列、銀河中心の十字が銀河中心方向（NDC≒中央）に一致することを数値＋スクショで確認。色変更（紫→緑）への追従、非表示で消えることも確認。

ご確認のうえ、環の太さ・色・中心十字のサイズなどのご希望があれば調整します。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show ce85f59
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-06-30)
Claudeさん、ありがとうございます.
確認しました。

あと、私の修正依頼内容に間違いがありました。
訂正させていただきます。

1. 修正
宙の窓に「天の川の環」の線を「白色」で表示する。天の川の中心座標も、他の天体と同じように天体色の十字記号を表示し、天の川の中心座標の軌跡(前後1日を含む3本)を天体色で表示する。

お手数ですが、修正の程、よろしくお願い申し上げます。

### 回答 (2026-06-30) 訂正対応: 天の川の環を白色に＋銀河中心の軌跡(3本)を追加
ご訂正の3点、対応しました（ヘッドレスChromiumで検証）。お気になさらず、いつでも訂正ください。

**1. 天の川の環の線を「白色」に変更 → 対応**
- 天の川の環（銀河赤道の大円）の線を**白色**に変更しました（全天儀のリングと同じ白）。背景の天の川写真の帯にぴたり整列します。

**2. 天の川の中心座標の十字は天体色のまま → 維持**
- 銀河中心の十字記号は、他天体と同じ**天体色**（既定＝紫）で表示（変更なし）。

**3. 銀河中心の軌跡（前後1日＝計3本）を天体色で追加 → 対応**
- 天の川の中心座標（銀河中心）の軌跡を、他の天体と同じく**前日・当日・翌日の3本**、**天体色の線**で表示するようにしました（銀河中心は赤道座標で固定なので、日周運動の弧を3本描きます）。

**検証（JSエラー0件）**
- 環の線色＝白(ffffff)、中心十字＝天体色、軌跡＝3本・天体色(800080) を数値確認。スクショのとおり、白い環（天の川の帯に整列）と、紫の中心十字・紫の軌跡が区別して表示されます。
- デッサン `05-soranomado.md` も訂正後の内容に更新しました。

ご確認のうえ、環の太さや軌跡の見せ方などのご希望があれば調整します。
