# ClaudeMederuU/ — Claudeのナレッジ置き場(MederuUのプロジェクト側)

このフォルダは、Claude(AI)の学び・道具・記録を1箇所に集約する、
`MederuU`(ナレッジ引き継ぎの器)のプロジェクト側の置き場です(第43ラウンドで移設)。
一般的なプロジェクト構成とバッティングせず、将来のMederuU本体リポジトリからの
一方向syncの吸い上げ対象が「このフォルダだけ」に一意化されます。

## 中身

- dessin/
  * MederuU自体のデッサン(器00・Koushi01・PAD02)
- knowledge/
  * 開発ナレッジ(バグの教訓・リファクタリング資料・デッサン駆動開発など)
- reviews/
  * コミット前レビューの記録(ラウンド毎の実施内容と学び)
- tools/
  * 自作ツールの道具箱(台帳=tools/README.md。生まれた経緯つき)

## このフォルダに無いもの

- `.claude/skills/` … スキルはClaude Codeの読み込み規約上この場所が必須のため、
  リポジトリ内で二重管理せず`.claude/skills/`だけに置く(MederuU本体を作る時に
  sync.jsが`.claude/skills/`から直接吸い上げる)。
- `docs/dessin/` … 宙の辻というプロジェクト自体の仕様書(プロジェクトの成果物)。
  ここに置くのはプロジェクトを跨いで持ち歩くナレッジ。

## 索引

将来、index-gen(ツール第2号)が各ファイルのヘッダから目次を自動生成する予定。
それまでは各サブフォルダのREADME(reviews/tools)と dessin/00-dessin.md が入り口。
