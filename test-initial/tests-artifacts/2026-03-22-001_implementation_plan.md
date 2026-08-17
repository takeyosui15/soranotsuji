# デプロイ前テストチェックリストのPlaywrightテスト実装

[docs/operation/test-checklist.md](file:///Users/watanabetakeyoshi/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local/docs/operation/test-checklist.md) に記載された「デプロイ前テストチェックリスト」の項目を、Playwrightで自動化する。
テスト対象URL: `https://takeyosui15.github.io/soranotsuji-dev/`

## Proposed Changes

### テストファイル

#### [NEW] [deploy_checklist.spec.js](file:///Users/watanabetakeyoshi/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local/tests/deploy_checklist.spec.js)

チェックリストの各カテゴリを1ファイルにまとめる：

| カテゴリ | テスト内容 |
|---------|-----------|
| **基本動作** | ページ読み込み・タイトル確認、Consoleエラーなし、地図(Leaflet)表示、地図タイル読み込み |
| **天体計算** | 天体情報（方位角・高度）が表示される、日時変更で天体位置が更新される、太陽/月/惑星チェックボックスが機能する |
| **辻検索** | 辻検索ボタンが動作する、検索結果がリスト表示される、検索結果クリックで地図上に表示 |
| **データ保存・復元** | LocalStorageへの保存、リロード後のデータ復元、設定が保持される |
| **入力バリデーション** | 異常値入力でもエラーにならない、min/max属性が機能する、step属性が機能する |
| **レスポンシブ・表示** | PC幅で正常表示、スマホ幅で正常表示、ヘルプモーダルが表示される、MathJaxレンダリング |

## Verification Plan

### Automated Tests

```bash
cd '/Users/watanabetakeyoshi/Library/Mobile Documents/com~apple~CloudDocs/Documents/soranotsuji-dev-local'
npx playwright test tests/deploy_checklist.spec.js --reporter=list
```

全テストを実行：
```bash
npx playwright test --reporter=list
```
