// tests/debug.spec.js
const { test, expect } = require('@playwright/test');

test('URL直接指定でアクセス', async ({ page }) => {
  const response = await page.goto('https://takeyosui15.github.io/soranotsuji-dev/');
  console.log('Status:', response.status());
  console.log('URL:', page.url());
  console.log('Title:', await page.title());
});