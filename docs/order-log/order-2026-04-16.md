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
git show 75e26c8
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-0４-16)
Claudeさん、ありがとうございます。
確認しました。

引き続き、機能改善をしたいです。
気がついたのですが、太陽と月以外の天体を撮影使用すると、新月の時が良いのです。
だから、辻検索した時に、月の月齢が必ず分かると良いと思いました。
ですので、辻検索のパネル表示する一覧リストの表示項目を

- リストの表示項目:天体ID、天体名、精度記号、精度角距離、日付、辻時刻、月齢、月齢アイコン、方位角、視高度、視半径

としたいです。
ちなみに、私が以前、ヘッダーの見出し文字列を修正したのですが、不整合が起きてしまっているようなので、見出し文字も、この内容で統一をお願いいたします。

### 回答 (2026-04-16)

辻検索結果リストの列順と見出し文字列をデッサン `02-tsujisearch.md` の仕様通りに統一しました。

#### 修正内容
新しい列順: **天体ID → 天体名 → 精度記号 → 精度角距離 → 日付 → 辻時刻 → 月齢 → 月齢アイコン → 方位角 → 視高度 → 視半径**

月齢と月齢アイコンを「辻時刻」と「方位角」の間に移動しました。

#### 修正箇所 (script.js)
1. **行HTML (L3690)**: `<td>` の並び順を新仕様に変更
2. **テーブルヘッダー (L3702)**: 見出し文字を `天体ID/天体名/精度記号/精度角距離/日付/辻時刻/月齢/月齢アイコン/方位角/視高度/視半径` に統一
3. **ソート定義 (L3710-3726)**: ラベルと並び順も同じく新仕様に統一

これでデッサンの記載、列順、ヘッダーラベル、ソート定義がすべて整合しました。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 97a3dc5
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-0４-16)
Claudeさん、ありがとうございます。
確認しました。

私の説明が良くなく、伝わっていなかったようです。

- リストの表示項目:天体ID、天体名、精度記号、精度角距離、日付、辻時刻、月齢、月齢アイコン、方位角、視高度、視半径
  - 月齢、月齢アイコンは、月以外のどの天体の時も、その日付で、その辻時刻の時の月齢と月齢アイコンを表示する。

このようにお願いいたします。

### 回答 (2026-04-16)

月齢と月齢アイコンを、**全天体の結果行でその辻時刻の月の状態を表示**するよう修正しました。

#### 修正内容
`startTsujiSearch` の結果行作成部分で、`if (body.id === 'Moon')` の分岐を削除し、全天体で常に月齢を計算するようにしました:

```js
// 月齢と月齢アイコンは全天体で辻時刻の月の状態を表示
const phase = Astronomy.MoonPhase(dt);
const moonAge = (phase / 360) * SYNODIC_MONTH;
const icons = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
const moonIcon = icons[Math.round(phase / 45) % 8];
```

行HTMLの `r.moonAge >= 0 ? r.moonAge.toFixed(1) : ''` の三項演算子も不要になったので、シンプルに `r.moonAge.toFixed(1)` に変更しました。

これで、例えば「太陽の辻」の結果行にも、その日時の月齢(例: 15.2)と満月アイコン(🌕)が表示されるようになります。新月付近の日を探すのに便利です。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show e127e99
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-0４-16)
Claudeさん、ありがとうございます。
確認しました。
OKです👍

追加で、もう少し改善をしたいです。
新月以外にも、満月に近い時だけ辻検索結果をフィルタしたい場合があります。
そのために、`02-tsujisearch.md`に13.フィルタチェックボックス、14.基準月齢テキストボックス、15.許容範囲月齢テキストボックスを追加しました。
デッサンを確認し、機能追加をしていただけないでしょうか。

また、辻検索の検索期間を「最大36500日(100年間)」と拡大しました。
こちらの対応もよろしくお願いいたします。

### 回答 (2026-04-16)

#### 1. 検索期間を36500日(100年間)に拡大
- `index.html:167` input要素: `max="1461"` → `max="36500"`, プレースホルダー変更
- `script.js:574` 検証範囲: `1461` → `36500`
- ヘルプテキストも更新

