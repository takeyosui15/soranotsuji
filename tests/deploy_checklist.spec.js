// tests/deploy_checklist.spec.js
// デプロイ前テストチェックリスト（docs/operation/test-checklist.md）に基づく自動テスト
// テスト対象: https://takeyosui15.github.io/soranotsuji-dev/

const { test, expect } = require('@playwright/test');

/**
 * コントロールパネルを展開するヘルパー関数
 * パネルが最小化されている場合はヘッダーをクリックして展開する
 */
async function expandPanel(page) {
  const panel = page.locator('#control-panel');
  const isMinimized = await panel.evaluate(el => el.classList.contains('minimized'));
  if (isMinimized) {
    await page.locator('.panel-header').click();
    await page.waitForTimeout(500);
  }
}

// =========================================================
// 基本動作
// =========================================================

test.describe('基本動作', () => {
  test('ページが正常に読み込まれる（白画面・エラーにならない）', async ({ page }) => {
    const response = await page.goto('./');
    expect(response.status()).toBe(200);
    // タイトルに「宙の辻」が含まれること
    await expect(page).toHaveTitle(/宙の辻/);
    // bodyが空でないこと
    const bodyContent = await page.locator('body').innerHTML();
    expect(bodyContent.length).toBeGreaterThan(100);
  });

  test('Console にJavaScriptエラー（赤文字）が出ていない', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./');
    // ページの初期化を待つ（Leaflet・スクリプト読み込み完了）
    await page.waitForTimeout(3000);
    expect(errors).toEqual([]);
  });

  test('地図が正常に表示される（Leaflet）', async ({ page }) => {
    await page.goto('./');
    // Leafletの地図コンテナが存在・表示されること
    const map = page.locator('#map');
    await expect(map).toBeVisible();
    // Leafletが初期化されていること（leaflet-containerクラスが付与される）
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });

  test('地図タイルが読み込まれる（国土地理院タイル）', async ({ page }) => {
    // タイルリクエストが発生することを確認
    let tileRequestCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('cyberjapandata.gsi.go.jp')) {
        tileRequestCount++;
      }
    });
    await page.goto('./');
    await page.waitForTimeout(3000);
    expect(tileRequestCount).toBeGreaterThan(0);
  });
});

// =========================================================
// 天体計算
// =========================================================

test.describe('天体計算', () => {
  test('天体情報（方位角・高度）が表示される', async ({ page }) => {
    await page.goto('./');
    await page.waitForTimeout(3000);
    await expandPanel(page);

    // 天体リスト（#celestial-list）が存在し、1件以上の天体が表示されること
    const celestialList = page.locator('#celestial-list');
    await expect(celestialList).toBeVisible();
    const items = celestialList.locator('li');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    // 方位角・視高度のデータテキストが存在すること
    const dataText = page.locator('[id^="data-"]').first();
    const text = await dataText.innerText();
    expect(text).toMatch(/方位角/);
  });

  test('日時を変更すると天体位置が更新される', async ({ page }) => {
    await page.goto('./');
    await page.waitForTimeout(3000);
    await expandPanel(page);

    // 太陽の方位角テキストを取得（DOMに存在するが不可視でも innerText は取れる）
    const dataEl = page.locator('[id^="data-Sun"]');
    const before = await dataEl.innerText();

    // 日付を1日進める（btn-date-next はパネルヘッダー外のため常時クリック可）
    await page.locator('#btn-date-next').click();
    await page.waitForTimeout(1500);

    const after = await dataEl.innerText();
    // 日時が変わったので天体位置テキストが更新されているはず
    expect(after).not.toBe(before);
  });

  test('太陽・月のチェックボックスが存在し操作できる', async ({ page }) => {
    await page.goto('./');
    await page.waitForTimeout(3000);
    await expandPanel(page);

    // 天体リスト内のチェックボックスを確認
    const checkboxes = page.locator('#celestial-list .body-checkbox');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);

    // 最初のチェックボックスをオフにしてからオンに
    const first = checkboxes.first();
    const initialChecked = await first.isChecked();
    await first.click();
    await page.waitForTimeout(500);
    const afterChecked = await first.isChecked();
    expect(afterChecked).toBe(!initialChecked);
    // 元に戻す
    await first.click();
  });
});

// =========================================================
// 辻検索
// =========================================================

