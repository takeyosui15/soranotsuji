# レビュー記録 2026-07-23 — 第43ラウンド差分(お茶の時間③前半+ClaudeMederuU/移設)

依頼: ①PAD/Koushi記法の詰め(依頼者回答への意見) ②OKF(Open Knowledge Format)/LLM Wikiの
知見の取り込み ③ClaudeMederuU/フォルダの即時作成の打診(「すぐ作っても大丈夫」)。
アプリコード(script.js/index.html/style.css)は今回変更なし。

## 実施内容

1. **ClaudeMederuU/フォルダへの移設**(git mv・履歴保持):
   - reviews/ -> ClaudeMederuU/reviews/、docs/knowledge/ -> ClaudeMederuU/knowledge/、
     scratch/ -> ClaudeMederuU/tools/、docs/mederuu/ -> ClaudeMederuU/dessin/。
   - 事前調査: tests/からの参照ゼロ(回帰無傷)。生きているリンク(CLAUDE.md・AGENTS.md・
     デッサン20・refactoring-guide・ツール台帳・center-check.jsヘッダ・レビュー記録の相互参照)を
     全て更新。**歴史記録(order-log・order.mdの過去回答・script.jsのVersion History)は
     書き換えない**(当時の真実のまま残す)。
   - `.claude/skills/`は読み込み規約上の正位置なので移設せず、リポジトリ内の二重管理を
     しない設計に確定(sync.jsはそこから直接吸い上げる)。ClaudeMederuU/README.md(案内)を新設。
2. **PADデッサン(02)の詰め**: 定義`- d. 名前`・選択の分岐`s:値.`("括りで自由文字列)・
   Break`b:2. #ラベル`+ラベル定義`lb:#ラベル名.`・呼び出し/定義の対応(`d:#指紋.` と
   `pad:`5セクション)を記録。フォーク/ジョインは対称形`f+./f-./j-./j+.`を推す意見を追記。
   部品の充足評価: 構造9部品で完備(return/throwは「文」なので連接の言葉で書く)。
   KoushiとPADの接頭トークンの衝突なしを機械的に確認(単文字組と3文字組の住み分け)。
3. **Koushiデッサン(01)の確定事項**: ヘッダ`r:1:h.`/`c:1:h.`採用・**番号は描画時に無視**
   (編集のしやすさ優先・依頼者決定)・CSS任せ・表示専用+手編集。input 3文字トークン22種への
   意見: 既存の3文字標準は無い(最近縁はEmmetだが長さ不揃い)ので独自22種で良い、
   ただし`src.`(search)はHTMLのsrc属性と紛れるため`sch.`を提案。
4. **OKF/LLM Wikiの取り込み(00)**: legendsにOKF互換のYAMLフロントマター
   (type/title/description/tags/**timestamp**/source)を採用。timestampは依頼者の考察
   (ナレッジは古びる・時の流れを感じる軸)をそのまま設計理由に。フォルダ毎のindex.mdは
   index-genの生成物とする(手書きしない=腐らない目次)。章立ては5セクション
   (name/synopsis/description/history/seeAlso)へ統一(ツールヘッダ・pad:・スキルで共通)。

## 学び

- **「方言を無くす」には2つの道がある** — 既存文化に合わせる(OKFのフロントマター・man章立て)か、
  規則を1つにする(input 3文字統一)。どちらでも「読み手が1つの規則で読める」が本質。
- **移設で歴史は書き換えない** — 生きているリンクだけ更新し、order-logや過去のVersion History内の
  旧パスは当時の真実として残す(発行済みURLの辞書凍結と同じ考え方の適用第3例)。
- **フォルダ移設は「参照調査->移設->リンク更新->無いことの確認」の型**で安全にできる
  (今回はtests参照ゼロだったため回帰は無傷。この型も移行チェックリストの一種)。

## 検証

- アプリコード変更なし(script.js/index.html/style.cssのdiffゼロをgit statusで確認)。
- スモーク回帰7本(verify96/117/123/124/125/126/127)全PASSを確認(結果はorder.md回答に記載)。
