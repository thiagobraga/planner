import { mkdir } from 'node:fs/promises';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

for (const width of [390, 660, 1440]) {
  test(`Settings header contains its wrapped subtitle at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/settings/appearance');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    const subtitle = page.locator('.page-header-subtitle');
    await expect(subtitle).toBeVisible();
    const layout = await subtitle.evaluate((element) => {
      const header = element.closest('header')!.getBoundingClientRect();
      const text = element.getBoundingClientRect();
      return { fits: element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth, contained: text.bottom <= header.bottom };
    });
    expect(layout).toEqual({ fits: true, contained: true });
    await mkdir('dist/screenshots', { recursive: true });
    await page.screenshot({ path: `dist/screenshots/settings-header-${width}.png` });
  });
}
