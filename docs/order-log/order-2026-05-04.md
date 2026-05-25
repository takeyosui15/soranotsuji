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
git show 1e1c93a
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-05-04)
Claudeさん、ありがとうございます。
やはり、うまく進捗バーが表示されません。
いっそのことよく100年分(36500日分)計算するので、辻検索とMy辻検索を並行・並列・プール化したワーカースレッドで非同期化しませんか。
検索期間は、だいたい365の倍数になるので、ワーカースレッドに渡す単位を365単位くらいが良いと思います。
それから、テキストボックスのステップを1日単位でなくて、365日単位にして欲しいです。
よろしくお願いいたします。

### 回答 (2026-05-04) — 辻検索/My辻検索のWorkerプール化 + 365日チャンク + 進捗バー細粒化

#### 1. Worker Pool アーキテクチャの実装

辻検索 / My辻検索の両方が**同一の `tsujiPool` を共有**するグローバル Worker プールを実装しました。プールはタスクキューを持ち、空いているワーカーから順にタスクを処理します。

```js
const TSUJI_CHUNK_DAYS = 365;
const TSUJI_NUM_WORKERS = Math.max(1, Math.min(navigator.hardwareConcurrency || 4, 8));

const tsujiPool = (() => {
    let workers = [];
    let idle = [];
    const queue = [];
    const active = new Map();

    function ensure() { while (workers.length < TSUJI_NUM_WORKERS) { ... } }
    function dispatch() { while (idle.length && queue.length) { ... } }
    function run(worker, task) {
        worker.onmessage = (e) => { task.resolve(e.data); idle.push(worker); dispatch(); };
        worker.postMessage(task.taskData);
    }
    return {
        runTask(taskData) { ... ensure(); queue.push({...}); dispatch(); },
        terminateAll() { ... reject all active+pending ... }
    };
})();
```

**特徴**:
- ワーカーは一度作成すると再利用 (起動オーバーヘッドを毎回負担しない)
- 同時実行数は最大 `navigator.hardwareConcurrency` (上限8)
- `terminateAll()` で全ワーカーを破棄しつつ、active/pending タスクを reject (orphan async が await から抜けて正常終了できる)

#### 2. 365日固定チャンクへの変更

旧: `chunkSize = Math.ceil(searchDays / TSUJI_NUM_WORKERS)` (例: 36500/8 = 4563日)
新: 固定 `TSUJI_CHUNK_DAYS = 365` (36500日 → 100チャンク)

これにより、**100年分の検索でも100個の細かいタスクに分割され、プール内で並列処理**されます。1チャンク = 約365日分 = 365 × (1440分 + 121秒) の計算量で、1〜2秒程度で完了します。

ヘルパー関数 `runTsujiChunks()` を追加:

```js
async function runTsujiChunks({ bodyMsg, ..., days, onChunkDone }) {
    const numChunks = Math.ceil(days / TSUJI_CHUNK_DAYS);
    const promises = [];
    for (let c = 0; c < numChunks; c++) {
        const dayStart = c * TSUJI_CHUNK_DAYS;
        const dayEnd = Math.min(dayStart + TSUJI_CHUNK_DAYS, days);
        const p = tsujiPool.runTask({...}).then(data => {
            if (onChunkDone) onChunkDone();  // ← 1チャンクごとに進捗更新
            return data;
        }).catch(_ => { onChunkDone?.(); return { results: [], dayStart, dayEnd }; });
        promises.push(p);
    }
    return (await Promise.all(promises)).sort((a, b) => a.dayStart - b.dayStart);
}
```

#### 3. 進捗バー細粒化 (チャンク単位)

進捗バーの分母を「チャンクの総数」に変更:
- **辻検索**: `天体数 × ceil(searchDays/365)` (例: 5天体 × 100チャンク = 500)
- **My辻検索**: `Σ(行ごと: 天体数 × ceil(days/365))`

```js
const totalChunks = checked.reduce((sum, t) => {
    const ids = (t.bodyIds || '').split(':').filter(s => s.trim());
    const chunksPerBody = Math.ceil((t.days || 0) / TSUJI_CHUNK_DAYS);
    return sum + Math.max(1, ids.length) * Math.max(1, chunksPerBody);
}, 0);
let doneChunks = 0;
const chunkDoneCb = () => {
    doneChunks++;
    setTsujiProgress(doneChunks, totalChunks);
};
```

これで100年検索でも100チャンク単位で進捗が見え、進捗バーが必ず表示されます。1天体分でも100チャンクなので、十分な粒度になります。

#### 4. 計算順序の変更 (天体間も並列化)

旧: 天体ごとに sequential `for` ループ + 各天体内のチャンクを並列
新: **全天体の全チャンクを Promise.all で一気にプールへ投入**

