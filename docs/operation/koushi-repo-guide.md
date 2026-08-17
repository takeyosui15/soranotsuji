# koushiリポジトリ公開の手順書 — リポジトリ作成からMarketplace公開まで

第69ラウンド(2026-08-09)作成。全体は5段で、**たけちゃんの作業(🧑)とClaudeの作業(🤖)**を明記する。
進捗: 手順1〜5✅(第70〜72。**v0.3.1がMarketplace掲載**)。
更新リリースフロー(①更新→②開錠→③push→④施錠→⑤pull+publish)も第73〜75で
**v0.3.2(プレビュー画像)の一周を実走完了**。以後はこの手順書だけで回る。
掲載ページ: https://marketplace.visualstudio.com/items?itemName=takeyosui15.koushi-preview
一式の中身は `ClaudeMederuU/tools/koushi-repo-staging/` に準備済み(このフォルダがそのまま
新リポジトリの中身になる。正は従来どおり宙の辻リポジトリ側で、リリース時にClaudeが同期する)。

## 手順1 🧑: GitHubでkoushiリポジトリを作成する(5分)

1. https://github.com/new を開く。
2. 設定は次の通り。
   - Owner: `takeyosui15` / Repository name: `koushi`
   - 説明(Description・任意): `Koushi: Markdown Spanning Table — write tables with merged cells as Markdown-style bullet lists (VS Code extension)`
   - **Public** を選ぶ(Marketplaceから参照されるため公開)。
   - **「Add a README file」「Add .gitignore」「Choose a license」は全てオフのまま**にする
     (中身は全部Claudeが送るので、空のリポジトリが一番きれい。LICENSEも一式に入っている)。
3. 「Create repository」を押す。以上。
   - 補足: Publicでも**書き込めるのは所有者(たけちゃん)と招待した人だけ**。
     他の人ができるのは「読む・フォークする・プルリクエストを提案する」まで
     (プルリクを取り込むかは所有者の自由)。「誰でも書き込める」状態にはならないので安心を。

## 手順2 🧑→🤖: Claudeに一式を送ってもらう

1. **ClaudeのGitHub Appに`koushi`へのアクセスを許可する**(第70ラウンドで判明した必須手順。
   公開リポジトリでも「読めるが書けない」ため、これが無いとClaudeがpushできない):
   - GitHubの Settings → Applications → Installed GitHub Apps → **Claude** の「Configure」→
     Repository access で `koushi` を追加して Save。
   - (Claude in Slack/Web の管理画面 https://claude.ai/settings から辿れるGitHub設定でも同じ)
2. リポジトリとアクセス許可ができたら、次の依頼で「`koushi`リポジトリを作りました。
   一式を送ってください」と伝える。
3. Claudeがセッションにリポジトリを追加し、staging一式(README・LICENSE(MIT)・拡張本体・
   レンダラ・文法・テスト・icon)をmainへpushする。
   - 代替(Appの許可をしたくない場合): Macで手動コピー —
     `git clone https://github.com/takeyosui15/koushi` → 宙の辻リポジトリの
     `ClaudeMederuU/tools/koushi-repo-staging/` の中身(隠しファイル含む)をコピー →
     `git add -A && git commit -m "initial release" && git push`。

## 手順3 🧑: Microsoftアカウントとpublisher登録(15分・1回だけ)

1. Microsoftアカウントが無ければ https://signup.live.com で作成(既存の個人アカウントでも可)。
2. https://marketplace.visualstudio.com/manage をそのアカウントで開き、
   「Create publisher」で publisher ID **`takeyosui15`** を作成する(表示名は自由)。
3. https://dev.azure.com を同じアカウントで開き(初回はorganization作成を求められたら作成)、
   右上のUser settings → Personal access tokens → New Token。
   - Name: 任意(例: vsce) / Organization: **All accessible organizations**
   - Scopes: 「Show all scopes」→ **Marketplace → Manage** にチェック。
   - 発行されたトークン(PAT)をコピーして手元に控える(一度しか表示されない)。

## 手順4 🧑: Macから公開する(5分)

```sh
git clone https://github.com/takeyosui15/koushi
cd koushi
npx @vscode/vsce login takeyosui15    # 聞かれたらPATを貼る
npx @vscode/vsce publish
```

- 数分でMarketplaceに載る(反映まで少し時間がかかることがある)。
  掲載ページ: https://marketplace.visualstudio.com/items?itemName=takeyosui15.koushi-preview
- 以後の更新: リポジトリを更新→`package.json`のversionを上げて→`npx @vscode/vsce publish`。
  (versionを上げ忘れると公開が弾かれる。上げ方はClaudeに任せてOK)

## 手順5 🧑: 公開後の確認

1. VSCodeの拡張ビューで「Koushi」を検索して出てくること(アイコン=格子)。
2. Marketplaceからインストールし直して、READMEのサンプルのプレビューが従来どおり描けること
   (以後はvsixファイルでの手渡しは不要になり、更新もVSCodeが自動で拾う)。

### 反映待ちの目安とトラブルシュート(第72ラウンド追記)

- 新規拡張は公開後にMarketplace側の検証(スキャン等)が走るため、**検索や掲載ページに出るまで
  数分〜数時間**かかるのが普通(初回は特に)。まずは待つ。
- 進み具合は https://marketplace.visualstudio.com/manage で確認できる: 自分の拡張の行に
  緑のチェック(Verified)が付けば検証完了。エラーが出ていればその文言をClaudeへ。
- 掲載URL(公開後に有効): https://marketplace.visualstudio.com/items?itemName=takeyosui15.koushi-preview
- 24時間待っても出ない場合: `vsce publish`実行時の端末出力に「DONE Published」が出ていたかを確認。
  出ていなければ手順4をやり直し(PATの期限切れ・scope不足が典型)。

### 鍵(GitHub Appのアクセス)の運用 — 既定は施錠(第72ラウンド確定)

- 依頼者の決定: `koushi`へのApp アクセスは**普段は外しておき、必要な時だけ開ける**。
- リリース時の流れ: ①宙の辻側で更新+staging再構成(🤖) ②依頼者がRepository accessに
  `koushi`を追加(🧑・1クリック) ③Claudeがpush(🤖) ④施錠(🧑・1クリック)
  ⑤依頼者がMacで`git pull`→`npx @vscode/vsce publish`(🧑)。
- 施錠はClaudeのAppに対してだけで、**依頼者自身のclone/pull/push/publishには無関係**
  (依頼者は自分のGitHub認証でいつでも操作できる)。

### Macのクローン置き場(第72ラウンド追記)

- リリース用クローンは**ローカルディスクでよい**(むしろ正解)。iCloud Drive内のgitリポジトリは
  .git配下の数千ファイルを同期しようとして衝突・破損しやすい(mac-install-decision.mdで
  調査済みの知見)。クローンは使い捨てで、必要な時に`git clone`し直せばよい。

## 運用メモ(Claude向け)

- 正(開発の場)は宙の辻リポジトリの `ClaudeMederuU/tools/`(レンダラ)+`vscode-koushi/`(拡張)。
  リリース時に `koushi-repo-staging/` を組み立て直してkoushiリポジトリへ同期する。
- staging側のextension.test.jsはドリフト検査を「親が居る時だけ」に条件化してある
  (単独リポジトリではkoushi.js自身が正)。
- 公開物にMederuU・宙の辻の文脈は含めない(依頼者方針: Koushi単体で理解できる章立て)。
