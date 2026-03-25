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
