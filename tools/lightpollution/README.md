# tools/lightpollution — 光害アセット前処理(宙検索フェーズ3用)

Falchi et al. 2016「世界光害アトラス」のGeoTIFF(人工天空輝度 mcd/m²)から日本域を切り出し、
SQM(mag/arcsec²)に変換してUint8量子化した軽量アセットを生成する、オフラインで1回だけ実行するスクリプトです。
参照元が更新されたら再実行するだけでアセットを最新化できます。

## 手順(コピー&ペーストで順番に実行してください)

> 表記の注意: このREADMEやスクリプトの説明で山括弧付きの `<GeoTIFF>` のように書かれている部分は
> 「実際のファイルパスに置き換える穴埋め」の意味です。`<>` ごと入力するとzshの構文エラー
> (`parse error near '\n'`)になりますのでご注意ください。

1. **入力データの入手**(1回だけ・無料。非商用条件・クレジット必須):
   - GFZ Data Services: doi:10.5880/GFZ.1.4.2016.001
   - https://dataservices.gfz-potsdam.de/contact/showshort.php?id=escidoc:1541893
   - ページ内のダウンロードリンクからアーカイブを取得し、**GeoTIFF(拡張子 .tif。float32・全球・30秒角)**を
     取り出してください(例: `~/Downloads/World_Atlas_2015.tif` に置く)
2. **このディレクトリへ移動して依存をインストール**(1回だけ):
   ```
   cd tools/lightpollution
   npm install
   ```
   ※ リポジトリの直下ではなく、必ず `tools/lightpollution` の中で実行してください
   (直下で実行するとgeotiffが入らず「geotiff が見つかりません」エラーになります)
3. **動作確認**(入力ファイル不要。SELFTEST PASS と出ればスクリプトは正常):
   ```
   node lp-preprocess.js --selftest
   ```
4. **本実行**(--in の後ろを手順1で置いた実ファイルのパスにする):
   ```
   node lp-preprocess.js --in ~/Downloads/World_Atlas_2015.tif
   ```
   - 既定で リポジトリの `data/lp-japan.bin`(Uint8格子)と `data/lp-japan.json`(メタ)を生成します
   - 生成された2ファイルをコミットしてください(フェーズ3でアプリから読み込みます)
   - オプション: `--out <dir>` 出力先 / `--downsample 4` 縮約率(既定4 → 約2分角≒3.7km格子・数百KB) /
     `--west/--south/--east/--north` 切り出し範囲(既定 E122〜154, N24〜46)

## トラブルシューティング

- **`ERR_FS_FILE_TOO_LARGE: File size ... is greater than 2 GiB`**
  - 旧版スクリプトの既知の問題です(全球GeoTIFFは約2.8GBで、ファイル全体読みの上限2GiBを超える)。
  - 現行版は必要な帯だけをランダムアクセスで読む方式(fromFile)に修正済みです。
    ローカルリポジトリで `git pull` して最新のスクリプトに更新してから再実行してください。
- **`EPERM: operation not permitted, open '~/Downloads/...'`**
  - macOSのプライバシー保護(TCC)で、ターミナル(node)がダウンロードフォルダにアクセスできない状態です。
  - 対処A(簡単): Finderで .tif ファイルを `tools/lightpollution` フォルダへドラッグして移動し、
    `node lp-preprocess.js --in ./World_Atlas_2015.tif` のように相対パスで実行する
  - 対処B: システム設定 → プライバシーとセキュリティ → ファイルとフォルダ → ターミナル →
    「ダウンロードフォルダ」をオン → ターミナルを再起動して再実行
  - それでも出る場合: ファイルがiCloudのプレースホルダ(雲アイコン)になっていないか確認
    (一度開く等でローカルに実体化してから実行)
- **`zsh: parse error near '\n'`** — `<GeoTIFF>` の山括弧は穴埋め表記です。`<>`ごと入力せず実パスに置き換えてください
- **`geotiff が見つかりません`** — `tools/lightpollution` の中で `npm install` を実行してください

## 変換式と実行時の参照

- 自然光 22.0 mag/arcsec² = 0.171168465 mcd/m² / total = artificial + 0.171168465 /
  SQM = log10(total / 108000000) / (−0.4)
- 量子化: SQM∈[15.0, 22.0] を 0〜255 に線形割当(1段 ≈ 0.027等級)
- 実行時(フェーズ3でscript.jsに実装):
  ```
  ix = floor((lng − west) / dLng); iy = floor((north − lat) / dLat)
  SQM = sqmMin + bin[iy*width + ix] / 255 * (sqmMax − sqmMin)
  ```

## クレジット(アプリのフッターに表記)

- Falchi et al. 2016, "The new world atlas of artificial night sky brightness",
  GFZ Data Services, doi:10.5880/GFZ.1.4.2016.001(非商用条件)