```js
const allBodyResults = await Promise.all(visibleBodies.map(body => {
    return runTsujiChunks({ ... onChunkDone: chunkDoneCb });
}));
```

プールサイズ8、100年×5天体 = 500チャンクの場合、8並列で順次処理されます。

#### 5. テキストボックスのステップ変更 (1日 → 365日)

- `index.html` L168: `<input id="input-tsuji-search-days" step="1">` → `step="365"`
- `script.js` L4795: `<input class="mytsuji-days" step="1">` → `step="365"`

これで↑↓キーやスピナーで365日単位で値を変更できます。

#### 6. 強制キャンセルの動作改善

旧: `worker.terminate()` は `worker.onmessage` を発火させないため、`Promise.all(chunkPromises)` がハングし orphan async がメモリリーク。
新: `tsujiPool.terminateAll()` 内で active/pending タスクの Promise を**明示的に reject** するため、orphan async は `await` から抜けて自身の generation チェックでクリーンに return できます。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 535cc0d
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-05-04)
Claudeさん、ありがとうございます。
確認しました。
大丈夫でした。
ありがとうございます。

少し訂正をしていただきたいのですが、検索日時の365日ステップですが、最小値が1のため、365の倍数+1になってしまうようです。
最小値を0にすれば良いと気がついたのですが、プログラム側で検索日時が0の時は1にするような処理が必要と思いました。
`min=0`として動作するように変更をお願いいたします。

### 回答 (2026-05-04) — 検索日数 min=0 + 0→1 内部正規化

#### HTML 側: `min="0"` に変更

- `index.html` L168: `<input id="input-tsuji-search-days" step="365" min="1" max="36500">` → `min="0"`
- `script.js` L4770 (My辻検索の `mytsuji-days` 入力): `min="1"` → `min="0"`

これでスピナーの有効ステップ値が `0, 365, 730, 1095, ..., 36500` (365の倍数) になります。

#### コード側: 値が `0` の時に `1` へ正規化

旧コードは `parseInt(...) || 365` というイディオムを使っていましたが、`0` も falsy のため `0 || 365 = 365` となり、入力された 0 が意図せず 365 にリセットされていました。

新コードは `isNaN` を明示判定し、空欄のみ既定値 (365) にフォールバック、その後 `Math.max(v, 1)` で最小値 1 にクランプ:

```js
// script.js (input-tsuji-search-days)
let v = parseInt(e.target.value);
if (isNaN(v)) v = 365;
appState.tsujiSearchDays = Math.min(Math.max(v, 1), 36500);

// script.js (mytsuji-days)
let v = parseInt(e.target.value);
if (isNaN(v)) v = 365;
v = Math.min(Math.max(v, 1), 36500);
t.days = v;
```

#### 期待される挙動

| ユーザー入力 | 内部値 | HTML 表示 |
|---|---|---|
| 空欄 | 365 | 365 |
| 0 | 1 | 1 |
| 365 | 365 | 365 |
| 730 | 730 | 730 |
| 36500 | 36500 | 36500 |
| 50000 | 36500 | 36500 |

スピナーで「365 → 0 → (1に正規化)」と遷移しても、続けて手入力で `730` 等を直接打鍵すれば 365 倍数で進められます。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 25f55b2
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-05-04)
Claudeさん、ありがとうございます。
確認しました。

続いて、機能追加です。
「辻ライン365」ボタンを追加します。
詳細は、デッサン`01-location.md`に記載をしました。
よろしくお願いいたします。

### 回答 (2026-05-04) — 辻ライン365 トグルボタンの追加

#### 1. ボタンの追加 (`index.html`)

位置情報メニュー1列目5段目 (旧spacer-btn位置) に追加:

```html
<div class="control-row">
    <div class="btn-group-left">
        <button id="btn-dp365" class="nav-btn small" title="辻ライン365(直近1年の辻ラインを描画します)">辻</button>
    </div>
    <label class="input-label">目的点標高(m):</label>
    ...
</div>
```

#### 2. 状態管理 (`script.js`)

- `appState.isDP365Active: false` (新規)
- `saveAppState` / `loadAppState` に追加
- 起動時の `if (appState.isDP365Active) document.getElementById('btn-dp365').classList.add('active')`

#### 3. `toggleDP365()` トグルハンドラ

```js
function toggleDP365() {
    appState.isDP365Active = !appState.isDP365Active;
    const btn = document.getElementById('btn-dp365');
    if (appState.isDP365Active) {
        btn.classList.add('active');
        updateDP365Lines();
    } else {
        btn.classList.remove('active');
        dp365Layer.clearLayers();
        dp365CurrentGeneration++; // 進行中の計算を破棄
    }
    saveAppState();
}
```

