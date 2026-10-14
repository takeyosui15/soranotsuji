# 可視マップの静的資産の配布 — 公開リポジトリとGitHub Pagesの手順

可視マップ(デッサン `docs/dessin/dessin/05-kashimap.md`)の静的資産(山ごとの `meta.json`・`islands.json`・`outline.json` と索引 `index.json`)を、
宙の辻の本体とは別の**公開リポジトリ**から GitHub Pages で配る手順(Q21・Q26の依頼者決定: 公開で)。
今は `data/kashimap/v1/`(本体に同梱。富士山60km・毛無山20km)から読んでいる。配布先ができたら `script.js` の `KM_ASSET_BASE` を差し替えるだけで切り替わる。

## 1. なぜ別リポジトリか
- 資産は大きい(富士山60kmの `outline.json` が7.5MB。300km/700kmの資産はさらに大きい)。本体リポジトリに積むとclone・デプロイが重くなる。
- 資産は作り直すたびに丸ごと差し替える(間引きなし・版 `v1`)。本体のコミット履歴と分けた方が扱いやすい。
- GitHub Pages は静的ファイルを `Access-Control-Allow-Origin: *` で配る(別ドメインの宙の辻からfetchできる)。JSONはgzipで圧縮して送られる。

## 2. たけちゃんがやること(1回だけ)
1. GitHubで新しいリポジトリを作る: 名前は例えば `soranotsuji-kashimap`。**Public**。READMEだけで作ってよい(ライセンスは後述)。
2. Settings → Pages → Build and deployment: Source=**Deploy from a branch**、Branch=**main** / **(root)** → Save。
   数分で `https://takeyosui15.github.io/soranotsuji-kashimap/` が開くようになる(404のうちは待つ)。
3. 配布のURLは `https://takeyosui15.github.io/soranotsuji-kashimap/kashimap/v1/` になる(フォルダ `kashimap/v1/` の下に資産を置く)。
4. (任意)このリポジトリも「施錠」運用にするなら、MederuU/koushiと同じ扱いにする。資産は公開だが、書き込みは本体と同じ合図で。

## 3. 資産の置き方(Claude/道具がやること)
1. 配布リポジトリをcloneする(宙の辻の作業ディレクトリの外。例 `~/work/soranotsuji-kashimap`)。
2. 道具で資産を作る時に `--asset <cloneの中のkashimap/v1>` を付ける:
   ```
   node tools/kashimap/viewshed.js --id 368 --range 60 --asset ~/work/soranotsuji-kashimap/kashimap/v1
   ```
   `kashimap/v1/368/terrain/60/{meta,islands,outline}.json` と `kashimap/v1/index.json`(山リストの「島の数」「静的」列の元)が書かれる。
   アプリの「目的点で計算」で作った資産(端末の「⬇」でFile出力したJSON)を静的資産に昇格するなら、JSONの `assets[i].meta/islands/outline` を
   同じ3つのファイルに分けて置き、`index.json` に山を足す(形は `data/kashimap/v1/index.json` と同じ。`sizes`=3ファイルの合計バイト数は山リストの「サイズ」列の元。道具が書く)。
3. 配布リポジトリで `git add -A && git commit -m "資産: 富士山60km" && git push`。Pagesが数分で更新される。
4. 確かめる: ブラウザで `https://takeyosui15.github.io/soranotsuji-kashimap/kashimap/v1/index.json` が開く。

## 4. アプリ側の切り替え
- `script.js` の `KM_ASSET_BASE` を `'https://takeyosui15.github.io/soranotsuji-kashimap/kashimap/v1/'` に変える(末尾の `/` を忘れない)。
- 同梱の `data/kashimap/v1/` は、配布先に同じ資産を置いた後に本体から外す(それまでは二重でよい)。
- 端末に保存済みの資産(IndexedDB)はそのまま使える(鍵は `id/kind/range` で置き場所に依らない)。

## 5. 大きさの目安と上限
- GitHub: 1ファイル100MBまで(50MBで警告)。リポジトリは1GB程度までが目安。Pagesのサイトは1GB・月100GBの転送が目安。
- 富士山60km(z15・間引きなし)= outline 7.5MB・islands 0.8MB。100km(z14)・300km(z12)・700km(z11)は粗い解像度で作るので、1山あたり合計で数十MB以内に収まる見込み。
- 1山で100MBを超える資産ができたら、輪郭を範囲ごとに分ける(今の形のまま `range` を分けて置く)か、PMTiles化(段3第2弾)を検討する。

## 6. 出典とライセンスの表記
- 資産の `meta.json` に `attribution`(「国土地理院 標高タイル(DEM5A/5B/5C/10B)を加工して作成。日本の主な山岳標高(国土地理院)を加工して作成」)が入っている。
- 配布リポジトリのREADMEにも同じ出典と、宙の辻からのリンクを書く。資産のライセンスは出典(地理院コンテンツ利用規約=出典の明記で利用可)に従う旨を書く。
- 本体のヘルプ「可視マップ」節の出典表記はそのまま。

## 7. 作業の順番(提案)
1. たけちゃん: リポジトリ作成+Pages有効化(2.)。URLを依頼文で知らせる。
2. Claude: 富士山60km・毛無山20kmの資産を配布リポジトリへ(3.)。`KM_ASSET_BASE` を切り替え、回帰(資産を読むverify175/176/177)はローカルの写し(ハーネス)で確認。
3. その後: 百名山から順に静的資産を作って積む(道具の実走は1山60kmで約10分=タイル取得が大半。2回目からはキャッシュ)。
