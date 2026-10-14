# vendor/ — 自前で配信する第三者ライブラリ

宙の辻が使う第三者のJavaScript/CSS/WASMを、CDNや外部ホストから読み込む代わりに、このフォルダから配信します。
理由: 外部ホストの改ざん・停止・版の勝手な変化に、アプリの安全性と動作を預けないためです(サプライチェーン対策)。

- 版は固定です。各ファイルの出所(npmの版)・ライセンス・内容の指紋(sha384/sha256)は `MANIFEST.json` に記録しています。
- 回帰テスト(`tests/verify184.js`)が、このフォルダの中身と `MANIFEST.json` の指紋が一致することを見張ります。
- 更新するときは、新しい版をnpmの配布物から取り寄せます(registry.npmjs.org の tgz、または cdn.jsdelivr.net/npm と unpkg.com の2か所から取って同じ指紋であることを確かめる=1か所の改ざんに気づくため)。ファイルを置き換え、`MANIFEST.json` の版と指紋を書き直してから、回帰テストを全部回します。
- GitHub Pages は `.nojekyll` が無いと `vendor/` という名前のフォルダを配信しません(Jekyllが飛ばす)。リポジトリ直下の `.nojekyll` を消さないこと(本番のリポジトリにも同じファイルが要ります)。
- 各ライブラリのライセンス全文は `licenses/` にあります(MapLibre GL JS: BSD-3-Clause / three.js・astronomy-engine・qrcode-generator・GeographicLib: MIT / Draco: Apache-2.0)。GeographicLib の度分秒(geographiclib-dms)は使っていないので同梱しません。

| ファイル | パッケージ | 版 | 用途 |
|---|---|---|---|
| maplibre-gl.js / maplibre-gl.css | maplibre-gl | 4.7.1 | 地図 |
| astronomy.browser.min.js | astronomy-engine | 2.1.19 | 天体計算(本体とワーカー) |
| three.module.min.js | three | 0.160.0 | 天体儀・宙の窓の3D |
| geographiclib-geodesic.min.js | geographiclib-geodesic | 2.2.0 | 測地線(WGS84) |
| qrcode.js | qrcode-generator | 1.4.4 | QRコード(npmの配布物そのまま。CDNが作る .min は出所を再現できないので使わない) |
| draco/draco_wasm_wrapper.js / draco/draco_decoder.wasm | three (examples/jsm/libs/draco = Google Draco) | 0.160.0 | 都市モードの建物データの解凍 |