OFF時は世代カウンタをインクリメントすることで、進行中の Promise が結果を破棄します。

#### 4. `updateDP365Lines()` — 並列バッチ計算

365日分 × 表示天体分のpath計算を、DPプール (`dp-line-worker`) のWorkerプールに投入します。UIフリーズ回避のため `BATCH_DAYS = DP_POOL_SIZE` (8日) ずつのバッチで処理し、バッチ間で `await` して yield。

```js
const BATCH_DAYS = DP_POOL_SIZE;
for (let dOff = 0; dOff < totalDays; dOff += BATCH_DAYS) {
    if (generation !== dp365CurrentGeneration) return;
    const batchTasks = [];
    for (let b = 0; b < BATCH_DAYS && (dOff + b) < totalDays; b++) {
        const day = new Date(baseDate.getTime() + (dOff + b) * 86400000);
        for (const body of visibleBodies) {
            batchTasks.push(calculateDPPathPoints(day, body, observer).then(pts => {
                if (generation !== dp365CurrentGeneration) return;
                drawDP365Path(pts, body.color);
                doneWork++;
                updateLabel();  // 「辻」ボタンに XX% 表示
            }));
        }
    }
    await Promise.all(batchTasks);
}
```

`calculateDPPathPoints` は既存の DP プール (1秒サンプリング) を再利用するため、新規 Worker は不要です。

#### 5. `drawDP365Path()` — 軽量描画 (◎破線のみ)

通常の辻ラインと違い、5分マーカー・時刻ラベル・前後日線・視半径エッジ線・△境界線などは描画しません。`dashArray: '13, 13'` の破線のみ、weight=3, opacity=0.6 で控えめに表示します。

```js
L.polyline(seg, { color, weight: 3, opacity: 0.6, dashArray: '13, 13' }).addTo(dp365Layer);
```

`dp365Layer` は通常の `dpLayer` とは独立したレイヤーで、365のON/OFFが通常の辻ラインに影響しません。

#### 6. 進捗表示

ボタン自体に `XX%` を表示します (例: `45%`)。完了時に「辻」に戻ります。

#### 7. 仕様メモ

- 365日 × 5天体 = 1825 path計算 (各day内で各天体について 1時間粗スキャン → 可視時間のみ Worker で 1秒サンプリング)
- 太陽・月のように毎日空に出る天体だと、各day平均 6〜12時間 × 1825 day ≈ 11000〜22000 Workerタスク。プール8並列で数分〜十数分の処理。
- `appState.isMoving` 中は `calculateDPPathPoints` がメインスレッド1分粗描画パスへ分岐するため、365 を有効化中にアニメーションを開始した場合は描画品質が下がります (停止後に手動でトグルOFF→ONで再計算してください)。
- 計算中にユーザーが日付/位置を変更しても、既に開始した365計算は当時の値で完了します (現在の世代のものは描画される)。次回ON時に最新値で再計算されます。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show b542338
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-05-04)
Claudeさん、ありがとうございます。
確認しました。
スマホで実行すると、メモリ不足で処理がキャンセルされるようです。
1秒間隔でなくて1分間隔にしましょう。
あと、途中で処理をキャンセルすると、ボタンラベル名が「何％」のままで「辻」に戻りません。
修正をよろしくお願いいたします。

### 回答 (2026-05-04) — 辻ライン365 を1分間隔に変更 + キャンセル時のラベル復元

#### 1. サンプリング間隔を 1秒 → 1分 に変更 (メモリ削減 60×)

**worker側 (`dp-line-worker.js`)**: `stepSeconds` パラメータを追加し、ループ刻み幅を可変化:

```js
const stepSec = (stepSeconds && stepSeconds > 0) ? stepSeconds : 1;
const startSec = hourStart * 3600;
const endSec = hourEnd * 3600;
for (let s = startSec; s < endSec; s += stepSec) {
    // ...
}
```

`stepSeconds` 未指定時は従来通り 1秒 (通常の辻ライン用)。

**`calculateDPPathPoints` (`script.js`)**: 第4引数に `opts` オブジェクトを追加:

```js
async function calculateDPPathPoints(targetDate, body, observer, opts = {}) {
    const stepSeconds = opts.stepSeconds || 1;
    const forceWorker = !!opts.forceWorker;
    // ...
    if (appState.isMoving && !forceWorker) { /* main-thread fallback */ }
    // ... pass stepSeconds to dpPoolRunTask({ ..., stepSeconds })
}
```

- `opts.stepSeconds`: Worker内サンプリング間隔(秒) (デフォルト 1)
- `opts.forceWorker`: アニメ中でもメインスレッドフォールバックせずWorkerパス強制 (365モード用)