#### 2. 月齢フィルタ機能の追加
**UI要素** (index.html): 許容範囲視高度の後に水平線で区切り、以下を追加:
- 「フィルタ」チェックボックス (`chk-tsuji-moon-filter`, 初期値オフ)
- 「基準月齢:」テキストボックス (`input-tsuji-moon-base`, 初期値15, 0〜30, step 0.1)
- 「許容範囲月齢:±」テキストボックス (`input-tsuji-moon-tolerance`, 初期値2, 0〜15, step 0.1)

**appState 追加**:
- `tsujiMoonFilterEnabled: false`
- `tsujiMoonBase: 15`
- `tsujiMoonTolerance: 2`

**saveAppState/loadAppState**: 3つの新プロパティを保存・復元対応

**`updateTsujiMoonFilterUI()`**: フィルタオフ時、基準月齢と許容範囲月齢のテキストボックスを `disabled` に (CSS `:disabled` セレクタで灰色背景)

**`isMoonAgeInRange(moonAge, base, tolerance)`**: 月齢の循環(SYNODIC_MONTH = 29.53058886)を考慮した範囲判定関数
- `diff = |moonAge - base|`
- 循環で近い方を取る: `if (diff > S/2) diff = S - diff`
- `diff <= tolerance` なら範囲内

**辻検索ロジック適用** (`startTsujiSearch` 内の rowData 構築部分):
- フィルタ有効かつ範囲外の結果は `return` でスキップ

例: 基準月齢=0, 許容範囲=2 → `27.53〜29.53` と `0〜2` の月齢範囲のみ表示(新月付近)。満月付近なら基準=15, 許容=2。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 5e50e9b
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-0４-16)
Claudeさん、ありがとうございます。
確認しました。
大丈夫です👍

辻検索でのURL取得した時も、クエリストリングが必要になるので、`00-overview.md`にキーを記載しました。
辻検索で、月齢フィルタを有効にした場合も、URL取得で、きちんと動作をするように、機能改善をお願いいたします。

### 回答 (2026-04-16)

辻検索のURL取得に月齢フィルタ関連のクエリストリングを追加しました。

#### 追加したURLパラメータ (00-overview.md 準拠)
- `tsujiMoonFilter`: boolean ("true"/"false"), 省略時 false
- `tsujiMoonBase`: float, 省略時 15.0
- `tsujiMoonTolerance`: float, 省略時 2.0

#### 修正箇所 (script.js)

**1. URL生成** (`copyTsujiSearchUrl` 内, L4138-4141):
```js
params.set('tsujiAltTolerance', String(appState.tsujiSearchToleranceAlt));
params.set('tsujiMoonFilter', appState.tsujiMoonFilterEnabled ? 'true' : 'false');
params.set('tsujiMoonBase', String(appState.tsujiMoonBase));
params.set('tsujiMoonTolerance', String(appState.tsujiMoonTolerance));
```

**2. URL復元** (`restoreFromUrl` 内 `mode === 'tsujisearch'` ブロック内):
```js
if (params.has('tsujiMoonFilter')) { appState.tsujiMoonFilterEnabled = params.get('tsujiMoonFilter') === 'true'; }
if (params.has('tsujiMoonBase')) { const v = parseFloat(params.get('tsujiMoonBase')); if (!isNaN(v)) appState.tsujiMoonBase = v; }
if (params.has('tsujiMoonTolerance')) { const v = parseFloat(params.get('tsujiMoonTolerance')); if (!isNaN(v)) appState.tsujiMoonTolerance = v; }
```

UIの同期は既存の初期化処理（L334-337）で `appState` → UI反映が行われるため、URL からの復元後にチェックボックスと入力値が正しく反映されます。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 650ae67
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-0４-16)
Claudeさん、ありがとうございます。
確認しました。
大丈夫です👍

ヘルプに私が月齢フィルタの記述を追加しました。
変更を取り込んでください。

次に、大きな機能追加を行います。
`My辻検索メニュー`の追加です。
デッサン`08-mytsujisearch.md`を参照してください。
疑問点、気になるところがあれば質問をしてください。
疑問点、質問点がなくなってから、実装してください。

### 回答 (2026-04-16) — Phase A-1: My辻検索メニューのHTML骨格

