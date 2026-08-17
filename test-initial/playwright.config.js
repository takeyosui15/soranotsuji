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
