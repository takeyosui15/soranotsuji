# 宙の辻 (Sora no Tsuji) — AI エージェント共通指示書

このファイルは、すべてのAIエージェント（Claude Code, Gemini等）が共通で参照する指示書です。

## プロジェクト概要
天体と地上のランドマーク（富士山など）の位置関係を地図上に可視化するWebアプリケーション。
ダイヤモンド富士やパール富士など、天体が特定の山と重なる「辻」の日時・場所を計算する。

## 技術スタック
- **静的Webアプリ** — ビルドプロセスなし、GitHub Pagesでホスティング
- **HTML/CSS/Vanilla JavaScript** — フレームワーク不使用
- **主要ライブラリ（CDN読み込み）:**
  - Leaflet 1.9.4（地図描画）
  - Astronomy Engine 2.1.19（天体位置計算）
  - GeographicLib（測地線計算）
  - MathJax 3（数式表示）

## ファイル構成
| ファイル | 役割 |
|---|---|
| `index.html` | メインHTML（UI構造、ヘルプ、全セクション定義） |
| `script.js` | メインロジック（状態管理、天体計算、地図操作、UI制御） |
| `style.css` | 全スタイル定義 |
| `muni.js` | 市区町村データライブラリ |
| `gas_spredsheet.js` | Google Apps Script連携（訪問者カウンター） |
| `reset.html` | データリセットページ |

## アーキテクチャ
- **状態管理**: `appState` オブジェクトで全状態を一元管理
- **永続化**: LocalStorage（キー: `soranotsuji_app`）に設定・位置情報を保存
- **外部API**: 国土地理院（標高DEM・地図タイル）、OpenStreetMap（ジオコーディング）、Open-Meteo（標高データ）

## script.js の主要セクション
1. 定数定義（天体データ、デフォルト座標、色設定）
2. `appState`（グローバル状態オブジェクト）
3. 初期化処理（LocalStorage復元、地図初期化、イベント登録）
4. UIイベントハンドラ
5. Storage管理（保存・読込）
6. 天体計算・更新ロジック（`updateCalculation`, `updateCelestialData`）
7. 辻検索（`startTsujiSearch` — 方位角・視高度による天体アライメント検索）
8. ユーティリティ関数

## コーディング規約
- 命名規則
  - グローバル定数:UPPER_SNAKE_CASE
  - グローバル変数:PascalCase
  - 定数:UPPER_SNAKE_CASE
  - 変数:camelCase
  - 関数名:camelCase
  - CSS:kebab-case
- UIテキスト・コメントは**日本語**で記述
- コミットメッセージも日本語（`feat:` / `fix:` / `style:` プレフィクス使用）
- XSS対策として `escapeHtml()` を使用（ユーザー入力をDOMに挿入する際は必須）
- **構造とスタイルの分離**: インラインスタイル（`style="..."`）は使用せず、CSSクラスで定義する。HTML/JSには構造のみ、`style.css`にスタイルを記述する
- 恒星（Polaris, Merak, Mintaka, Subaru, MyStar）は固定RA/Decで計算、惑星・太陽・月はAstronomy Engine APIで動的計算

## ドキュメント一覧

### 必ず読む（毎回）
| ドキュメント | 目的 |
|---|---|
| `docs/order.md` | 最新の依頼・回答履歴。前回の作業状態を把握する |
| `docs/todo.md` | やることリスト・優先タスクを確認する |
| `docs/order-to-me.md` | 依頼者の備忘録。運用ルール・注意事項を確認する |

### 必要に応じて読む
| ドキュメント | 読むタイミング |
|---|---|
| `docs/operation/branch-strategy.md` | ブランチ操作・リポジトリ構成を確認したいとき |
| `docs/operation/deploy-guide.md` | デプロイ作業を行うとき |
| `docs/knowledge/bugs.md` | バグ修正時。過去の教訓を参照する |
| `docs/dessin/` | 機能設計・実装の詳細を確認したいとき |
| `docs/research.md` | 技術調査の過去結果を参照したいとき |
| `docs/operation/test-checklist.md` | テストを実施するとき |

## バージョン管理
- バージョン履歴は `script.js` 冒頭のコメントに記載
- 現在: V1.17.3（2026-03-25）
- ライセンス: GPL v3
- コミット・プッシュ後はコミットハッシュ（例: `abc1234`）を報告する