**`updateDP365Lines`**: `{ stepSeconds: 60, forceWorker: true }` を渡す:

```js
calculateDPPathPoints(day, body, observer, { stepSeconds: 60, forceWorker: true })
```

これで:
- 1チャンク (1時間) 当たり最大 3600 → 60 ポイント (60×削減)
- 365日 × 5天体 × 60点/時間 × 6〜12時間 ≈ 65万〜130万 → 1万〜2万 ポイントへ
- スマホでもメモリ枯渇しにくくなります

**他の動作への影響なし**: 通常の辻ライン (`updateDPLines`) は引数を渡さないため、従来通り1秒精度のまま動作します。

#### 2. キャンセル時のボタンラベル復元

**バグの原因**: `updateDP365Lines` の `finally` ブロックは「自分の世代がまだアクティブな時のみ」ラベルを復元していたため、ユーザーがOFFトグル → `dp365CurrentGeneration++` の時、orphan は既に古い世代になっており finally の条件分岐がfalseとなり、ラベルが「XX%」のままでした。

**修正**: `toggleDP365()` のOFF分岐で**即座にラベルを復元**:

```js
} else {
    btn.classList.remove('active');
    btn.textContent = '辻'; // ← 進捗表示(XX%)が残らないように即座にラベル復元
    dp365Layer.clearLayers();
    dp365CurrentGeneration++;
}
```

orphan async の `.then()` 内では `if (generation !== dp365CurrentGeneration) return;` チェックを通るため、キャンセル後の遅延ポイント描画やラベル更新は行われず、リセット済みラベルが上書きされる心配もありません。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 99b145d
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-05-04)
Claudeさん、ありがとうございます。
確認しました。
スムーズに表示されるようになりました。

あと、私の伝え方が良くなかったのですが、表示天体メニューで表示を切り替えた時に、表示・再表示出来るようにしたいです。
何か疑問点や質問はありますでしょうか。

### 回答 (2026-05-04) — 表示天体トグルに連動した辻ライン365の表示/再表示

#### 質問はありません — 仕様を以下のように設計しました

「再計算は重い」 (1分間隔でも数分かかる) ため、単純な「全再計算」ではなく **天体ごとレイヤー + 計算済みキャッシュ** で実装しました。これにより既に計算済みの天体は再計算なしで瞬時に表示・非表示を切り替えできます。

#### 1. データ構造の変更 (`dp365LayerByBody` + `dp365CalculatedBodies`)

旧: 単一 `dp365Layer = L.layerGroup()` に全天体の線をまとめて描画
新:
```js
let dp365LayerByBody = {};      // body.id -> L.layerGroup
let dp365CalculatedBodies = new Set();  // 365日分の計算が完了した天体ID
```

各天体ごとに独立したレイヤーグループを保持し、map への add/remove で表示・非表示を制御します。

#### 2. `toggleVisibility` フック

表示天体メニューのチェックボックス変更時に `updateDP365Lines()` を呼び出し:

```js
function toggleVisibility(id, checked) {
    // ...既存処理...
    if (appState.isDP365Active) {
        updateDP365Lines();
    }
}
```

#### 3. `updateDP365Lines` のスマート化

```js
async function updateDP365Lines() {
    const generation = ++dp365CurrentGeneration;
    const visibleBodies = appState.bodies.filter(b => b.visible);
    const visibleIds = new Set(visibleBodies.map(b => b.id));

    // (a) 非表示になった天体: レイヤーをmapから外す (キャッシュは保持)
    Object.entries(dp365LayerByBody).forEach(([id, layer]) => {
        if (!visibleIds.has(id) && map.hasLayer(layer)) {
            layer.removeFrom(map);
        }
    });
    // (b) 計算済み・表示中の天体: 即座にmapに追加 (再計算なし)
    visibleBodies.forEach(body => {
        if (dp365CalculatedBodies.has(body.id)) {
            const layer = ensureDP365LayerForBody(body.id);
            if (!map.hasLayer(layer)) layer.addTo(map);
        }
    });
    // (c) 未計算の天体だけ計算
    const newBodies = visibleBodies.filter(b => !dp365CalculatedBodies.has(b.id));
    if (newBodies.length === 0) return;  // 全て計算済みなら即終了
    // ... (newBodies のみ 365日 × プールバッチで計算) ...
}
```

#### 4. 振る舞い表

| シナリオ | 動作 |
|---|---|
| 365 OFF→ON (Sun, Moon表示中) | Sun, Moon の365日分を計算 (数分) |
| Marsチェック (Sun, Moon計算済) | **Mars のみ計算** (Sun, Moon は再計算しない) |
| Sun チェック解除 | Sun のレイヤーを map から外すだけ (即時) |
| Sun チェック再投入 | キャッシュ済みなのでレイヤーを map に再追加 (即時) |
| 365 OFF→ON | キャッシュをクリア → 全可視天体を再計算 (位置/日付変更後の更新はこれで) |

