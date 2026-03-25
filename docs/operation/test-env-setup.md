# テスト環境構築手順書

作成日: 2026-03-17

## 概要

Antigravity + Playwright を使ったテスト環境を構築する手順書。
Mac Mini と MacBook の両方で同じ環境を再現できるようにする。

### 構成図

```
Mac Mini / MacBook（各マシンに同じ環境を構築）
├── Antigravity（AI IDE）      ← テスト指示・実行
├── Node.js（nvm で管理）      ← Playwright の実行に必要
├── Playwright（npm パッケージ）← ブラウザ自動テスト
└── soranotsuji-dev-local/     ← iCloud で同期されるプロジェクト
    └── tests/                 ← テストコード（iCloud で同期）
```

### 何がどこにインストールされるか

| 項目 | インストール先 | Mac間で同期？ |
|---|---|---|
| Antigravity | 各マシンにアプリをインストール | 同期不要（各マシンにインストール） |
| Node.js (nvm) | `~/.nvm/`（各マシンのホーム直下） | 同期不要（各マシンにインストール） |
| Playwright | プロジェクトの `node_modules/`（.gitignoreで除外） | 同期不要（各マシンで `npm install`） |
| テストコード | プロジェクトの `tests/` フォルダ | **Git で同期** |
| Playwright設定 | プロジェクトの `playwright.config.js` | **Git で同期** |
| package.json | プロジェクトルート | **Git で同期** |

**ポイント:** テストコードと設定ファイルはGitで管理されるため、両マシンで同じ。
Node.jsとPlaywrightは各マシンにインストールするが、バージョンを揃えることで差異を防ぐ。

---

## パス定義

| 変数名 | パス |
|---|---|
| `$DOCS` | `~/Library/Mobile Documents/com~apple~CloudDocs/Documents` |
| 開発環境 | `$DOCS/soranotsuji-dev-local` |

---

## 構築手順

### Step 1: Node.js のインストール（nvm 経由）

**なぜ nvm を使うのか:**
- Node.js のバージョンを明示的に管理できる
- Mac Mini と MacBook で同じバージョンを使える
- プロジェクトごとに異なるバージョンを切り替えられる
- macOS のシステムに影響を与えない

**両方のマシンで同じ手順を実行する。**

- [x] nvm をインストール
- [x] nvm をインストール

```bash
# nvm のインストール
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

- [x] ターミナルを再起動（またはシェル設定を再読込）
- [x] ターミナルを再起動（またはシェル設定を再読込）

```bash
# zsh の場合（Mac のデフォルト）
source ~/.zshrc
```

- [x] nvm がインストールされたことを確認
- [x] nvm がインストールされたことを確認

```bash
nvm --version
# 0.40.1 などのバージョンが表示されること
# 0.40.1
```

- [x] Node.js LTS をインストール
- [x] Node.js LTS をインストール

```bash
# LTS（長期サポート版）をインストール
nvm install --lts

# インストールされたバージョンを確認
node --version
# v22.x.x などが表示されること
# v24.14.0

