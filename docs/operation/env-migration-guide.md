# 環境移行手順書（開発環境 ←→ 試行環境）

宙の辻プロジェクトの **開発環境** と **試行環境** 間で、ソースを相互に移行するための手順書です。

作成日: 2026-04-18

## 前提

本手順書は、`repo-migration-guide.md` と `pre-migration-tag-guide.md` によって構築された
以下の環境構成を前提としています。

### リポジトリ構成 (GitHub リモート)

| 環境 | リポジトリ | 主なブランチ | GitHub Pages |
|---|---|---|---|
| 本番 | `soranotsuji` | main | https://soranotsuji.net |
| **開発** | `soranotsuji-dev` | main, develop, work, claude/yyy | https://takeyosui15.github.io/soranotsuji-dev/ (develop) |
| **試行** | `soranotsuji-sandbox` | main, develop, work, claude/xxx | (公開なし) |

### ローカルフォルダ構成 (Mac, iCloud)

| 変数名 | パス | 追跡するリモート |
|---|---|---|
| `$DOCS` | `~/Library/Mobile Documents/com~apple~CloudDocs/Documents` | — |
| **開発環境 (ローカル)** | `$DOCS/soranotsuji-dev-local` | `soranotsuji-dev` |
| **試行環境 (ローカル)** | `$DOCS/soranotsuji-sandbox-local` | `soranotsuji-sandbox` |
| 一時作業 | `$DOCS/soranotsuji-tmp-local` | — |

> `soranotsuji-dev-local` / `soranotsuji-sandbox-local` は **ローカルのフォルダ名** です。
> GitHub 上のリポジトリ名ではありません。

### ブランチ戦略（概略）

- **開発環境 (soranotsuji-dev)**: `claude/yyy → work → develop → main` の順で流す
- **試行環境 (soranotsuji-sandbox)**: `claude/xxx → work → develop → main` (開発環境と同じフロー)

詳細は `branch-strategy.md` を参照。

---

## 移行の基本方針

- 開発環境と試行環境は **別リポジトリ**。自動同期はしない（手動マージで連携）
- 各ローカルフォルダの `origin` はそれぞれ別のリモートを指す
- 相互に行き来するには、**クロスリモートを追加**するか、**パッチ/ファイルコピー**する

---

## 初回セットアップ: クロスリモートの登録

開発環境と試行環境を相互に参照できるよう、リモートを追加登録します（初回のみ）。

### 開発環境 (soranotsuji-dev-local) に試行環境のリモートを追加

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local"

# 試行環境リポジトリを "sandbox" という名前で追加
git remote add sandbox https://github.com/takeyosui15/soranotsuji-sandbox.git

# 登録されたことを確認
git remote -v
# origin   https://github.com/takeyosui15/soranotsuji-dev.git       (fetch/push)
# sandbox  https://github.com/takeyosui15/soranotsuji-sandbox.git   (fetch/push)

# 試行環境の内容を取得
git fetch sandbox
```

### 試行環境 (soranotsuji-sandbox-local) に開発環境のリモートを追加

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-sandbox-local"

# 開発環境リポジトリを "dev" という名前で追加
git remote add dev https://github.com/takeyosui15/soranotsuji-dev.git

# 登録されたことを確認
git remote -v
# origin  https://github.com/takeyosui15/soranotsuji-sandbox.git  (fetch/push)
# dev     https://github.com/takeyosui15/soranotsuji-dev.git      (fetch/push)

# 開発環境の内容を取得
git fetch dev
```

> **注意:** `git fetch <remote>` は最新の情報取得のみでローカルには影響しません。
> 実際に反映させるには次の手順の `merge` や `cherry-pick` が必要です。

---

## パターン1: 開発環境 → 試行環境 への取り込み

**目的:** 開発環境の最新ソースを試行環境に取り込んで、試行開発のベースにしたい。

### 方法A: ブランチごとマージ（推奨）

開発環境の main をまるごと試行環境の main に反映します。

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-sandbox-local"

# 1. 未コミットの変更がないことを確認
git status
# "nothing to commit, working tree clean" であること
# (変更が残っている場合は git stash または git commit しておく)

# 2. 開発環境の最新情報を取得
git fetch dev

# 3. 作業ブランチに切り替え（または新規作成）
git checkout -b take-from-dev

# 4. 開発環境の main をマージ
git merge dev/main

# 5. コンフリクトが発生した場合は手動で解消
#    → 該当ファイルを編集 → git add <file> → git commit

# 6. 試行環境の main にマージして push
git checkout main
git merge take-from-dev
git push origin main

