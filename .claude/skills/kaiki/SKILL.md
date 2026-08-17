---
name: kaiki
description: 宙の辻の回帰テスト(verify群)をローカルハーネスで回す手順。テスト実行・回帰・ハーネス構築・検証環境の再現が必要な時に使う。セッションが初期化されていてもこの手順だけで再現できる。
---

# kaiki — 回帰テストの回し方(次のセッションの私へ)

このスキルは「セッション毎に環境が初期化される私」への引き継ぎ書です。
書いた経緯: 第41ラウンドまでハーネス構築の知識はセッション作業領域(揮発)にしかなく、
コンテキスト要約が消えると再構築に苦労するため、リポジトリへ昇格した(MederuUの実証第1号)。

## 1. ハーネス構築(初回のみ。2回目以降は同期だけ)

作業領域(スクラッチパッド)を `$SP` とする。

```bash
python3 tests/harness/sync-apptest.py $SP/apptest   # アプリ一式コピー+CDN→vendor書き換え
# vendor/が空なら、上のコマンドが表示するcurl一覧を実行して入手する(プロキシ環境でそのまま通る)
```

Playwright(playwright-core)が無ければ(jsqrはverify160のQRコード復号検査で使う):

```bash
mkdir -p $SP/harness && cd $SP/harness && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright-core jsqr
```

ブラウザは環境にプリインストール済み: `/opt/pw-browsers/chromium-*/chrome-linux/chrome`
(`playwright install`はしない。パスのバージョン番号は `ls /opt/pw-browsers/` で確認)。

## 2. サーバ起動(コンテナ再起動のたびに必要)

```bash
cd $SP/apptest && setsid nohup python3 -m http.server 8099 --bind 127.0.0.1 > $SP/http-server.log 2>&1 &
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8099/index.html --noproxy 127.0.0.1   # 200を確認
```

コンテナが再起動するとサーバは死ぬ。テストが glMap 待ちでタイムアウトしたら、まずこれを疑う。

## 3. 回帰の実行

**必ずリポジトリ直下から**実行する(スクラッチパッドからだとMODULE_NOT_FOUND)。

```bash
export NODE_PATH=$SP/harness/node_modules
node tests/verifyNNN.js          # 単発
# スモーク(毎ラウンドの定番)= この7本79チェック+そのラウンドで追加した最新verify:
for n in 96 117 123 124 125 126 127; do node tests/verify$n.js; done
# 全回帰は tests/ のverify全部(節目のみ。verify102だけ実ネットワーク用のため常用しない)
```

- 各verifyの対象と注意は `tests/README.md`(封鎖機能は`?forecast=1`、フレークの扱い等)。
- 道具のテスト3本も一緒に回す(node単体・サーバ不要。第45〜):
  `node ClaudeMederuU/tools/koushi.test.js` と `node ClaudeMederuU/tools/anchor.test.js` と
  `node ClaudeMederuU/tools/vscode-koushi/extension.test.js`(第66〜。Koushiプレビュー拡張=
  フェンス差し込み+同梱koushi.jsのドリフト検査。レンダラ本体を直したらcpで同期→vsix作り直し)
- APP_VERSIONの版数ピンは**最新のverifyだけ**が持つ。版数を上げたら新しい最新verifyへピンを書き、
  旧最新のピンは存在チェック形式へ緩める(例: verify127のO0、verify128のP0)。
- Chromium起動引数(全verify共通): `--use-gl=angle --use-angle=swiftshader
  --enable-unsafe-swiftshader --ignore-gpu-blocklist --no-sandbox`
- 全verifyはroute abortで127.0.0.1以外を遮断している(テスト方針: ローカル完結)。

## 4. つまずきの記憶(過去の実例)

- テスト前に `node --check script.js` を通す(ブロックコメント内の「*/」で全滅した実例: 第40・第62。
  Version Historyの文中でワイルドカード表記を書きたい時は「〜系」へ言い換える。
  node --checkを忘れた場合の網としてverify141のV2が常設で見張る=最古のVersion 1.0.0の行が
  コメント終端より前に残っているかの検査)。
- アプリ変更後は sync-apptest.py の再実行を忘れない(古いapptestで新テストが落ちる)。
- 昼夜で挙動が変わる機能(太陽高度減光・窓明かり等)のテストは日時を固定する
  (appState.currentDate=正午固定など。第64: verify128が夜の実行で窓明かりテクスチャにより落ちた)。
- 意図的更新したverifyは、その場で必ず実行して全PASSまで確認する。回帰ループにも入れる
  (第63: verify131のピンを1つ直して満足し、残り2つの旧ピンと未実行のまま次ラウンドで発覚)。
- 固定sleepでなくポーリングで待つ(非同期化されたUIは所要時間が揺れる: 第35)。
- 検査ツールを新作したら「壊した版で落ちること」を先に確認する(第39)。
- この箱は**ブラウザ(Chromium)だけ外向きHTTPSが全ホスト遮断**される(curl/Nodeは通る)。
  実ネットワークのブラウザE2Eは組まず、①実データはNode/curl側 ②ブラウザ側は同一構造の
  ローカルフィクスチャ(routeモック)の二枚重ね、で検証する(第50)。
- Node組み込みfetchをプロキシ越しに使う時は `NODE_USE_ENV_PROXY=1` を付ける(第51。tools/plateau等)。