#### 5. 既知のリミテーション

- 観測点・目的点・日付・気象パラメータを変更してもキャッシュは無効化されません。最新値で再計算したい場合は **365 OFF→ON** で完全リフレッシュしてください (ボタンOFF時に `clearAllDP365Layers()` でキャッシュ全クリア)。
- 計算中(`%`表示中)に追加で天体をチェックすると、進行中計算は generation チェックでキャンセルされ、新規天体含む再計算が始まります。既存天体の計算が完了していなければ完了マークもされないため、再計算時に再度処理されます。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 8a30928
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-05-04)
Claudeさん、ありがとうございます。
確認しました。

どうやら、辻365ボタンを押下したままで、ブラウザを閉じると、再びブラウザを開いた時に、辻ラインが描画されないようです。
原因の調査と改善をお願いいたします。
なんとなくなのですが、辻365ボタンは、ブラウザを開いたときは、前の状態にかかわらず初期値はOFFで良いように思えます。

### 回答 (2026-05-04) — 辻ライン365 を「起動時は常にOFF」に変更

#### 原因の調査結果

**問題**: 旧実装では `appState.isDP365Active` を localStorage に保存・復元していました。トグル ON のままブラウザを閉じると、再起動時に:
- `isDP365Active = true` が復元される
- ボタンに `active` クラスが付く (見た目はON)
- しかし `updateDP365Lines()` が呼ばれない (init には `classList.add('active')` のみで、計算開始処理がない)

→ ボタンは「ON」に見えるが、実際には何も計算されておらず、線も描画されないという矛盾状態でした。

#### 設計判断

ユーザー提案の通り、「起動時は常に OFF」とするのが最適と判断しました。理由:

1. **365日計算は重い** — 起動時に勝手に開始されると、ユーザー意図せずCPU/メモリを消費 (特にスマホで問題)
2. **キャッシュ無効化が困難** — 観測点・目的点・日付が前回と異なる場合、復元したキャッシュは古い設定のもの。整合性を担保するには起動時に全再計算が必要だが、これも重い
3. **代替手段が容易** — ユーザーは起動後にボタンを押すだけで再計算開始できる

#### 修正内容 (2箇所)

**`saveAppState`**: `isDP365Active` を保存対象から外す:

```js
isDPActive: appState.isDPActive,
// isDP365Active は意図的に保存しない:
// - 365日計算はキャッシュ無効化(位置/日付変更)を伴うため起動時のキャッシュ復元が困難
// - 重い計算を起動時にユーザーの意図なしに走らせない
// - 起動時は常にOFFで、ユーザーがボタン押下時のみ計算開始
locMode: appState.locMode,
```

**`loadAppState`**: 復元処理を削除:

```js
if(saved.isDPActive !== undefined) appState.isDPActive = saved.isDPActive;
// isDP365Active は読み込まない: 起動時は常に OFF で初期化済み (saveAppStateにも保存しない)
if(saved.locMode) appState.locMode = saved.locMode;
```

`appState.isDP365Active` の初期値 `false` (L245) はそのまま使われ続けるため、起動時は常に OFF (ボタンラベル「辻」、active クラスなし) で表示されます。

#### 既存の `if (appState.isDP365Active) ...` 初期化分岐

L333 の初期化コードは残しています (デッドコードに見えますが、デフォルト値変更時の保険として無害)。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 54c1ae6
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-05-04)
Claudeさん、ありがとうございます。
確認しました。

次に、

- 標高グラフで視高度の赤い線をスタート地点に観測点高を補正出来るようにし、ゴール地点に目的点高を補正できるようにする。
- 可視判定直線から、可視ならOK、ダメならNGを表示する。

詳細は、`01-location.md`に記載しましたので、ご確認ください。
実装をお願いいたします。

### 回答 (2026-05-04) — 標高グラフの可視直線(高さ補正) + OK/NG可視判定ポップアップ

#### 1. 赤い可視直線を「観測点高/目的点高」を含む明示的な値で描画

旧コード: `appState.start.elev` / `appState.end.elev` を使用 (内部的に `recalcElev` で `apiElev + height` が反映されるが、計算経路によっては不整合の可能性あり)

```js
const startElev = appState.start.elev;  // 暗黙に height を含む
const endElev = appState.end.elev;
```

新コード: API標高と高さを**明示的に加算**して使用 (意図と整合性が明確)

```js
// 見通し線（赤）: スタート地点(API標高+観測点高) → ゴール地点(API標高+目的点高)
const startElev = appState.startApiElev + appState.startHeight;
const endElev = appState.endApiElev + appState.endHeight;
```

