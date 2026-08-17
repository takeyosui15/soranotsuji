# レビュー記録 2026-07-23 — 第42ラウンド差分(v1.44.0 お茶の時間②+リファクタリングB第1弾)

依頼: ①MederuUデッサンの図をMarkdown箇条書きへ(ASCII罫線はインデント崩れ)+ClaudeMederuU/
フォルダ方針+Doc文化(JSDoc等)との両立 ②Koushiのデッサン ③リファクタリングB(重複の関数化)。
依頼者提案の「移行チェックリスト」方式を初採用(大きめのリファクタはチェックリストで
プロセスを明確にし、順序の不整合を検知する)。

## お茶の時間②の成果物

1. **Koushiのデッサン**(ClaudeMederuU/dessin/01-koushi-dessin.md) — `.`終端・`:`区切りの確定記法、
   スパン(xc/xr)・寄せ(l/c/r/t/m/b)、入れ子・セル内Markdown・input要素、レンダラ計画
   (Koushi→HTML片方向・ゴールデン方式)、未決4点。
2. **Markdown-PAD記法の捕獲**(ClaudeMederuU/dessin/02-pad-dessin.md) — 依頼者原案(7構造+f./j.)を
   新鮮なうちに記録+所感(行頭記号の意味付けはMarkdown仕様と相談・論点3つ)。
3. **MederuUデッサン更新**(00-dessin.md) — 図2つをMarkdown箇条書き/Markdown-PADへ書き換え・
   ClaudeMederuU/フォルダ方針・JSDoc/docstringとの両立(章立て=man由来、入れ物=言語の慣用)。

## リファクタリングB 第1弾: ファイル入出力の型(1候補=1コミット)

測定: 「ファイル選択+読込」の殻が9箇所、「CSV行分割」が8箇所、「Blob→ダウンロード」の
末尾6行が8箇所で完全に重複(grepの一覧はチェックリスト参照)。
抽出: `pickTextFile(accept, onText)` / `splitCsvLines(text)` / `downloadTextFile(filename, text, mime)`。
エラー処理・確認ダイアログは呼び出し側の責務のまま(挙動不変)。
除外: `soraExportDownload`(動画/画像Blob用の遅延revoke版=既に関数)・動画/画像の
createObjectURL 2箇所(用途が異なる)。

### 移行チェックリスト(依頼者提案の初採用。Koushi記法の実証第1号)

```koushi
- t:1.
  - r:1:h.
    - c:1. 対象関数
    - c:2. 種別
    - c:3. <checkbox/>置換
    - c:4. <checkbox/>検証
  - r:2.
    - c:1. importMyStarsCsv
    - c:2. 入力+行分割
    - c:3.
      - chb:on.
    - c:4.
      - chb:on.
  - r:3.
    - c:1. appendMyStarsCsv
    - c:2. 入力+行分割
    - c:3.
      - chb:on.
    - c:4.
      - chb:on.
  - r:4.
    - c:1. importBackup
    - c:2. 入力(.json)
    - c:3.
      - chb:on.
    - c:4.
      - chb:on.
  - r:5.
    - c:1. importMyPointsCsv / appendMyPointsCsv
    - c:2. 入力+行分割
    - c:3.
      - chb:on.
    - c:4.
      - chb:on.
  - r:6.
    - c:1. importMyTsujiCsv / appendMyTsujiCsv
    - c:2. 入力+行分割
    - c:3.
      - chb:on.
    - c:4.
      - chb:on.
  - r:7.
    - c:1. importMySoraCsv / appendMySoraCsv
    - c:2. 入力+行分割(String(reader.result)変種)
    - c:3.
      - chb:on.
    - c:4.
      - chb:on.
  - r:8.
    - c:1. exportMyStarsCsv / exportMyPointsCsv / exportMyTsujiCsv / exportMySoraCsv
    - c:2. 出力
    - c:3.
      - chb:on.
    - c:4.
      - chb:on.
  - r:9.
    - c:1. exportBackup
    - c:2. 出力(.json・mime指定)
    - c:3.
      - chb:on.
    - c:4.
      - chb:on.
  - r:10.
    - c:1. downloadTsujiResultCsv / ssDownloadCsv / mySoraDownloadCsv
    - c:2. 出力
    - c:3.
      - chb:on.
    - c:4.
      - chb:on.
  - r:11.
    - c:1. 殻の残骸ゼロ確認(createElement('input')=1箇所・text系createObjectURL=1箇所)
    - c:2. 無いことのテスト
    - c:3.
      - chb:on.
    - c:4.
      - chb:on.
```

(チェック手順: 置換→node --check→対象verify→全て終えたら回帰。検証列は対象verifyのPASSで✓)

## 残したB候補の調査記録(次のBコミットの材料)

- 時刻フィルタUI組み立て: **済み**(buildTimeGroupHtmlFor へ既に共通化済み=候補から消し込み)
- My観測点/My目的点の行操作・リスト描画: myPointConfigで主要部は共通化済み。残りは次回計測
- ポップアップHTML組み立て: 次回計測

## 見つけた変種と対処(チェックリストが効いた箇所)

- **async変種**: My観測点/My目的点のCSV入力は`onchange`/`onload`が`async`(取込後に標高を
  awaitで再取得するため)。一括置換の1回目がこの2箇所だけ不一致で止まり、パターンの見落としを
  教えてくれた(async許容+コールバックへ引き継ぎで対処)。
- **本体直接参照の変種**: importBackupは`const text=...`を経由せず`JSON.parse(ev.target.result)`を
  直接参照していた。置換の残骸検査(ev.target.result残数)が検出(本体内の参照もtextへ置換)。
- **テスト側の学び**: `blob.text()`はUTF-8のBOMを仕様どおり剥がして返す。BOMの存在確認は
  `arrayBuffer()`のバイト列(EF BB BF)で行う(verify127 O5の自作テストバグとして検出・修正)。

## 学び

- **移行チェックリスト方式(依頼者提案)は置換の「途中で止まる勇気」をくれる** — 一括置換の
  カウント不一致(9箇所中7箇所)を異常として即検知でき、async変種の見落としが本番前に見えた。
  リハーサル的に「置換数の期待値」を先に書いておくのが肝(期待値がないと7でも通ってしまう)。
- **殻の関数化は「境界の責務」を動かさない** — エラー処理・確認ダイアログを呼び出し側に
  残したことで、9箇所の挙動差(try/catchの有無・メッセージ差)がそのまま保存された。
  共通化は「同じ形の部分だけ」を最小で括るのが安全。
- **無いことのテストが再増殖を防ぐ** — 殻のボイラープレートは書きやすいのでまた生えてくる。
  verify127のカウント表明(input=1/FileReader=1/createObjectURL=4)が防波堤になる。

## 検証

- verify127(9チェック): 無いことのテスト4+版数2+端到端3(CSV出力のファイル名/BOMバイト/行内容・
  CSV入力のコメント行スキップ+登録・ページエラーなし)。
- CSV/バックアップ関連の先行確認: verify98(40)・verify105(10)・verify110(14)・verify123(10)全PASS。
- 回帰: 全31本(verify96〜127。verify102除く)=392チェック、全PASS(FAIL 0件)。
