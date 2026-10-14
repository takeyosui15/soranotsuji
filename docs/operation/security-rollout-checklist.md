# v1.98.0(セキュリティ対策)を確かめて配るまでの手順書 — 一つ一つ

作成日: 2026-10-12(第160ラウンド)
対象: 第159ラウンドの変更(v1.98.0)。詳しい中身は `docs/dessin/dessin/34-security.md`、経緯は `docs/order.md`(回答その157。後日 `docs/order-log/` へ保管される)。
この時点の実機: 本番 `https://soranotsuji.net` = v1.87.0(2026-08-23デプロイ)、開発サイト `https://takeyosui15.github.io/soranotsuji-dev/` = v1.97.0。

## 0. 先に知っておくこと

- **今、何も壊れていない。** 本番も開発サイトも、第159の前のまま動いている。第159の変更は「守りを足す」だけで、機能は変えていない。
- **どの段にも戻し方がある。** 下の表に書いてある。本番に触るのは最後の段で、それも `deploy-guide.md` のロールバック(数分)で戻せる。
- **順番は「影響の小さい所から」。** 自分のPC → 開発サイト → 設定 → 本番。
- **一段ごとに結果を送る。** 「A: はい」「B3: いいえ(404のまま)」のように番号で書いて、`docs/order.md` に貼れば、次の段へ進むかを一緒に決められる。コンソールの行は、そのまま貼る。
- **進む・止まるの目安**: 「期待する結果」と違ったら、その段で止まって送る。止まっても、本番には何も起きていない。

## 1. 全体の順番

| 段 | 場所 | やること | 影響の範囲 | 戻し方 |
|---|---|---|---|---|
| A | 自分のPC(ローカル) | `work` に取り込み、ローカルサーバーで開く | 自分だけ | 何もしなくてよい(ブランチを戻すだけ) |
| B | 開発サイト | `develop` にマージ → GitHub Pages で開く | 開発サイトを見る人だけ | 戻さなくてよい(直して次を載せる)。どうしても戻すなら私に「develop を v1.97.0 に戻して」と頼む |
| C | 開発サイト | Google連携を一巡(ログイン〜ログアウト)。コンソールを見ながら | 自分のGoogleアカウントだけ | ログアウト(取り消しが届く) |
| D | Google Cloud コンソール | 点検表 1〜7(デッサン34の7.) | 設定だけ。アプリ本体は触らない | 設定を元に戻す |
| E | Googleアカウント・GitHub・レジストラ | 2段階認証・ブランチ保護・Secret scanning | 自分のアカウント | 戻す必要なし |
| F | Apps Script | `gas_spredsheet.js` の新版を再デプロイ(URLは変わらない) | 訪問者カウンタだけ | 「デプロイを管理」で前のバージョンに戻す |
| G | 本番 | `deploy-guide.md` のプレ・デプロイ・チェックリスト+Step 1〜6 | 全利用者 | `deploy-guide.md` のロールバック(git revert) |
| H | 本番 | C と同じ一巡+点検 10・16 | 自分のGoogleアカウントだけ | ログアウト |

E・F は B・C と独立(どの順でもよい)。D は C の後が望ましい(C が落ちた時に、コードの問題と設定の問題を切り分けられる)。D4/D5 を直した後は、数分待ってから C1 と C4 をもう一度。G だけは A〜C が「はい」になってから。

## A. 自分のPCで開く(影響: 自分だけ)