Stream idle timeoutを避けるため、Phase A を4段階に細分化して順次実装します。
- **A-1 (本回)**: HTMLセクション骨格 + appState + localStorage保存/復元
- A-2: `renderMyTsujiList()` 行描画 + 初期化呼び出し + dirty flag
- A-3: CRUD操作 (行追加/行削除/上下移動/辻検索取得/全て登録) + イベントリスナー
- A-4: バリデーション (観測点ID/目的点ID存在チェック + 基準方位角/視高度自動計算)

#### A-1 実施内容

1. **`index.html`** — `sec-mytsuji` セクションを `sec-twilight` と `sec-myobs` の間に追加
   - 1段目: 一括選択トグル
   - 2段目: 一括計算/File取得
   - 3段目: 辻検索取得/全て登録
   - エラー表示エリア (`#mytsuji-error`) と リスト表示エリア (`#mytsuji-list`)
   - N+1段目: 上下移動
   - N+2段目: 行追加/行削除
   - N+3段目: 全CSV入力/追加CSV入力/CSV出力
   - N+4段目: URL取得
   - ヘルプセクション「My辻検索」を「My観測点」の前に追加

2. **`script.js`** — `appState.myTsujiSearches = []` を追加
   - 各要素のスキーマ: `{id, name, days, bodyIds, obsId, tgtId, baseAz, baseAlt, offsetAz, offsetAlt, toleranceAz, toleranceAlt, moonFilter, moonBase, moonTolerance, checked}`
   - `saveAppState()` / `loadAppState()` の両方に対応

#### 確認事項
- ブラウザで「My辻検索」セクションが「薄明情報」と「My観測点」の間に表示
- 「▼」で開閉できる（初期: 閉）
- 中身は空のリストと各種ボタン（A-1ではボタンは非動作）
- `appState.myTsujiSearches === []` がコンソールで確認可能
- リロード後もlocalStorageから復元される

次回 A-2 では、`renderMyTsujiList()` 関数を作成し、`appState.myTsujiSearches` をベースに `#mytsuji-list` div内に行を動的描画します。

### 回答 (2026-04-16) — Phase A-2: 行描画 + dirty flag

#### A-2 実施内容

1. **`script.js`** — My辻検索セクション(`// My辻検索 — 共通関数`)を新規追加
   - `myTsujiDirty` グローバルフラグ
   - `setMyTsujiDirty(val)` 関数: 「全て登録」ボタンに `.dirty` クラス付与/除去
   - `getNextMyTsujiId()` 関数: 1〜1000の空きIDを返す
   - **`renderMyTsujiList()`** 関数: `appState.myTsujiSearches` をループして各行を描画
     - 行ヘッダー: ラジオ + チェックボックス + IDラベル(4桁ゼロ埋め)
     - 辻検索名 (text)
     - 検索期間 (number, 1-36500)
     - 天体ID (text, "Sun:Moon"形式)
     - 観測点ID / 目的点ID (number, 1-1000)
     - 基準方位角 / 基準視高度 (number)
     - オフセット方位角 / オフセット視高度 (number, 初期値0)
     - オフセット方位距離 / オフセット視高距離 (number, readonly)
     - 許容範囲方位角 / 許容範囲視高度 (number, 初期値15)
     - 区切り線 (`tsujisearch-separator`)
     - フィルタチェックボックス + 基準月齢 + 許容範囲月齢
   - 0件の時は「My辻検索は登録されていません」メッセージ

2. **`script.js` 初期化** — `renderMyTsujiList()` を `renderMyPointsList('tgt')` の直後に呼び出し追加

3. **CSS** — 既存の `.mypoint-row` / `.mypoint-label` / `.elev-readonly` / `.tsujisearch-separator` / `.body-checkbox` / `.mystars-radio` / `.mystars-empty` をすべて再利用 (新規追加なし)

#### Phase A-2 注意事項
- A-2では**描画のみ**。各フィールドのイベントハンドラ(input/change)はまだ無いので編集してもappStateには反映されません。
- ボタン群(辻検索取得/全て登録/行追加/行削除/上下移動/CSV/URL)もまだ動作しません。
- 動作確認のためには、DevTools コンソールから手動で行を追加してリロードするか、A-3 完了まで待つ必要があります。