これにより、標高グラフ上の赤線は**観測点高(`input-start-elev`)** と**目的点高(`input-end-elev`)** の値を直接反映します。

#### 2. 可視判定ロジック (`computeVisibility`)

100mおきの2000地点の標高データから、可視直線との比較で可視性を判定:

```js
function computeVisibility() {
    const pts = appState.elevationData.points.filter(p => p.fetched);
    if (pts.length < 2) return { visible: true };
    const startElev = appState.startApiElev + appState.startHeight;
    const endElev = appState.endApiElev + appState.endHeight;
    const totalDist = pts[pts.length - 1].dist;
    // 両端は判定対象外 (スタート/ゴール地点自体は除外)
    for (let i = 1; i < pts.length - 1; i++) {
        const pt = pts[i];
        const lineElev = startElev + (endElev - startElev) * (pt.dist / totalDist);
        if (pt.elev > lineElev) {
            return { visible: false, blockingDist: pt.dist, blockingElev: pt.elev, lineElevAtBlocking: lineElev };
        }
    }
    return { visible: true };
}
```

各点について、可視直線上の同距離での高さ `lineElev` を線形補間で求め、地形標高 `pt.elev` がそれを超える点が一つでもあればNG。最初に検出した地点の情報 (距離・標高・直線高度) を返します。

#### 3. ポップアップ表示 (`showVisibilityResult`)

取得完了後に1回だけ呼び、結果を `alert` で通知:

```js
function showVisibilityResult() {
    const r = computeVisibility();
    if (r.visible) {
        alert('可視判定: OK\n観測点から目的点が見通せます');
    } else {
        alert(`可視判定: NG\n観測点から ${r.blockingDist.toFixed(2)}km 地点 (標高 ${r.blockingElev.toFixed(1)}m) が可視直線(${r.lineElevAtBlocking.toFixed(1)}m)を遮っています`);
    }
}
```

NG時はどこでブロックされているかも具体的に表示するため、ユーザーが原因地点を把握しやすくなります。

#### 4. `startElevationFetch` の最後で呼び出し

進捗中の `drawProfileGraph` (中間描画) ではポップアップを出さず、**全タイル取得完了後の最終描画後に1回だけ**呼ぶよう配置:

```js
await fetchAllElevations(...);
document.getElementById('progress-overlay').classList.add('hidden');
drawProfileGraph();
showVisibilityResult();  // ← 取得完了後の1回のみ
```

#### 仕様メモ

- 両端 (スタート・ゴール地点自体) は判定対象外。それらは線の端点なので必然的に直線上にあり、誤判定を避けるため `for (let i = 1; i < pts.length - 1; i++)` でスキップ。
- 屈折・地球曲率は考慮していない単純な直線判定です (山などの遠距離見通しでは精度に注意)。
- 観測点高 / 目的点高 を変更後に標高グラフを再表示すると、新しい高さで再判定されます。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 04854e3
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-05-04)
Claudeさん、ありがとうございます。
確認しました。
そこまで具体的にありがとうございます。

可視判定のメッセージとヘルプに、「屈折・地球曲率は考慮していない単純な直線判定です（遠距離見通しでは精度に注意）」という注意書きを書けないでしょうか。

### 回答 (2026-05-04) — 可視判定の注意書きをポップアップ/ヘルプに追加

#### 1. ポップアップメッセージ (`script.js` の `showVisibilityResult`)

OK/NGどちらの場合も末尾に注意書きを付加するため、共通の `note` 定数を導入:

```js
function showVisibilityResult() {
    const r = computeVisibility();
    const note = '\n\n※ 屈折・地球曲率は考慮していない単純な直線判定です(遠距離見通しでは精度に注意)';
    if (r.visible) {
        alert('可視判定: OK\n観測点から目的点が見通せます' + note);
    } else {
        const dist = r.blockingDist.toFixed(2);
        const elev = r.blockingElev.toFixed(1);
        const lineE = r.lineElevAtBlocking.toFixed(1);
        alert(`可視判定: NG\n観測点から ${dist}km 地点 (標高 ${elev}m) が可視直線(${lineE}m)を遮っています` + note);
    }
}
```

注意書きの前に空行 (`\n\n`) と「※」マークを置き、本文と分離して見やすくしました。

#### 2. ヘルプセクション (`index.html` 標高グラフ)

```html
<section class="help-section">
    <h3>標高グラフ</h3>
    <p>観測点と目的点の間の地形断面を表示します。国土地理院のDEM標高タイルから2000地点で標高を取得します。</p>
    <p>取得完了後、観測点高・目的点高を加えた可視直線(赤線)に対して、地形が遮らないかを判定し、可視なら「OK」、不可視なら「NG」のポップアップを表示します。なお、屈折・地球曲率は考慮していない単純な直線判定です(遠距離見通しでは精度に注意)。</p>
</section>
```