- [x] A1 いつもの手順で `claude/…` を `work` に取り込む。
- [x] A2 ローカルサーバーで `index.html` を開く。フッター(または起動ログ)の版数が **1.98.0**。
- [x] A3 DevTools のコンソール(Mac: ⌥⌘I / Windows: F12)を開く。**赤い行にも黄色い行にも「Content Security Policy」「CSP違反」が無い**(宙の辻が記録する「CSP違反: …」は黄色の警告で出る。ブラウザ自身の「Refused to … Content Security Policy」は赤)。地理院タイルやOpen-Meteoへの通信は普通に出る(それは違反ではない)。
- [x] A4 地図が出る。天体の方位角・高度が出る。辻検索が動く。
- [x] A5 ヘルプの「気差係数(K)について」の数式が読める(K ≈ 503 × P / T² × (0.034 − Γ))。第159で数式ライブラリをやめてHTMLに書き直した所。
- [x] A6 URL取得のダイアログで「:QRコード」をオン → URLのボタン → 「…QRコードをクリップボードにコピーしました。」が出る → メモなどに貼り付けると QR 画像が貼り付く(画面には出ない)。「QRコード部品(vendor/qrcode.js)が読み込めていません」が出たら vendor/ が配信されていない印(B3 と同じ原因)。
- [x] A7 (任意。飛ばしてよい=第162で確認。同じことを C1 で確かめる)Googleログイン。やるなら: バックアップメニューの「Googleドライブ」の節の **ログイン** ボタン → Google のポップアップでアカウントを選ぶ → ログインボタンが押せなくなり、ログアウトボタンが押せるようになる → **ログアウト**。ローカルは、開発用OAuthクライアントの「承認済みのJavaScript生成元」に `http://127.0.0.1:3000`(VS Code Live Preview のポート。ポートまで一致が必要)が登録されている時だけ動く(2026-07-15 にローカルでログインできた記録があるので、登録済みのはず)。ログインしても、ヘッダのアイコンの ①(保存)は押さない(C2 と同じ理由: Drive の控えは本番と共通)。

期待と違ったら: コンソールの行をそのまま貼って送る。A で止まる=私(Claude)の直しが要る、という意味。本番には何も起きていない。

