# MederuUリポジトリ作成の手順書 — Privateで器を立てる

第76ラウンド(2026-08-14)作成。koushi公開で確立した型(staging→開錠→push→施錠→検品)の再利用。
一式の中身は `ClaudeMederuU/mederuu-repo-staging/` に準備済み(デッサン00の手順4=
「2フォルダ+README+CLAUDE.mdの最小構成」の通り。蒸留第1陣は入れない=空の器を先に作る)。

## 手順1 🧑: GitHubでMederuUリポジトリを作成する(3分)

1. https://github.com/new を開く。
2. 設定は次の通り。
   - Owner: `takeyosui15` / Repository name: `MederuU`
   - 説明(任意): `Claudeのナレッジ・道具・手順をセッションを越えて引き継ぐ器`
   - **Private** を選ぶ(公開の判断は手順9のまま先送り=デッサン00の方針)。
   - README/.gitignore/licenseは**全てオフのまま**(中身はClaudeが送る。
     ライセンスは公開時に道具=コードと学び=文書で分けて検討する — MITの意向は記録済み)。
3. 「Create repository」。
   - Privateなので読めるのも書けるのも、たけちゃんと許可したApp(開錠中のClaude)だけ。
   - ブランチ保護は当面設定しない(単独オーナーのPrivateでは鍵=App施錠が実質の保護。
     公開する時=手順9で、PR必須化とあわせて再検討する)。

## 手順2 🧑→🤖: 開錠してClaudeにpushしてもらう

1. GitHubの Settings → Applications → Installed GitHub Apps → Claude →「Configure」→
   Repository access に `MederuU` を追加してSave(開錠)。
2. 次の依頼で「MederuUを作りました。開錠済みです」と一言。
3. Claudeがstaging一式(README・CLAUDE.md・legends/・projects/)をmainへpushし、
   引き直しクローンで検品する(koushiと同じ「届いた実物」検品)。
4. 🧑 施錠(Repository accessから外す)。次にpushが必要になるまで閉めておく
   (koushiと同じ既定施錠の運用)。

## 以後の手順(デッサン00のスモールスタート手順の続き)

- 手順5: sync.js(一方向吸い上げ+秘密検査)— 吸い上げ元は宙の辻の`ClaudeMederuU/`+`.claude/skills/`。
- 手順6: index-gen(man風ヘッダ→目次)。
- 手順8: 最初の蒸留(reviews/約70枚からlegends/への昇格第1陣。プロジェクトの節目に)。
- 手順9: 公開の判断(ライセンス・秘密検査の確認)。
- sync実行時のMederuUへのpushも「開錠→push→施錠」で行う(頻度はプロジェクトの節目毎なので
  開けっ放しにしない運用と相性が良い)。

## sync.jsの運用(手順5。第80ラウンドで道具は完成)

- 本体は `ClaudeMederuU/mederuu-repo-staging/sync.js`(次の開錠時にMederuUのルートへpush)。
- 使い方: MederuUのクローン内で `node sync.js <宙の辻リポジトリのパス> [--dry-run]`。
  `node sync.js --self-test` で検査パターンの自己テスト(8チェック)が回る。
- 一方向ミラー(元に無い写しは消す)+秘密検査(鍵・トークン・秘密鍵・メール等。1件でも
  当たったファイルはスキップして報告・終了コード1)。`*-repo-staging/`・`.vsix`・
  `node_modules/` は写さない(知識ではなく製品の複製のため)。
- 写した記録は `projects/<名前>/SYNC.md`(日時・元コミット・件数)。
- **写し(projects/の中身)は宙の辻リポジトリには置かない**(毎ラウンド churn する複製になるため)。
  push時に「MederuUをクローン→sync.jsを実行→commit」の順で生成する。

## 進捗

- 手順1〜2✅(第76〜77ラウンド=2026-08-14): Private作成・開錠→初回コミット44da054をmainへpush・
  引き直しクローンでstagingと完全一致を検品済み。**器は立った(デッサン00の手順4完了)**。
- 手順5✅道具完成(第80ラウンド=2026-08-14): sync.js作成・自己テスト8チェック全PASS・
  宙の辻を吸い上げ元にした実走で96ファイル/秘密検査スキップ0件を確認(検査は当初3件を検出→
  すべてKoushiのサンプル架空アドレス(example.com=文書用予約ドメイン)で、許可リストへ追加)。
- **手順5✅完遂(第81ラウンド=2026-08-14)**: 開錠を受けてsync.js+初回吸い上げ(97ファイル)を
  コミットb2cc685としてmainへpush。引き直しクローンで検品済み(sync.js/READMEがstagingと
  完全一致・クローン内で自己テスト8/8・projects/soranotsuji=98ファイル[97+SYNC.md])。
  以後のsyncはプロジェクトの節目毎に「開錠→クローンでsync.js実行→commit+push→施錠」。
- **手順6✅(第92ラウンド=2026-08-14)**: index-gen.js(腐らない目次)を作成しMederuUルートへ配置。
  コミットf4f20c7としてmainへpush(同時に第81〜91のreviews 11枚を吸い上げ・sync.jsヘッダを
  JSDocタグ形式へ・index.md 13フォルダ分を生成)。引き直しクローンで検品済み
  (sync.js/index-gen.jsがstagingと完全一致・クローン内で自己テスト8/8と9/9・reviews 73枚)。
  以後のsyncは「開錠→クローンでsync.js→index-gen.js→commit+push→施錠」の順(index-genを
  syncの後に走らせると、ミラーが消した古い目次を作り直す=一方向ミラーと矛盾しない)。
- 以後: 手順8(蒸留第1陣)・9(公開判断)はデッサン00の手順のまま。
  MederuUへのpushは毎回「開錠→push→施錠」(既定施錠)。

## Macローカルクローン「MederuU-local」の作り方と切り替え(手順8の成果物をVSCodeで読む準備)

第82ラウンド(2026-08-14)追記。依頼者の閲覧用。読むだけの場所なので、いつ作ってもよい。

1. **置き場所はiCloud同期の外**にする(例: `~/dev`)。iCloudドライブ配下はgitと相性が悪い
   (docs/knowledge/mac-install-decision.md の教訓と同じ)。
2. ターミナルで:
   ```bash
   cd ~/dev
   git clone https://github.com/takeyosui15/MederuU.git MederuU-local
   ```
   - PrivateだがたけちゃんはオーナーなのでGitHubのログイン(いつものgit認証)でそのまま引ける。
   - **施錠(AppのRepository access)はたけちゃん自身のgit操作には関係ない**(鍵はClaude用)。
3. VSCodeで「ファイル → フォルダーを開く…」で `~/dev/MederuU-local` を開く。
4. **切り替え**: 「ファイル → 最近使用した項目」から soranotsuji-dev ⇄ MederuU-local を行き来するか、
   「ファイル → 新規ウィンドウ」で2つ並べる(見比べたい時はこちらが楽)。
5. **更新**: 読む前にVSCodeのターミナルで `git pull`(Claudeが吸い上げをpushした後の新しい写しが入る)。
6. 約束: MederuU-local側は**読むだけ**(projects/は写し=手で編集しない。編集はいつも通り宙の辻側で)。
   legends/など蒸留物(手順8以降)にコメントしたくなったら、依頼文で言っていただければ宙の辻側の運用に乗せます。