可視判定機能の動作概要 + 注意書きを2段落目として追加しました。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show 448ccf3
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-05-04)
Claudeさん、ありがとうございます。
確認しました。

続いて、`02-tsujisearch.md`と`08-mytsujisearch.md`で、辻検索とMy辻検索の画面表示項目とFile出力項目を見直しました。
実装をお願いいたします。

### 回答 (2026-05-04) — 辻検索/My辻検索の表示項目とFile出力項目を再構成

#### 1. 辻検索パネル (`startTsujiSearch`)

**列構成変更**:
- 削除: 天体ID
- 追加: 日の出時刻 / 日の入時刻 / 月の出時刻 / 月の入時刻 (辻時刻の直後)
- 順序: 天体名 → 精度記号 → 精度角距離 → 日付 → 辻時刻 → 日の出/日の入/月の出/月の入時刻 → 月齢 → 月齢アイコン → 方位角 → 視高度 → 視半径

**書式変更**:
- 日付: `YYYY/MM/DD(曜日)` → `YYYY年MM月DD日(曜日)` (Japanese format, dessin準拠)
- 方位角/視高度: `0.0000°` → `0.00°` (dessinで2桁指定。precision regression to 2 decimals)
- 精度角距離: `0.00000°` (5桁、変更なし)

**rise/set計算**:
日付別キャッシュ `riseSetCache[dateString]` で、`Astronomy.SearchRiseSet` を 1日につき1回 (Sun rise/set, Moon rise/set の4回) のみ実行。365日 × 4 = 1460回程度に抑制。

```js
const riseSetCache = {};
function getRiseSetForDay(dateObj) {
    const key = dateObj.toDateString();
    if (riseSetCache[key]) return riseSetCache[key];
    // ... Astronomy.SearchRiseSet × 4 ...
    return riseSetCache[key] = { sr, ss, mr, ms };
}
```

**ソート対応**: 日の出/日の入/月の出/月の入時刻列に対する `setupTableSort` 比較関数を追加。

#### 2. My辻検索パネル (`renderMyTsujiResultRow`)

**列構成変更**:
- 追加: 日の出時刻 / 日の入時刻 / 月の出時刻 / 月の入時刻 (辻時刻と月齢の間)
- 順序: 辻検索ID → 辻検索名 → 天体ID → 天体名 → 観測点ID → 観測点名 → 目的点ID → 目的点名 → 精度記号 → 精度角距離 → 日付 → 辻時刻 → 日の出/日の入/月の出/月の入時刻 → 月齢 → 月齢アイコン → 方位角 → 視高度 → 視半径

**書式変更**:
- 日付: `YYYY/MM/DD(曜日)` → `YYYY年MM月DD日(曜日)`
- 方位角/視高度: `0.0000°` (4桁、変更なし)

**rise/set計算**:
`decorateMyTsujiResults()` 内で行ごとに直接計算 (観測点が行ごとに異なるためキャッシュは複雑化を避ける)。

#### 3. My辻検索 File出力 (`buildMyTsujiCsvRow`)

**列構成変更**:
- 移動: 辻時刻 — 「精度角距離と方位角の間」 → 「日付の直後」
- 追加: 相手距離 / 相手方位 / 相手高度 (視半径と オフセット系の間)
- 追加: オフセット方位角 / オフセット視高度 / オフセット方位距離 / オフセット視高距離 (相手系とメモの間)

**新規計算項目**:
- `相手距離` = `L.latLng(obs.lat, obs.lng).distanceTo(L.latLng(tgt.lat, tgt.lng))` (m)
- `相手方位` = `calculateBearing(obs.lat, obs.lng, tgt.lat, tgt.lng)` (°)
- `相手高度` = `calculateApparentAltitude(distance, obs.totalElev, tgt.totalElev)` (°、屈折・地球曲率考慮)
- `オフセット方位角` = `r.tsuji.offsetAz` (°)
- `オフセット視高度` = `r.tsuji.offsetAlt` (°)
- `オフセット方位距離` = `dist * tan(offsetAz)` (m)
- `オフセット視高距離` = `dist * tan(offsetAlt)` (m)

#### 4. 確認ポイント

- `02-tsujisearch.md` の構造化リストに従い、辻検索の方位角/視高度は **2桁** ("0.00°") に再設定しました。前回4桁にしたばかりですが、dessinの新しい指定を優先しています。意図と異なる場合はお知らせください (My辻検索は4桁のままです)。
- 辻検索デッサンに残骸テキスト (158行目「天体ID、天体名、精度記号、…」) が残っていますが、構造化リストの方を仕様として採用しました。
- File出力でも `辻時刻` は1度だけ出力 (旧版は中間にも重複していたが、新dessinでは日付直後のみ)。日の出/日の入は2箇所重複するのが新仕様 (上部の単純表示 + 中部の薄明セクション内) です。