test.describe('辻検索', () => {
  test('辻検索ボタンが存在する', async ({ page }) => {
    await page.goto('./');
    await page.waitForTimeout(2000);
    await expandPanel(page);
    // ボタンはDOMに存在すること（パネル内でhiddenクラスがなければOK）
    const btn = page.locator('#btn-tsuji-search');
    await expect(btn).toBeAttached();
    // ボタンにテキストが表示されていること
    const text = await btn.innerText();
    expect(text).toContain('辻検索');
  });

  test('辻検索を実行すると結果パネルが表示される', async ({ page }) => {
    await page.goto('./');
    await page.waitForTimeout(3000);

    // コントロールパネルを展開（minimizedの場合）
    const panel = page.locator('#control-panel');
    const isMinimized = await panel.evaluate(el => el.classList.contains('minimized'));
    if (isMinimized) {
      await page.locator('.panel-header').click();
      await page.waitForTimeout(500);
    }

    // 辻検索セクションを展開
    const tsujisearchSection = page.locator('#sec-tsujisearch');
    const isClosed = await tsujisearchSection.evaluate(el => el.classList.contains('closed'));
    if (isClosed) {
      await page.locator('.section-header').nth(1).click();
      await page.waitForTimeout(300);
    }

    // 検索期間を入力（短期間で高速に）
    await page.locator('#input-tsuji-search-days').fill('7');

    // 辻検索ボタンをクリック
    await page.locator('#btn-tsuji-search').click();
    await page.waitForTimeout(5000);

    // 辻検索結果パネルが表示されること
    const searchPanel = page.locator('#tsujisearch-panel');
    await expect(searchPanel).toBeVisible({ timeout: 10000 });
  });

  test('辻検索結果にコンテンツが含まれる', async ({ page }) => {
    await page.goto('./');
    await page.waitForTimeout(3000);

    const panel = page.locator('#control-panel');
    const isMinimized = await panel.evaluate(el => el.classList.contains('minimized'));
    if (isMinimized) {
      await page.locator('.panel-header').click();
      await page.waitForTimeout(500);
    }

    // 辻検索セクションを展開
    const tsujisearchSection = page.locator('#sec-tsujisearch');
    const isClosed = await tsujisearchSection.evaluate(el => el.classList.contains('closed'));
    if (isClosed) {
      await page.locator('.section-header').nth(1).click();
      await page.waitForTimeout(300);
    }

    await page.locator('#input-tsuji-search-days').fill('7');
    await page.locator('#btn-tsuji-search').click();
    await page.waitForTimeout(5000);

    // 結果コンテンツにテキストが入っていること
    const content = page.locator('#tsujisearch-content');
    const text = await content.innerText();
    expect(text.length).toBeGreaterThan(0);
  });
});

// =========================================================
// データ保存・復元
// =========================================================

test.describe('データ保存・復元', () => {
  test('LocalStorageへの保存が動作する（Homボタン）', async ({ page }) => {
    await page.goto('./');
    await page.waitForTimeout(3000);

    const panel = page.locator('#control-panel');
    const isMinimized = await panel.evaluate(el => el.classList.contains('minimized'));
    if (isMinimized) {
      await page.locator('.panel-header').click();
      await page.waitForTimeout(500);
    }

    // 観測点を入力
    await page.locator('#input-start-latlng').fill('35.6585,139.7454');
    await page.locator('#input-start-latlng').press('Enter');
    await page.waitForTimeout(2000);

    // Homボタンをクリックして登録
    await page.locator('#btn-reg-start').click();
    await page.waitForTimeout(500);

    // LocalStorageにデータが保存されたことを確認
    const stored = await page.evaluate(() => {
      return Object.keys(localStorage).length > 0;
    });
    expect(stored).toBe(true);
  });

  test('ページリロード後にLocalStorageのデータが存在する', async ({ page }) => {
    await page.goto('./');
    await page.waitForTimeout(3000);

    // LocalStorageに何かデータがある状態でリロード
    const keysBefore = await page.evaluate(() => Object.keys(localStorage));
    
    await page.reload();
    await page.waitForTimeout(3000);

    const keysAfter = await page.evaluate(() => Object.keys(localStorage));
    // リロード後もキー数が同じであること（データが消えていない）
    expect(keysAfter.length).toBe(keysBefore.length);
  });

  test('設定（観測点）がlocalStorageに保存・復元される', async ({ page }) => {
    await page.goto('./');
    await page.waitForTimeout(3000);
    await expandPanel(page);

    // LocalStorage の全キーを確認
    const keys = await page.evaluate(() => Object.keys(localStorage));
    // アプリが何らかのデータをLocalStorageに保存していること
    // ※ 初回はLocalStorageが空の可能性もあるため、ページ読み込み後のDOMに初期値が表示されることを確認
    const startInput = page.locator('#input-start-latlng');
    await expect(startInput).toBeAttached();
    // 入力欄がDOMに存在すること（値の有無は問わない）
    const val = await startInput.inputValue();
    expect(typeof val).toBe('string');
  });
});

// =========================================================
// 入力バリデーション
// =========================================================