# 7. 作業ブランチを削除（任意）
git branch -d take-from-dev
```

### 方法B: 特定のコミットだけ取り込み（cherry-pick）

開発環境の特定のコミットだけ試行環境に持ち込む場合。

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-sandbox-local"

git fetch dev

# 開発環境のコミット一覧を確認してハッシュをメモ
git log dev/main --oneline -20

# 試行環境の作業ブランチで cherry-pick
git checkout develop   # または作業ブランチ
git cherry-pick <commit-hash>
git push origin develop
```

### 方法C: ファイル単位でコピー（Git を使わず）

試行環境のブランチ履歴と開発環境のブランチ履歴が大きく乖離している場合に便利です。

```bash
# 試行環境フォルダで作業
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-sandbox-local"

# 特定ファイルのみ開発環境からコピー
cp ../soranotsuji-dev-local/script.js ./script.js
cp ../soranotsuji-dev-local/style.css ./style.css

# 複数ファイルを一括コピー (.git を除外)
rsync -av --exclude='.git' --exclude='node_modules' \
    ../soranotsuji-dev-local/ ./

git add -A
git commit -m "dev から取り込み: <内容>"
git push origin <branch>
```

---

## パターン2: 試行環境 → 開発環境 へのアップ

**目的:** 試行環境で検証・完成したコードを、開発環境に戻して本番デプロイの準備に入る。

### 方法A: ブランチごとマージ

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local"

# 1. 未コミットの変更がないことを確認
git status

# 2. 試行環境の最新情報を取得
git fetch sandbox

# 3. 開発者Claudeの claude/yyy ブランチで取り込み
#    (ブランチ戦略: claude/yyy → work → develop → main の順で流す)
git checkout -b claude/take-from-sandbox
git merge sandbox/main

# 4. コンフリクトがあれば解消
# 5. push
git push -u origin claude/take-from-sandbox

# 6. たけちゃんの work ブランチで確認・調整
#    → work にマージ → develop にマージ → テスト → main にマージ
#    (詳細は branch-strategy.md 参照)
```

### 方法B: 特定のコミットだけ取り込み（cherry-pick）

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local"

git fetch sandbox
git log sandbox/main --oneline -20

# work ブランチで cherry-pick
git checkout work
git cherry-pick <commit-hash>
git push origin work
```

### 方法C: ファイル単位でコピー

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local"

# 試行環境の特定ファイルを開発環境にコピー
cp ../soranotsuji-sandbox-local/script.js ./script.js

git checkout -b claude/take-from-sandbox
git add script.js
git commit -m "sandbox から取り込み: <内容>"
git push -u origin claude/take-from-sandbox
```

---

## 日常フロー例

### フロー1: 開発環境の最新を試行環境に取り込んで実験

```
1. 開発環境の main を最新に保つ (普段の開発作業)
2. 試行環境 (soranotsuji-sandbox-local) で git fetch dev
3. 試行環境の main に dev/main をマージ (パターン1・方法A)
4. 試行環境で実験的な開発作業を行う
5. 試行が成功したら、開発環境にアップ (パターン2へ)
```

### フロー2: 試行環境の成果を開発環境にアップして本番化

```
1. 試行環境で実験的な開発を完了 (soranotsuji-sandbox-local の main)
2. 開発環境 (soranotsuji-dev-local) で git fetch sandbox
3. 開発環境に claude/take-from-sandbox ブランチを作成してマージ
4. work → develop へ流してテスターClaude (Antigravity) がテスト
5. テストOKなら main にマージしてタグ付け
6. deploy-guide.md に従って本番デプロイ
```

---

## トラブルシューティング

### マージ時にコンフリクト

```bash
# どのファイルがコンフリクトしているか確認
git status

# 該当ファイルを開き、以下のマーカーを手動で解消
# <<<<<<< HEAD
# (こちらのブランチの内容)
# =======
# (相手のブランチの内容)
# >>>>>>> <branch>

# 解消後、addしてcommit
git add <file>
git commit
```

### マージをやり直したい

```bash
# マージ途中で中断
git merge --abort

# 既にマージコミットを作ってしまった場合、直前に戻す
git reset --hard HEAD~1
```

### リモート登録を間違えた

```bash
# 登録を削除
git remote remove <remote-name>

# URL を変更
git remote set-url <remote-name> <new-url>

# 現在の登録を確認
git remote -v
```

### バージョン番号（script.js / index.html）の調整

環境間でマージすると、`script.js` や `index.html` の version コメントが
古い方に上書きされてしまうことがあります。

```bash
# マージ後、バージョン番号が正しいか確認
head -10 script.js
grep -n "V1\." script.js | head -5

# 必要に応じて手動で修正
```

---

## 参考資料

- `branch-strategy.md` — ブランチ戦略の全体像
- `deploy-guide.md` — 本番デプロイ手順
- `pre-migration-tag-guide.md` — タグ付与手順
- `repo-migration-guide.md` — リポジトリ移行時の構成変更記録
- `git-basics.md` — git コマンドの基礎
