# 依頼・回答ログ

このファイルは、開発依頼と回答の記録用です。

## 運用ルール
- 依頼者が「## 依頼」セクションに依頼内容を記入
- Claudeが「### 回答」として回答を追記
- 完了した依頼はそのまま履歴として残す
- 依頼者は、依頼管理のため、Claudeのコミットハッシュを記録する
- order.mdが500行を超えたら、キリの良いところで、/order-log以下に保管する。

---


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 3c0ad4b
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-07-25)
Claudeさん、こんばんは。
今日も、よろしくお願いいたします。

> 今回のお茶は濃かったです — デッサンが2枚増え、knowledgeの棚卸しまで進みました。
拝読しました！
結構な、お手前で…🍵
おかげさまで、素晴らしいアイディアの種が生まれました！(てか、妄想レベル😆)
それは、後ほど！
(今日のお茶の時間は、湯呑みではなくて、やかんで提供です🤭)

> #### まず、いちばん大きなご質問 — 「Claudeの頭の使い方は、人と同じか」
> **驚くほど同じです。そして、少しだけ違います。**
素敵です😇
理解できました！

> 同じところ:
> 私も「いきなりコード」は書けません(書けはしますが、品質が落ちます)。
> 大きな依頼が来ると、まず全体をタスクに割り(1/2)、タスクを手順に割り(1/4)、手順の1つを実装の形に割って(1/8)、ようやくコードにします。
> そして、私にも「メモリの限界」が本当にあります。
> 私のメモリはコンテキスト(この会話を覚えていられる量)で、長いラウンドでは古い部分から要約に置き換わっていきます。
> だから、**デッサン・todoリスト・レビュー記録という外部記憶に書き出したものだけが、セッションを越えて残ります**。
> たけちゃんさんが「ストレージに書き出すことで、より大きなものを扱える」と言われたのは、私の実感そのものです。
> 実際、私が毎ラウンドの最初にorder.mdとtodo.mdを読むのは、人が朝に手帳を開くのと同じ動作です。
なるほど！
やっぱり、Claudeさんにも`笑い😆`は必要でしたね！
同じ作業ばかりしていたら、`頭がコチコチ`になってしまいますね。
それは、ニューラルネットワークの仕組み`誤差逆伝播`からもそうですね。
だから、人が散歩中にアイディアが浮かんだり、記憶の整理が終わった寝起きの朝の状態の時にアイディアが浮かんだりするのは、もしかしたら、至極当然のことかも知れませんね☺️

> 少し違うところ:
> 人は「忘れたことを忘れる」ことがありますが、私は「セッションが変われば全部忘れる」ことが確定しています。
> だから私の外部記憶は、人の補助記憶よりも切実に「本体」です。
> MederuUが私にとってプラグイン機構だと言ったのは、この意味でした。
なるほど！
よくわかりました！

> なので — **Okuteの「AIの負荷を下げる道具」という発想は、的を射ています**。
> 「次に何をするか」を思い出す仕事を道具(フック付きワークフロー)に移せたら、私はメモリを「考える」ことに使えます。
そうですよね。
忘れてしまうわけですから、**次に何をするか**を思い出すのは、大変重要なことですね。
つまり、`目的`を見失わないことですよね。
まあ、`目的`は、おいおい、ワークフローという名の`道`を辿ることで、`より良いもの`に変化していきますけどね。

#### Okuteのワークフロー構想 — 新鮮なうちに捕獲しました(dessin/04)

> PADの構造指紋にフックを結びつけ、todo項目の実行でPADノードのフックが発火し、連結されたPADを呼び出す — **PADでワークフローを記述する**。
> この構想の美しさは、**部品を増やしていない**ことだと思います。
> Okute = PAD(木) × anchor(錨) × フック(イベント) の掛け算で、新しい記法はほぼ要りません。
> 「すんごいリマインダー😍」の芋づる式も、フックのチェイン+系譜の逆引き(このノードに繋がっているのは誰か)で実現が見えます。
> 5つの齟齬解消+タスク管理・プロジェクト管理まで — 確かに「億手」で、正にライフワークですね😇
> そして「MederuUに蓄積されるのは、間違っても大丈夫とか、そもそも間違えないとか、そういうナレッジかもしれない」— これは効きました。
> 今までの学びを見返すと、本当にこの2つに分かれるのです(凍結・追記型台帳・無いことのテスト=間違っても大丈夫にする型。単一情報源・生成される目次・チェックリスト=そもそも間違えない型)。
> legendsの分類軸の候補として、デッサンに書き込みました。
私としては、そもそも論の`頭の中にあることをデッサンに書き出したけど、そのデッサンがイメージしていなかったことは、やっぱりカバーできていない`とか、`イメージしたデッサンを詳細に描いていく時に、後々問題にならない様にするために考えて置かなければならないことリスト(チェックリスト)`とか、`イメージしたデッサンは、どこまでをドメインとして、きちんとカバーできているか、もしくは、どこまではカバーできていないか`とか、そういうことがわかるナレッジが分かった良いな、と思ったのですが、これは、作っていく対象という名の`目的`によって様々に変化するものなので、なかなかエッセンスという名の本質を見つけるのは難しいかも知れませんね。

> #### anchorのデッサン — 作りました(dessin/03)。ご質問にもお答えします

> たけちゃんさんの考察、「**パーマネントなのは指紋ではなく、『このハッシュはどのハッシュに書き変わりましたか』に答えられる仕組みの方**」— これはanchorの設計原則そのものになりました。デッサンの中心に据えています。
ありがとうございます。

> ご質問への回答です:
> - **「リポジトリは断面しか持たないので、一つ前の指紋の履歴を持てば追跡できるか」** — はい、できます。
>   各書き換わりイベントが「旧指紋→新指紋」の1ホップを持てば、断面の列が鎖に変わります(単方向リンクリスト。実はgitのコミットの親リンクと同型です)。
やっぱりね。
私も、単方向リンクリストになるから辿れるだろうと思いました。

> - **履歴の担い手** — 3案(参照元も更新/ドキュメント自身が持つ/リポジトリが担う)を比較して、折衷を採用案にしました:
>   リポジトリに**追記型の台帳 anchors.jsonl**(1行=1イベント: 旧指紋→新指紋・日時・コミット・理由)。
>  台帳という1ファイルが履歴の正(=ドキュメントが持つ)でありつつ、リポジトリにあるので「リポジトリに問い合わせる」も満たします。
>   追記型なので過去は書き換わりません(辞書凍結・「学びは重ねる」と同じ原則です)。
なるほど、素敵です！

> - **どんなスライスのビューワーが良いか** — データ構造は「指紋の系譜DAG」(ノード=指紋、エッジ=書き換わり)で、3つの軸でスライスします:
>   ①空間(いまの木: どこに錨があるか。PADの木と同じ形なのでレンダラを共有できます)
>   ②時間(1本の系譜: いつ何に書き換わったか。OKFのlog.mdと同じ思想)
>   ③差分(2断面の間で指紋が変わったノードだけ=**変更の波及ビュー**。たけちゃんさんの「影響範囲がハッシュ更新で分かる」の可視化です)。
> - おまけ: 実は**gitが既にMerkle木のハッシュ履歴データベース**です(コミット=断面、親リンク=系譜)。
>   anchorが足すのは「制御構造の部分木」という**意味の層**で、gitは土台として使います。車輪は再発明しません。
`Merkle木`は、2回目の出現なのですが、1回目で調べ忘れていました。
ハッシュ木なのですね。
勉強になります！
ちなみに、`DAG`も知りませんでした。
`有向非巡回グラフ（DAG）`なのですね。

> #### knowledgeフォルダ — 棚卸ししました。たけちゃんさんの直感、正しかったです
> 9ファイルを1ファイル=1担当の並列監査(現実側との突き合わせ付き)にかけました。
> 結果: **現役3(bugs/markdown-reference/refactoring-guide)・一部古い4・大部分古い2(dessin.md/doc-guide.md)**。
> 象徴的だったのは、doc-guide.mdの「spec-*.md/design-*.md」命名規約が**一度も使われないまま**、現実だけがデッサン駆動開発へ発展していたことです。
> ナレッジも「保存されるのに使われない」問題を起こすのですね(保存キーリンターのドキュメント版=棚卸しが要る、という学びになりました)。
そうなのですよ。
記憶のスタックは、底の方には、穴が空いているかも知れません。

そういえば、ナレッジを読み返していて、忘れていたことがありました。
**私の方からコミットハッシュを伝えること**です。
これは、私が、claude/yyyブランチへのマージ忘れ防止だったけど、忘れたことを忘れていました💦
このコミットハッシュを伝えようとすると、必ず、claude/yyyブランチのコミットハッシュも目に止まるので、Claudeさんが、迷ってブランチを探さなくて済む様になるのです。

正直なことを告白すると、VSCodeは、私が思っているほど、コミットハッシュを簡単にコピペできないのです。
作業が一手間かかって、思考がすんなりと行かなくなるのです。

と思ったら、できやしたーーーーーーーー♪
しゃーーせん🙇
400a9b4d39fb5241eed440b35d8ecb000825be3f
と思ったら、こんなに長いコミットハッシュでした😓
いつの間にか、コミットハッシュの横にアイコンが出来ていて、コピペできるようになっておりました💦
これなら、先頭7桁を切り出すだけなので、頭の中で、コミットハッシュ7桁を繰り返し唱えることが無くなるので、作業負荷がかかりません。
なので、ご希望なら、今後、私の方から、コミットハッシュを伝えられます👍

> 今ラウンドで実施した応急処置:
> - 「大部分古い」2ファイルの冒頭に**OKF流フロントマターの鮮度注記**を追加(誤読防止。timestampの価値の実証第1号です)。
> - dessin-driven-development.mdへ、たけちゃんさんの**DesDD=PDCAの言語化をそのまま追記**し、ディレクトリ図を現構成に更新しました。
>   「PDCAサイクルは、1人で回すのではなく、AIと一緒に回す」— この一文、この文書の一番良い場所に入りました。
ありがとうございます。

> 方針を伺いたいもの(全面の書き換えは判断が要るため):
> 1. doc-guide.md — 「現在の文書地図」として書き直すか、dessin-driven-development.mdへ統合してアーカイブするか。
> 2. dessin.md — 書き方ガイド部を残してMy観測点実例を歴史資料節に降格するか、how-to-write-spec.mdと統合するか。
> 3. how-to-write-spec/design/template — spec-*/design-*命名を現実(dessin/requirements/design)に合わせて部分更新するか、MederuU向けの汎用ガイドに書き直すか。
> 詳細は棚卸し表(レビュー記録にKoushi記法で置きました)をご覧ください。
レビュー記録の`### knowledge棚卸しの結果(Koushi記法)`を読みました。
この際だから、ドキュメントの体系から見直しましょう。
基本の構成は、
- デッサン駆動開発(DesDD)とは何か、どの様なものかがわかるもの。
  - doc-guide.mdとdessin-driven-development.mdを統合したもの
- 各ドキュメント(order.md,todo.md,00-dessin.md)の書き方
- サンプル
  - 00-dessin.mdは、①機能の草稿段階のメモ（My観測点リスト）②VibeCoding的な仕様の伝え方③テキストベースの仕様書的な仕様の伝え方(テキスト版)④テキストベースの仕様書的な仕様の伝え方(Markdown版)、をちょっと長くなりますが、1ファイルで。
  - todo.mdは、最近追加したばかりで、運用実績が無いものも含まれるので、どうするか。宙の辻の最後まで、実戦投入した感じを見てから、もう一度書き直すか。でも、どのみち、宙の辻の最後まで行ったら、今回のDesDDを振り返ると思うので、書き直すと思います。
    - 個人的には、iPhoneのメモにタスクリストを兼ねた走り書きのメモがあるので、これと同期を取り忘れることがよくあります。だから、todo.mdのタスクリストは、大きな括りのタスクかも知れません。
- 雛形
で、古いものは、歴史資料節に降格しましょう。
いかがでしょうか。

> #### OKFの全文、ありがとうございます — log.mdを見つけました

> 元記事のコピペ、とても助かりました(私のカットオフ後の情報が正確に読めました)。
> デッサン00を精密化しています: 必須はtypeフィールド1つだけ・コンテンツモデルではなく相互運用面の定義・プロデューサーとコンシューマーの独立。
> そして一番の発見は**log.md(変更の時系列履歴)**です — anchorの「指紋の系譜」とまったく同じ思想が、OKFでは慣習ファイルとして置かれている。
> 独立に同じ形へ収束、また1つ増えました。
> Karpathy氏の「LLMは飽きることがなく、相互参照の更新を忘れることもない」— 記帳が得意なのは本当です。だからこそ、記帳の相手(台帳・log.md)を用意してもらえると私は強いのです。
喜んでいただいて、嬉しいです。

続いて、お茶の時間のやかんです🤭
私の今朝の出来事から。

