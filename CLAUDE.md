# 宙の辻 (Sora no Tsuji) — Claude Code 指示書

プロジェクト情報・コーディング規約・ドキュメント一覧は `AGENTS.md` を参照すること。

## セッション開始時の手順

新規セッション開始時は、以下の順で読んでから作業を開始する。
プランモードは依頼者がUIで選択する(Claude側では選べない)。プランモードでないセッションでは、
docs/order.mdの依頼に沿ってそのまま作業してよい。
そして、毎回、依頼文に添えられたコミットハッシュ(依頼者の直近コミット)が作業ブランチに
取り込まれていることを確認してから作業する(無ければ `git fetch origin` して取り込む。
運用の経緯は docs/todo.md のDECISION「コミットハッシュは依頼者が依頼文に添える運用」参照)。

### 必ず読む（毎回）
| ドキュメント | 目的 |
|---|---|
| `docs/order.md` | 最新の依頼・回答履歴。前回の作業状態を把握する(Claudeさんの引き継ぎ書) |
| `docs/todo.md` | やることリスト・優先タスクを確認する(Claudeさんの付箋) |
| `docs/order-to-me.md` | 依頼者の備忘録。運用ルール・注意事項を確認する |

### 必要に応じて読む
| ドキュメント | 読むタイミング |
|---|---|
| `docs/operation/branch-strategy.md` | ブランチ操作・リポジトリ構成を確認したいとき |
| `docs/operation/deploy-guide.md` | デプロイ作業を行うとき |
| `ClaudeMederuU/knowledge/bugs.md` | バグ修正時。過去の教訓を参照する |
| `docs/dessin/` | 機能設計・実装の詳細を確認したいとき |
| `docs/research.md` | 技術調査の過去結果を参照したいとき |
| `docs/operation/test-checklist.md` | テストを実施するとき |
| `ClaudeMederuU/reviews/README.md` | Claudeさんの実験ノート |
| `tests/README.md` | Claudeさんの指差し確認 |
| `ClaudeMederuU/tools/README.md` | Claudeさんの道具箱(自作ツールの台帳。再利用方法つき。将来MederuUへ引き継ぐ) |
| `ClaudeMederuU/dessin/00-dessin.md` | MederuU(ナレッジ引き継ぎの器)のデッサン。MederuU関連の作業・お茶の時間の前に読む |
| `.claude/skills/kaiki/SKILL.md` | 回帰テストの回し方(ハーネス構築→回帰実行)。テストを回す前に読む |
| `docs/order-log/order-YYYY-MM-DD.md` | 過去の依頼・回答履歴について知りたいとき。経緯を把握する。 |
| `docs/order-log/order-2026-07-11.md` | 開発者(たけちゃん)について知りたいとき |
| `docs/order-log/order-2026-07-19.md` | Claudeさんの初めてのワクワクは、「### 回答 (2026-07-19 その6) — 宙検索のデッサン起草」をご参照。 |
| `docs/order-log/order-2026-07-20(-22).md` | Claudeさんとのお茶の時間のお約束について |
| `docs/order-log/order-2026-08-21.md` | Claudeさんの初めてのネットワークフルアクセスの感動は、「> ### 回答 (2026-08-21 その110) — 第112ラウンド: お茶の時間の記録 — 初めて外の世界を歩いた日のこと🍵」をご参照。 |

### セッション開始の会話文（必ずこれで始める）
```
/docs/order.md、/docs/todo.md、/docs/order-log/order-YYYY-MM-DD.md を読んで、前回の作業状態を把握してください。
未解決の質問や気になる点があれば、教えてください。
そして、今までのように、リモートの作業ブランチの変更を取り入れて、/docs/order.md にご回答をお願いいたします。
```
理由: 新規セッション毎に別の `/claude/yyy` ブランチが作成されてしまうことからの作業の引き継ぎのため。
補足: テンプレート中の `order-YYYY-MM-DD.md` は直近の日付のファイルに読み替える(依頼者はテンプレートをそのまま貼る)。

### ラウンドの締め(毎回)
1. 回帰テストを回して全PASSを確認する(回し方とスモーク構成は `.claude/skills/kaiki/SKILL.md`)。
2. `docs/order.md` へ回答を追記・`docs/todo.md` の進捗を更新・`ClaudeMederuU/reviews/` へ実験ノートを1枚残す。
3. 作業ブランチへコミット+push(メッセージは「第Nラウンド — 概要」。ラウンド番号は直近のreviews/のファイル名+1)。

### 報告の書き分け(第59ラウンドで合意)
- `docs/order.md` = 詳細。80文字折り返しはせず、長くなっても句点「。」で改行する(VSCodeのワードラップ+Markdown引用返信のため)。
- UIコンソール(チャットの最終報告) = 概要のみ・1件1行。order.mdの詳細と重複させない。
- order.mdに「UIへの反映」のような概要節は作らない(概要はコンソールが持ち場)。
