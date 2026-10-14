# 34. セキュリティ(守りの設計と合格条件)

- 起草: 2026-10-12(第159ラウンド・依頼者の依頼「真剣なセキュリティ対策」)。
- 目的: 宙の辻の「守り」を1枚にまとめ、何を守っていて、何をもって「対策が取れた」と判断するかを、依頼者と開発者(AI)が同じ物差しで見られるようにする。
- 背景: 2026年9〜10月、国内で不正アクセスによる個人情報の漏えいが相次ぎ、JPCERT/CC(JPCERT-AT-2026-0030)とIPA(2026-10-09)が注意喚起を出した。宙の辻はGoogleドライブ連携を持つので、利用者のアカウントを巻き込む責任がある。

## 1. 宙の辻の形(前提)

- サーバーを持たない静的なウェブアプリ(GitHub Pages)。利用者のデータは端末(localStorage・IndexedDB)と、利用者自身のGoogleドライブ/スプレッドシート(本人が許可した時だけ)にある。宙の辻のプロジェクトは利用者のデータを一切預からない。
- Google連携: Google Identity Services のトークン方式(ブラウザだけで完結)。スコープは `drive.file`(このアプリが作ったファイルだけ)。アクセストークンはメモリだけ(保存しない・URLに乗せない)・1時間で切れる・ログアウトで取り消す。リフレッシュトークンは持たない。
- 外部サービス: Google(ログイン/Drive/Sheets/Picker)・国土地理院(地図/標高タイル・住所検索)・OpenStreetMap(地図タイル・Nominatim)・terrarium(全球DEM)・Open-Meteo(標高/天気)・Google Apps Script(訪問者カウンタ)・PLATEAU(都市モードの建物)。
- 配信: GitHub Pages(開発: takeyosui15.github.io/soranotsuji-dev=developブランチ / 本番: soranotsuji.net=soranotsuji リポジトリ)。公開リポジトリなので、リポジトリの中身は全て公開物。

## 2. 守る物と、誰が何を得るか(信頼の境界)

| 守る物 | 失うと起きること | 入口 |
|---|---|---|
| 利用者のブラウザで動くスクリプト(宙の辻のオリジン) | ログイン中ならDriveのトークンを盗まれる(このアプリのファイルだけ)・端末のMyリストを読まれる/書き換えられる | 他人から受け取る物(共有URL・バックアップJSON・可視マップの資産ファイル・Myセットのシート・将来のMyサイト)に混ぜたHTML/スクリプト(XSS) |
| 読み込む第三者ライブラリ | 上と同じ(全利用者に一斉) | CDNの改ざん・版の勝手な変化・配信元の停止(サプライチェーン) |
| GitHubのアカウント/リポジトリ/Pages | 全利用者へ改ざんしたアプリを配る(最悪) | 開発者のアカウント乗っ取り・ブランチ保護の不備 |
| Google Cloud のプロジェクト(OAuthクライアント・APIキー) | 宙の辻の名前で同意画面を出す偽アプリ(フィッシング)・APIキーの横取り | 開発者のGoogleアカウント乗っ取り・承認済みオリジン/リファラ制限の不備 |
| 訪問者カウンタ(Apps Script) | 数字の水増し・枠(クォータ)の使い切りで止まる | 誰でも叩ける公開URL |
| 利用者のGoogleアカウントそのもの | (宙の辻は触れない) | 宙の辻とは別の経路(フィッシング・流用パスワード) |

(以下、脅威モデルの当てはめ・合格条件・運用・ドライブ継続の判断は本文で)


