# デプロイ手順書（開発環境 → 本番環境）

作成日: 2026-03-16
更新日: 2026-03-18

## 概要

開発環境（soranotsuji-dev）で動作確認済みのコードを、
本番環境（soranotsuji）にデプロイする手順書。

### 開発フロー（前提）

デプロイ手順に入る前に、以下の開発フローが完了していること。
（参照: branch-strategy.md）

```
claude/yyy ←→ work ←→ develop ──→ main ──→ soranotsuji/main
 （開発）    （確認）    （テスト）    （安定版）    （本番デプロイ）
```

1. 開発者Claudeが `claude/yyy` で作業
2. たけちゃんが `work` で確認・調整（ローカルサーバーで確認）
3. `work` ←→ `claude/yyy` で何往復かやりとり
4. 固まったら `develop` にマージ
5. テスターClaude（Antigravity）が `develop` でPlaywrightテスト
6. テストOK → バージョン番号を更新 → `work`,`claude/yyy`,`develop`にマージ
7. **プレ・デプロイ・チェックリストに進む**
8. デプロイ手順に進む
9. Step 1: developでのテスト確認 & mainへのマージ
10. Step 2: 開発リポジトリにバージョンタグを付与
11. Step 3: 本番リポジトリにファイルを反映
12. Step 4: 本番環境へpush & タグ付与
13. Step 5: 本番環境の動作確認
14. Step 6: デプロイ記録
15. Step 7: 本デプロイ記録をファイルごと`/docs/deploy-log/deploy-log-vA.B.C-YYYY-MM-DD.md`に残す

### プレ・デプロイ・チェックリスト

- [x] 今回のデプロイで機能追加されたところをリストアップする。
  - 1. 辻検索とMy辻検索の精度不整合、辻検索とMy辻検索の計算中の観測点/目的点/日時の動的問題を修正
- [x] 上記の機能は、組み込みの**ヘルプ**に内容が反映されているかを確認する。
  - [x] 1. 不具合修正なので問題なし
- [x] 上記の機能は、組み込みの**README.md**に内容が反映されているかを確認する。
  - [x] 1. 不具合修正なので問題なし
- [x] バージョン番号が更新されている。
  - [x] index.html:1箇所:バージョン表記
  - [x] script.js:2箇所:バージョン履歴とコンソール出力

### デプロイの流れ

```
開発環境(soranotsuji-dev)          本番環境(soranotsuji)
        |                                  |
   develop でテスト済み                     |
        |                                  |
   main にマージ済み                        |
        |                                  |
   バージョンタグ付与(main)                  |
        |                                  |
   ローカルで同期 ─────────────────→ git push
        |                                  |
        |                          バージョンタグ付与
        |                                  |
        |                          GitHub Pages自動デプロイ
        |                                  |
        |                          soranotsuji.net に反映
```

---

## パス定義

本手順書では以下のパスを使用する。
各パスはユーザーのiCloud書類フォルダ配下に配置されている。

| 変数名 | パス |
|---|---|
| `$DOCS` | `~/Library/Mobile Documents/com~apple~CloudDocs/Documents` |
| 開発環境 | `$DOCS/soranotsuji-dev-local` |
| 一時作業 | `$DOCS/soranotsuji-tmp-local` |

ターミナルで使う場合は、スペースをエスケープするか引用符で囲む:

```bash
# 方法1: 引用符で囲む
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local"

# 方法2: エイリアスを設定しておく（~/.zshrc に追記）
alias cddev='cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local"'
alias cdtmp='cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-tmp-local"'
```

以降の手順では、簡潔さのため `$DOCS/soranotsuji-dev-local` のように記載する。
実際のコマンドでは上記の方法でパスを指定すること。

---

## 前提条件

- リポジトリ移行が完了していること（repo-migration-guide.md参照）
- ローカルに以下のフォルダが存在すること:
  - `$DOCS/soranotsuji-dev-local`（開発環境）
  - 本番リポジトリのローカルcloneは不要（デプロイ時に一時作成）

---

## バージョンタグの命名規則

- 形式: `vX.Y.Z`（例: `v1.17.0`）
- `script.js` 冒頭のバージョンコメントと一致させる
- タグは開発・本番の両リポジトリに付与する

---

## デプロイ手順

### Step 1: developでのテスト確認 & mainへのマージ

- [x] developブランチでのテストが完了していることを確認

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local"
git checkout develop
git pull origin develop
```

- [x] GitHub Pages（`https://takeyosui15.github.io/soranotsuji-dev/`）で動作確認
  - GitHub Pagesはdevelopブランチをデプロイしているため、developの内容が表示される

- [x] テストOK → developをmainにマージ

```bash
# mainブランチに切り替え
git checkout main
git pull origin main

# developをmainにマージ
git merge develop

# マージ結果をリモートにpush
git push origin main
```

- [x] デプロイ対象のコミットハッシュを記録

```bash
git log --oneline -5
# 先頭のコミットハッシュをメモ（例: abc1234）。キー「q」で抜ける。
55f1251
```

- [x] `script.js` 冒頭のバージョン番号を確認

```bash
head -5 script.js
# 例: // V1.17.0（2026-03-06）
# このバージョン番号をメモ（例: v1.17.0）
v1.19.2
```

---

### Step 2: 開発リポジトリにバージョンタグを付与

- [x] タグを作成してpush

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local"

# タグを作成（vX.Y.Zはscript.jsのバージョンに合わせる）
git tag v1.19.2