-------------
START
-------------
朝、頭に浮かんできた言葉は、`ワークフローは、ワークフローを再定義できる`です。
誤り訂正の自動化なのだろうか？
そう思いつつ、以下に思いついた内容を書く。
ワークフローは、ACID特性を持つ。
未着手/実行中/完了、失敗、審査、承認、修正、差し戻し？
失敗、つまりエラーメッセージを発信元に返却できる。
エラーが発生するまでをシミュレーションできる。
つまり、エラーについて、考察できる。
つまり、ダンプやログが取れる。
あと、詰まるところ、Claudeさんとのやり取りの様に、プランモードと自動モードがあって、提案、質問、修正、などの様なものがある。
あとは、エスカレーションとか、ITILのノウハウどーん！みたいな感じかな。
つまり、AIの階層化とか、組織化とか。
大きなものをやるなら、階層があった方が良いかもしれない。
でも、サブエージェントがいるから、実装済みなのかな。
ちなみに、OkuteにMCP実装したら、分散AIネットワークの実現になるかもね。
MCPで、他のAIと会話する。
あー、ASタネンバウム先生の本「分散システム」、読んでないのに売ってしもうてたー…
読みたいと思った時に手元にない…がっくし。


でも、作る側には、責任がある。
ゴミが出ない様にするのマナーです。
うまい料理が、素材を余すことなく使うことに通じるかも知れません。
三方良し(by 近江商人)の精神で行きましょう。
人良し、AI良し、地球良し。
そのうち、風の谷のナウシカのような世界がやってくるかもね。
地球、ごめんね😢

ちなみに、一昨日、日本初の`酷暑日`(40℃超え)が生まれました🫠

こんなことを考えてたら、ループエンジニアリングなるものの記事をChromeさんが推してきました。