-------------------------------------------------------------------------------
-------------------------------------------------------------------------------
git show e7bb5b1
-------------------------------------------------------------------------------
-------------------------------------------------------------------------------


## 依頼 (2026-05-04)
Claudeさん、ありがとうございます。
私のデッサンに誤りがあったようです。
修正をしました。

- 画面表示
  - 日付:「YYYY年MM月DD日」
  - 曜日:「(和暦)」:月火水木金土日
- File出力
  - 日付:「YYYY/MM/DD」
  - 曜日:「和暦」:月火水木金土日

この違いは、意図してやっています。
画面での見やすさと、Excelでの加工のしやすやの違いのためです。

あと、辻検索とMy辻検索の画面表示も揃えました。
これで、確定ですので、よろしくお願いいたします。

### 回答 (2026-05-04) — 日付/曜日の分離 + 辻検索メモ/観測点メモ/目的点メモ追加 + 辻検索 4桁復活

#### 1. 日付と曜日を別カラムに分離

**画面 (辻検索パネル / My辻検索パネル):**
- 日付: `YYYY年MM月DD日` (年月日のJapanese形式)
- 曜日: `(月)` のように括弧付き

**File出力 (CSV):**
- 日付: `YYYY/MM/DD` (Excel加工しやすいスラッシュ区切り)
- 曜日: `月` (括弧なし、単一文字)

実装:
```js
// 画面用
const dateStr = `${dt.getFullYear()}年${...}月${...}日`;
const dowStr = `(${['日','月','火','水','木','金','土'][dt.getDay()]})`;

// CSV用
const csvDateStr = `${dt.getFullYear()}/${...}/${...}`;
const csvDowStr = ['日','月','火','水','木','金','土'][dt.getDay()];
```

#### 2. 辻検索パネルの修正 (`startTsujiSearch`)

- **天体IDを復活** (前回削除したが、新dessinで明示的に追加されたため復元)
- **方位角/視高度を 4桁に復活** (前回2桁にしたが、新dessinで `0.0000°` に修正)
- **曜日列を独立追加** (日付の右隣)

最終列構成 (16列):
天体ID, 天体名, 精度記号, 精度角距離, 日付, 曜日, 辻時刻, 日の出時刻, 日の入時刻, 月の出時刻, 月の入時刻, 月齢, 月齢アイコン, 方位角, 視高度, 視半径

#### 3. My辻検索パネル

最終列構成 (22列):
辻検索ID, 辻検索名, 天体ID, 天体名, 観測点ID, 観測点名, 目的点ID, 目的点名, 精度記号, 精度角距離, 日付, **曜日**, 辻時刻, 日の出時刻, 日の入時刻, 月の出時刻, 月の入時刻, 月齢, 月齢アイコン, 方位角, 視高度, 視半径

#### 4. My辻検索 File出力 (CSV)

**追加項目** (3つ):
- `辻検索メモ` — 辻検索名の右隣 (`r.tsuji.memo`)
- `観測点メモ` — 観測点高の右隣 (`r.obs.memo`)
- `目的点メモ` — 目的点高の右隣 (`r.tgt.memo`)

**末尾の旧 `メモ` カラム削除** — `辻検索メモ` に統合

**最終列構成 (53列)**:
辻検索ID, 辻検索名, **辻検索メモ**, 日付, 曜日, 辻時刻,
日の出時刻, 日の入時刻, 月の出時刻, 月の入時刻,
月齢, 月齢アイコン,
天文薄明[始], 航海薄明[始], 夜明, 常用薄明[始],
日の出時刻, 日の入時刻,
常用薄明[終], 日暮, 航海薄明[終], 天文薄明[終],
天体ID, 天体名, 天体赤緯, 天体赤経,
観測点ID, 観測点名, 観測点緯度, 観測点経度, 観測点標高, 観測点高, **観測点メモ**,
目的点ID, 目的点名, 目的点緯度, 目的点経度, 目的点標高, 目的点高, **目的点メモ**,
精度記号, 精度角距離, 方位角, 視高度, 視半径,
相手距離, 相手方位, 相手高度,
オフセット方位角, オフセット視高度, オフセット方位距離, オフセット視高距離,
プレビューURL

#### 5. ソート対応

両パネルに「曜日」列のソートを追加:
```js
{ label: '曜日', compare: (a, b) => a.dateObj.getDay() - b.dateObj.getDay() }
```