#### 動作確認手順
DevTools コンソールから以下を実行してリストの描画を確認:
```js
appState.myTsujiSearches.push({
  id: 1, name: 'テスト', days: 365, bodyIds: 'Sun:Moon',
  obsId: 1, tgtId: 1,
  baseAz: 271.41, baseAlt: 4.62,
  offsetAz: 0, offsetAlt: 0,
  toleranceAz: 15, toleranceAlt: 15,
  moonFilter: false, moonBase: 15, moonTolerance: 2,
  checked: false
});
saveAppState();
renderMyTsujiList();
```
→ My辻検索メニューに1行表示されること

次回 **A-3** では、各ボタンと各フィールドのイベントハンドラを実装し、CRUD操作を可能にします。

### 回答 (2026-04-16) — Phase A-3: CRUD + イベントハンドラ

#### A-3 実施内容

**1. ヘルパー関数追加** (`script.js`):
- `getSelectedMyTsujiId()` — ラジオボタン選択中のIDを取得
- `recalcMyTsujiOffsetDist(t)` — 観測点-目的点間の距離からオフセット方位距離・視高距離を再計算
- `updateMyTsujiButtonStates()` — 行追加/削除/上下移動ボタンの有効/無効を更新 (0件で削除/上下無効、1000件で追加無効)
- `findOrCreateMyObsFromCurrent()` — 位置情報メニューの観測点と一致するMy観測点IDを返す。なければ新規追加
- `findOrCreateMyTgtFromCurrent()` — 同上 (My目的点)

**2. CRUD関数追加** (`script.js`):
- `addMyTsujiRow()` — 空の辻検索情報を追加 (確認ダイアログあり)
  - 初期値: name='', days=365, bodyIds='Sun:Moon', obsId/tgtId/baseAz/baseAlt=null, offsetAz/Alt=0, toleranceAz/Alt=15, moonFilter=false, moonBase=15, moonTolerance=2, checked=false
  - 選択中の行の次に挿入
- `deleteMyTsujiRow()` — 選択中の行を削除 (確認ダイアログあり)
- `moveMyTsujiUp()` / `moveMyTsujiDown()` — 上下移動
- `getMyTsujiFromTsujiSearch()` — 辻検索取得
  - 観測点/目的点の現在値からMy観測点/My目的点を find or create
  - 辻検索メニューの全パラメータをコピー
- `registerAllMyTsuji()` — 全て登録 (バリデーション + dirty クリア)
  - 必須項目: name, days, bodyIds, obsId, tgtId, baseAz, baseAlt
  - 未入力なら赤字メッセージ「辻検索ID:(数字)に未入力のものがあります。入力するか、行削除してください。」表示
- `toggleAllMyTsuji()` — 一括選択/一括解除トグル
  - クラス `.mytsuji-toggle-active` (黄色背景・太字) のオン/オフでラベル切替

**3. `renderMyTsujiList()` 拡張** (`script.js`):
- 描画後、各行のフィールドに `change` イベントハンドラを登録
  - 名前 / 検索期間 (1〜36500) / 天体ID / 観測点ID / 目的点ID
  - 基準方位角 / 基準視高度 / オフセット方位角・視高度
  - 許容範囲方位角 (0〜360) / 視高度 (0〜360)
  - 月齢フィルタチェック / 基準月齢 (0〜30) / 許容範囲月齢 (0〜15)
  - 一括計算チェックボックス
- フィルタチェックボックス変更時に基準月齢・許容範囲月齢の disabled をトグル
- オフセット方位角/視高度/観測点ID/目的点ID 変更時にオフセット距離を自動再計算
- 描画完了後 `updateMyTsujiButtonStates()` を呼び出し

**4. ボタン onclick 登録** (`script.js setupUI`):
- 一括選択 / 辻検索取得 / 全て登録 / ▲上へ / ▼下へ / 行追加 / 行削除
- CSV / URL / 一括計算 / File取得 ボタンは Phase B/C で実装

**5. CSS追加** (`style.css`):
- `.mytsuji-toggle-active`: 黄色背景・太字 (一括解除状態)