補足(第166): 「宙の辻のログイン」と「ブラウザの Google アカウントのログイン」は別物。宙の辻が持つのはアクセストークン(メモリだけ・再読み込みで消える・ログアウトで取り消し・最長1時間)で、Google API を呼ぶ時にだけ使う。Myセットの「開く」はスプレッドシートの URL を新しいタブで開くだけで、宙の辻のトークンは使わず、ブラウザの Google アカウントで開く。だから宙の辻が未ログイン(🈚️)でも開ける。ブラウザ側の Google アカウントを守るのは Mac の画面ロックと Google の2段階認証(層2 #8)で、宙の辻が代わりにログアウトさせることはしない(できないし、すべきでもない)。

## 3. 2026年10月の事件の型と、宙の辻への当てはめ

| 注意喚起の型 | 宙の辻では | 対応 |
|---|---|---|
| JPCERT ケースA: 既知の脆弱性の探索・設定ファイル/バックアップの窃取 | 当てはまらない(サーバー無し。GitHub Pagesは静的ファイルだけ。公開リポジトリで隠す物が無い) | 依存ライブラリの既知の脆弱性だけが相当(5.) |
| ケースB: 管理用/内部APIの不正操作・アプリ解析でAPIキー/エンドポイント特定・盗んだキーの流用 | 形を変えて当てはまる: 公開JSのOAuthクライアントID・ピッカーのAPIキー・Apps ScriptのURL | キー/クライアントの「このサイトからだけ」の制限(7.のコンソール点検)・GASの再試行上限と例外文の非公開 |
| ケースC: Metabase SQLi / ケースD: Webシェル | 当てはまらない | — |
| IPA: 外部サービスの洗い出し・アカウントの点検・不要な情報は持たない | 当てはまる | 1.の表・7.の点検・設計(預からない) |
| Qiita: XSS | 当てはまる(他人から受け取る物→innerHTML) | 保存データの型そろえ・HTMLを組む所の二重化(4.) |
| Qiita: 依存ライブラリ | 当てはまる(CDN読み込み) | 自前配信+指紋の台帳(4.) |
| Qiita: OAuth設定 | 当てはまる(承認済みオリジン・スコープ) | 7.の点検 |
| Qiita: SQLi/コマンド/SSRF/IDOR/パストラバーサル/キャッシュ汚染/GraphQL | 当てはまらない | — |

## 4. 今回の対策(第159・v1.98.0)

1. **第三者ライブラリの自前配信(vendor/)**: MapLibre 4.7.1・three 0.160.0・astronomy-engine 2.1.19・GeographicLib 2.2.0・qrcode-generator 1.4.4・Draco(three同梱)。出所(npmの固定版)・ライセンス・内容の指紋(sha384/sha256)を `vendor/MANIFEST.json` に。CDN(jsDelivr/unpkg/sourceforge.io)への読み込みは全廃。MathJaxは撤去(ヘルプの数式はHTMLに書き直し=10.)。更新手順は `vendor/README.md`。
2. **読み込み元の許可リスト(CSP meta)**: `script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com/gsi/client https://apis.google.com`(インラインとevalは不可)。`connect-src`/`img-src`/`frame-src` は使うAPI・タイル・Googleの枠だけ。`object-src 'none'`・`base-uri 'self'`・`worker-src 'self' blob:`・`media-src 'self' blob:`。`Referrer-Policy: strict-origin-when-cross-origin`。CSP違反は `securitypolicyviolation` でコンソールに記録(機能が静かに止まらないように)。meta では `frame-ancestors`(埋め込み禁止)は書けない(GitHub Pagesはヘッダーを出せない)。reset.html は自サイトだけのCSP。
3. **インラインのスクリプト全廃**: `onclick=`(30+2箇所)→ `data-click`/`data-arg` 属性+1つの委譲リスナー+許可表 `_CLICK_ACTIONS`(属性の文字列を評価しない)。three の読み込み→ `three-global.js`。reset.html → `reset.js`。
4. **保存データの型そろえ `_sanitizeStoredShapes()`**(`normalizeAppState` の先頭で毎回=起動・バックアップ取り込み・Driveからの復元・Myセット切替・URL復元の全入口): 観測点/目的点/Home(緯度経度は数値必須)・My観測点/My目的点(id整数・緯度経度数値・標高/高さ数値かnull・名前/メモは文字)・My天体(id整数・赤経赤緯数値・色は safeCssColor)・My辻検索(CSV取り込みと同じ型)・My宙検索(id/観測点ID/目的点IDは整数)・Myセット(id整数・シートIDはGoogleのIDの文字種だけ)・Googleドライブの控えのID(同)・表示天体の色。直せない行は捨ててコンソールに記録。`escapeHtml` は文字列以外も落ちない。HTMLを組む所(地点のポップアップ・My*の行・ID入りのエラー文・宙検索の一括結果・可視マップの島リスト/ポップアップ)は Number()/escapeHtml で二重化。可視マップの資産ファイルの取り込みは島の番号/画素数が数値でなければ拒む。
5. **リンクとAPIのパス**: `target="_blank"` は全て `rel="noopener noreferrer"`。Myセットのシートを開く `window.open` は noopener+IDの文字種検査。Sheets/Drive API のパスに入るIDは `encodeURIComponent`。Myセットのシートから読む名前/メモは150文字で切り、4M文字(STORE_WRITE_MAX_CHARS)を超えるセットは端末に保持せず読込失敗として扱う(13.)。
6. **Google連携**: ログアウトの取り消し(revoke)が届く先 `oauth2.googleapis.com` を connect-src に(無いとCSPが止めて、取り消しが静かに失敗していた)。取り消しに失敗した時はコンソールに記録。
7. **訪問者カウンタ(Apps Script)**: 混雑時は合計3回まで試す(再試行2回。全画面が叩き続けない)。サーバー側は例外の本文を外へ出さない(`error: 'internal'`。依頼者が再デプロイ)。
8. **reset.html**: 「すべてのデータを消去」に地図タイルの控え(soranotsuji-maptiles)も。
9. **配信の前提(レビューで見つかった致命的な穴)**: GitHub Pages はJekyllで配信するので、`.nojekyll` が無いと `vendor/` という名前のフォルダを配信しない(全利用者でアプリが起動しなくなる)。リポジトリ直下に `.nojekyll` を置いた(本番の soranotsuji リポジトリにも要る。rsyncは隠しファイルも写す)。配信後に `https://soranotsuji.net/vendor/MANIFEST.json` が 200 で返ることを確かめる。
10. **ヘルプの数式**: MathJax は実は使われていた(気差係数の節のTeX記法18行)。撤去に合わせてHTML(<i>K</i>・上付き文字)に書き直した(数式のためだけに1MB超のライブラリとフォントを配る理由は無い)。
11. **出所の再現性**: qrcode は CDN(jsDelivr)がその場で作る .min ではなく、npm の配布物そのまま(qrcode.js。registry/jsDelivr/unpkg の3か所で同じ指紋)。使っていなかった GeographicLib の度分秒(DMS)は同梱しない。ハーネスはコピーした vendor/ を台帳の指紋で確かめ、違えば中断する(CDNから取り直す案内は無くした)。
12. **CSV出力の式の注入対策**: 名前・メモ・天体IDなど自由文のセルは `csvText()`(先頭が = @ + - タブなら先頭にアポストロフィ。負号の数値は対象外)、取り込みは `csvUnprefix()` で外す(往復で元に戻る)。5種のCSV出力+3つの結果出力(esc)・5種の取り込み+シートの読み取り。Sheets への書き込みは RAW(式を評価しない)のまま。
13. **取り込み口の大きさと鍵**: ファイルは8MBまで(PICK_FILE_MAX_BYTES)・書き戻しは soranotsuji_app だけ・JSONとして読める物だけ・合計4M文字まで(STORE_WRITE_MAX_CHARS。本体と reset.js)・Myセットのシートは1,100行まで読む(MYSET_SHEET_MAX_ROWS)・Myセット1件は4M文字を超えたら読込失敗として扱う(同期済みの印を付けない)。
14. **公開リポジトリの個人情報**: 依頼文の控え(order-log 2026-10-09)に残っていた依頼者のメールアドレス入りの問い合わせリンクのパラメータを伏せた(履歴には残る)。
15. **差分の反証レビューで直した自分の穴**: 緯度経度が未入力の My点の行を捨てていた(正当な途中の状態)→残す / Myセットの1MBの上限が正当な大きさにかかり、読込を成功と記録していた→4M文字+失敗扱い。

## 5. 合格条件 — 「何をもって対策が取れたと判断するか」

### 層1: 自動で見張る(tests/verify184.js。毎ラウンドの回帰で回す)
- 外部ホストからスクリプト/スタイルを読み込まない(index.html・ワーカー・動的に作るスクリプトはGoogleの2つだけ・Dracoも vendor/)。
- vendor/ の中身と MANIFEST.json の指紋が一致・台帳に無いファイルが無い・版は固定・ライセンス全文あり。
- CSP meta が期待どおり(script-src にインライン/evalが無い・object-src 'none'・base-uri・許可リストの中身とワイルドカード無し)・Referrer-Policy。reset.html も。
- インラインの on*= と \<script\> ブロックが無い・data-click の名前が許可表と一致・eval/new Function/javascript:/document.write が無い。
- target=_blank は全て noopener・window.open は noopener・シートIDの文字種。
- 追跡ファイル+未追跡の新しいファイル(コミットの前に回す検査なので)に秘密情報の形(ya29./GOCSPX-/1//0 のリフレッシュトークン/client_secret=値・refresh_token=値(語だけは対象外。検査の説明文に反応しないため)/秘密鍵/AKIA/xox/ghp_/sk-)が無い・APIキーはピッカー用の1つだけ・トークンはメモリだけ。
- ブラウザ: CSPの下で自サイトの資源が止められない・ライブラリの実体・ワーカー4種・トークンが localStorage/バックアップ/appState/URL に出ない・毒入りの保存データを入れて描画しても HTML として解釈されない・資産ファイルの取り込みの拒否。

### 層2: 依頼者がコンソールで1回確かめる(証拠はスクリーンショットを手元に)
(7. に表)

### 層3: 続ける運用
- 毎ラウンド: 回帰(verify184を含む)が全PASS。差分の反証レビュー。
- ライブラリを上げる時: vendor/ を取り寄せ→MANIFEST.json の版と指紋を書き直す→全走+実機。
- 月1回: Google Cloud の「APIとサービス>ダッシュボード」でAPIの呼び出し数・エラー率を見る(平時と違う山が無いか)。Apps Script の実行ログ(失敗の山=叩かれている)。GitHub の Security(Dependabot/シークレットスキャン)の通知。
- 情報収集: JPCERT/CC の注意喚起・IPA の重要なセキュリティ情報・MapLibre/three/astronomy-engine のリリース(GitHub Watch)。
- 疑いが出た時(手順): ①Google Cloud でAPIキーを再発行(古い鍵を削除)・OAuthクライアントのオリジンを確認 ②GitHub のパスワード/トークンを変え、Pages の配信元ブランチの最新コミットが自分の物か確認 ③Apps Script のデプロイを作り直す(URLが変わるので script.js を更新) ④利用者へは note で知らせる(何が起きたか・何をすればよいか=ログアウト/再ログイン)。

- 毎年9月: `/.well-known/security.txt` の Expires を1年先に進める(切れると verify184 S11 が落ちて教える)。

## 6. Googleドライブ連携を続けるかの判断(依頼者の問いへの答え)

- 続けてよい。宙の辻は利用者のデータを預からず、トークンはメモリだけ・1時間・drive.file。事件の型(サーバーに溜めた個人情報の流出)は起き得ない。
- ただし条件: 層1が全PASS(=このラウンド以降の毎回)・層2の点検が全部「はい」・層3を続ける。
- 残る本当の危険は「開発者のアカウント」。GitHub/Googleの2段階認証(パスキー)と、ブランチ保護・Pagesの配信元の確認が、コードのどんな対策よりも効く。
- Myサイト(09)はこの土台の上で進める。読む側の値も「型そろえ」(数値/文字/色を読む時点で確定)・自由文を持たない・連絡手段を持たない・URLのIDは文字種を検査、の4つを守る。

## 7. 依頼者がコンソールで確かめる点検表

| # | 場所 | 確かめること | 期待する値 |
|---|---|---|---|
| 1 | Google Cloud Console > APIとサービス > OAuth同意画面 | 公開ステータス・ユーザーの種類・アプリ名/サポートメール/プライバシーポリシーのURL | 本番環境(テスト中だとテストユーザー以外はログイン不可)・外部・https://soranotsuji.net/privacy.html |
| 2 | 同 > OAuth同意画面 > スコープ | 列挙されるスコープ | `…/auth/drive.file` だけ(drive・drive.readonly・spreadsheets が残っていれば削除) |
| 3 | 同 > 認証情報 > OAuthクライアント(本番 …cb6fqb…) | 承認済みのJavaScript生成元 | `https://soranotsuji.net` と `https://www.soranotsuji.net` だけ。リダイレクトURIは不要 |
| 4 | 同 > OAuthクライアント(開発 …r77t8c…) | 承認済みのJavaScript生成元 | `https://takeyosui15.github.io` と `http://127.0.0.1:<ハーネスのポート>` だけ。注: takeyosui15.github.io は他のGitHub Pagesプロジェクトと同じオリジン(他の公開ページを同じアカウントに置かない) |
| 5 | 同 > 認証情報 > APIキー(AIzaSyBQ…) | アプリケーションの制限・APIの制限 | ウェブサイト: `https://soranotsuji.net/*`・`https://www.soranotsuji.net/*`・`https://takeyosui15.github.io/*`・`http://127.0.0.1/*`(ポートを書かない=全ポート。ポートの位置に `*` は書けない)。API: Google Picker API だけ |
| 6 | 同 > 認証情報 | 使っていないOAuthクライアント・APIキー・サービスアカウント | 無い(あれば削除) |
| 7 | 同 > 有効なAPI | 有効なAPIの一覧 | Google Drive API・Google Sheets API・Google Picker API がある。Maps 等の「使った分だけ課金される」API は無効。Google Cloud の基盤系(Service Usage・Logging・Monitoring 等)は触らない |
| 8 | Googleアカウント(プロジェクトの持ち主) > セキュリティ | 2段階認証 | オン(パスキー推奨)・再設定用の電話/メールが現在の物 |
| 9 | Apps Script「宙の辻アクセスカウンタ」(第168で「無題のプロジェクト」から改名。Google アカウントのリンク済みアプリに同名で出る=カウンタがシートを読み書きする許可なので消さない) > デプロイ | 実行するユーザー・アクセスできるユーザー・紐付くスプレッドシート | 自分・全員(匿名で数えるため必要)・カウンタのシートだけ。`gas_spredsheet.js` の新版(例外文を出さない)を再デプロイ(URLは変わらない) |
| 10 | Googleアカウントの「リンク済みアプリ」(https://myaccount.google.com/linkedapps。旧 /connections。回答その157では「第三者によるアクセス」と書いた同じ画面) | 宙の辻でログアウトした後(ログインから1時間以内に) | 一覧(「ドライブへのアクセス権」側。「Google でログイン」は使わないので元から出ない)から「宙の辻」が消える(取り消しが届いている)。同意の記録は利用者×クライアントIDごとなので、本番や以前のログインの分は別。残っていたら Google の画面で「アクセス権を削除」してから、ログイン→ログアウト→再確認(第167) |
| 11 | GitHub > Settings > Password and authentication | 2段階認証 | オン(パスキー推奨) |
| 12 | GitHub > soranotsuji(本番)と soranotsuji-dev > Settings > Branches | 配信元ブランチの保護 | 本番の配信元(main等)と開発の develop/main にルールセット(削除の禁止・force pushの禁止)。PR必須は入れない(deploy-guide の Step 1 と work→develop は直接 push なので。第160で取り下げ) |
| 13 | GitHub > Settings > Pages | 配信元 | 本番: soranotsuji の決めたブランチ / 開発: soranotsuji-dev の develop。知らないブランチになっていない |
| 14 | GitHub > Settings > Advanced Security(旧 Code security)> Secret Protection | Secret scanning・Push protection(・Dependabot alerts) | オン。既知のアラート: 「Google API Key #1」=script.js のピッカー用ブラウザキー(公開前提。守りは行5の制限)。Won't fix で閉じる(第175) |
| 15 | ドメイン(soranotsuji.net)のレジストラ | ログインの2段階認証・ドメインロック・自動更新 | オン・オン・オン |
| 15b | GitHub > soranotsuji(本番)と soranotsuji-dev > Settings > 「Security and quality」> Advanced Security > Private vulnerability reporting | 非公開の脆弱性報告(第173で依頼者が両方オン) | Enable(ボタンが「Disable」表示)。Submission requirements は Require a CWE assignment=Off・Daily advisory limit=10・Trusted reporters=空(第175)。確認はログアウトした状態で「Security and quality」のタブに「Report a vulnerability」が出ること(本番)/ API `private-vulnerability-reporting` が enabled=true(開発)。security.txt の Contact の1行目がこの報告の URL。通知は、そのリポジトリの通知を受けている(右端の目のアイコン=Watch/Unwatch ボタンの選択が All Activity か Custom+Security alerts)管理者にだけ届くので、両リポジトリのページでその選択と、`https://github.com/settings/notifications` の Watching の Email も見る(第176で画面名を訂正: ログイン中は Watch/Unwatch、ログアウト時だけ Notifications と出る) |
| 16 | 実機(soranotsuji.net)で DevTools のコンソールを開いたまま | ログイン→Drive保存→Myセットの保存/読込→ピッカーで追加→開く→ログアウト | 「CSP違反」の警告が1つも出ない(出たらその行をそのまま報告) |

## 7b. 受け入れた(今は直さない)穴と、その理由

- 埋め込み(クリックジャッキング): meta の CSP では frame-ancestors を書けず、GitHub Pages はヘッダーを出せない。危ない操作(全消去・Myセットの保存/読込)は全て confirm() の後なので実害は低い。GitHub Pages 以外へ移す時にヘッダーで出す。
- 訪問者カウンタ(Apps Script)の水増し・枠の使い切り: 匿名で数える前提と両立する認証は無い。飾りの数字と割り切る。緩和案: CacheService で集計を60秒控える・1分あたりの増分に上限(依頼者が再デプロイ)。
- 開発用クライアントの承認済みオリジン takeyosui15.github.io は、同じアカウントの全 GitHub Pages プロジェクトと同じオリジン。開発版は一般利用者向けではないので低い。運用: このオリジンに宙の辻-dev 以外のHTMLを置かない(置く時は dev.soranotsuji.net のような別ドメインを当てる)。
- 専用ワーカー(URLで読む物)は meta の CSP の対象外(blob: のワーカーは対象)。ワーカーの通信先はコードの定数だけ(地理院・terrarium)なので受け入れる。
- MapLibre 4.7.1 の CVE-2026-85061: 属性文字列が定数の間は悪用できない(1067行目の注記で「利用者やシートの値を混ぜない」と縛る)。6.4.1以上への版上げは別ラウンド。

- 取り消し(revoke)はトークンが生きている間しか送れない(Google の仕様: 有効なアクセストークンが要る)。ログインから1時間を超えるとトークンが切れ、ログアウトボタンも押せなくなり(🈚️)、同意の記録だけが Google に残る。害は「次のログインで同意画面が出ない」だけ(記録だけではアクセスできない。アクセスには新しいトークン=本人のポップアップが要る)。消したい時は Google アカウントの「リンク済みアプリ」で「アクセス権を削除」(第167)。

## 7c. 非常停止(いつでも止められることの確認)

- script.js の GOOGLE_CONFIG の clientId を '' にして配れば、ログインは案内表示だけになり(googleLogin の先頭の分岐。案内文は利用者向け「Google連携は現在ご利用いただけません」=第160で差し替え。Myセットの更新も同じ分岐に入る)、既存のトークンも1時間で切れる。
- Google Cloud Console で OAuth クライアントを削除すれば、その場で全トークンが無効になる。
- Apps Script のデプロイをアーカイブすればカウンタの通信は 404 になるだけ(アプリは動く)。

## 8. 次の段(todo)

- GitHub: 配信元ブランチのルールセット(develop/main は無保護だった。削除と force push の禁止。PR必須は配布手順と両立しないので入れない)・迷子のブランチ「>」の削除・Secret scanning/Push protection(層2 #12〜#14)。Actions は Pages の配信に使われているので無効にしない(第160で「無効化」を取り下げ)。
- MapLibre を 6.4.1 以上へ(CVE-2026-85061: 属性文字列のサニタイザのバイパス。宙の辻は属性文字列が全て定数で、外部のTileJSONも読まないので今は悪用できない。4→6の大きな版上げなので、全走+実機で別ラウンド)。
- Apps Script のカウンタに CacheService(集計の控え)・/.well-known/security.txt(第172で設置・第173で Contact を2行に: 1行目=GitHub の非公開の脆弱性報告(security/advisories/new)・2行目=リポジトリ・Expires 2027-10-01・verify184 S11 が順序も見張る)(報告の窓口。公開文なので事前提示)・Service Worker(本体のオフライン起動)。
- Myサイト: 読み取りに docs.google.com を connect-src に足す時は、?mysite= のIDの文字種検査と一緒に。