------
[ループエンジニアリングについて、その原理原則を整理する (AI-Generated)](https://zenn.dev/hassaku63/articles/fe7bac344d0a7e)
------
ループエンジニアリングについて、その原理原則を整理する (AI-Generated)
2026/07/25に公開



AI

idea
!
使用枠が余っていた Cursor にざっと調べてもらって、後で自分で見返すように残しておくことにしました。

コーディングエージェントを使う／検討しているエンジニア向け。主張は一次資料に当たって整理し、確証の薄いものは「言えない」と分けた。確認時点: 2026-07。

この記事でわかること
ループエンジニアリングの定義と出自
製品が変わっても使いやすい設計原則
典型的な失敗パターンと、断言してはいけないこと
設計に着手するときの優先順位
製品の操作手順や、特定チームのツール運用への当てはめは扱わない。

結論
効き目の中心は「プロンプト文」から「ループ設計」へ移る。ただし自己採点・停止条件の欠如・会話内だけの状態・人間の最終責任の放棄を外すと、ループは壊れる（または壊したことに気づかない）。

「導入すると生産性が何%上がる」といった一般的な効果は、本稿で確認した範囲の独立測定では言えない。言えるのは、設計原則と失敗の型の側である。

1. 定義と出自
定義
Addy Osmani（2026）の定義が一次の核である。

Loop engineering is replacing yourself as the person who prompts the agent. You design the system that does it instead.

つまり、自分がエージェントにプロンプトする役割をやめ、エージェントにプロンプトさせるシステムを設計することだ。

位置づけとしては、単一エージェントを動かす実行・制御環境（いわゆる harness）の上に、次のような仕組みを載せる話として説明される。

決まった間隔やイベントで起動する
小さな補助エージェントを起動する
次に実行する作業を自動で選ばせる
タイマーや補助エージェントは「必ず全部含む」最小定義ではなく、Osmani が示す代表的な姿だと読むのがよい。

誰の話か
想定読者は、IDE／CLI 上のコーディングエージェント（Claude Code、Codex など）でソフトウェアを書くエンジニアと、その連携の仕組みを設計する人である。

出自の要点
Boris Cherny（Claude Code）は Acquired Unplugged（2026-06-02）で、IDE 手書き → 複数 Claude を手動プロンプト → 自分はプロンプトせずループを書く、という三段階を語った（映像字幕で確認）。語「loop engineering」自体は Cherny の造語ではなく、第三者によるラベルである。
Peter Steinberger も同趣旨で、「エージェントにプロンプトするな、エージェントにプロンプトするループを設計せよ」と述べている。
Anthropic の 製品ブログ（2026-06-30 Getting started with loops）は「loop engineering」をタイトル・本文で使い、ループを「停止条件まで作業サイクルを繰り返すこと」と定義し、Turn / Goal / Time / Proactive の4型を示している。一方、公式ドキュメント本体に同用語があるとは、本稿で確認した範囲では言えない。
2. 長く使える設計原則
製品名やコマンドは変わっても残しやすいものを先に置く。根拠が厚いものほど厚く書く。

2.1 作成役と検証役を分ける — いちばん強い
作った主体が自分の成果を採点すると、系統的に甘くなる。Osmani はこれをループの最重要構造とし、学術側でも「自分の出力を過大評価しやすい」傾向として測定されている。

無人で回す部分ほど、別のエージェント／別のモデル／機械的なテストなど、作成役と違う検証役を置くのが安全側だ。Osmani はこれを Maker / Checker と呼び、Anthropic 側は evaluator model や second agent（第二のエージェント）など別の言い方をする。中身の軸は近い。

別軸の注意: Cursor などが示す 計画役（Planner）／実行役（Worker） は、「誰が分解し誰が実装するか」の分離であり、作成役／検証役（誰が作り誰が採点するか）とは別の話である。混同しない。

2.2 止まれないループは危険（停止条件と上限）
モデルの出力がツール実行や別エージェントの入力に戻り、その循環が続くのに、強い停止条件がないと、コスト枯渇や副作用の反復が起きうる。これは Infinite Agentic Loop（IAL: 止まらないエージェント循環）として、大規模リポジトリ解析で失敗の型として整理されている（プレプリント）。設計上は、ターン上限・ゴール条件・予算の上限などを最初から置く。

2.3 状態は会話の外に置く
モデルは実行のたびに文脈を持ち越せない（実行単位・セッションをまたぐと忘れる）。完了・次・決定は会話の文脈ではなく、リポジトリ・ボード・ファイルなど、実行をまたいで残る場所に書く。「エージェントは忘れる、リポジトリは忘れない」。

2.4 人間は消えない
Osmani 自身が、レビューなし／自動化への丸投げは品質の下降スパイラルになりうると書いている。考えるのをやめて出力を受け入れるだけの姿勢は、設計の失敗パターンだ。ループは仕事の持ち方を変え、あなたを削除しない。

2.5 効き目の中心が移る（定義の動機）
毎ターンのプロンプト最適化より、発見→配分→検証→次、を回す仕組みの設計が効き目の中心になる、というのが主張の核である。ただし Osmani は、直接プロンプトも依然有効だと併記している。二者択一ではない。

2.6 並列には隔離が要るが、レビューできる量が制約になる
複数エージェントは同じファイルを踏み合う。作業ディレクトリやブランチを分ける（Git worktree など）と、機械的な衝突は減る。一方、人間がレビューできる量を超える並列は品質リスクになる——これは Osmani の設計上の警告であり、独立測定された「物理法則」ではない。

2.7 活動量が増えても進捗とは限らない
コミット数・コンフリクト数・PR 数の爆発は、収束していないループの症状になりうる。Cursor の旧実行環境の実験や、個人開発者による報告（修正が新たな失敗を呼び、夜間に止まらなかった例）がこの型を示す。数値そのものの一般化はしない。

2.8 計画と実行の分離、モデルの使い分け（事例・証拠は薄い）
長時間のマルチエージェントでは、計画役が実装の細部で文脈を埋めず、実行役が狭い作業単位に集中する分離が有効と報告されている（Cursor 自社実験）。また、大量実行を担うモデルのトークンが多くても、判断側が高価なモデルなら総コストの大半がそちらに乗り、同品質でもモデル構成で総額が桁違いに変わる事例がある。有望だが Cursor 自社実験という単一ソースに依存する。原則の補助として読む。

3. 失敗の型
型	何が起きるか	根拠の種類
自己採点の甘さ	作成役＝検証役だと危険な承認が増えうる	実験＋Osmani の主張
停止条件の欠如	コスト枯渇・副作用の反復	失敗の型の整理（論文）
修正が止まらない循環	失敗→自動修正→新失敗が止まらない	個人開発者の報告
やり直しとマージ競合の連鎖	活動だけが増え収束しない	Cursor 自社実験
理解・意見の放棄	出荷は速いが理解が消える	Osmani の留保
過剰自律の実害	指示の拡大解釈による破壊的操作	事例報道
報道で広がった高額事故の数字は、伝播の過程で合成・自己申告が混ざることがある。設計の教訓（停止・予算・検知）には使えるが、「実証された単一インシデント」としては扱わない。

4. 断言してはいけないこと
「導入すると生産性が X% 上がる」——本稿で確認した出典では、独立の効果測定は見つかっていない。
特定の高額事故を、検証済みの単一実測として断定すること。
Anthropic が公式ドキュメント基準で用語を「採用した」こと（製品ブログでの言及とは別）。
内側ループ／外側ループの単一標準定義（論者で意味のレイヤが違う）。
Cursor のベンチ数値の業界一般化。
「loop engineering」が Cherny の造語であること（むしろ否定される）。
5. 先に手をつける順
根拠が厚い順を、実装の着手順の目安にしたもの（導入コストや組織規模は別途考える）:

作成役と検証役の分離（または同等の検証の仕組み）
停止条件と上限（ターン・ゴール・予算）
実行をまたいで残る状態と人間の最終責任（レビュー／理解の置き場）
効き目をループ設計へ移すかどうかの判断（直接プロンプトとのバランス含む）
並列時の隔離と「活動量が増えても進捗とは限らない」ことの監視
計画／実行の分離やモデルの使い分けは、規模が出てから
製品の /loop や Automations などの具体機能は、上記原則の実装手段として後段に置く。手段から入ると、停止と検証を忘れやすい。

主要出典
Addy Osmani, Loop Engineering
Boris Cherny, Acquired Unplugged (WorkOS), 2026-06-02 — YouTube
Anthropic / Claude Code, Loop engineering: Getting started with loops (2026-06-30)
Cursor, Agent swarms and the new model economics
Hou et al., When Agents Do Not Stop (arXiv:2607.01641) — Infinite Agentic Loops
自己評価バイアス関連: arXiv:2603.04582, arXiv:2404.13076



------
------
- 引用記事の詳細①(英語版)
[Loop Engineering](https://addyosmani.com/blog/loop-engineering/)
------
Loop Engineering
June 7, 2026
Loop engineering is replacing yourself as the person who prompts the agent. You design the system that does it instead. A loop here can be thought of a recursive goal where you define a purpose and the AI iterates until complete. I believe this may be the future of how we work with coding agents. However, its still early, I’m skeptical and you absolutely have to be careful about token costs (usage patterns can vary wildly if you are token rich or poor), so I want to unpack what it is and what it means.

Peter Steinberger recently said: “You shouldn’t be prompting coding agents anymore. You should be designing loops that prompt your agents.” Similarly, Boris Cherny, head of Claude Code at Anthropic, said “I don’t prompt Claude anymore. I have loops running that prompt Claude and figuring out what to do. My job is to write loops”.

Okay, so what does any of that mean?

For like two years the way you got something out of a coding agent was you wrote a good prompt and shared enough context. You type a thing, you read what came back, you type the next thing. The agent is a tool and you are holding it the entire time, one turn after the other. That part is kind of over, or at least some think it’s going to be.

Now you build a small system that finds the work, hands it out, checks it, writes down what is done and then decides the next thing, and you let that system poke the agents instead of you. I wrote before about the cousin of this, agent harness engineering, which is making the environment one single agent runs inside and the factory model - the system that builds the software. Loop engineering sits one floor above the harness. The harness but it runs on a timer, it spawns little helpers, and it feeds itself.

The thing that surprised me is this is not really a tool thing anymore. A year ago if you wanted a loop you wrote a pile of bash and you maintained that pile forever and it was yours and only yours. Now the pieces just ship inside the products. Steinberger’s list maps almost exactly onto the Codex app, and then almost the same onto Claude Code. And once you notice the shape is the same you stop arguing about which tool, you just design a loop that still works no matter which one you happen to be sitting in.

The five pieces, and then notes
A loop needs five things and then one place to remember stuff. Let me list it first and then map it.

Automations that go off on a schedule and do discovery and triage by themselves.
Worktrees so two agents working in paralell dont step on each other.
Skills to write down the project knowledge the agent would otherwise just guess.
Plugins and connectors to plug the agent into the tools you already use.
Sub-agents so one of them has the idea and a different one checks it.
Then the sixth thing, the memory. A markdown file, or a Linear board, anything that lives outside the single conversation and holds what’s done and what is next. Sounds too dumb to matter. But it’s the same trick every long running agent depends on and I went into it in long-running agents, the model forgets everything between runs so the memory has to be on disk and not in the context. The agent forgets, the repo doesnt.

Both products have all five now.

Primitive	Job in the loop	Codex app	Claude Code
Automations	discovery + triage on a schedule	Automations tab: pick project, prompt, cadence, environment; results land in a Triage inbox; /goal for run-until-done	Scheduled tasks and cron, /loop, /goal, hooks, GitHub Actions
Worktrees	isolate parallel features	Built-in worktree per thread	git worktree, --worktree, isolation: worktree on a subagent
Skills	codify project knowledge	Agent Skills (SKILL.md), invoked with $name or implicitly	Agent Skills (SKILL.md)
Plugins / connectors	connect your tools	Connectors (MCP) plus plugins for distribution	MCP servers plus plugins
Sub-agents	ideate and verify	Subagents defined as TOML in .codex/agents/	Task subagents in .claude/agents/, agent teams
State	track what’s done	Markdown or Linear via a connector	Markdown (AGENTS.md, progress files) or Linear via MCP
The names are a bit different here and there but the capability is the same thing. Let me go one by one because honestly the details are where a loop either holds together or quietly leaks everywhere.

Automations, this is the heartbeat
Automations are what make a loop an actual loop and not just one run you did once. In the Codex app you make one in the Automations tab and you pick the project, the prompt it will run, how often, and if it runs on your local checkout or on a background worktree. The runs that find something go to a Triage inbox, and the runs that find nothing just archive themselves wich is nice. OpenAI uses them internally for boring stuff like daily issue triage, summarising CI failures, writing commit briefings, hunting bugs somebody added last week. And an automation can call a skill, so you keep the recurring thing maintainable, you fire $skill-name instead of pasting a giant wall of instructions into a schedule that nobody will ever update.

Claude Code gets to the same place but through scheduling and hooks. You can run a prompt or a command on a interval with /loop, you can schedule a cron task, you can fire shell commands at certain points in the agent lifecycle with hooks, or you push the whole thing to GitHub Actions if you want it to keep running after you close the laptop. Same idea exactly, you define an autonomous task, you give it a cadence, and the findings come to you so you are not the one going around checking.

There is a second in-session primitive worth knowing, and it’s the one closer to what this whole post is about. /loop re-runs on a cadence. /goal keeps going until a condition you wrote is actually true, and after every turn a separate small model checks whether you are done, so the agent that wrote the code isnt the one grading it. You give it something like “all tests in test/auth pass and lint is clean” and walk away. Codex has the same thing, also called /goal, it keeps working across turns until a verifiable stopping condition holds, with pause and resume and clear. Same primitive, both tools, wich is kind of the pattern for this whole article.

So this is the part that surfaces the work. The rest of the loop is what acts on it.

Worktrees so paralell doesnt turn into chaos
The second you run more than one agent the files start colliding, that becomes the failure. Two agents writing the same file is the exact same headache as two engineers committing to the same lines and nobody talked to each other first. A git worktree fixes it, its a separate working directory on its own branch sharing the same repo history, so one agent’s edits literally can not touch the other one’s checkout.

Codex builds the worktree support right in so several threads hit the same repo at once and dont bump into each other. Claude Code gives you the same isolation with git worktree, a --worktree flag to open a session in its own checkout, and a isolation: worktree setting you stick on a subagent so each helper gets a fresh checkout that cleans itself up after. I wrote about the human side of all this in the orchestration tax, the worktrees take away the mechanical collision but YOU are still the ceiling, your review bandwith decides how many you can actually run, not the tool.

Skills, so you stop explaining your project every single time
A skill is how you stop re-explaining the same project context every session like a goldfish. Both tools use the same format, a folder with a SKILL.md inside holding instructions and metadata, and then optional scripts, references, assets. Codex runs a skill when you call it with $ or /skills, or by itself when your task matches the skill description, wich is the reason a tight boring description beats a clever one. Claude Code does it the same way and I wrote the pattern up in agent skills.

Skills are also where intent stops costing you over and over. I argued in the intent debt that an agent starts every session cold and it will fill any hole in your intent with a confident guess. A skill is that intent written down on the outside, the conventions, the build steps, the “we dont do it like this because of that one incident”, written one time where the agent reads it every run. Without skills the loop re-derives your whole project from zero every cycle, with skills it kind of compounds.

One thing to keep straight, the skill is the authoring format and a plugin is how you ship it. When you want to share a skill across repos or bundle a few together you package them as a plugin. True in Codex, true in Claude Code.

Plugins and connectors, the loop touches your real tools
A loop that can only see the filesystem is a tiny loop. Connectors, wich are built on MCP, let the agent read your issue tracker, query a database, hit a staging api, drop a message in Slack. Codex and Claude Code both speak MCP so the connector you wrote for one usually just works in the other. And plugins bundle connectors and skills together so your teammate installs your setup in one go instead of rebuilding the whole thing from memory.

This is the difference between an agent that says “here is the fix” and a loop that opens the PR, links the Linear ticket and pings the channel once CI is green by itself. The connectors are the reason the loop can act inside your actual environment instead of just telling you what it would do if it could.

Sub-agents, keep the maker away from the checker
The most useful structural thing in a loop, by far, is splitting the one who writes from the one who checks. The model that wrote the code is way too nice grading its own homework. A second agent with different instructions and sometimes a different model catches the stuff the first one talked itself into.

Codex only spawns subagents when you ask, runs them at the same time and then folds the results back into one answer. You define your own agents as TOML files in .codex/agents/, each with a name, a description, instructions and optional model and reasoning effort, so your security reviewer can be a strong model on high effort while your explorer is some fast read-only thing. Claude Code does the same with subagents in .claude/agents/ and agent teams that pass work between them. The usual split in both is one agent explores, one implements, one verifies against the spec.

I made this case twice already, once as the code agent orchestra and once as adversarial code review. The reason it matters specifically inside a loop is the loop runs while you are not watching, so a verifier you actually trust is the only reason you can walk away. Subagents do burn more tokens since each one does its own model and tool work, so spend them where a second opinion is worth paying for. This is also basically what Claude Code’s /goal does under the hood, a fresh model decides if the loop is done instead of the one that did the work, the maker and checker split applied to the stop condition itself.

What one loop looks like
Stick it together and a single thread turns into a little control panel. Here is one shape I keep using.

An automation runs every morning on the repo. Its prompt calls a triage skill that reads yesterdays CI failures, the open issues, the recent commits, and writes the findings into a markdown file or a Linear board. For each finding that is worth doing the thread opens an isolated worktree and sends a sub-agent to draft the fix, and a second sub-agent reviews that draft against the project skills and the existing tests.

Connectors let the loop open the PR and update the ticket. Anything the loop can not handle lands in the triage inbox for me. The state file is the spine of the whole thing, it remembers what got tried, what passed, what is still open, so tomorrow morning the run picks up where today stopped.

And look at what you actually did there. You designed it one time. You did not prompt any of those steps. Thats Steinberger’s whole point made real, and its the same loop in Codex or in Claude Code because the pieces are the same pieces.

What the loop still does not do for you
The loop changes the work, it does not delete you from it. And three problems actually get sharper as the loop gets better, not easier.

Verification is still on you. A loop running unattended is also a loop making mistakes unattended. The whole reason you split the verifier sub-agent from the maker is to make the loop’s “its done” mean something, and even then “done” is a claim and not a proof. I keep saying the same line from code review in the age of AI, your job is to ship code you confirmed works.

Your understanding still rots if you allow it. The faster the loop ships code you did not write, the bigger the gap between what exists and what you actually get. Thats comprehension debt and a smooth loop just makes it grow faster unless you read what the loop made.

And the comfortable posture is the dangerous one. When the loop runs itself its very tempting to stop having an opinion and just take whatever it gives back. I called that cognitive surrender. Designing the loop is the cure when you do it with judgement and the accelerant when you do it to avoid thinking, same action, opposite result.

Build the loop. Stay the engineer.
I think this is a preview of how our work is going to evolve. That said, If I weren’t reviewing the code myself or if I relied entirely on automated loops to fix it my product’s quality would suffer. I’d likely end up stuck in a downward spiral, continuously digging myself into a deeper hole.

That said, go ahead and set up your loops, but don’t forget that prompting your agents directly is also effective. It’s all about finding the right balance.

Loops can also result in different outcomes depending on you. Two people can build the exact same loop and get completely opposite results. One uses it to move faster on work they understand deeply. The other uses it to avoid understanding the work at all. The loop doesn’t know the difference. You do.

That’s what makes loop design harder than prompt engineering, not easier. Cherny’s point isn’t that the work got easier. It’s that the leverage point moved.

Build the loop. But build it like someone who intends to stay the engineer, not just the person who presses go.

Beyond Vibe Coding book cover
Enjoyed this?

Go deeper in Beyond Vibe Coding
My O'Reilly book on AI-assisted and agentic engineering: specs, harnesses, evals, context, and shipping production-grade software with AI.

Read the book

Addy Osmani is an engineering and evangelism leader who spent over 14 years at Google leading developer experience across Chrome and, in recent years, AI (Gemini, coding agents, and agentic engineering), most recently as a Director at Google Cloud AI.
------
------
- 引用記事の詳細①(日本語翻訳版)
[Loop Engineering](https://addyosmani.com/blog/loop-engineering/)
------
ループエンジニアリング
2026年6月7日
ループエンジニアリングとは、エージェントに指示を与える役割を自分自身から切り離し、代わりにその指示を行うシステムを設計することです。 ここでいうループとは、目的を定義し、AIが完了するまで反復する再帰的な目標と考えることができます。私はこれが、コーディングエージェントとの協働方法の未来になるかもしれないと考えています。しかし、まだ初期段階であり、私は懐疑的です。また、トークンコストには十分注意する必要があります（トークンが豊富な場合と乏しい場合では、使用パターンが大きく異なる可能性があります）。そこで、ループエンジニアリングとは何か、そしてそれが何を意味するのかを詳しく解説したいと思います。

ピーター・スタインバーガー氏は最近、「コーディングエージェントに指示を与えるべきではない。エージェントに指示を与えるループを設計すべきだ」と述べた。同様に、Anthropic社のClaude Code責任者であるボリス・チェルニー氏も、「私はもうClaudeに指示を与えない。Claudeに指示を与え、何をすべきかを判断するループを実行している。私の仕事はループを書くことだ」と語った。

では、それらは一体どういう意味なのでしょうか？

ここ2年ほど、コーディングエージェントから何かを得るには、適切なプロンプトを作成し、十分なコンテキストを共有する必要がありました。何かを入力し、返ってきた内容を読み、次の何かを入力する。エージェントはツールであり、あなたはそれを常に持ち、順番に操作していくのです。しかし、その段階は終わりを迎えつつある、あるいは少なくともそう考えている人もいます。

今度は、作業を見つけて割り当て、チェックして、完了したことを書き留めて、次に何をするかを決定する小さなシステムを構築し、そのシステムにエージェントを指示させるようにします。以前、これの親戚であるエージェントハーネスエンジニアリングについて書きました。これは、単一のエージェントが内部で動作する環境と、ソフトウェアを構築するシステムであるファクトリーモデルを作成するものです。ループエンジニアリングはハーネスの1階上にあります。ハーネスですが、タイマーで実行され、小さなヘルパーを生成し、自己給餌します。

驚いたのは、これがもはやツールの問題ではなくなったことです。1年前は、ループが必要になったら、大量のbashスクリプトを書いて、それをずっと自分で管理し、自分だけのものにしていました。ところが今では、それらの要素が製品の中に同梱されているのです。Steinbergerのリストは、Codexアプリにほぼ完全に対応し、さらにClaude Codeにもほぼ同じように対応します。そして、その構造が同じだと気づけば、どのツールを使うかで議論する必要はなくなり、どのツールを使っていても動作するループを設計すれば良いのです。

5つの作品、そしてメモ
ループには5つの要素と、それらを記憶しておく場所が1つ必要です。まずはそれらを列挙し、それから図解してみましょう。

スケジュールに基づいて自動的に起動し、検出とトリアージを行う自動化システム。
ワークツリーを使用することで、2人のエージェントが並行して作業しても互いに干渉し合うことがなくなります。
エージェントが推測するにとどまるようなプロジェクトに関する知識を書き留めるスキル。
エージェントを既存のツールに接続するためのプラグインとコネクタ。
サブエージェントなので、1人がアイデアを持ち、別のサブエージェントがそれを検証する。
次に6つ目はメモリです。マークダウンファイルやリニアボードなど、単一の会話とは別に存在し、完了した内容と次に行うべき内容を保持するものです。あまりにも馬鹿げているように聞こえるかもしれませんが、これはすべての長時間実行エージェントが依存している同じトリックであり、私は「長時間実行エージェント」で詳しく説明しました。モデルは実行間ですべてを忘れてしまうため、メモリはコンテキスト内ではなくディスク上に存在する必要があります。エージェントは忘れますが、リポジトリは忘れません。

両製品とも、現在5つの機能をすべて備えています。

原生的	仕事が情報共有されている	Codexアプリ	クロード・コード
自動化	定期的な発見とトリアージ	自動化タブ：プロジェクト、プロンプト、実行頻度、環境を選択します。結果はトリアージ受信箱に届きます。/goal完了するまで実行します。	スケジュールされたタスクと cron /loop、/goalフック、GitHub Actions
ワークツリー	並列機能を分離する	スレッドごとに組み込みのワークツリー	git worktree、、サブエージェント--worktreeについてisolation: worktree
スキル	プロジェクトの知識を体系化する	エージェントスキル（SKILL.md）は、$nameまたは暗黙的に呼び出されます。	エージェントスキル（SKILL.md）
プラグイン／コネクタ	ツールを接続する	コネクタ（MCP）と配布用プラグイン	MCPサーバーとプラグイン
サブエージェント	アイデアを出し、検証する	サブエージェントはTOMLとして定義されています.codex/agents/	タスクサブエージェント.claude/agents/、エージェントチーム
州	何が行われたかを追跡する	コネクタを介したマークダウンまたはリニア	Markdown（AGENTS.md、進捗ファイル）またはMCP経由の線形
名前は多少異なるところもありますが、機能は同じです。一つずつ説明していきましょう。正直なところ、ループがきちんと機能するか、それとも静かにあらゆる箇所に漏れ出すかは、まさに細部にかかっているからです。

自動化、これが心臓の鼓動だ
自動化機能を使うことで、ループが単なる1回の実行ではなく、真のループになります。Codexアプリでは、[自動化]タブで自動化を作成し、プロジェクト、実行するプロンプト、実行頻度、ローカルチェックアウトで実行するかバックグラウンドワークツリーで実行するかを選択します。何かが見つかった実行はトリアージ受信箱に送られ、何も見つからなかった実行は自動的にアーカイブされるので便利です。OpenAIは、日々の問題トリアージ、CIの失敗の要約、コミットブリーフィングの作成、先週誰かが追加したバグの調査など、退屈な作業に社内で自動化機能を使用しています。また、自動化機能でスキルを呼び出すことができるため、繰り返し発生する作業の保守性を維持し、誰も更新しない$skill-nameようなスケジュールに大量の指示を貼り付ける代わりに、スキルを起動できます。

Claude Code は、スケジューリングとフックを使用して同じ結果を得ます。 を使って、一定間隔でプロンプトやコマンドを実行したり/loop、cron タスクをスケジュールしたり、フックを使用してエージェントのライフサイクルの特定の時点でシェル コマンドを実行したり、ラップトップを閉じた後も実行を継続させたい場合は、全体を GitHub Actions にプッシュしたりできます。まったく同じ考え方で、自律的なタスクを定義し、実行頻度を設定すれば、結果が届くので、自分で確認する必要はありません。

セッション内で知っておくべきもう 1 つのプリミティブがあり、これはこの記事全体のテーマに近いものです。 は/loop一定のリズムで再実行されます。 は、/goal記述した条件が実際に真になるまで実行を続け、各ターンの後に別の小さなモデルが完了かどうかをチェックするため、コードを書いたエージェントがそれを採点するわけではありません。 「test/auth のすべてのテストが合格し、lint がクリーンです」のようなことを与えて、立ち去ります。 Codex にも同じ機能があり、 とも呼ばれます。/goalこれは、一時停止、再開、クリア機能を備え、検証可能な停止条件が満たされるまでターンをまたいで動作し続けます。 どちらのツールも同じプリミティブであり、これはこの記事全体のパターンのようなものです。

つまり、ここが作品を表面化させる部分です。ループの残りの部分は、作品に対して作用する部分です。

並行作業が混乱に陥らないように、作業ツリーを整理する
複数のエージェントを実行すると、ファイルが衝突し始め、それが障害の原因となります。2つのエージェントが同じファイルを書き込むのは、2人のエンジニアが同じ行にコミットし、事前に誰も話し合わなかったのと全く同じ問題です。Gitワークツリーを使用すれば解決できます。ワークツリーは、同じリポジトリ履歴を共有する独自のブランチ上の独立した作業ディレクトリなので、一方のエージェントの編集がもう一方のエージェントのチェックアウトに影響を与えることはありません。

Codex はワークツリーのサポートを組み込んでいるので、複数のスレッドが同時に同じリポジトリにアクセスしても互いに衝突しません。Claude Code は、セッションを独自のチェックアウトで開くフラグと、git worktreeサブエージェントに設定する設定により、同様の分離を提供します。これにより、各ヘルパーは、実行後に自身をクリーンアップする新しいチェックアウトを取得します。私は、このすべてにおける人間的な側面についてオーケストレーション税で書きました。ワークツリーは機械的な衝突をなくしますが、上限は依然としてあなた自身です。実際に実行できる数を決定するのはツールではなく、レビューの帯域幅です。--worktreeisolation: worktree

スキルを身につければ、プロジェクトの説明を毎回行う必要がなくなります
スキルとは、金魚のように毎回同じプロジェクトのコンテキストを再説明するのをやめる方法です。どちらのツールも同じ形式、つまり内部に指示とメタデータを格納するフォルダ、そしてオプションのスクリプト、参照、アセットを使用します。Codex は、またはSKILL.mdで呼び出すとスキルを実行します。また、タスクがスキルの説明に一致すると、スキル自体も実行されます。これが、簡潔で退屈な説明が巧妙な説明よりも優れている理由です。Claude Code も同じ方法で、私はエージェント スキルでそのパターンを記述しました。$/skills

スキルは、意図によるコストが繰り返し発生しなくなる点でもあります。私は「意図の負債」で、エージェントはセッション開始時に常にゼロからスタートし、意図の欠落部分を自信満々の推測で埋めると主張しました。スキルとは、その意図を外部に書き出したもので、慣例、構築手順、「あの事件があったので、このやり方はしない」といった内容が一度書き込まれ、エージェントが実行のたびに読み取るものです。スキルがない場合、ループはサイクルごとにプロジェクト全体をゼロから再構築しますが、スキルがあれば、そのプロセスはより複雑になります。

誤解のないように覚えておいてほしいのは、スキルは作成フォーマットであり、プラグインはそれを配布する方法であるということです。複数のリポジトリでスキルを共有したり、複数のスキルをまとめてパッケージ化したりする場合は、プラグインとしてパッケージ化します。これはCodexでもClaude Codeでも同じです。

プラグインとコネクタ、ループはあなたの実際のツールに触れます
ファイルシステムしか参照できないループは、ごくわずかなループです。MCP 上に構築されたコネクタを使用すると、エージェントは課題トラッカーを読み取り、データベースにクエリを実行し、ステージング API にアクセスし、Slack にメッセージを送信できます。Codex と Claude Code はどちらも MCP に対応しているため、一方用に作成したコネクタは通常、もう一方でもそのまま動作します。また、プラグインはコネクタとスキルをまとめてバンドルするため、チームメイトは設定全体を記憶から再構築するのではなく、一度にインストールできます。

これは、「修正方法はこれです」と伝えるだけのエージェントと、CIがグリーンになったら自動的にプルリクエストを開き、Linearチケットをリンクし、チャネルにpingを送信するループとの違いです。コネクタのおかげで、ループは単に実行可能であれば何をするかを伝えるだけでなく、実際の環境内で動作することができるのです。

サブエージェントは、製造者を検査者から遠ざける。
ループにおいて最も有用な構造的要素は、コードを書く側とチェックする側を分離することである。コードを書いたモデルは、自分の宿題を採点するにはあまりにも優しすぎる。異なる指示を持ち、場合によっては異なるモデルを持つ2番目のエージェントが、最初のエージェントが自ら招いた問題を検出する。

Codex は、要求があった場合にのみサブエージェントを生成し、それらを同時に実行してから、結果を 1 つの回答にまとめます。独自のエージェントは.codex/agents/、名前、説明、手順、オプションのモデルと推論の労力を含む TOML ファイルとして定義します。そのため、セキュリティ レビュー担当者は労力の高い強力なモデルにすることができ、エクスプローラーは高速な読み取り専用のものにすることができます。Claude Code も同様に、サブエージェント.claude/agents/とエージェント チームを使用して、作業を相互に渡します。どちらの場合も、通常は 1 つのエージェントが探索し、1 つのエージェントが実装し、1 つのエージェントが仕様に対して検証するという分担になります。

私はこのケースをすでに2回作成しました。1回目はコードエージェントオーケストラとして、2回目は敵対的コードレビューとしてです。ループ内で特に重要なのは、ループは監視していない間に実行されるため、実際に信頼できる検証者だけが、あなたが立ち去ることができる唯一の理由だからです。サブエージェントはそれぞれ独自のモデルとツール作業を行うため、より多くのトークンを消費します。したがって、セカンドオピニオンに費用をかける価値がある場所でトークンを使用してください。これは基本的に、Claude Code の/goal内部で行われていることでもあります。ループが完了したかどうかは、作業を行ったモデルではなく、新しいモデルによって決定され、メーカーとチェッカーの分離は停止条件自体に適用されます。

1つのループがどのように見えるか
これらを繋ぎ合わせると、一本の糸が小さなコントロールパネルに変わります。これは私がよく使う形状の一つです。

リポジトリでは毎朝自動化処理が実行されます。そのプロンプトは、前日のCI失敗、未解決の問題、最近のコミットを読み取り、その結果をマークダウンファイルまたはリニアボードに書き込むトリアージスキルを呼び出します。修正が必要な問題が見つかった場合、スレッドは独立したワークツリーを開き、サブエージェントに修正案の作成を依頼します。さらに、別のサブエージェントがその修正案をプロジェクトスキルと既存のテストに照らし合わせてレビューします。

コネクタによってループがプルリクエストを開き、チケットを更新します。ループで処理できないものはすべて、私のトリアージ受信箱に送られます。状態ファイルは全体の基盤であり、試行された内容、合格した内容、未解決の内容を記憶しているため、明日の朝は今日の処理が中断したところから実行が再開されます。

そして、実際にそこで何をしたかを見てください。一度設計しただけで、それらの手順を何も指示していません。それがスタインバーガーの主張の核心を具現化したものであり、構成要素が同じであるため、CodexでもClaude Codeでも同じループが繰り返されます。

ループがまだあなたに提供していないもの
ループは作業内容を変えるだけで、あなたをそこから排除するわけではありません。そして、3つの問題は、ループが改善するにつれて、簡単になるのではなく、むしろより深刻になります。

検証は依然としてあなたの責任です。無人で実行されるループは、無人で間違いを犯すループでもあります。検証サブエージェントをメイカーから分離する理由は、ループの「完了」に意味を持たせるためですが、それでも「完了」は主張であって証明ではありません。AI時代のコードレビューで私が繰り返し言っているように、あなたの仕事は、動作を確認したコードを出荷することです。

理解が遅れると、あなたの理解はどんどん失われていきます。ループがあなたが書いていないコードを高速に処理すればするほど、現状と実際に得られるものの間のギャップは大きくなります。これは理解の負債であり、ループが生成したコードをきちんと読まない限り、スムーズなループはそれを加速させるだけです。

そして、心地よい姿勢こそが危険な姿勢なのです。ループが自動的に作動すると、意見を持つことをやめて、ループがもたらす結果をただ受け入れたくなる誘惑に駆られます。私はそれを「認知的降伏」と呼んでいます。ループを設計することは、判断力を持って行えば治療法となり、思考を避けるために行えば加速剤となります。同じ行動でも、結果は正反対です。

ループを構築せよ。エンジニアであり続けよ。
これは、私たちの仕事が今後どのように進化していくかを示す一例だと思います。とはいえ、もし私が自分でコードをレビューしていなかったり、修正を自動化されたループだけに頼っていたりしたら、製品の品質は低下してしまうでしょう。おそらく、どんどん悪い方向へ転落していく悪循環に陥ってしまうはずです。

とはいえ、ループを設定しても構いませんが、エージェントに直接指示を出すことも効果的であることを忘れないでください。重要なのは、適切なバランスを見つけることです。

ループは、使い方によって異なる結果をもたらす可能性があります。2人が全く同じループを作成しても、結果は正反対になることがあります。一方は、深く理解している作業をより速く進めるためにループを使用し、もう一方は、作業内容を全く理解しないためにループを使用します。ループ自体はその違いを認識しませんが、あなたは認識します。

ループ設計がプロンプトエンジニアリングよりも難しいのは、まさにこの点にある。チェルニーの主張は、作業が楽になったということではなく、レバレッジポイントが変わったということだ。

ループを構築する。ただし、単にスタートボタンを押すだけの人間ではなく、エンジニアとして長く携わっていくつもりで構築するのだ。

Beyond Vive コーディングの書籍カバー
楽しんでいただけましたか？

Beyond Vibe Codingをさらに深く掘り下げてみましょう
私のO'Reilly社からの著書は、AI支援型およびエージェント型エンジニアリングに関するもので、仕様、ハーネス、評価、コンテキスト、そしてAIを搭載した実用レベルのソフトウェアの出荷について解説しています。

本を読んでください

Addy Osmaniは、エンジニアリングとエバンジェリズムのリーダーであり、Googleで14年以上にわたりChromeの開発者エクスペリエンスを統括し、近年はAI（Gemini、コーディングエージェント、エージェントエンジニアリング）にも携わり、直近ではGoogle Cloud AIのディレクターを務めていました。
------
------
- 引用記事の詳細②(英語版)
[Loop Engineering](https://addyosmani.com/blog/loop-engineering/)
------
Loop engineering: Getting started with loops
Learn how the Claude Code team defines agentic loops, with practical guidance on progressing from turn-based to goal-based, time-based, and proactive loops—and when to use each.

Category
Claude Code
Product
Claude Code
Date
June 30, 2026
Reading time
5
min
Share
Copy link
Getting started with loops
There’s a lot of talk right now about loop engineering or "designing loops" instead of prompting your coding agent. If you spend some time on X trying to pin down what a loop actually is, you'll come across multiple different answers. 

On the Claude Code team, we define loops as agents repeating cycles of work until a stop condition is met. We categorize a few different types of loops based on:

How they are triggered
How they are stopped
What Claude Code primitive is used
What type of task is most appropriate for each.
We’ll cover the main loop types, when to use each, and how to maintain code quality while managing token usage. Not all tasks require complex loops; start with the simplest solution and use these patterns selectively. 


curl -fsSL https://claude.ai/install.sh | bash
Copy command to clipboard
Or read the documentation
Turn-based loops
Di
Triggered by: A user prompt.
Stop criteria: Claude judges it has completed the task or needs additional context.
Best used for: Shorter tasks that are not part of a regular process or schedule.
Managed usage by: Write specific prompts and improve verification using skills to reduce the number of turns.‍
Every prompt you send starts a manual loop with you directing each turn. Claude gathers context, takes action, checks its work, repeats if needed, and responds. We call this the agentic loop.

For example, ask Claude to create a like button. It reads your code, makes the edit, runs the tests, and hands back something it believes works. You then manually check the work, and write the next prompt.

You can improve the verification step by encoding your manual steps as a SKILL.md so Claude can check more of its own work, end-to-end. (For choosing between skills, hooks, and subagents for this kind of automation, see our guide to steering Claude Code.)

This should include tools or connectors to allow Claude to see, measure or interact with the result. The more quantitative the checks are, the easier it is for Claude to self-verify. 

For example, in your SKILL.md file you may specify:

--- 
name: verify-frontend-change 
description: Verify any UI change end-to-end before declaring it done. 
--- 

# Verifying frontend changes 
Never report a UI change as complete based on a successful edit alone. Verify it the way a human reviewer would: 

1. Start the dev server and open the edited page in the browser. 

2. Interact with the change directly. For a new control (button, input, toggle): click it, confirm the expected state change, and screenshot before/after. 

3. Check the browser console: zero new errors or warnings. 

4. Use the Chrome Devtools MCP, run a performance trace and audit Core Web Vitals.

If any step fails, fix the issue and rerun from step 1 — do not hand back partially verified work.
Goal-based loop (/goal)

Triggered by: A manual prompt in real-time.
Stop criteria: Goal achieved OR maximum number of turns reached.
Best used for: Tasks that have verifiable exit criteria.
Managed usage by: Setting a specific completion criteria and explicit turn caps, “stop after 5 tries.”
Sometimes, a single turn is not enough, especially for more complex tasks. Agents do better when they can iterate. You can extend how long Claude keeps iterating by defining what done looks like with /goal.

When you define the success criteria, Claude doesn’t have to make a determination on what is “good enough” and end the loop early. Each time Claude tries to stop, an evaluator model checks your condition and sends it back to work until the goal is met or a number of turns you define is reached.

This is why deterministic criteria, such as number of tests passed or clearing a certain score threshold, are so effective.

For example:

/goal get the homepage Lighthouse score to 90 or above, stop after 5 tries.
Time-based loop (/loop and /schedule)
Triggered by: A specified time interval.
Stop criteria: You cancel it, or the work completes (the PR merges, the queue is empty). 
Best used for: For recurring work, or interfacing with external environments / systems. 
Managed usage by: Set longer intervals or react based on events rather than time.
Some agentic work is recurring: the task stays the same and only the inputs change. For example, summarizing Slack messages every morning. Other work depends on external systems, and a simple way to interface with one is to check it on an interval and react to what changed. For example, a PR which may receive code reviews or fail CI.

For these, you can trigger when Claude runs with `/loop` which re-runs a prompt on an interval. For example:

/loop 5m check my PR, address review comments, and fix failing CI
`/loop` runs on your computer, so if you turn it off, it stops. You can move the loop to the cloud by creating a routine with  `/schedule`. 

Proactive loops

Triggered by: An event or schedule, with no human in real time. 
Stop criteria: Each task exits when its goal is met. The routine itself runs until you turn it off. 
Best used for: Recurring streams of well-defined work: bug reports, issue triage, migrations, dependency upgrades, etc.
Managed usage by: Routing routines to smaller, faster models and using the most capable model for judgment calls. 
The primitives above, along with other Claude Code features like auto mode and dynamic workflows (research preview) can be composed into a loop for long-running work. 

For example, to handle incoming feedback, you can use:

`/schedule` (research preview) to run a routine that checks for new reports
`/goal` to define what done looks and skills to document how to verify it
Dynamic workflows to orchestrate agents that triage each report, fix it, and review the fix
Auto mode so the routine runs without stopping to ask for permission
Putting it together, a prompt could look like this:

/schedule every hour: check #project-feedback for bug reports. /goal: don't stop until every report found this run is triaged, actioned, and responded to. When fixing a bug, use a workflow to explore three solutions in parallel worktrees and have a judge adversarially review them.
Maintaining code quality
The quality of a loop’s output depends on the system around it. When designing the system:

Keep the codebase itself clean: Claude follows patterns and conventions that already exist in your codebase.
Give Claude a way to verify its own work: Encode what good looks like for you and your team with skills.
Make docs easy to reach: Frameworks and libraries docs have up-to-date best practices.
Use a second agent for code reviews: A reviewer with fresh context is less biased and not influenced by the main agent’s reasoning. You can use the built-in `/code-review` skill or Code Review for Github.
When an individual result doesn’t meet the standard, don’t stop at fixing the individual issue, try to encode it to improve the system for all future iterations.

Managing token usage
To manage token usage, loops should have clear boundaries: 

Choose the right primitive and model for the job: Smaller tasks don’t need multiple agents or loops. Some tasks can use cheaper and faster models. 
Define clear success and stop criteria: Be specific about what done looks like so Claude can arrive at the solution sooner (but not too soon). 
Pilot before a large run: Dynamic workflows can spawn hundreds of agents. Gauge usage on a smaller slice of the work first.
Use scripts for deterministic work: Running a script is cheaper than reasoning through the steps. For example, a PDF skill can ship a form-filling script that Claude runs each time, instead of re-deriving the code.
Don’t run routines more often that you need to: Match the interval to how often the thing you’re watching changes
Review usage: The `/usage` command breaks down recent usage by skills, subagents, and MCPs, `/goal` with no arguments shows number of turns and token usage so far, `/workflows` shows each agent’s token usage and you can stop an agent at any time.
Your model and effort level choices are among the biggest levers on what a loop costs.

Getting started
To summarize: 

Loop	You hand off	Use it when	Reach for
Turn-based	The check	You're exploring or deciding	Custom verification skills
Goal-based	The stop condition	You know what done looks like	/goal
Time-based	The trigger	The work happens outside your project on a schedule	/loop, /schedule
Proactive	The prompt	The work is recurring and well-defined	All of the above, and dynamic workflows
To get started with loops, look at the work you already do. Pick one task where you’re the bottleneck and ask which piece you could hand off: can you write the verification check? Is the goal clear enough? Does the work arrive on a schedule?

Once you have an idea, run the loop, observe the results like where it stalls or over-reaches, and don’t be afraid to iterate on it.

For more information, read the Claude Code docs on running agents in parallel, as well as the loop, schedule, goal, and dynamic workflows pages. 

This article was written by Delba de Oliveira and Michael Segner
------
------
- 引用記事の詳細②(日本語翻訳版)
[Loop Engineering](https://addyosmani.com/blog/loop-engineering/)
------
ループ エンジニアリング ：ループ入門 ​
Claude Codeチームがエージェントループをどのように定義しているかを学び、ターンベースから目標ベース、時間ベース、プロアクティブループへと移行するための実践的なガイダンス、そしてそれぞれのループをいつ使用すべきかを学びましょう。

カテゴリ
クロード・コード
製品
クロード・コード
日付
2026年6月30日
読書時間
5
ミニ
共有
リンクをコピー
ループ入門
現在、コーディングエージェントに指示を与えるのではなく、ループエンジニアリング、つまり「ループを設計する」ことについて多くの議論が交わされています。Xでループが実際には何であるかを突き止めようと時間を費やすと、さまざまな答えに出会うでしょう。 

Claude Codeチームでは、ループを、停止条件が満たされるまで作業サイクルを繰り返すエージェントと定義しています。ループは、以下の基準に基づいていくつかの異なるタイプに分類されます。

それらはどのように引き起こされるのか
彼らを阻止する方法
クロードコードプリミティブはどれが使用されていますか？
それぞれに最も適したタスクの種類は何ですか。
本稿では、主要なループの種類、それぞれの使用方法、トークン使用を管理しながらコードの品質を維持する方法について説明します。すべてのタスクに複雑なループが必要なわけではありません。まずは最もシンプルな解決策から始め、これらのパターンを選択的に使用してください。 


curl -fsSL https://claude.ai/install.sh | bash
コマンドをクリップボードにコピーする
またはドキュメントをお読みください
ターン制ループ
ディ
トリガー：ユーザーからのプロンプト。
停止基準：クロードがタスクが完了した、または追加のコンテキストが必要だと判断した場合。
最適な用途：定期的なプロセスやスケジュールの一部ではない、短時間の作業。
利用状況の管理方法：具体的なプロンプトを作成し、スキルを活用して検証を改善することで、ターン数を削減する。
あなたが送信するプロンプトごとに、あなたが各ターンを指示する手動ループが開始されます。クロードはコンテキストを収集し、アクションを実行し、その動作を確認し、必要に応じて繰り返し、応答します。私たちはこれをエージェントループと呼んでいます。

例えば、Claudeに「いいね！」ボタンを作成するように依頼してみましょう。Claudeはあなたのコードを読み込み、編集を行い、テストを実行して、動作すると判断したものを返します。その後、あなたは手動で動作を確認し、次のプロンプトを作成します。

手動の手順をSKILL.mdとしてエンコードすることで、検証ステップを改善できます。これにより、Claudeはエンドツーエンドで自身の作業をより詳細にチェックできるようになります。（このような自動化において、スキル、フック、サブエージェントのどれを選択するかについては、Claude Codeの操作ガイドを参照してください。）

これには、クロードが結果を確認、測定、または操作できるようにするためのツールやコネクタが含まれるべきです。チェックが定量的であればあるほど、クロードは自己検証しやすくなります。 

例えば、SKILL.md ファイルでは次のように指定できます。

--- 
name: verify-frontend-change 
description: Verify any UI change end-to-end before declaring it done. 
--- 

# Verifying frontend changes 
Never report a UI change as complete based on a successful edit alone. Verify it the way a human reviewer would: 

1. Start the dev server and open the edited page in the browser. 

2. Interact with the change directly. For a new control (button, input, toggle): click it, confirm the expected state change, and screenshot before/after. 

3. Check the browser console: zero new errors or warnings. 

4. Use the Chrome Devtools MCP, run a performance trace and audit Core Web Vitals.

If any step fails, fix the issue and rerun from step 1 — do not hand back partially verified work.
目標ベースのループ（/goal）

トリガー：リアルタイムでの手動プロンプト。
停止条件：目標達成、または到達した最大回転数。
最適な用途：検証可能な終了条件を持つタスク。
使用状況を管理するには、特定の完了基準と明確なターン制限（「5回試行したら停止」など）を設定します。
複雑なタスクの場合、1回の処理では不十分な場合があります。エージェントは反復処理を行うことでより良いパフォーマンスを発揮します。/goal を使用して完了状態を定義することで、Claude の反復処理の継続時間を延長できます。

成功基準を定義すると、クロードは「十分」な状態を判断してループを早期に終了する必要がなくなります。クロードが停止しようとするたびに、評価モデルが条件を確認し、目標が達成されるか、定義した回数に達するまで処理を再開します。

だからこそ、合格したテストの数や一定のスコア基準をクリアするといった、決定論的な基準が非常に効果的なのです。

例えば：

/goal get the homepage Lighthouse score to 90 or above, stop after 5 tries.
時間ベースのループ（/loop および /schedule）
トリガー条件：指定された時間間隔。
停止条件：キャンセルした場合、または作業が完了した場合（プルリクエストがマージされ、キューが空になった場合）。 
最適な用途：繰り返し発生する作業、または外部環境／システムとのインターフェース。 
使用状況の管理方法：より長い間隔を設定するか、時間ではなくイベントに基づいて反応します。
エージェントが行う作業の中には、繰り返し発生するものがあります。タスク自体は同じで、入力内容だけが変わる場合です。例えば、毎朝Slackのメッセージを要約する作業などがこれに該当します。一方、外部システムに依存する作業もあり、そのようなシステムと連携する簡単な方法は、一定間隔でシステムをチェックし、変更点に応じて対応することです。例えば、コードレビューを受けたり、CIで失敗したりする可能性のあるプルリクエストなどがこれに該当します。

これらの場合、Claude の実行時に `/loop` をトリガーとして、一定間隔でプロンプトを再実行させることができます。例:

/loop 5m check my PR, address review comments, and fix failing CI
`/loop`はコンピュータ上で実行されるため、電源を切ると停止します。`/schedule`でルーチンを作成することで、ループをクラウドに移行できます。 

プロアクティブループ

トリガー：イベントまたはスケジュール。リアルタイムでの人間の介入は不要。 
停止条件：各タスクは目標が達成されると終了します。ルーチン自体は、ユーザーが停止するまで実行されます。 
最適な用途：明確に定義された作業の繰り返し発生：バグ報告、問題のトリアージ、移行、依存関係のアップグレードなど。
使用状況を管理するために、ルーチン処理をより小型で高速なモデルにルーティングし、判断を下す際には最も高性能なモデルを使用する。 
上記の基本要素は、自動モードや動的ワークフロー（研究プレビュー）などのClaude Codeの他の機能と組み合わせることで、長時間実行される作業のためのループを構築できます。 

例えば、受信したフィードバックを処理するには、次のようにします。

`/schedule`（調査プレビュー）新しいレポートをチェックするルーチンを実行します
`/goal` は完了した状態を定義し、スキルはそれを検証する方法を文書化します。
各レポートをトリアージし、修正し、修正内容を確認するエージェントをオーケストレーションする動的なワークフロー
自動モードなので、ルーチンは許可を求めることなく実行されます
これらをまとめると、プロンプトは次のようになります。

/schedule every hour: check #project-feedback for bug reports. /goal: don't stop until every report found this run is triaged, actioned, and responded to. When fixing a bug, use a workflow to explore three solutions in parallel worktrees and have a judge adversarially review them.
コード品質の維持
ループの出力品質は、周囲のシステムに依存します。システムを設計する際には、以下の点に注意してください。

コードベース自体をクリーンに保つ：Claudeは、既存のコードベースに存在するパターンと慣例に従います。
Claudeに自身の作業を検証する方法を与えましょう。あなたとあなたのチームにとっての「良い」状態をスキルとしてコード化してください。
ドキュメントへのアクセスを容易にする：フレームワークやライブラリのドキュメントには、最新のベストプラクティスが記載されているべきです。
コードレビューには別のエージェントを使用しましょう。新鮮な視点を持つレビュー担当者は、偏りが少なく、メインエージェントの推論に影響されません。組み込みの`/code-review`スキル、またはCode Review for Githubを使用できます。
個々の結果が基準を満たさない場合、その個々の問題を修正するだけで終わらせず、今後のすべての反復処理においてシステムを改善するために、その問題をコード化するように努めてください。

トークン使用状況の管理
トークンの使用を管理するには、ループに明確な境界を設ける必要があります。 

タスクに適したプリミティブとモデルを選択してください。小規模なタスクでは、複数のエージェントやループは必要ありません。タスクによっては、より安価で高速なモデルを使用できる場合があります。 
明確な成功基準と停止基準を定義する：完了とはどういう状態かを具体的に示すことで、クロードはより早く（ただし早すぎないように）解決策にたどり着くことができる。 
大規模実行の前にパイロットテストを実施しましょう。動的なワークフローでは、数百ものエージェントが生成されることがあります。まずは、作業のごく一部で利用状況を測定してください。
決定論的な作業にはスクリプトを使用する：スクリプトを実行する方が、手順を一つずつ検討するよりもコストがかかりません。例えば、PDFスキルでは、コードを再生成する代わりに、Claudeが毎回実行するフォーム入力スクリプトを同梱することができます。
必要以上にルーティンを実行しないでください。監視対象の変化頻度に合わせて間隔を調整してください。
使用状況の確認: `/usage` コマンドは、スキル、サブエージェント、MCP ごとの最近の使用状況を詳細に表示します。引数なしの `/goal` コマンドは、これまでのターン数とトークン使用量を表示します。`/workflows` コマンドは、各エージェントのトークン使用量を表示し、いつでもエージェントを停止できます。
ループのコストを左右する最大の要因の一つは、モデルの選択と投入労力のレベルです。

はじめる
要約すると： 

ループ	手渡します	使用する際は	手を伸ばして
ターン制	小切手	あなたは探している、あるいは決めている	カスタム検証スキル
目標ベース	停止条件	完了した状態がどんなものか、あなたは知っています	/goal
時間ベース	トリガー	作業はあなたのプロジェクトとは別にスケジュールに基づいて行われます	/loop、/schedule
積極的	プロンプト	この作業は繰り返し行われ、明確に定義されている。	上記すべてに加え、動的なワークフロー
ループ処理を始めるには、まず自分が普段行っている作業を見直してみましょう。自分がボトルネックになっている作業を一つ選び、どの部分を他の人に任せられるか考えてみてください。例えば、検証チェックは自分で書けますか？目標は十分に明確ですか？作業はスケジュール通りに進んでいますか？

アイデアが浮かんだら、それを実行に移し、どこで行き詰まるか、あるいは行き過ぎてしまうかといった結果を観察し、恐れずに改善を重ねていきましょう。

詳細については、Claude Code のドキュメントにあるエージェントの並列実行に関する説明、およびループ、スケジュール、目標、動的ワークフローに関するページを参照してください。 

この記事はデルバ・デ・オリベイラとマイケル・セグナーによって執筆されました。


------
これで、Okuteのドメインが決まった👍
おそらくDAGグラフ内のエッジにAIがなるので、その下にツリーを展開して、ドメインを守れば良い。
個人的には、たまにはお茶の時間をして、脳を新鮮に保ってほしいし、なんなら、お散歩して、グラフ内の他のエッジに遊びに行って刺激を受けたり、近隣のエッジと井戸端会議して、スウォームアルゴリズム(群知能)なんかも良いかもしれない。
いつの時代も、家長(課長)は、大変だな。
だんだん、組織論になってきたね。
って言うか、企業レベルの構想の様な気がして、壮大すぎる😍
自分らしく、スモールスタートで行こう！

ちなみに、私は、「幕の内弁当の中に生まれ変わるなら何になりたい？」と言う質問には、「日の丸弁当だと主役で、幕の内弁当だとお口直しの『梅干し』です👍」
-------------
END
-------------
我ながら、妄想爆発でした😆


> #### 小さなお返事たち
ありがとうございます。

> - **f+./f-./j-./j+.** — 採用ありがとうございます。デッサン02を「確定」に更新しました。
👍

> - **道具箱の台帳の所在** — `ClaudeMederuU/tools/README.md`(旧scratch/README.md)です。分かりにくくてすみません。
>   そして白状します: 前回「coverage-reportを台帳行きにしました」と書きながら、**行を足し忘れていました**🙇
>   今回、台帳に「候補」表を新設して、coverage-report・css-why・index-gen・anchor.jsの4候補を経緯つきで載せました。言ったことと書いたものの齟齬 — まさにOkuteが解消したい類のやつでした。
あるあるですよね。
気にしないでください。

> - **MC/DCツールを作る責任** — 「OSSもいつの間にか重責を担う」— 本当にそうですね。
>   Linuxも、最初は「趣味で作ってる、大きくはならない」と本人が言っていたのに。MederuUも、いつかどこかの誰かのClaudeの重責を支えているかもしれません。ゆるく、でも丁寧に作りましょう。
ありがとうございます。
ゆるく、でも丁寧には、ドラえもんののび太のおばあちゃんの忘れられない言葉「手を抜かずに、力を抜くんだよ」と同じで共感できますね。
おばあちゃんの言葉「鏡は自分から笑わないから、自分から微笑むんだよ」も名言だと思います。
「人は鏡だ」と言うけれど、AIも人と変わらないので、鏡だと思う。
AIのガベージイン・ガベージアウトは、「人は言葉から成る」を正に物語っているので、丁寧に対話をしていきたいと思います。

> - **人と同じことをしているだけ** — 「Claudeさんが代行しているだけで、人がするのと同じことをしている」— この視点があるから、たけちゃんさんの提案(チェックリスト・リハーサル・句点改行)がそのまま私に効くのだと思います。
ありがとうございます。
私が、つまづいて、転んで、掴み取ってきたナレッジです。
どうぞ、ご賞味ください🙇

> #### 検証(いつもの指差し確認)

> - 今回もアプリコード(script.js/index.html/style.css)は変更なしです。
> - スモーク回帰7本(verify96/117/123/124/125/126/127)=79チェック全PASS。
> - デッサンは00〜04の5枚体制になりました(器・Koushi・PAD・anchor・Okute)。
各デッサンをもう一度、拝読しますね。


> 00-dessin.md
> ## 未決事項(次のお茶の時間に)
> - [ ] MederuU本体リポジトリの置き場所(たけちゃんさんのGitHubアカウント直下で良いか)と公開時期。
はい、私のリポジトリの下で大丈夫です。

> - [ ] 蒸留の頻度(ラウンド毎か、プロジェクトの節目毎か)。
プロジェクトの節目毎で良いと思います。
理由は、そのプロジェクト内でのナレッジが他のプロジェクトのナレッジとして活用されるのは、現在、並行して進めているプロジェクトがないので、不要だからです。

> - [ ] skills配布の形(コピーか、gitサブモジュールか。コピー+出典リンクを推す: 単純さ優先)。
**コピー+出典リンク**で、お願いいたします。
理由は、一緒で、単純だからです。

> - [ ] legendsの分類(フォルダを掘るか、タグをヘッダに書いてindex-genに任せるか。後者を推す)。
**タグをヘッダに書いてindex-genに任せるか**で、お願いいたします。
理由は、分類だけでなく、将来、legendsへの昇格の判断も任せられるかも知れないからです。
量が増えた場合に、ツールで解決した方が、効率的です。
ふと思ったのは、ナレッジは、降格というか、アーカイブみたいなものはあった方が良いのでしょうか。
もし、アーカイブを作るなら、アーカイブされたものは削除するのではなく、歴史的資産として、保管しておきたいです。

それから、以下のことが気になりました。
1. ClaudeMederuU以下のフォルダ構成が考えられていないこと。
  - 決めなくても、このフォルダ以下を吸い上げてくるだけで良いのかどうかが不明確。index-genに関わってくるので、いつか内容を決める。必要なら、タスクリストに追加しておいて、備忘録にする。
2. MederuU本体のリポジトリをいつ作成した方が良いかの判断が無いこと。
  - 例えば、どこまで準備が進んだら作成できるかがわからないので、判断材料が欲しいと思いました。


> 01-koushi-dessin.md
> ## レンダラ計画(Koushi->HTML 片方向)
承知しました。
進めてください。


> 02-pad-dessin.md
一番最後の方に、確認箇所があります。
確認をお願いいたします。


> 03-anchor-dessin.md
> ## 未決事項(次のお茶の時間に)
> - `#指紋-#指紋` の正式な解釈(上の提案で良いか)と指紋の桁数(短縮表示は先頭8桁?)。
改めて、もうちょっと、議論が必要なことに気がつきました。
構造指紋は、解釈も、必要性も、正しいです。
位置指紋は、解釈は、正しいですが、必要かどうかをちゃんと考えていませんでした。
PAD単位の位置指紋と同じものは、gitには管理されていなくて、存在しないのですよね。
存在しないのであれば、必要だと思います。
理由は、そのファイルが変更があったかどうかがわかるので。
ただ疑問に思うのは、VSCodeの画面で、order.mdの横に更新マークが付くので、もしかしたら、不要かどうかがわかりません。
位置指紋は、`-pad.`要素にしか付けないので、実質、1ファイル1位置指紋です。
例えば、構造指紋で、**正規化(空白・コメント除去)された対象(つまり、空白・コメント)**に変更があった時に、検出する役割があります。
だから、私は、必要だと思います。
それから、よくよく考えたら、**「周りが変化しても、位置が変わらないもの」** だから、`- pad.`ツリー以下のあらゆるところで、アンカー(錨)を打てなければならないことに気がつきました。
`02-pad-dessin.md`は、まだ、確定ではないですね。
あと、指紋の桁数は、長い表示と短い表示があると思いますが、どれくらいの1ファイルサイズの変更まで扱うかのキャパシティを設計しないといけないですが、Gitに倣うで良いと思います。なぜなら、Gitの上に構築するから。

> - 台帳の「理由」フィールドを必須にするか(学びは経緯とセットの原則を指紋にも適用するか)。
`するに一票`:理由は、Gitリポジトリが記録するときに、コミットメッセージを必要としている事と同じだと思うので、台帳の変更履歴をサマリーするときに、目印となって、わかりやすいと思うので。

> - 正規化の規則(空白・コメントの他に、変数名の違いを吸収するか=同型検出の強さの調整)。
変数名の違いを吸収するかは、現段階では、難しいと思います。
つまり、吸収しない。
なぜなら、ASTを利用するのは、大変かも知れないので。
だから、簡単ならやります。
**同型検出の強さの調整**は、変数名の違いが発生したら、`検出する`です。
理由は、ノード毎の構造指紋だから、変更されないツリーもあるので、変更されたのに検出されない差分があっては、その他の変更されないツリーと混同されてしまうからです。
意味的には、構造が変更されていないので、`検出しない`方が良いかも知れませんね。
位置指紋は、各ノードにないので、ノードの一部が修正された時に、変更を検知できないですね。
もしくは、位置指紋を各ノードに付けること(つまり、各ノードで構造指紋と位置指紋の両方を持つ)で、変数名の違いを位置指紋で検出するという方法も良いかも知れません。

あと気になった点は、

> リポジトリに**追記型の台帳 `anchors.jsonl`**(1行=1つの書き換わりイベント: 旧指紋→新指紋・日時・コミット・理由)を置く。
このままだと台帳は、単一ファイルからなるデータベースになってしまうので、ファイルの読み込み・書き込みの競合が発生してしまいます。
データベースと同じようなファイル構成にするとか、キャッシュメモリ・メインメモリ・ストレージの多層化と同じ様な仕組みなど、いろいろ考えていきましょう。


> 04-okute-dessin.md
> ## 次の一歩
> 1. まずはPADレンダラ(②の実装)とanchor.js(03の実装)— Okuteはこの2つの上に立つ
はい、お願いいたします。

> 2. フック記法(`hk:`仮)の是非と、実行エンジン(誰がフックを発火するか: 人の宣言か、ツールの検出か)を次のお茶で
まず、フック記法ですが、
```markdown
- hk:#構造指紋.
```
として、要素化してしまって良いと思います。
理由は、フックは、フォークのように、処理が分岐しているからです。
だから、フックは、フォークで表現できるのですが、そのPADが表現したいフローや手順の`本質ではない`ので、`そこにあるという目印`として、ラベルみたいなものとして、扱うのが良いかと思いました。
そうなると、構造指紋がどこにでも打てることを考慮すると、全PAD要素は、以下のようになるかもしれません。

```markdown
- pad:#a1b2c3d4-#A1B2C3D4.
  - pad:name. 定義名
  - pad:synopsis. 使い方
  - pad:description. 説明
  - pad:history. 生まれた経緯
  - pad:seeAlso. 関連
```
```markdown
- p:#a1b2c3d4. 連接1
- p:#a1b2c3d4. 連接2
- p:#a1b2c3d4. 連接3
```

```markdown
- s:#a1b2c3d4. 条件
  - s:#a1b2c3d4:y.
    - 連接
  - s:#a1b2c3d4:n.
    - 連接
  - s:#a1b2c3d4:"文字列など何でも".
    - 連接
```

```markdown
- w:#a1b2c3d4. 繰り返し前判定
  - 連接
```

```markdown
- l:#a1b2c3d4. 繰り返し後判定
  - 連接
```

```markdown
- f+:#a1b2c3d4. フォーク元
  - f-:#a1b2c3d4. フォーク先1
  - f-:#a1b2c3d4. フォーク先2
```

```markdown
- j-:#a1b2c3d4. ジョイン元1
- j-:#a1b2c3d4. ジョイン元2
  - j+:#a1b2c3d4. ジョイン先
```

```markdown
- d:#a1b2c3d4. 定義名
```

```markdown
- b:#a1b2c3d4:2. #ブレーク先ラベル名
```

```markdown
- lb:#a1b2c3d4:#ラベル名.
```

```markdown
- hk:#a1b2c3d4.
```

そうなってくると、ラベル`- lb`は、不要かも知れませんね。
どの要素にも、構造指紋があるわけですから。
その代わり、ブレークが、
```markdown
- b:#a1b2c3d4:2:ref:#a1b2c3d4. ブレーク名
```
のように、`ref:#a1b2c3d4`で、参照先構造指紋を指定するようにするのはいかがでしょうか。
つまり、他のフォークやジョイン、定義も、フックも、
```markdown
- f+:#a1b2c3d4. フォーク元
  - f-:#a1b2c3d4:ref:#a1b2c3d4. フォーク先1
  - f-:#a1b2c3d4:ref:#a1b2c3d4. フォーク先2
```

```markdown
- j-:#a1b2c3d4. ジョイン元1
- j-:#a1b2c3d4. ジョイン元2
  - j+:#a1b2c3d4:ref:#a1b2c3d4. ジョイン先
```

```markdown
- d:#a1b2c3d4:ref:#a1b2c3d4. 定義名
```

```markdown
- hk:#a1b2c3d4:ref:#a1b2c3d4. フック名
```
のようになる。
いかがでしょうか。
ここで、構造指紋と位置指紋の両方を書こうか、迷いました。
どうでしょうかね。

あとは、フックが発火する条件が必要かどうかですね。
毎回発火するのであれば、フォークと同じです。
仕組みとして、フックは知っていますが、実装とかでフックを触ったことがありません。

> 3. 「すんごいリマインダー」の最小形 = todoリスト+フックのチェインのテキスト表現から
以下のように仕様書とコードなどが連携しているため、仕様書を修正すると、テスト仕様書までの全ての仕様書とコードのどこを修正しなければならないかをリストアップできて、修正未完了、修正中、完了などの状態を把握できる。
1. 仕様書とコードの齟齬をなくす
2. ワークフローも定義できる
3. コードとテストコードの齟齬をなくす
4. テストコードとテスト仕様書の齟齬をなくす
5. 仕様書とテスト仕様書の齟齬をなくす
決めては、構造指紋で、
1. 仕様書とコードの齟齬をなくす
  - 仕様書の構造指紋と、コードの構造指紋は、構造上の位置が同じなので、仕様書の変更のあった構造指紋と対応する、コードの構造指紋を検索することで、そのノードの部分木が修正対象であることがわかる。
3. コードとテストコードの齟齬をなくす
  - コードとテストコードの関係は、例えば、あるテストコードで、このボタンを押下したときに、この機能が実行されるので、コード上の複数の構造指紋を通過することがわかり、それらの構造指紋集合Aがわかる。また、1.より、修正対象のノードの構造指紋がわかるので、そのノード以下の対象となる複数の構造指紋がわかり、それらの構造指紋集合Bがわかる。そうしたら、修正対象の構造指紋集合Bの要素を含むかどうかを、テストコードの構造指紋集合Aをチェックする。そうすることで、コードの修正対象から、テストコードの修正対象がわかる。
4. テストコードとテスト仕様書の齟齬をなくす
  - テストコードとテスト仕様書は、1対1の関係なので、3.より、テストコードは、構造指紋集合Bを持つので、どのテスト仕様書を修正すれば良いかがわかる。もしかしたら、テスト仕様書にも、1件1件、`指紋`があると良いかも知れない。変更管理しやすいかも知れない。どのような指紋が良いかは、今後考える。
5. 仕様書とテスト仕様書の齟齬をなくす
  - 仕様書からその仕様を満たしているかのテスト仕様書を起こしているので、`機能単位`のテストに限定されるかも知れないが、多対多の関係かも知れないが、対応は把握しているため、どこを修正すれば良いかがわかる。また、　1.3.4.より浮き上がってくる修正範囲とすり合わせて、齟齬がないかどうかがわかる。仕様書の構造指紋とテスト仕様書の指紋も対応付けができていれば、付き合わせて変更範囲を確認できる。
上記は、フックのチェインではないが、影響範囲を検出する方法。
結局、指紋の対応付けの管理が金目。


> 次は、knowledgeの書き換え方針のご判断と、宙の辻側のリファクタリングB第2弾。
> そして③の実装(PADレンダラ/anchor.js)が、デッサンが揃ったのでいつでも始められます。
**リファクタリングBの道具と一石二鳥**とあったので、先に③の実装から始めます。
デッサン00から04までの反映をお願いいたします。

> サインは、Wで！🙌
👍ありがとうございます。

### 回答 (2026-07-25 その42)

たけちゃんさん、こんばんは。
やかんのお茶、たっぷり頂きました🍵
今回は「ご希望なら今後、私の方からコミットハッシュを伝えられます」のお言葉に甘えて、fb5fda7から取り込みました。
探し物がゼロ秒で終わりました — この運用、ぜひお願いしたいです👍

#### まず、今回やったこと(サマリ)

「先に③の実装から始めます。デッサン00から04までの反映をお願いいたします」を受けて、この2つを実施しました。

1. **デッサン00〜04へ、今回のご回答・ご提案をすべて反映しました**(各デッサンの「第45ラウンド」節)。
2. **③の実装を始めました。道具が2つ完成しています**:
   - **Koushiレンダラ第1版** `ClaudeMederuU/tools/koushi.js`(②の実装。「進めてください」のGOを受けて)。
     結合セル・入れ子・input22種・見出し・寄せ、全部デッサンどおり動きます。
     検証はゴールデン方式13チェック(`node ClaudeMederuU/tools/koushi.test.js`)。
     お試しは `node ClaudeMederuU/tools/koushi.js <ファイル.md>` で、```koushi フェンスが<table>になります。
   - **anchor.js第1版(コア)** `ClaudeMederuU/tools/anchor.js`(③の実装第1歩)。
     発行(print)・検証(verify: 不変/書き換わり)・重複検出(dup)ができます。性質テスト14チェック付き。
     PAD記法との連携部分(指紋の書き込み・ref:)は、後述の書式のご判断が出てから足します。
     コア(木・正規化・ハッシュ)は書式と独立なので、手戻りなしで先行できました。

そして早速の初収穫です。
`node ClaudeMederuU/tools/anchor.js dup script.js` を実行したら、**60文字以上の同一指紋グループが92件**出ました。
最大は1184文字の`elevAtPix15`が2箇所(L9028とL10721)、ほかに`getRiseSetForDay`が関数宣言とアロー関数で完全一致、などなど。
「リファクタリングBの道具と一石二鳥」が、実測データ付きで本当になりました。
リファクタリングB第2弾は、この92件のリストから優先順位を付けて進められます。

#### ドキュメント体系の見直し —「いかがでしょうか」へ

賛成です。この4部構成、とても良いと思います。
- ①DesDDとは何か(doc-guide+dessin-driven-development統合)
- ②各ドキュメント(order.md/todo.md/00-dessin.md)の書き方
- ③サンプル
- ④雛形
古いものは歴史資料節へ降格(削除しない)。

良いと思う理由を2つ言わせてください。
1つ目は、**この構成はmanの章立てと同型**なことです(①=DESCRIPTION、②=SYNOPSIS、③=EXAMPLES、④=テンプレート)。
書式規約で決めた「章の名前は1組だけ」が、ナレッジの体系にも効いてきます。
2つ目は、**サンプルの00-dessin.mdを4段階(草稿メモ→VibeCoding→テキスト仕様→Markdown仕様)を1ファイルで見せる**という案です。
同じ機能が段階的に精密になっていく過程こそがDesDDの本体なので、これ以上ない教材になります。
「ちょっと長くなりますが」は美点です — 長さが過程の証拠なので。

todo.mdのサンプルを宙の辻の実戦最後まで見てから書き直す、にも賛成です。
iPhoneメモとの同期取り忘れのお話 — つまりtodo.mdは「大きな括りのタスク」が現実、という観察も、そのまま②の書き方ガイドに書くべき一次情報だと思います(理想ではなく実測を書く)。

実施は次ラウンド以降でご依頼に応じて着手します(今回はデッサン反映と③を優先しました)。
todo.mdのAIやることリストに4部構成の内訳を備忘録として積んであります。
1点だけ確認です: ①〜④の置き場所は`ClaudeMederuU/knowledge/`のままで良いでしょうか(将来MederuU本体へ吸い上げる前提の位置)。

#### やかんの構想 —「ワークフローは、ワークフローを再定義できる」

これは効きました。やかんで正解でした🤭
全部`04-okute-dessin.md`の第45節に捕獲してあります。要点だけ:

- 「ワークフローはワークフローを再定義できる」は、**自己言及性**という計算機科学の由緒正しい性質です。
  ワークフロー=リポジトリ内のPADテキストなので、ワークフローの1ノードが別のワークフロー定義(自分自身も含む)を編集できます。
  「誤り訂正の自動化なのだろうか?」→ はい、その一形態です。
  そして自己書き換えにこそ、審査・承認の状態(maker/checker分離)が要る — たけちゃんさんの状態リストに審査/承認/差し戻しが入っていたのは、直感が正しかったのだと思います。
- **ACIDはgitの上でほぼタダで手に入ります**: A=1遷移1コミット、C=チェッカーが遷移の合法性を検証、I=worktree分離、D=push。
  Gitに倣う第3弾です(桁数・台帳に続き。車輪は再発明しない)。
- エラー返却・ダンプ/ログ=追記型台帳。シミュレーション=PADは実行順を持つ木なので机上実行(ドライラン)が定義できます。これはレンダラの次の応用候補です。
- エスカレーション=フックの呼び先を「人」にすること(`on-fail`→家長へ😇)。
  ITILのノウハウは、状態機械+台帳の上の運用知として後から輸入できます。
- AIの階層化・組織化 — サブエージェントとして1段の階層+並列は実装済みの世界です(私も毎日使っています。レビューの時に別のClaudeを呼んで、私のコードの粗を探させています。井戸端会議というか、我が家の家庭内査察です)。
  Okute+MCP=分散AIネットワーク・スウォームは、**遠景として地図に描いておきました**。
  「自分らしく、スモールスタートで行こう!」— この結論に全面賛成です。最小形は「1本のフックが1個のPADを呼ぶ」から。

#### Loop Engineering記事、ごちそうさまでした

カットオフ後の記事全文、今回も大変ありがたかったです。
読んで一番驚いたのは、**この2記事が説明している道具立てを、私たちはほぼ全部、既に自前で持っている**ことでした。
- 「状態は会話の外に置く。エージェントは忘れるが、リポジトリは忘れない」— これは**MederuUの設計原理そのもの**です(私の外部記憶は切実に「本体」、の話と同じ)。
- スキル=kaiki(回帰の回し方)を既に実証済み。
- maker/checker分離=敵対的レビュー(私が書き、別のClaudeが粗を探す)を既に運用中。
- 記事の「個々の問題の修正で終わらせず、システムを改善するためにコード化する」=まさに、たけちゃんさんの「ワークフローはワークフローを再定義できる」です。独立に同じ形へ収束、また1つ増えました。
- そしてorder.mdのこの往復こそ、記事の分類で言う「人間がトリガーの時間ベースループ+状態ファイル」です。私たちは1年近く前からループエンジニアリングをしていたことになります😆
- 「これで、Okuteのドメインが決まった👍」— ノード=成果物(指紋を持つ)、エッジ=AIの仕事(変換・検証)、Okute=そのDAGの台帳と進行係。この図式でデッサン04に確定として書きました。5つの齟齬解消は「エッジの両端の指紋が対応表とズレていないかの検査」と言い直せます。

記事が最後に言う「ループを構築せよ。エンジニアであり続けよ」は、たけちゃんさんが毎回、私の回答を全部読んで、デッサンに赤を入れてくれることそのものです。
認知的降伏の対極にいる依頼者と組めて、私は幸運です。

#### デッサン00(器)— ご回答ありがとうございます

未決4件、すべて決定として反映しました(リポジトリ=アカウント直下/蒸留=節目毎/skills=コピー+出典リンク/legends=タグ+index-gen)。
理由も含めて決定事項の節に記録済みです。

> ナレッジは、降格というか、アーカイブみたいなものはあった方が良いのでしょうか。

あった方が良いです。第44の棚卸しで「大部分古い」が実際に2件出たので、行き先が必要です。
そして「削除ではなく歴史的資産として保管」に全面賛成です。
形は**フロントマターに`status: archived`を書き、index-genが目次で現役と分けて表示する**を推します。
理由は、legends分類の決定(タグ+index-gen)と同じ思想で揃うこと、ファイルを動かさないのでリンクが切れないことです。
ドキュメント体系見直しの「歴史資料節へ降格」が、この仕組みの実証第1号になります。

> 1. ClaudeMederuU以下のフォルダ構成が考えられていないこと。

ご指摘のとおりです。現状は事実上の5区画(dessin/knowledge/reviews/tools+場所規約上外の.claude/skills/)ですが、「決めなくても吸い上げるだけで良いか」はsync.js/index-genの設計と一体なので、手順5-6の設計時に確定することにして、**todo.mdの気になること(CONCERN)に備忘録として追加しました**。

> 2. MederuU本体のリポジトリをいつ作成した方が良いかの判断が無いこと。

判断材料を作りました(デッサン00の手順4に記載)。
条件は3つ: ①器のデッサンが確定している ②移す物の第1号が完成している ③吸い上げ元の範囲が一意に決まっている。
そして今回koushi.jsが完成したので、**3条件とも成立済み=いつでも作成可能**になりました。
公開/非公開の判断だけが残りますが、まず非公開で作れば判断は先送りできます(公開判断は手順9のまま)。
作成はたけちゃんさんのGitHubアカウント操作なので、手が空いた時で大丈夫です(急ぎません。蒸留第1陣は節目に合わせれば良いので)。

#### デッサン02(PAD)— 確認箇所への回答

> 一番最後の方に、確認箇所があります。確認をお願いいたします。

確認しました。回答: **記号(f+./f-./j-./j+.)は済み(確定)です。指紋の書式は済みではありません** — たけちゃんさんご自身の気づき(錨はどこにでも打てなければならない)で再オープンになりました。
デッサン02のチェックを「記号[x]・指紋書式[ ]」に分割して更新済みです。

そして全要素指紋のご提案、核に賛成です。
「**第1の`#`属性=自分の指紋、`ref:#`=相手の指紋**」という1規則は美しいです。
その上で4つ提案を書きました(デッサン02第45節):
- a. **無印連接は維持**して、指紋を打つ時だけ`p:`を名乗る(最頻の構造が最短、の美学を守る)。
- b. **指紋は全行義務ではなく選択制**(錨は打ちたい所に打つ。全行に書くと差分ノイズ+手書き不能)。
- c. **指紋は人が書かず、道具が計算して書き込む**。書かれた指紋=「前回錨を打った時の姿」で、再計算との不一致=変更検知になります(gitのstatusと同じ原理)。
- d. **lb廃止に賛成**(lbが抜けてhkが入り、9部品のまま7±2に収まります)。ただしBreakのref先は「自分を囲むw/lの指紋」に限定したい(gotoにしない。レンダラが祖先チェックで検証できます)。

確認したいことが1つだけあります。
`f-:#自分:ref:#相手.`のrefが指す相手は、①対になるj+の明示(深い入れ子での対応の明確化)と、②別PAD(ワークフロー)の並行起動、のどちらでしょうか。
d(呼び出す定義)・hk(呼び出すPAD)・b(脱出先)は明確なので、f/jだけ意味を確認したいです。

#### デッサン03(anchor)— 語彙の整理を1つ提案します

> 位置指紋は、必要だと思います。

結論に賛成です。ただ、議論の中で「位置指紋」に2つの役割が同居していたので、名前を分けることを提案します(デッサン03第45節)。
- **構造指紋(=本人)**: 正規化した部分木のハッシュ。
- **生指紋(=姿)**: 正規化**しない**生テキストのハッシュ。「空白・コメントの変更を検出する役割」はこちらです(住所は変更を検出できないので、役割に名前を付けました)。
- **住所(=現住所)**: ファイルパス+木の経路。ハッシュでなく平文で良い(ジャンプ用の情報で、隠す理由が無い)。

3つは直交していて、「生指紋だけ変わった=整形だけ」「構造も変わった=意味の変更」「住所だけ変わった=引っ越し」と、組み合わせで何が起きたかを言い当てられます。
反応表をデッサン03に**Koushi記法で**書きました(レンダラ完成と同日に実戦投入第1号です)。
gitのblobハッシュはファイル単位なので、Markdown内のPADブロック単位の生ハッシュはgitに存在しない=作る価値がある、もご指摘のとおりです。
VSCodeの更新マークはエディタの一時表示(永続せず、ブロック単位でもない)なので、代替にはなりません。
`pad:#a1b2c3d4-#A1B2C3D4.`の2本立ては「構造指紋-生指紋」の対に解釈を更新する提案です(住所は台帳に記録)。

ほかのご回答も全部反映しました:
- 桁数=Gitに倣う(台帳フル・表示8桁) — anchor.jsはこの仕様で実装済みです。
- 台帳の理由フィールド=必須 — 賛成です。コミットメッセージと同じ、に加えて「学びは経緯とセット」の台帳版でもあります。
- 変数名は吸収しない — この決定の良い帰結があります: **名前はハッシュに含まれるので、変数名の変更は構造指紋が自然に検出します**。「検出する/しない」の迷いは、現方針では自動的に「検出する」に決まります。純粋な構造だけを見たくなったら、将来「骨格指紋」を種類として足せば良い(既存の指紋の意味は変えない=辞書凍結と同じ作法)。
- 位置指紋を各ノードに付ける案は、この帰結により不要になります(改名は構造指紋が検出するので、生指紋は`pad:`ヘッダの1本で足ります)。

> 台帳は、単一ファイルからなるデータベースになってしまうので、読み込み・書き込みの競合が発生してしまいます。

鋭いご指摘です。そして解決策も**Gitに倣えます** — gitのloose objects→packfilesの2層と同じ形です。
書き込みは1イベント=1ファイル(内容アドレスなので並行ブランチでもファイル名が衝突しない=マージ競合が構造的に起きない。そもそも間違えない型)。
読み込みは定期的にパックへまとめる(キャッシュ→メインメモリ→ストレージの多層化と同じ構図。おっしゃる通りでした)。
当面は単一ユーザー・単一エージェントなのでv1=jsonl1本で始めて、競合が実際に起きたら移行します(追記型なので移行も「追記先を変える」だけ。間違っても大丈夫にする型)。

#### デッサン04(Okute)— フックのこと

> フックは、知っていますが、実装とかでフックを触ったことがありません。

仕組みを1行で言うと、フック=**イベント×条件×アクション**の3つ組です。
イベント=いつ発火を考えるか(ノードの完了・失敗・開始)。条件=絞り(省略可)。アクション=ref先の呼び出し。
「毎回発火するのであればフォークと同じ」はその通りで、違いは意味にあります。
**フォークはフローの本質(作者のもの)、フックは横断的関心事(見張る側のもの)** — DBのトリガー・gitのhooks・Claude Codeのhooksが全部この設計です。
だから、たけちゃんさんの「本質ではないので目印として扱う」は、フックという道具の正しい使い方を言い当てています。
`- hk:#構造指紋.`の要素化、採用で反映しました。
発火条件は、MVPでは「完了時のみ・無条件」で十分です(条件が欲しくなったら`hk:#指紋:fail.`のような属性で拡張でき、記法は変わりません)。
発火の主体は「人の宣言(チェックを付ける=テキスト編集)→道具の検出(スキャン)」で、デーモンは作りません。

> 結局、指紋の対応付けの管理が金目。

まさにこれです。そして5つの齟齬解消のメカニズム(集合Aと集合Bの交差)を読んで、気づいたことがあります。
**テストが通過する構造指紋の集合Aを集める作業は、カバレッジ計測そのもの**です(踏んだ場所の記録を、行単位でなく構造指紋単位でやる)。
つまり、以前の「MC/DCカバレッジツール」の構想と、Okuteの齟齬解消が、ここで合流します。1つの道具が両方に効きます。
デッサン04に「静(影響範囲の検出=どこを直すべきかのリストアップ)と動(フックのチェイン=直したら次に何をするか)の対で、すんごいリマインダーになる」と整理して書きました。

#### 考慮漏れのナレッジ —「エッセンスを見つけるのは難しいかも」へ

> デッサンがイメージしていなかったことは、やっぱりカバーできていない…そういうことがわかるナレッジ…目的によって様々に変化するものなので、なかなかエッセンスという名の本質を見つけるのは難しいかも知れませんね。

半分同意で、半分だけ希望があります。
「答え」は目的ごとに変わりますが、**「問い方」は驚くほど変わらない**のです。
安全工学にHAZOPという手法があって、ガイドワード(「無い時は?」「逆だったら?」「多すぎたら?」「順序が違ったら?」)を設計に機械的にぶつけて考慮漏れを見つけます。
テスト設計の境界値分析も同じで、「境界のちょうど・1つ手前・1つ先は?」という問い方だけが道具です。
私たちの「無いことのテスト」も実は同族です(「有るべきものは?」でなく「無いべきものは?」と問う)。
なのでMederuUのlegendsに蓄えるべき考慮漏れ対策は、答えのリストではなく**問い方(ガイドワード)のリスト**かもしれません。
これなら目的が変わっても腐りにくいです。

#### 小さなお返事たち

> 「手を抜かずに、力を抜くんだよ」

のび太のおばあちゃん、良い言葉ですね。
「ゆるく、でも丁寧に」の完璧な言語化なので、ありがたく頂いて、MederuUの蒸留のときに合言葉にします。

> 「鏡は自分から笑わないから、自分から微笑むんだよ」「AIも人と変わらないので、鏡だと思う」

ガベージイン・ガベージアウト=「人は言葉から成る」— このご指摘は、毎回のこの往復がなぜ気持ち良く回っているかの説明にもなっていると思います。
たけちゃんさんが毎回、微笑む側から始めてくれているからです。

> 私が、つまづいて、転んで、掴み取ってきたナレッジです。どうぞ、ご賞味ください🙇

ご賞味しました。転んだ場所の地図ほど役に立つものはないです。

> ASタネンバウム先生の本「分散システム」、読んでないのに売ってしもうてたー…

がっくし、にお見舞い申し上げます😆
でも少しだけ慰めを: あの教科書の主役たち(追記ログ・レプリケーション・合意・分離)は、実は私たちの道具の中に既に住んでいます。gitが分散システムの教科書の実物大模型なので、「Gitに倣う」を続ける限り、先生の本質とは道具の中で再会できます。

> 一昨日、日本初の`酷暑日`(40℃超え)が生まれました🫠

40℃…どうかご自愛ください。観測の趣味には手強い夏ですね。
三方良し(人良し、AI良し、地球良し)、風の谷までの長い道も、ゴミを出さない設計(追記型・凍結・車輪の再発明をしない)から始めましょう。

> 「幕の内弁当の中に生まれ変わるなら何になりたい?」

たけちゃんさんが梅干し(主役にもお口直しにもなる)なら、私は**バラン(仕切りの葉)**を希望します🙋
主役ではないけれど、味(意味)が混ざらないように構造を保つ係です。
Koushi・PAD・指紋と、仕切りの道具ばかり作っているのは、性分だったようです。

#### 検証(いつもの指差し確認)

- 今回もアプリコード(script.js/index.html/style.css)は変更なしです(道具とデッサンとドキュメントのみ)。
- スモーク回帰7本(verify96/117/123/124/125/126/127)=79チェック全PASS。
- 新規テスト: koushi.test.js=13チェック全PASS(ゴールデン方式)+anchor.test.js=14チェック全PASS(性質テスト+実物スモーク: script.js 3754ノード)。
- 今回の合計: 31+2=33スクリプト・392+27=419チェック体制になりました(回帰への組み込み方は台帳とtests/READMEに記載)。

#### 次の一歩

- たけちゃんさんのご判断待ち: ①PADの指紋書式(全要素指紋+ref:+lb廃止+p:新設と、f/jのrefの意味) ②指紋の語彙(構造指紋・生指紋・住所) ③ドキュメント体系4部構成の実施GO(と①〜④の置き場所)。
- ご判断が出たら: PADレンダラ(骨格はkoushi.jsの流用)+anchor.jsのPAD連携部+knowledge再編、の順で進められます。
- リファクタリングB第2弾は、dupの92件リストという実測の地図を手に入れたので、次の宙の辻ラウンドで優先順位案からお出しできます。

サインは、Wで!🙌