#### Phase A-3 完了で動作するもの
- 「辻検索取得」: 現在の辻検索条件を1件追加 (My観測点/My目的点も自動追加)
- 「行追加」: 空行を追加
- 「行削除」: 選択行を削除
- 「▲上へ」「▼下へ」: 並べ替え
- 各フィールド編集 → appState/localStorageに即時反映 + dirty flag
- 「全て登録」: バリデーション + dirty クリア
- 「一括選択/一括解除」: 全行のチェックボックスを一括切替

#### 動作未対応 (Phase A-4 / B / C)
- A-4: 観測点ID/目的点IDの存在チェック (フォーカスアウト時) + 基準方位角/視高度の自動計算
- B: 全CSV入力 / 追加CSV入力 / CSV出力
- C: 一括計算 / File取得 / URL取得 / 専用結果パネル

次回 **Phase A-4** で、観測点ID/目的点IDの検証と、基準方位角/視高度の自動計算を実装します。

### 回答 (2026-04-16) — Phase A-4: バリデーション + 基準方位角/視高度自動計算

#### A-4 実施内容

**1. 新規ヘルパー関数** (`script.js`):
- `renderMyTsujiRowError(row, messages)` — 行内エラー表示エリアにメッセージを設定 (空なら非表示)
- `validateMyTsujiRow(t, row)` — 観測点ID/目的点IDの存在チェック
  - 存在しないIDが入力されていれば、「観測点ID:(数字)はMy観測点リストに存在しません」「目的点ID:(数字)はMy目的点リストに存在しません」のメッセージを行内に赤字太字で表示
  - 正常なら空配列を返して表示クリア
- `autoCalcMyTsujiBase(t, row)` — 観測点ID/目的点IDから基準方位角・視高度を自動計算
  - `calculateBearing` で方位角を算出
  - `calculateApparentAltitude` で視高度を算出 (観測点elev+height、目的点elev+height、地球曲率+気差考慮)
  - `t.baseAz` / `t.baseAlt` を小数第2位まで丸めて更新し、DOMにも反映

**2. `renderMyTsujiList()` 拡張**:
- 行テンプレートに `<div class="mytsuji-row-error"></div>` を追加 (観測点ID/目的点ID行の下)
- 初期描画時に `validateMyTsujiRow(t, row)` を呼び出し、既存データのエラーを表示
- `onChange('mytsuji-obsid')` / `onChange('mytsuji-tgtid')` に検証+自動計算処理を追加
  - 入力直後に `validateMyTsujiRow()` でエラーチェック
  - エラーなしなら `autoCalcMyTsujiBase()` で基準方位角/視高度を自動更新
  - オフセット距離も連動再計算 (既存 `updateDist()`)

**3. CSS追加** (`style.css`):
- `.mytsuji-row-error`: 行内エラー表示エリア (margin 4px 0)

#### Phase A-4 完了で動作するもの (A-3 に加えて)
- 観測点ID/目的点IDの入力時に存在チェック → 無効なら行内に赤字エラー表示
- 観測点ID/目的点ID 変更時に、両方有効なら基準方位角/視高度を自動計算
- 観測点/目的点の緯度経度・標高・高さを使用し、地球曲率 + 気差補正込みで計算
- リロード時に既存データ内の無効IDもエラー表示される

#### Phase A 完了 — 残りフェーズ
- Phase B: CSV入出力 (全CSV入力 / 追加CSV入力 / CSV出力)
- Phase C: 一括計算 / File取得 / URL取得 / 専用結果パネル

次回 **Phase B** に進み、CSV入出力を実装します。

### 回答 (2026-04-16) — Phase B: My辻検索 CSV入出力

#### 確定済み方針
- **CSV列構成**: 15列に拡張 (デッサンの12列 + 月齢フィルタ3列)
- インポート時の13-15列 (フィルタ/基準月齢/許容範囲月齢) は省略可 — 省略時はデフォルト値 (OFF/15/2)
- 既存12列フォーマットもそのまま読み込める後方互換

