# Koushi: Markdown Spanning Table — VSCode拡張

Write tables with merged cells (colspan/rowspan) as Markdown-style bullet lists.

Markdownの ```` ```koushi ```` コードフェンスを、VSCodeの標準Markdownプレビュー
(Cmd+Shift+V)で**Koushi(格子)記法の表**として描画する拡張です。
Markdown標準の表では書けない**結合セル**(xc/xr)・罫線の種類(bd/bs/ba/bo)・入れ子表・
input要素を、箇条書きの書き味のまま書けます。
マトリックスCLや状態遷移表を「漏れなく・ダブりなく」目で確認するための道具
(第66ラウンド・依頼者GO)。

## 記法のポイント(詳細はデッサン01が正)

- 3層の箇条書き `t:`(表)→`r:`(行)→`c:`(セル)+終端の`.`。属性は`:`区切りで順不同。
- **番号はただの目印**: `c:1.`や`r:2.`の数字は描画時に読み飛ばされます。人間が列位置を
  見失わないためのラベルで、振り直しても出力は変わりません(ゴールデンテストで保証)。
- 結合: `xc2`=横に2列結合・`xr3`=縦に3行結合。見出し: `h`(行に付ければ行全体)。
- 寄せ: `l/c/r`(水平)・`t/m/b`(垂直)。
- 罫線: `bd`=二重・`bs`=太実線・`ba`=破線・`bo`=点線。**行に付ければその行の上辺・
  セルに付ければそのセルの左辺**。

## input要素トークン一覧(22種)

セルの子の箇条書きとして `- chb:on.` のように書きます。値は`"`括り(エスケープは`\"`)。

| トークン | type | `"値"`の意味 | トークン | type | `"値"`の意味 |
|---|---|---|---|---|---|
| `btn` | button | value | `pwd` | password | value |
| `chb` | checkbox | `on`でチェック | `rad` | radio | `on`でチェック |
| `clr` | color | value(#rrggbb) | `rng` | range | value |
| `dat` | date | value | `rst` | reset | value |
| `dtl` | datetime-local | value | `sch` | search | value |
| `eml` | email | placeholder | `smt` | submit | value |
| `fil` | file | `multiple`で複数可 | `tel` | tel | placeholder |
| `hdn` | hidden | value | `txt` | text | placeholder |
| `img` | image | src | `tim` | time | value |
| `mnt` | month | value | `url` | url | placeholder |
| `nmb` | number | value | `wek` | week | value |

注意: プレビュー上のチェック等の操作は**ファイルへ書き戻されません**(片方向レンダラ)。

## インストール(Mac・どちらか一方でOK)

### 方法A: vsixファイルで入れる(おすすめ)

1. このフォルダの `koushi-preview-0.3.2.vsix` を使います(旧版が入っていても上書きされます)。
2. VSCodeの拡張ビュー(⇧⌘X)右上の「…」→「Install from VSIX...」でファイルを選ぶ。
   (またはターミナルで `code --install-extension <このフォルダ>/koushi-preview-0.3.2.vsix`)
3. VSCodeを再読み込み(⇧⌘P→「Reload Window」)。

### 方法B: フォルダを拡張ディレクトリへコピーする(vsixが使えない時の予備)

```sh
cp -R ClaudeMederuU/tools/vscode-koushi ~/.vscode/extensions/soranotsuji.koushi-preview-0.3.2
```

その後、VSCodeを再読み込み。アンインストールはこのフォルダを削除するだけです。

## 動作確認

同じフォルダの `sample.md` を開いてプレビュー(⇧⌘V)。
3つの表(マトリックスCL・状態遷移表・チェックリスト)が罫線つきで描かれ、
最後のjsフェンスは普通のハイライトのままなら成功です。

## 中身と保守

| ファイル | 役割 |
|---|---|
| `extension.js` | markdown-itプラグイン本体(```koushiフェンスだけをkoushiToHtmlで描画・他は委譲) |
| `koushi.js` | レンダラの同梱コピー。**正は `ClaudeMederuU/tools/koushi.js`**。ズレは`extension.test.js`のドリフト検査が検知(同期は`cp`一発) |
| `koushi-preview.css` | プレビュー用の罫線と寄せ+罫線属性(bd=二重/bs=太実線/ba=破線/bo=点線。行=上辺・セル=左辺。第67ラウンド) |
| `syntaxes/` | 編集画面のハイライト(第67ラウンド): Markdownの```koushiフェンスへ注入する文法+Koushiトークン文法。`-`はMarkdownのリストと同じ色・t:/r:/c:はタグ色・属性は属性色・"値"は文字列色 |
| `sample.md` | 動作確認サンプル(結合セル+罫線属性の状態遷移表つき) |
| `extension.test.js` | Node単体で回る検証(フェンス差し込み・委譲・エラー閉じ込め・ドリフト・package構造・文法JSON)。回帰の道具テストに含める |

- 記法の正はデッサン `ClaudeMederuU/dessin/01-koushi-dessin.md`。
- レンダラ本体を更新したら: `cp ClaudeMederuU/tools/koushi.js ClaudeMederuU/tools/vscode-koushi/koushi.js`
  → テスト → vsixを作り直してVSCodeへ入れ直す。
- vsixの作り直し(ネットワークのある環境): このフォルダで
  `npx @vscode/vsce package --allow-missing-repository` を実行。

## Marketplaceへのリリース(準備メモ・第68ラウンド)

この拡張をVisual Studio Marketplaceで公開する時の手順(公開作業は依頼者のMacで):

1. **publisher登録(1回だけ)**: Microsoftアカウントで https://marketplace.visualstudio.com/manage
   を開き、publisher(公開者ID)を作成する。
2. **PAT(トークン)作成**: https://dev.azure.com → User settings → Personal access tokens →
   Scopes「Marketplace: Manage」で作成。
3. package.jsonのpublisherは実ID(`takeyosui15`)設定済み。
4. このフォルダで `npx @vscode/vsce login <publisherID>`(PATを貼る)→ `npx @vscode/vsce publish`。
5. 以後の更新は versionを上げて `npx @vscode/vsce publish`。

同梱済みの公開要件: LICENSE(MIT)・icon.png(128×128)・README(このファイルが
Marketplaceの説明ページになる)・.vscodeignore(vsixにテスト等を入れない)。
リポジトリ欄(repository)は、公開用リポジトリを作った時にpackage.jsonへ追記する。
