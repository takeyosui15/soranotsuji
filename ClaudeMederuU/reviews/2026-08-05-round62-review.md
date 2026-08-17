# レビュー記録 2026-08-05 — 第62ラウンド差分(結果コントロール一括+曜日URLキーv14+リストCSV45列 v1.57.0)

依頼: ①曜日フィルタのURLキー作成(キー名はClaudeが英語で) ②My辻リストCSVの曜日列は
「28列目:終了前後時刻と29列目:精度フィルタの間」に挿入(依頼者指定) ③主役=結果コントロールメニュー
(辻検索/辻メッシュ/My辻一括の3パネル・仕様凍結済み・GO受領)。

## 実施内容

1. **URLキー①** — tsujiDow系/tsujiMeshDow系16キーを3つのURL取得(辻検索/辻メッシュ/My辻)+復元へ。
   短縮URL辞書はv14新設(「&キー名=false」の16シード。v13以前は凍結)。デッサン00のURL表を更新。
2. **リストCSV②** — 29〜36列目に曜日8列(列名は「曜日月フィルタ」形)を挿入し37→45列。
   パーサはhasDow(≧45列)+di=8の列シフトで、21/36/37列の旧形式を列数判別のまま互換。デッサン10更新。
3. **結果コントロール③** — 共通部品を1式で3パネルへ:
   - _resCtlRead/Set/FromAppState/AllOff/UpdateEnable/Reapply(+_resCtlInitで配線。時間グループは
     buildTimeGroupHtmlForをtsujires/tsujimeshresプレフィックスで再利用)。
   - 辻検索: startTsujiSearchの表示部を_tsujiRenderResultsへ切り出し(生結果totalResults+文脈ctxを
     _tsujiResRawに保持→フィルタはFから)。My辻: 表示部を_myTsujiRenderResultsへ切り出し+
     _myTsujiResPass(追加絞り込み・全オフ始まり。decorateにtwを載せて時間フィルタ再判定を可能に)。
     辻メッシュ: 行構築ループを_tmBuildRowsへ切り出し(_tsujiMeshCalcベース・F適用+行の標高絞り込み追加)。
   - File出力: 辻検索=生結果→_pushMyTsujiResults→再decorate→共通66列/My辻=絞り込み後の行/
     メッシュ=_tmExportMeshRowsCsv(現在行)。
4. **検証** — verify140=17チェック(スナップショット独立コピー・再導出・メニュー不変・My辻の5フィルタ・
   メッシュ再導出・File66列・URL v14往復・CSV45列往復+37列互換)。意図更新3本:
   verify124 L2(辞書網羅にv14キー)・verify125 M0/M4(14版+v14ゴールデン新設。v13ゴールデンは
   「復号のみ」の凍結保証として残す=発行済みURLの保証が試験として生き続ける)・verify135 W1(呼出4)。
   スモーク+98+136〜139+道具、全PASS。

## 学び(次の私へ)

- **「*/」は第40の教訓の再演** — Version Historyに「tsujiDow*/tsujiMeshDow*」と書いてブロックコメントが
  閉じ、script.js全体が死んだ。node --checkが即検知(kaikiの手順が効いた)。日本語文中でもワイルドカード
  表記に*/が現れる。コメント内の連続文字「*/」は表記を変える(「系」「〜」)。
- **辞書の版上げは「エンコードは最新・デコードは全版」の一方通行** — 追加はシード配列の末尾concat+
  版配列へ追記だけ。凍結保証はゴールデンを「復号のみのテスト」に降格して残すと、発行済みURLの
  保証が試験として生き続ける。
- **3パネルの結果コントロールは「DOMがフィルタ状態の唯一の置き場」方式が軽い** — スナップショットは
  DOMへ書き、再導出は毎回DOMから読む(_resCtlRead)。appStateに載せない=保存・URL・リンター
  (verify123)に一切波及しない。
- **切り出しリファクタはpythonの文字列手術+アンカーassert** — 3つの大ブロック(辻検索表示・My辻表示・
  メッシュ行構築)をregex/replaceで移設。全assertが通ってから書き込む(部分適用を作らない)。

## 検証結果

- verify140(新規)=17チェック全PASS。
- スモーク7本+verify98=40+verify135〜139+道具2本、全PASS(124/125/135は意図更新)。
- 版数ピン: verify140がv1.57.0を保持。verify139は存在チェックへ緩和。
- 短縮URL: v14ゴールデン(qp-v14-golden.json)新設・v13ゴールデン(qp-v13-golden.json)は復号のみで維持。