#### CSV 列構成 (ヘッダー + データ行)
| # | 列名 | 省略時 |
|---|---|---|
| 1 | 辻検索ID | 必須 (1-1000) |
| 2 | 辻検索名 | 必須 |
| 3 | 検索期間 | 必須 (1-36500) |
| 4 | 天体ID | 必須 (`Sun:Moon`形式) |
| 5 | 観測点ID | 必須 (1-1000) |
| 6 | 目的点ID | 必須 (1-1000) |
| 7 | 基準方位角 | 空なら観測点/目的点から再計算 |
| 8 | 基準視高度 | 空なら観測点/目的点から再計算 |
| 9 | オフセット方位角 | 0 |
| 10 | オフセット視高度 | 0 |
| 11 | 許容範囲方位角 | 15 |
| 12 | 許容範囲視高度 | 15 |
| 13 | フィルタ (ON/OFF or 1/0) | OFF |
| 14 | 基準月齢 | 15 |
| 15 | 許容範囲月齢 | 2 |

#### B 実施内容

**1. 新規関数** (`script.js`):
- `calcMyTsujiBaseValues(t)` — DOM非依存で `t.baseAz` / `t.baseAlt` を計算・反映
- `autoCalcMyTsujiBase(t, row)` — 上記 + DOM更新 (A-4からリファクタ)
- `parseMyTsujiCsvLine(cols, lineNum)` — CSV 1行パース共通ロジック
- `importMyTsujiCsv()` — 全CSV入力 (上書き)
  - 1001行まで (ヘッダー込み)
  - 辻検索ID重複チェック
  - 基準方位角/視高度が空なら再計算
- `appendMyTsujiCsv()` — 追加CSV入力
  - CSV内ID重複チェック
  - 内容重複 (ID/名前以外全一致) はスキップ
  - 既存ID重複時は確認ダイアログで採番 or 終了
  - 上限1000件到達でbreak
- `exportMyTsujiCsv()` — CSV出力
  - BOM付きUTF-8
  - ファイル名: `soranotsuji-My辻検索-YYYY-MM-DD-HHmmss.csv`

**2. setupUI ボタン onclick 登録**:
- `btn-mytsuji-csv-import` → `importMyTsujiCsv`
- `btn-mytsuji-csv-append` → `appendMyTsujiCsv`
- `btn-mytsuji-csv-export` → `exportMyTsujiCsv`

**3. 全角→半角変換**: 辻検索名以外の全列を `toHalfWidth()` で変換

#### 動作確認方法 (例)
1. 行追加等で2〜3件登録
2. 「CSV出力」→ ファイルがダウンロードされ、15列構成で内容が一致すること
3. 「全CSV入力」→ 上記ファイルを選択 → 同じ内容が復元されること
4. 基準方位角/視高度を空にしたCSVを作成 → 「全CSV入力」→ 自動再計算されること
5. 「追加CSV入力」→ ID重複は確認ダイアログ、内容重複はスキップ

#### 残り
- Phase C: 一括計算 / File取得 / URL取得 / 専用結果パネル

次回 **Phase C** に進み、一括計算等を実装します。

### 回答 (2026-04-16) — Phase C: My辻検索 一括計算 / File取得 / URL取得 / 専用結果パネル

Phase C はボリュームのため、以下の3サブフェーズで実装しました。

#### C-1: URL取得
- `getMyTsujiUrl()` — ラジオ選択中のMy辻検索情報をURLクエリに詰めて生成、クリップボードにコピー
  - 観測点/目的点の lat/lng/elev/height
  - 天体ID群 (`:`区切り → 複数 `starId`)
  - 検索期間/基準方位角/視高度/オフセット2/許容範囲2
  - 月齢フィルタ/基準月齢/許容範囲月齢
  - 成功時メッセージ: 「My辻検索リストの辻検索（ID:(数字)、辻検索名）を開くURLをクリップボードにコピーしました。」
- `btn-mytsuji-url` onclick 登録

#### C-2: 一括計算 + 専用結果パネル
- **新HTMLパネル** `#mytsuji-panel` (index.html, 地図直下):
  - ヘッダー: 「My辻検索結果」+ ステータス + 閉じるボタン
  - コンテンツ: テーブル表示エリア