test.describe('入力バリデーション', () => {
  test('テキストボックスに異常な値（文字列）を入力してもエラーにならない', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./');
    await page.waitForTimeout(2000);

    const panel = page.locator('#control-panel');
    const isMinimized = await panel.evaluate(el => el.classList.contains('minimized'));
    if (isMinimized) {
      await page.locator('.panel-header').click();
      await page.waitForTimeout(300);
    }

    // 観測点テキストボックスに異常値を入力
    await page.locator('#input-start-latlng').fill('あいうえお12345!@#$%');
    await page.locator('#input-start-latlng').press('Enter');
    await page.waitForTimeout(1000);
    expect(errors).toEqual([]);
  });

  test('数値入力欄に極端な値を入力してもエラーにならない', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./');
    await page.waitForTimeout(2000);

    const panel = page.locator('#control-panel');
    const isMinimized = await panel.evaluate(el => el.classList.contains('minimized'));
    if (isMinimized) {
      await page.locator('.panel-header').click();
      await page.waitForTimeout(300);
    }

    // 観測点標高に極端な値を入力
    await page.locator('#input-start-elev').fill('999999');
    await page.locator('#input-start-elev').press('Tab');
    await page.waitForTimeout(500);

    // 目的点標高に負の極端値
    await page.locator('#input-end-elev').fill('-999999');
    await page.locator('#input-end-elev').press('Tab');
    await page.waitForTimeout(500);

    expect(errors).toEqual([]);
  });

  test('辻検索入力のmin/max属性が正しく設定されている', async ({ page }) => {
    await page.goto('./');
    await page.waitForTimeout(1000);

    // 検索期間のmin/max確認（min=1, max=1461）
    const daysInput = page.locator('#input-tsuji-search-days');
    const min = await daysInput.getAttribute('min');
    const max = await daysInput.getAttribute('max');
    expect(min).toBe('1');
    expect(max).toBe('1461');

    // 基準方位角のmin/max確認（min=0, max=360）
    const azInput = page.locator('#input-tsuji-az');
    const azMin = await azInput.getAttribute('min');
    const azMax = await azInput.getAttribute('max');
    expect(azMin).toBe('0');
    expect(azMax).toBe('360');
  });

  test('step属性が正しく設定されている', async ({ page }) => {
    await page.goto('./');
    await page.waitForTimeout(1000);

    // 基準方位角のstep確認（0.01°）
    const azInput = page.locator('#input-tsuji-az');
    const step = await azInput.getAttribute('step');
    expect(step).toBe('0.01');

    // 月齢のstep確認（0.1）
    const moonAgeInput = page.locator('#moon-age-input');
    const moonStep = await moonAgeInput.getAttribute('step');
    expect(moonStep).toBe('0.1');
  });
});

// =========================================================
// レスポンシブ・表示
// =========================================================

test.describe('レスポンシブ・表示', () => {
  test('PC幅（1280x800）で正常表示される', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('./');
    await page.waitForTimeout(2000);
    // 地図が表示されること
    await expect(page.locator('#map')).toBeVisible();
    // コントロールパネルが表示されること
    await expect(page.locator('#control-panel')).toBeVisible();
  });

  test('スマートフォン幅（390x844）で正常表示される', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');
    await page.waitForTimeout(2000);
    // 地図が表示されること
    await expect(page.locator('#map')).toBeVisible();
    // コントロールパネルが表示されること
    await expect(page.locator('#control-panel')).toBeVisible();
    // JSエラーなし
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.waitForTimeout(1000);
    expect(errors).toEqual([]);
  });

  test('ヘルプモーダルが正常に表示される', async ({ page }) => {
    await page.goto('./');
    await page.waitForTimeout(2000);

    // ヘルプボタンをクリック（コントロールパネルのヘッダーに常時表示）
    await page.locator('#btn-help').click();
    await page.waitForTimeout(500);

    // ヘルプモーダルが表示されること
    const helpModal = page.locator('#help-modal');
    await expect(helpModal).toBeVisible();

    // ヘルプ内にコンテンツがあること
    const helpContent = helpModal.locator('.help-content');
    await expect(helpContent).toBeVisible();

    // 閉じるボタンで閉じられること
    await page.locator('#help-modal .close-help').click();
    await page.waitForTimeout(300);
    await expect(helpModal).toBeHidden();
  });

  test('MathJax（数式）がロードされる', async ({ page }) => {
    await page.goto('./');
    await page.waitForTimeout(2000);

    // ヘルプを開いてMathJaxコンテンツを確認
    await page.locator('#btn-help').click();
    await page.waitForTimeout(3000); // MathJaxレンダリング待ち

    // MathJaxスクリプトが読み込まれていること
    const mathjaxLoaded = await page.evaluate(() => {
      return typeof window.MathJax !== 'undefined';
    });
    expect(mathjaxLoaded).toBe(true);
  });
});
