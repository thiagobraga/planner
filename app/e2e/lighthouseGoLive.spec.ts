import { expect, test, STORAGE_STATE_PATH } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('page has a useful description and readable version label in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/daily/list');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /tasks|journal/i);
  const version = page.locator('.topbar-version');
  await expect(version).toBeVisible();
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
    await page.waitForTimeout(200);
    const contrast = await version.evaluate((element) => {
      const luminance = (color: string) => {
        const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((part) => {
          const value = part / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const foreground = luminance(getComputedStyle(element).color);
      const background = luminance(getComputedStyle(element.closest('.topbar')!).backgroundColor);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
    expect(contrast, `${theme} version contrast`).toBeGreaterThanOrEqual(4.5);
  }
  await version.click();
  await expect(page).toHaveURL(/\/changelog$/);
  await expect(page.locator('main')).not.toBeEmpty();
});

test('fonts load locally on demand with offline caching in production', async ({ page, context, api }) => {
  const collection = await api.createCollection({ name: 'Weekly journal', color: '#b4a285' });
  try {
    await api.createTask({ title: 'Review weekly journal', collectionId: collection.id, dueDate: new Date().toISOString().slice(0, 10) });
    const requests: string[] = [];
    const errors: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/daily/list');
    await expect(page.locator('main')).not.toBeEmpty();
    await expect(page.getByText('Review weekly journal', { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(requests.some((url) => ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(new URL(url).hostname))).toBe(false);
    expect(requests.some((url) => /\/fonts\/lora-latin-normal\.woff2/.test(url))).toBe(true);
    expect(requests.some((url) => /\/fonts\/(playpen|hubballi)-/.test(url))).toBe(false);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: 'dist/screenshots/lighthouse-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'dist/screenshots/lighthouse-mobile.png' });
    await page.goto('/settings/appearance');
    await expect(page.locator('main')).not.toBeEmpty();
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => requests.some((url) => /\/fonts\/playpen-/.test(url))).toBe(true);
    await expect.poll(() => requests.some((url) => /\/fonts\/hubballi-/.test(url))).toBe(true);
    expect(errors).toEqual([]);
    if (process.env.E2E_PRODUCTION !== '1') return;

    // The production service worker caches optional font bytes after selection.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
      }
      for (const name of ['playpen', 'hubballi']) {
        await fetch(`/fonts/${name}-latin-normal.woff2`);
      }
    });
    await context.setOffline(true);
    const available = await page.evaluate(async () => Promise.all(
      ['lora', 'playpen', 'hubballi'].map(async (name) => {
        const response = await fetch(`/fonts/${name}-latin-normal.woff2`);
        return response.ok && (await response.arrayBuffer()).byteLength > 1000;
      }),
    ));
    expect(available).toEqual([true, true, true]);
    expect(errors).toEqual([]);
  } finally {
    await context.setOffline(false);
    await api.deleteCollection(collection.id);
  }
});
