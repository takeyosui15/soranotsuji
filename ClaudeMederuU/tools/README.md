# ClaudeMederuU/tools/ — 自作ツール置き場(Claudeさんの道具箱)

「自分が使うツールは、自分で作る」— 開発中に必要になって自作した、**プロジェクトをまたいで
再利用できる道具**をここに保管します(第39ラウンド新設。将来は`MederuU`へ引き継ぐ想定)。

## 道具の台帳

| ツール | 置き場所 | 用途 | 再利用方法 |
|---|---|---|---|
| 保存キー整合性リンター | `tests/verify123.js` | 「保存される(save)のに復元されない(load)」「復元コードだけあって保存されない」という複数箇所の暗黙対応のズレを静的検査する。宙の辻の花火モードのバグ(第36ラウンド)の再発防止から生まれた | `node tests/verify123.js [対象JSファイル]` — 対象を引数で差し替え可能。関数名(buildStateToSave/loadAppState/normalizeAppState)は他プロジェクトでは冒頭の定数を書き換える |
| 中央寄せ画素チェッカー | `ClaudeMederuU/tools/center-check.js` | ボタン内アイコン等の「見た目の中央ズレ」を画素で実測する(子要素の矩形中心+スクリーンショットのインク重心の両方)。アイコン中心ズレのバグ(第33ラウンド)の画素実測を汎用化した | `node ClaudeMederuU/tools/center-check.js <URL> <CSSセレクタ...>` (要playwright-core+Chromium)。verifyからは`require('../ClaudeMederuU/tools/center-check.js')`で関数利用 |
| ローカルglyphs生成 | `tests/build-glyphs.js` | symbolレイヤ用のSDFフォントPBF(ASCII)を外部配信に頼らず自前生成する(オフライン方針との両立。第36ラウンド) | `node tests/build-glyphs.js` → `fonts/<名前>/0-255.pbf`。フォント名/文字範囲はスクリプト内の定数 |
| ハーネス構築・同期 | `tests/harness/sync-apptest.py` | ローカル検証用apptest(アプリ一式+CDN→vendor書き換え)をゼロから構築/再同期する。ハーネス構築の知識がセッション初期化で消える不便(第41ラウンド)から昇格。ヘッダはman風書式(NAME/SYNOPSIS/…/HISTORY)の適用第1号 | `python3 tests/harness/sync-apptest.py <apptestディレクトリ>`。手順全体はスキル`.claude/skills/kaiki/`を参照 |
| 回帰の回し方スキル | `.claude/skills/kaiki/SKILL.md` | 次のセッションのClaude宛の引き継ぎ書(ハーネス構築→サーバ→回帰実行→つまずきの記憶)。「Claude自身が次セッション宛にスキルを書けるか」(第41ラウンド)の実証第1号 | 新しいセッションで自動的に読み込まれる(Skillツールから`kaiki`で呼び出し)。他プロジェクトへはMederuUのskills/経由で配布想定 |
| Koushiレンダラ | `ClaudeMederuU/tools/koushi.js` | Koushi(格子)記法→HTML片方向レンダラ(結合セル・入れ子・input22種・class出力のみ)。デッサン01のレンダラ計画の実装第1版(第45ラウンド・依頼者GO)。**MederuU本体`tools/`への入居予定者第1号** | `require('./koushi.js')`で`koushiToHtml`/`renderMarkdownKoushi`。CLI: `node ClaudeMederuU/tools/koushi.js <file.md>`。検証: `node ClaudeMederuU/tools/koushi.test.js`(ゴールデン方式13チェック。標本更新は`--update`+目視確認) |
| Koushiプレビュー拡張 | `ClaudeMederuU/tools/vscode-koushi/` | VSCodeの標準MarkdownプレビューでKoushi記法(```koushiフェンス)を表として描くmarkdown-itプラグイン拡張+編集画面のトークンハイライト(TextMate文法注入。第67)。第68でMarketplace公開準備・第69でMIT化+publisher=takeyosui15+アイコンを依頼者デザイン(白地黒線の風車型結合格子)へ。レンダラはkoushi.jsの同梱コピー(正はtools/koushi.js・ドリフトはテストが検知) | インストール: `koushi-preview-0.3.1.vsix`をVSCodeへ(手順は同フォルダREADME)。公開はdocs/operation/koushi-repo-guide.mdの5段手順。検証: `node ClaudeMederuU/tools/vscode-koushi/extension.test.js`(13チェック)。レンダラ更新時: cpで同期→テスト→`npx @vscode/vsce package`でvsix再生成 |
| koushi公開リポジトリの一式(staging) | `ClaudeMederuU/tools/koushi-repo-staging/` | `takeyosui15/koushi`(公開リポジトリ)へ送る中身の完成品(第69)。英語章→日本語章の独立README(MederuU・宙の辻の文脈なし)・MIT LICENSE・拡張本体+レンダラ+文法+中立サンプル+テスト(ドリフト検査は親が居る時だけの条件化)。リポジトリ作成後にClaudeがpushする | 同期の正は宙の辻側。リリース時にvscode-koushi/とtools/から組み立て直す(手順はkoushi-repo-guide.mdの運用メモ)。検証: staging内でkoushi.test.js(14)+extension.test.js(13) |
| sync(MederuU吸い上げ) | `ClaudeMederuU/mederuu-repo-staging/sync.js`(正)→MederuUルートへ配布済み | プロジェクトのClaudeMederuU/+.claude/skills/をMederuUのprojects/<名前>/へ一方向ミラーする(秘密検査つき・1件でも当たればスキップ+終了コード1)。デッサン00の手順5(第80ラウンド) | MederuUのクローン内で`node sync.js <プロジェクトパス> [--dry-run]`。検証: `node sync.js --self-test`(8チェック)。運用は開錠→sync→index-gen→commit+push→施錠(docs/operation/mederuu-repo-guide.md) |
| index-gen(腐らない目次) | `ClaudeMederuU/mederuu-repo-staging/index-gen.js`(正)→MederuUルートへ配布済み | 各フォルダにindex.md(目次)を自動生成する。一言説明はJS=JSDocタグ(@name/@synopsis)・PY=docstring見出し行・MD=フロントマター→見出しの3パーサで拾う(手書きの目次は腐る)。デッサン00の手順6(第92ラウンドで候補から昇格) | MederuUのクローン内で`node index-gen.js [<ルート>] [--dry-run]`(syncの後に実行=ミラーの削除と整合)。検証: `node index-gen.js --self-test`(9チェック) |
| anchor(構造指紋) | `ClaudeMederuU/tools/anchor.js` | JSを波括弧の木として読み、各部分木の構造指紋(正規化v1+sha256)を発行・検証・重複検出する。第39ラウンドのパーマリンク案+デッサン03から。第45ラウンドで候補から昇格(③の実装第1歩)。**同一指紋の列挙=重複コード検出でリファクタリングBの道具と一石二鳥**(初収穫: script.jsで60文字以上の重複92グループ) | `node ClaudeMederuU/tools/anchor.js print\|dup\|verify <file.js> [--min-size N \| 指紋...]`。検証: `node ClaudeMederuU/tools/anchor.test.js`(性質テスト14チェック+実物スモーク)。PAD記法との連携(指紋の書き込み・ref:)は指紋書式の確定後(dessin/02第45節) |

## 候補(まだ作っていない道具。作る時はこの台帳へ昇格する)

| 候補 | 用途 | 生まれた経緯 |
|---|---|---|
| coverage-report | PlaywrightのCoverage APIで、回帰(verify群)実行中のscript.jsの行/関数カバレッジを実測する。クローズ前の品質確認用 | 第43ラウンドの依頼者のカバレッジ質問(C0/C1/MC/DC)から |
| css-why | ある要素のあるプロパティに、どの規則がカスケード順で効いているかを列挙する(人間のMDNホバーに当たるClaudeの目) | 第40ラウンドのレイヤーリスト縦4行のカスケード衝突調査から(手書き版はChromiumのネストCSS仕様で一度壊れた) |
| (index-genは第92ラウンドで台帳へ昇格した) | | |

## 運用メモ

- ここに置くのは「**プロジェクト成果物ではない**が、開発の道具として今後も使うもの」。
  (宙の辻専用のverifyスクリプトは従来どおり`tests/`。台帳からリンクだけする)
- 新しい道具を作ったら、この台帳に1行追加し、生まれた経緯(どのバグ/どの不便から)を書く。
  道具は経緯とセットで残すと、次のプロジェクトで「いつ使うか」が思い出せる。