- **CSS追加** (`style.css`): `#mytsuji-panel` 一式、`#tsujisearch-panel` より大きめ (35%)、z-index 915
- **`executeSingleMyTsujiSearch(t)`** — 単一のMy辻検索行を実行
  - 観測点/目的点を myObservations/myTargets から取得
  - `t.bodyIds` を `:`区切りで展開し、appState.bodies から該当天体を取得
  - 既存 `tsuji-search-worker.js` を流用して並列計算 (チャンク分割)
- **`decorateMyTsujiResults(results)`** — 結果に装飾情報を付加
  - 精度記号 (`◎○△-`), 月齢, 月齢アイコン, dateStr, timeStr
  - 各行の月齢フィルタチェックで除外
- **`runBatchMyTsujiSearch()`** — チェック済み行を順次実行し、`#mytsuji-panel` に表示
  - 確認メッセージ: 「チェックされた辻検索を実行しますか？」
  - ステータス: `⏳ 実行中... X/Y (ID:X ID名)`
  - テーブル: 辻検索ID/名/日付/辻時刻/天体ID/精度/角距離/月齢/月齢アイコン/方位角/視高度
  - 行クリック → 観測点/目的点/日時を設定してメイン画面でプレビュー
- ボタン onclick 登録: `btn-mytsuji-batch`, `btn-mytsuji-panel-close`

#### C-3: File取得 (CSV出力)
- **`buildMyTsujiCsvRow(r)`** — decorated結果1行を41列CSV配列に変換
  - デッサン仕様の全項目:
    - 辻検索ID, 辻検索名, 日付(YYYY年MM月DD日(曜日))
    - 日の出/日の入/月の出/月の入 (`HH:mm:ss`)
    - 月齢, 月齢アイコン
    - 天文/航海/夜明/常用の薄明4×2 = 8項目
    - 天体ID, 天体名, 天体赤緯, 天体赤経
    - 観測点ID/名/緯度/経度/標高/高
    - 目的点ID/名/緯度/経度/標高/高
    - 精度記号, 精度角距離
    - 辻時刻, 方位角, 視高度, 視半径
    - **プレビューURL** (`mode=preview` 付き)
- **`fileBatchMyTsujiSearch()`** — チェック済み行を実行し、結果をCSVダウンロード
  - 確認メッセージ: 「チェックされた辻検索を実行し、結果をCSVでFile取得しますか？」
  - ファイル名: `soranotsuji-My辻検索結果-YYYY-MM-DD-HHmmss.csv`
  - BOM付きUTF-8, カンマ/改行を含む文字列は `"` でエスケープ
- ボタン onclick 登録: `btn-mytsuji-file`

#### 動作確認のお願い
1. **URL取得**: ラジオで選択 → 「URL取得」→ クリップボードにURLコピー → 別タブで開くと、観測点/目的点/辻検索条件が復元される
2. **一括計算**: 複数行をチェック → 「一括計算」→ 結果パネルに表示 → 行クリックでメイン画面にプレビュー
3. **File取得**: 複数行をチェック → 「File取得」→ 41列のCSVがダウンロードされる。プレビューURL列をブラウザで開くと結果日時が復元される
4. **結果パネル閉じる**: 「閉じる」ボタンでパネル非表示

### 全Phase完了 — My辻検索メニュー

| Phase | 内容 | Commit |
|---|---|---|
| A-1 | HTML骨格 + appState + localStorage | `f77be95` |
| A-2 | 行描画 + dirty flag | `6a3647e` |
| A-3 | CRUD + イベントハンドラ + 一括選択 | `cc9e189` |
| A-4 | バリデーション + 基準方位角/視高度自動計算 | `c11884c` |
| B | CSV入出力 (全/追加/出力) | `084528c` |
| C (C-1〜C-3) | URL取得 + 一括計算 + File取得 | (本コミット) |

### 留意事項
- プレビューURL (`mode=preview`) は既存URL復元ロジックを利用し、page loadで日時と観測点/目的点が復元される。`mode=preview` 自身の特殊な挙動は未実装 (将来拡張向け)
- 結果パネルはスクロール可能。41列のCSVは少し重いため、大量行でのFile取得は時間がかかる可能性あり
- 行クリックのプレビューは「そのとき」の観測点/目的点/日時をメイン画面にコピーして表示します

ご確認をお願いします。