# タグをリモートにpush
git push origin v1.19.2
```

- [x] タグが正しく付与されたことを確認

```bash
git tag -l
# vX.Y.Z が表示されること
```

---

### Step 3: 本番リポジトリにファイルを反映

一時ディレクトリで本番リポジトリをcloneし、開発環境のファイルで上書きする。

- [x] 一時作業フォルダを準備

```bash
# 一時作業フォルダが存在しない場合は作成
mkdir -p "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-tmp-local"
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-tmp-local"
```

- [x] 本番リポジトリを一時cloneして同期

```bash
git clone https://github.com/takeyosui15/soranotsuji.git soranotsuji-deploy
cd soranotsuji-deploy

# CNAMEファイルを退避（本番のみに必要なファイル）
cp CNAME ../CNAME_backup

# .git以外の全ファイルを削除
find . -maxdepth 1 -not -name '.git' -not -name '.' -exec rm -rf {} +

# 開発環境のファイルをコピー（.gitは除く）
rsync -av --exclude='.git' "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local/" ./

# CNAMEファイルを復元
cp ../CNAME_backup ./CNAME
```

- [x] 差分を確認

```bash
git status
git diff --stat
# 変更内容が意図通りであることを確認
```

- [x] 環境差異ファイルの確認

```bash
# CNAMEファイルの内容確認
cat CNAME
# soranotsuji.net% であること
```

---

### Step 4: 本番環境へpush & タグ付与

- [x] コミット & push

```bash
git add -A
git commit -m "deploy: soranotsuji-dev コミット 55f1251 からデプロイ (v1.19.2)"
# ↑ abc1234 はStep 1で記録したコミットハッシュに置き換え
# ↑ vX.Y.Z はStep 1で確認したバージョンに置き換え
git push origin main
```

- [ ] 本番リポジトリにもバージョンタグを付与

```bash
git tag v1.19.2
git push origin v1.19.2
```

- [x] 一時作業フォルダを削除

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-tmp-local"
rm -rf soranotsuji-deploy
rm -f CNAME_backup
```

---

### Step 5: 本番環境の動作確認

GitHub Pagesのデプロイには1-2分かかる場合がある。

- [x] `https://soranotsuji.net` にアクセスして動作確認
- [x] 主要機能のチェック:
  - [x] 地図が正常に表示される
  - [x] 天体の方位角・高度が計算される
  - [x] 辻検索が動作する
  - [x] LocalStorageへの保存・読込が正常

---

### Step 6: デプロイ記録

- [x] デプロイ記録を残す（order.mdまたは任意の場所に記録）

```
デプロイ日時: YYYY-MM-DD HH:MM
バージョン: vX.Y.Z
デプロイ元コミット: abc1234 (soranotsuji-dev)
デプロイ先コミット: xyz5678 (soranotsuji)
確認結果: OK / NG
```

---

## 環境差異の管理

本番環境と開発環境で異なるファイル:

| ファイル | 本番（soranotsuji） | 開発（soranotsuji-dev） | 理由 |
|---|---|---|---|
| CNAME | `soranotsuji.net` | なし | カスタムドメイン用 |

デプロイ手順のStep 3で、CNAMEファイルを退避・復元することで差異を吸収している。
今後、環境差異ファイルが増えた場合は、この表を更新し、同様に退避・復元の手順を追加する。

---

## バージョンタグの管理

### タグの一覧確認

```bash
# ローカルのタグ一覧
git tag -l

# リモートのタグ一覧
git ls-remote --tags origin
```

### タグの削除（間違えた場合）

```bash
# ローカルのタグ削除
git tag -d v1.17.0

# リモートのタグ削除
git push origin --delete v1.17.0
```

### 過去のバージョンのコードを確認

```bash
# 特定のタグの状態を確認（読み取り専用）
git checkout v1.17.0

# 元のブランチに戻る
git checkout main
```

---

## ロールバック手順

デプロイ後に問題が発見された場合の切り戻し方法。

### 方法1: 直前のコミットに戻す（推奨）

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-tmp-local"
git clone https://github.com/takeyosui15/soranotsuji.git soranotsuji-rollback
cd soranotsuji-rollback

# 直前のコミットに戻す
git revert HEAD --no-edit
git push origin main

# 一時フォルダを削除
cd ..
rm -rf soranotsuji-rollback
```

### 方法2: 特定のバージョンに戻す

```bash
cd "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-tmp-local"
git clone https://github.com/takeyosui15/soranotsuji.git soranotsuji-rollback
cd soranotsuji-rollback

# デプロイ記録から正常だったコミットハッシュを確認
git log --oneline -10

# そのコミットの状態に戻す
git revert HEAD --no-edit
git push origin main

cd ..
rm -rf soranotsuji-rollback
```

---

## 将来の選択肢: CDパイプライン（GitHub Actions）

現段階では手動デプロイで十分だが、デプロイ頻度が増えた場合は
GitHub Actionsによる自動化を検討する価値がある。

### メリット
- 手動ミスの排除（CNAMEの退避忘れなど）
- デプロイの高速化（ボタン一つ or 自動）
- デプロイ履歴がGitHub上に残る
- タグ付けも自動化可能

### デメリット
- 設定の学習コスト
- 意図しないデプロイのリスク（mainにpushするたびに本番反映）
- GitHub Actionsの無料枠に注意（パブリックリポジトリは無制限）

### 導入する場合のイメージ

soranotsuji-devリポジトリに `.github/workflows/deploy.yml` を作成:
- トリガー: mainブランチへのpush、または手動実行（workflow_dispatch）
- 処理: soranotsujiリポジトリにファイルを同期してpush
- 環境差異（CNAME）の自動管理
- バージョンタグの自動付与

導入を検討する際は、別途手順書を作成する。