既知の1行(第161で確認済み・無害): VS Code Live Preview で開くと、赤い行で `___vscode_livepreview_injected_script` が `ws://127.0.0.1:3001/…` に繋げない、という CSP のエラーが1つ出る(宙の辻が記録する黄色の「CSP違反: connect-src が ws://127.0.0.1:3001/… — 開発用サーバー(Live Preview)の自動再読み込み。宙の辻の外で、無害」も出ることがある)。これは Live Preview が「保存したら自動で再読み込み」のために差し込む部品で、宙の辻の外。CSP が仕事をしている証拠で、害は無い(自動再読み込みが効かないだけ。保存したら手で再読み込み)。開発サイト・本番では出ない。この1行だけなら A3 は「はい」。

## B. 開発サイトで開く(影響: 開発サイトを見る人だけ)

- [x] B1 `work` → `develop` にマージして push(いつもの手順)。
- [x] B2 リポジトリの Actions タブの「pages build and deployment」が緑になってから(通常1分前後。GitHub の公式には最長10分)`https://takeyosui15.github.io/soranotsuji-dev/` を開く。古いキャッシュを捨てるため **Shift を押しながら再読み込み**。版数が **1.98.0**。
- [x] B3 `https://takeyosui15.github.io/soranotsuji-dev/vendor/MANIFEST.json` を開くと **JSONが表示される(404でない)**。これが「`.nojekyll` が効いて `vendor/` が配信されている」証拠(B1 の前に開くと 404。それは正常。B1 の後は JSON)。
- [x] B4 コンソールに「Content Security Policy」「CSP違反」の行が無い(赤も黄色も)。
- [x] B5 A4〜A6 と同じことを開発サイトでも。

期待と違ったら:
- B3 が404のまま → `develop` の直下に `.nojekyll` が入っているか(`git ls-files .nojekyll` で1行出る)。入っていれば GitHub Pages のビルド待ち(リポジトリの Actions タブの「pages build and deployment」が緑になるまで)。
- 版数が古いまま → Shift+再読み込み。それでも古ければ配信側のキャッシュ(最長10分)を待つ。

## C. 開発サイトで Google 連携を一巡(影響: 自分のGoogleアカウントだけ)

コンソールを開いたまま、順に。「〜しますか？」の確認ダイアログが出るのは正常。「〜を選択してください」「〜が紐付いていません」は「前提が足りない」という意味で、CSP の問題ではない(その段の手順を見直す)。

- [x] C1 バックアップメニューの「Googleドライブ」の節の **ログイン** ボタン(Googleのポップアップでアカウントを選ぶ。ログインボタンが押せなくなり、ログアウトボタンが押せるようになる)。
- [x] C2 ヘッダの Google アイコン(ログイン後は 👍/👎/😢 のどれか)を押す。**👍** なら「同期が取れています」の表示(これで Drive との通信は確かめられている)。**👎** なら「どのように更新しますか」のダイアログが出るので **③キャンセル**。**😢**(控えが無い)なら「作成して保存しますか」で OK(新しく作るだけ)。
  - 注意: 開発サイトも本番も、同じ Google アカウントの同じ Drive の控え(soranotsuji-app.json)を使う。開発サイトで ①(保存)を押すと、本番の端末が同期している控えを開発サイトの内容で上書きする。だから開発サイトでは押さない。①の保存は H(本番)で。万一上書きしたら、Google ドライブでそのファイルを右クリック→「版を管理」で前の版に戻せる。
- [x] C3 「Myセット」の節で行を1つ決める: その行の**選択ラジオ**(左端)をオン、**チェックボックス**もオン。行が無ければ「行追加」で作る。そして **切り替え表示** を押して、そのセットを表示中にする(表示中・既定・オフライン指定のセットだけが端末に内容を持つので、保存できる。第163の実機で判明)。
- [x] C4 その行にスプレッドシートが紐付いていない(😢)なら、行の **😢 を押して作成**(新しいスプレッドシートが Drive に作られる)。それから **追加** → 確認に OK → Google のファイル選択の枠(docs.google.com)が開く。枠が開いたことを確かめたら、**何も選ばずに ×(キャンセル)で閉じる**(選ぶと、その Myセットの紐付け先が選んだシートに差し替わる)。
- [x] C5 (C3 で切り替え表示したセットで)その行の **:保存** ラジオ → **更新** → 確認で OK → 「Myセットの一括更新が完了しました(成功: 1件)」。表示中でないセットに :保存 をすると「端末に内容を持っていません…切り替え表示で表示中にしてから」の案内が出て失敗扱いになる(それは正常=空のシートで上書きしないための止め)。次に同じ行の **:読込** ラジオ → **更新** → OK → 同じ完了表示(読込は端末の My辻検索/My観測点/My目的点/My天体をシートの内容で置き換えるが、直前に保存した同じ内容なので変わらない)。
- [x] C6 **開く**(選択ラジオの行のスプレッドシートが新しいタブで開く)。注: 「開く」は URL を新しいタブで開くだけで、宙の辻のトークンは使わない(ブラウザの Google アカウントで開く)。だから宙の辻が 🈚️(未ログイン)でも開ける。それは正常で、宙の辻のログアウトとは別の話(第166)。
- [x] C7 「Googleドライブ」の節の **ログアウト** ボタン(ログインの隣)。
- [x] C8 ここまでで、コンソールに **「CSP違反」が0行**(赤も黄色も。形は「CSP違反: connect-src が https://… を止めました(script.js:行)」)。Google の部品が出す次の行は違反ではない(無害): `client:… Cross-Origin-Opener-Policy policy would block the window.closed call.`(ログインのポップアップを Google の部品が見張る時の警告)・`picker?… [Violation] Permissions policy violation: unload is not allowed`・`cb=gapi.loaded_0… [Violation] … unload …`(Google のピッカー/部品が古い unload を使っている旨の Chrome の注意)。第166で確認済み。
- [x] C9 `https://myaccount.google.com/linkedapps`(Googleアカウントの「リンク済みアプリ」。旧 `/connections` でも可。デッサン34と回答その157で「第三者によるアクセス」と書いた画面と同じ)に **「宙の辻」が残っていない**(ログアウトの取り消しが届いた証拠。点検表の10)。画面の見出しは版で変わるので、一覧に「宙の辻」が無いことだけ確かめる。
  - 見る場所: 宙の辻は「Google でログイン」(Sign in with Google)を使わないので、そのフィルタには元から出ない。出るとすれば「ドライブへのアクセス権」の側(第167で確認)。
  - **消してはいけない物**: 同じ画面の「Google でログイン」側にある **「宙の辻アクセスカウンタ」(第168で改名。以前は Google の既定名「無題のプロジェクト」)** は、訪問者カウンタ(Apps Script)がシートを読み書きするための許可。消すと本番のカウンタが「- - -」になる(第168で発生。直し方は F1b)。
  - 残っていた時(第167): 同意の記録は「利用者×クライアントID」ごとに Google が持つ。本番(soranotsuji.net)や以前のログインの分は、開発サイトでログアウトしても残る。また、宙の辻から取り消しを送れるのは、トークンが生きている間(ログインから1時間以内)だけ。→ その画面で「宙の辻」を開き **「アクセス権を削除」**(安全。次のログインで同意画面が出るだけ)。それから開発サイトで ログイン → すぐ ログアウト → 数十秒後に画面を再読み込みして、消えていれば「はい」。それでも残るなら報告。

期待と違ったら:
- ログインのポップアップが出ない/「エラー400: origin_mismatch」 → 開発用クライアントの生成元に `https://takeyosui15.github.io` が無い(`google-oauth-guide.md` の「困った時」)。
- 「CSP違反: …」の行 → そのまま貼って送る。許可リストの足し漏れなら私が直す。
- C4 でピッカーの枠が開かない → D5(APIキーの制限)を直した直後なら数分待って再試行。許可するサイトに `https://takeyosui15.github.io/*` があるか。
- C9 に残っている → 回数と、ログアウト時のコンソールの行を送る。

## D. Google Cloud コンソールの点検(影響: 設定だけ)

点検表はデッサン34の「7.」(番号は同じ)。**順番は 5 → 1 → 2 → 3 → 4 → 7 → 6**(効き目の大きい順)。
それぞれ「はい/いいえ」で。「いいえ」の所は直す前に送ってくれてもよい(一緒に考える)。

- [x] D5 **APIキー(AIzaSyBQ…)の制限** — APIとサービス > 認証情報 > 該当のAPIキー。(第170で依頼者が D 完了を報告。チェックの付け忘れを第175で直した)
  - アプリケーションの制限 = **ウェブサイト**。許可するサイトに次の4つ: `https://soranotsuji.net/*` `https://www.soranotsuji.net/*` `https://takeyosui15.github.io/*` `http://127.0.0.1/*`(ポートを書かない=全ポート。今登録してある `http://127.0.0.1:3000/*` のままでもよい。`:*` のようにポートの位置にワイルドカードは書けない)
  - APIの制限 = **キーを制限** → **Google Picker API** だけ。
  - 保存。反映まで数分。
  - 理由: このキーは公開JSに入っている(それが前提のキー)。制限が無いと、誰でも宙の辻の枠でこのキーを使える。
  - 注意: 4つを**書いてから**保存する。書き忘れたサイトでは「ピッカーで追加」だけが動かなくなる(ログイン・保存・読込は動く)。
  - `https://www.soranotsuji.net/*` が無かった場合(第169): **足してよい(足すのが望ましい)**。DNS(Squarespace の `www CNAME takeyosui15.github.io`)は GitHub Pages の正しい設定で、変える物は無い。www は GitHub Pages が常に `https://soranotsuji.net/` へ 301 で転送する(箱から確認)ので、実際にピッカーが呼ばれる時の送信元は soranotsuji.net になり、www の行が無くても今は動く。それでも足すのは、本番用 OAuth クライアントの生成元(D3)と `GOOGLE_CONFIG.prod.hosts` が www を含むのと揃えるため・転送の仕組みが将来変わっても止まらないため。
- [x] D1 **OAuth同意画面** — 公開ステータス=本番環境・ユーザーの種類=外部・アプリ名・サポートメール・プライバシーポリシーのURL(`https://soranotsuji.net/privacy.html`)。
- [x] D2 **スコープ** — `…/auth/drive.file` だけ。他(drive・drive.readonly・spreadsheets)が並んでいたら外す。アプリは drive.file しか要求しないので、外しても動作は変わらない。
- [x] D3 **本番用OAuthクライアント**(クライアントIDが `87463892240-cb6fqb…` の方)の「承認済みのJavaScript生成元」 — `https://soranotsuji.net` と `https://www.soranotsuji.net` だけ。「承認済みのリダイレクトURI」は空でよい。
- [x] D4 **開発用OAuthクライアント**(`87463892240-r77t8c…` の方)の生成元 — `https://takeyosui15.github.io` と `http://127.0.0.1:3000`(VS Code Live Preview。ポートまで一致が必要。アドレスは localhost ではなく 127.0.0.1 で開く)だけ。
- [x] D7 **有効なAPI** — APIとサービス > 有効なAPIとサービス。Google Drive API・Google Sheets API・Google Picker API の3つが「有効」にあることを確かめる。無効化の対象は Maps Platform / Places / Vision など「宙の辻が使わない・使った分だけ課金される」API だけ。Google Cloud 自身の基盤(Service Usage・Cloud Logging・Cloud Monitoring・BigQuery など、プロジェクト作成時から有効な物)や Apps Script が足した物は触らない。迷ったら無効化せず、一覧をそのまま送る。
- [x] D6 **使っていない認証情報** — 認証情報の一覧に、知らないOAuthクライアント・APIキー・サービスアカウントが無い。あれば削除(削除は即時。迷ったら先に送る)。注意(第168): Google が付ける既定の名前(「無題のプロジェクト」「Web client 1」など)は、自分の物でも見分けがつかない。消す前に、心当たりの物に名前を付けてから。

## E. アカウントの守り(影響: 自分のアカウント)

- [x] E8 Googleアカウント(Cloudプロジェクトの持ち主) > セキュリティ > **2段階認証プロセス** = オン。パスキーが使えるなら追加。再設定用の電話/メールが現在の物。
- [x] E11 GitHub > Settings > Password and authentication > **Two-factor authentication** = オン。
- [x] E12 GitHub > `soranotsuji`(本番)と `soranotsuji-dev` > Settings > Rules > **Rulesets** — 本番の `main` と、開発の `develop`・`main` に「Restrict deletions」「Block force pushes」の2つ。「Require a pull request」は**入れない**(回答その157では「PR必須」と書いたが、deploy-guide の Step 1・Step 4 と B1 は main/develop へ直接 push するので、PR必須にすると push が拒まれる。取り下げ。どうしても入れるなら Bypass list に自分=Repository admin を足す)。作っただけでは効かないので Enforcement status を **Active** に。Target branches は「Add target → Include by pattern」で `main`(開発は `develop` も)。
  - 作り方(第170。GitHub の画面は英語): ①リポジトリを開き、上の **Settings**(無ければ「…」の中)→ 左の「Code and automation」の **Rules** → **Rulesets**。②右上の **New ruleset** → **New branch ruleset**。③**Ruleset Name** に `protect-branches`(名前は自由)。④**Enforcement status** を **Active** に(既定は Disabled なので必ず変える)。⑤**Bypass list** は何も足さない(自分でも削除と force push は止まる。それでよい)。⑥**Target branches** で **Add target** → **Include by pattern** → `main` → Add。開発リポジトリではもう一度 Add target → Include by pattern → `develop` → Add。⑦**Rules** の一覧で **Restrict deletions** と **Block force pushes** の2つだけにチェック(Require a pull request before merging などは触らない)。⑧一番下の **Create**。⑨一覧に Active で出れば完了。本番 `soranotsuji` でも同じ(Target は `main` だけ)。
  - 効き方: ブランチの削除と force push が止まるだけで、普段の push・マージ・deploy-guide の手順はそのまま通る。迷子のブランチ「>」の削除(E-追)も止まらない(対象が main/develop だけなので)。
  - 確認: `soranotsuji-dev` は Claude が箱から API で確かめられる(第170の時点では rulesets は空だった)。本番は画面の一覧(Active・2 rules・targets)で。
- [x] E13 GitHub > Settings > Pages > **配信元(Source)** — 本番: soranotsuji の `main`(Deploy from a branch / main / (root)) / 開発: soranotsuji-dev の `develop`。知らないブランチになっていない。
- [x] E14 GitHub > Settings > **Advanced Security**(旧 Code security)> **Secret Protection** を Enable(その中に Secret scanning と Push protection のスイッチ)。
  - 既知の行(第175): 両リポジトリの Security and quality > **Secret scanning alerts** に「Google API Key #1」(script.js の `GOOGLE_CONFIG.apiKey`=Google ピッカー用のブラウザキー。v1.85.0 の配布 2026-08-17 に検出・「Publicly leaked」「Validity: Unknown」)が出る。これは**想定内**: 公開サイトのブラウザキーで、守りは D5 の制限(利用サイト4つ・API はピッカーだけ)。ローテーション・取り消しはしない(新しい鍵もまた公開になるだけで、取り消すとピッカーが止まる)。扱い: アラートを開き、「Close as」→ **Won't fix** を選び、コメントに「ブラウザ用の公開キー(Google Picker)。利用サイトと API を制限済み(D5)」と書いて閉じる(両リポジトリ)。Push protection はこの鍵では止まらない(GitHub の対応表で Google API Key は Push protection の対象外=検出と通知だけ。加えて「既にアラートがある秘密は止めない」。E14 の後の開発リポへの push が通っている)。万一、別の理由で止まったら、画面の理由は「It's a false positive」→「Allow me to push this secret」(この鍵に限る。ya29. のトークンは絶対に通さない)。「Validity: Unknown」は個人リポジトリでは Google の鍵の生死確認が行われないため(常に Unknown)。
- [x] E15 ドメイン(soranotsuji.net)のレジストラ — ログインの2段階認証・ドメインロック(移管ロック)・自動更新 = オン。
- [x] E-追(点検表には無い追加) `soranotsuji-dev` に名前が「>」だけの迷子のブランチ(2026-07-06)が残っている → GitHub の Branches 画面で削除(コマンドなら `git push origin --delete '>'`)。
- [x] E16(点検表の追加・第173・画面名は第174で訂正) GitHub > `soranotsuji`(本番)と `soranotsuji-dev` > Settings > 左の「Security and quality」の中の **Advanced Security**(URL で直接: `https://github.com/takeyosui15/<リポジトリ>/settings/security_analysis`。開かなければ Settings の左の一覧から)> **Private vulnerability reporting** = Enable(依頼者が 2026-10-14 に両方オン。有効だとボタンが「Disable」表示になる)。確認: 本番はログアウトした状態でも「Security and quality」のタブ(URL は `https://github.com/takeyosui15/soranotsuji/security`)に「Report a vulnerability」が出る(第173で箱から確認。朝の時点では無かった)。開発は API `private-vulnerability-reporting` が `{"enabled":true}`。報告の URL(`…/security/advisories/new`)はログインしていないとサインイン画面に転送される(=報告者は GitHub のアカウントが要る)。通知の条件(GitHub の説明どおり): 報告が来たことは、そのリポジトリを **Watch**(All Activity、または Custom で「Security alerts」にチェック)していて、そのリポジトリの通知が有効な管理者に届く(Watch していないと、Security のタブの Advisories に溜まるだけで知らせは来ない)。メールで受け取るには、さらに通知設定(Notification settings)の Subscriptions > Watching で Email にチェック。→ 確認(第176で訂正): リポジトリのページの右端の**目のアイコンのボタン**(ログイン中は「Watch」=通知を受けていない/「Unwatch」=通知を受けている、と表示。ログアウト時だけ「Notifications」と出る)を押し、4つの選択肢(Participating and @mentions / All Activity / Ignore / Custom)のうち「**All Activity**」にチェックがあること(Custom なら中の「Security alerts」にチェック)。両リポジトリで。一覧で見るなら `https://github.com/watching`(Watched repositories=通知を受けているリポジトリの一覧。自分のリポジトリも載る)。メールは `https://github.com/settings/notifications` の Subscriptions > Watching で Email にチェック。自分で報告を出して試すことはできない(自分のリポジトリには報告できない)。GitHub の画面は英語で名前がよく変わるので、この行は URL を主にして書いてある(第174)。
  - 同じ画面の「Submission requirements」(第175): **Require a CWE assignment = Off のまま**(オンにすると報告者が CWE=弱点の分類番号を選ばないと送れなくなり、専門でない人の報告が減る。小さな個人のアプリでは Off がよい)。Daily advisory limit = 10(このリポジトリが1日に受け付ける報告の上限。画面の値のまま)。Trusted reporters = 空のまま(上限を免除する人の登録欄。今は不要)。この3つは GitHub が 2026-10-01 に足した機能(変更履歴)。
- 注: E の番号は点検表の番号。GitHub Actions は、Pages の配信(pages-build-deployment)が Actions の仕組みで動くので**無効にしない**(回答その157の「Actions は無効に」は取り下げ)。

## F. Apps Script(訪問者カウンタ)の再デプロイ(影響: カウンタだけ)

第159でサーバー側のコード(`gas_spredsheet.js`)を1か所直した(例外の本文を外へ出さない)。再デプロイしないと旧コードのまま(害は無いが、直しが効かない)。

- [x] F1 `script.google.com` のプロジェクト **「宙の辻アクセスカウンタ」**(第168で改名)を開き、`gas_spredsheet.js` の全文を貼り替え → 保存。
- [x] F1b **再承認**(第168: リンク済みアプリから許可を消した後に必要): エディタ上部の関数の選択で `doGet` を選び **「実行」** → 「承認が必要です」→「権限を確認」→ アカウントを選ぶ →(「このアプリは Google で確認されていません」が出たら「詳細」→「宙の辻アクセスカウンタ(安全ではないページ)に移動」)→ **「許可」**。実行そのものは「e.parameter が無い」で失敗して終わるが、それでよい(欲しいのは許可)。リンク済みアプリに「宙の辻アクセスカウンタ」が戻る。
- [x] F2 「デプロイ」→「**デプロイを管理**」→ 既存のデプロイの鉛筆(編集)→ バージョン「**新バージョン**」→「デプロイ」。**WebアプリのURLは変わらない。**
  - 「新しいデプロイ」は押さない(URLが変わり、アプリ側の `GAS_API_URL` と合わなくなる)。
- [x] F3 本番(soranotsuji.net)と開発サイトを開き直して、訪問者カウンタの数字が出る(「- - -」のままなら F1b の許可と F2 の「アクセスできるユーザー=全員」を見直す)。Claude の箱からも、カウンタの URL が JSON を返すかを確かめられる。
- [x] F9 ついでに点検表の9: 実行するユーザー=自分・アクセスできるユーザー=全員・紐付くスプレッドシートはカウンタのシートだけ。

戻し方: 「デプロイを管理」→ 鉛筆 → バージョンを前の番号に → デプロイ。

## G. 本番へ配る(影響: 全利用者)

前提: A〜C が「はい」。D〜F は済んでいなくても配れるが、D5(APIキーの制限)は配る前に済ませるのが望ましい。

- [x] G0 知っておく: 本番は v1.87.0 なので、今回は **v1.88〜v1.98 の変更がまとめて載る**(宙の窓検索・地理院タイルのオフライン表示・気差の2本立て(大気差補正/気差オプション)と統一可視判定(大円・海は海面0m)・除外範囲の山頂部・可視マップとMyサイトの封鎖・セキュリティ対策。中身は script.js の Version History v1.88.0〜v1.98.0)。リリースノート(note用)は合図があれば起草する(todo)。
- [x] G0b `deploy-guide.md` の「プレ・デプロイ・チェックリスト」(機能のリストアップ・ヘルプ/README への反映・版数2か所)を先に。機能のリストアップ=リリースノート `docs/release-notes/v1.98.0.md`(第171で起草)。README の主な機能と、表示中の文言に残っていた封鎖中の「可視マップ」の名前は第171で整えた。版数2か所(Version History・APP_VERSION)は 1.98.0 で揃っている。
- [x] G0c 公開文のご判断(回答その157の9.): privacy.html の「4. 外部サービスへの通信」の差し替え(CDN を消し、実際の通信先を列挙。改定日 2026-10-14)と `/.well-known/security.txt`(Contact は2行: 1行目=GitHub の非公開の脆弱性報告 `…/security/advisories/new`・2行目=リポジトリ(第173で並べ替え)。Expires 2027-10-01)を、第172で依頼者の判断どおりに載せた。verify184 S11 が見張る。
- [ ] G1 `deploy-guide.md` の Step 1〜4 をそのまま(Step 1 の main への push は、E12 のルールが「削除・force push の禁止」だけなら通る)。Step 3 の rsync の後、`ls -a` で **`.nojekyll` と `vendor/` と `.well-known/` が入っている**ことを見る(`.nojekyll` と `.well-known` は名前が「.」で始まるので `ls` だけでは見えない)。
- [ ] G2 Step 5: `https://soranotsuji.net/vendor/MANIFEST.json` が JSON で表示される。版数 1.98.0(Shift+再読み込み)。コンソールに CSP の行が無い。主要機能。
- [ ] G3 Step 6: デプロイ記録。

戻し方: `deploy-guide.md` の「ロールバック手順 方法1」(git revert → push。ビルドが緑になれば前の版。他の端末では最長10分前の版が残ることがある)。

## H. 本番での最終確認

- [ ] H16 本番で C1〜C8(コンソールを開いたまま Google 連携を一巡。CSP違反0行)。本番では C2 で ①(端末の内容をGoogleドライブに保存)まで行う。ただし 👎 の時は、ダイアログの Drive 側の最終更新日時を見て、本番の端末の内容を上書きしてよいか確かめてから。点検表の16。
- [ ] H10 ログアウト後、`https://myaccount.google.com/linkedapps` に「宙の辻」が残っていない。

## 報告の書き方(コピーして使う)

**貼る前に1つだけ**: コンソールの行に `ya29.` で始まる長い文字列(Google のアクセストークン)や `token=`・`oauth_token=`・`access_token=` が入っていたら、その部分を `(伏せた)` に書き換えてから貼る。ブラウザ自身の赤い行は URL を全部出すので、問い合わせ部分(`?` より後)にトークンが入っていることがある。宙の辻の黄色い行は第165から `?` より後を出さない。もし入ったままコミットすると、GitHub の push protection(E14)が push を止める(第165で実際に止まった。直し方は回答その163)。

```
A: はい / いいえ(A3: コンソールの行 → ここに貼る)
B: はい / いいえ(B3: 404 のまま)
C: はい / いいえ(C8: CSP違反: … の行 → ここに貼る)
D5: はい / いいえ  D1: …  D2: …  D3: …  D4: …  D7: …  D6: …
E8: …  E11: …  E12: …  E13: …  E14: …  E15: …  E-追: …
F: はい / いいえ
G: 済 / 未  H: はい / いいえ
```

## 最後の手段(普段は使わない)

本番で「Google連携が危ない」と判断した時は、`script.js` の `GOOGLE_CONFIG` の `clientId` を空文字にして配れば、ログインは案内表示(「Google連携は現在ご利用いただけません」。第160で利用者向けの文にした)だけになる(既存のトークンも1時間で切れる)。Google Cloud で OAuth クライアントを削除すれば、その場で全トークンが無効になる。デッサン34の 7c。