npm --version
# 10.x.x などが表示されること
# 11.9.0
```

- [x] デフォルトバージョンを設定
- [x] デフォルトバージョンを設定

```bash
nvm alias default lts/*
```

---

### Step 2: プロジェクトの Node.js バージョンを固定

- [x] プロジェクトルートに `.nvmrc` ファイルを作成

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local"

# 現在のNode.jsバージョンを .nvmrc に記録
node --version > .nvmrc
```

`.nvmrc` ファイルがあると、もう一方のマシンで以下のコマンドで同じバージョンに切り替えられる:

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local"
nvm use
# .nvmrc に記載されたバージョンに自動で切り替わる
```

---

### Step 3: Playwright のセットアップ

- [x] package.json を初期化（まだ存在しない場合）

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local"
npm init -y
```

- [x] Playwright をインストール

```bash
npm install --save-dev @playwright/test
```

- [x] Playwright のブラウザをインストール

```bash
npx playwright install
```

これにより、Chromium / Firefox / WebKit のテスト用ブラウザがダウンロードされる。
（ダウンロード先: `~/Library/Caches/ms-playwright/` — iCloud外のローカル領域）

- [x] .gitignore に node_modules を追加

```bash
# .gitignore に以下を追加（まだ記載がなければ）
echo "node_modules/" >> .gitignore
```

---

### Step 4: Playwright 設定ファイルの作成

- [x] `playwright.config.js` を作成

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local"
```

以下の内容で `playwright.config.js` を作成する:

```javascript
// playwright.config.js
// テスト対象: GitHub Pages の develop ブランチ
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  reporter: 'html',
  use: {
    // テスト対象URL（GitHub Pages の develop ブランチ）
    baseURL: 'https://takeyosui15.github.io/soranotsuji-dev/',
    // スクリーンショットをテスト失敗時に保存
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
```

---

### Step 5: テストコードフォルダの作成

- [x] tests フォルダを作成

```bash
mkdir -p tests
```

- [x] サンプルテストを作成（`tests/basic.spec.js`）

```javascript
// tests/basic.spec.js
// 基本動作テスト
const { test, expect } = require('@playwright/test');

test('ページが正常に読み込まれる', async ({ page }) => {
  await page.goto('./');
  // タイトルに「宙の辻」が含まれること
  await expect(page).toHaveTitle(/宙の辻/);
});

test('地図が表示される', async ({ page }) => {
  await page.goto('./');
  // Leaflet の地図コンテナが存在すること
  const map = page.locator('#map');
  await expect(map).toBeVisible();
});

test('コンソールにエラーがない', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  // ページ読み込み後にJavaScriptエラーがないこと
  expect(errors).toEqual([]);
});
```

---

### Step 6: テストの実行確認

- [x] テストを実行

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local"
npx playwright test
```

- [x] テスト結果を確認

```bash
# HTMLレポートを表示（テスト結果の詳細を確認）
npx playwright show-report
```

---

### Step 7: Git にテスト関連ファイルをコミット

- [x] 以下のファイルをコミット

```bash
git add .nvmrc package.json package-lock.json playwright.config.js tests/ .gitignore
git commit -m "feat: Playwright テスト環境をセットアップ"
git push origin develop
```

**コミットするファイル:**
- `.nvmrc` — Node.js バージョン指定
- `package.json` / `package-lock.json` — npm パッケージ管理
- `playwright.config.js` — Playwright 設定
- `tests/` — テストコード
- `.gitignore` — node_modules 除外

**コミットしないファイル（.gitignore で除外）:**
- `node_modules/` — npm パッケージ本体（各マシンで `npm install` する）

---

## 2台目のマシンでの環境構築

Mac Mini で構築した後、MacBook（またはその逆）で同じ環境を再現する手順。

### Step 1〜2 は両マシンで実行済みの前提

nvm と Node.js のインストールは各マシンで1回だけ必要。

### 2台目での手順

- [x] プロジェクトを最新に更新

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local"
git checkout work
git pull origin work
```

- [x] Node.js バージョンを合わせる

```bash
nvm use
# .nvmrc のバージョンに切り替わる
# まだインストールしていない場合は nvm install を実行
```

- [x] npm パッケージをインストール

```bash
npm install
```

- [x] Playwright ブラウザをインストール

```bash
npx playwright install
```

- [x] テストを実行して確認

```bash
npx playwright test
```

**これだけで2台目の環境構築は完了。**
テストコードと設定はGitで同期されているため、`npm install` と `npx playwright install` だけで同じテスト環境が再現される。

---

## Antigravity との連携

### Antigravity でテストを実行する場合

1. Antigravity で soranotsuji-dev-local を開く
2. develop ブランチに切り替える
3. Claude モデルを選択
4. 以下のように指示する:

```
Playwrightのテストを実行して、結果を教えてください。
```

### Antigravity に新しいテストを書いてもらう場合

```
My観測点を100件追加するテストを tests/data-limit.spec.js に書いて実行してください。
テスト対象URLは https://takeyosui15.github.io/soranotsuji-dev/ です。
```

---

## よく使うコマンド早見表

| やりたいこと | コマンド |
|---|---|
| テスト実行 | `npx playwright test` |
| 特定のテストだけ実行 | `npx playwright test tests/basic.spec.js` |
| ブラウザを表示しながらテスト | `npx playwright test --headed` |
| テスト結果レポートを表示 | `npx playwright show-report` |
| Node.js バージョン確認 | `node --version` |
| Node.js バージョン切り替え | `nvm use` |
| npm パッケージインストール | `npm install` |
| Playwright ブラウザ更新 | `npx playwright install` |
