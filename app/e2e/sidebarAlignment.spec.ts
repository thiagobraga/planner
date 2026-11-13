import { mkdir } from 'node:fs/promises';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

test.use({ storageState: STORAGE_STATE_PATH });

test('topbar fits every style and responsive tier in both locales and themes', async ({ page, api }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mkdir('dist/screenshots', { recursive: true });
  for (const locale of ['en', 'pt-BR']) {
    for (const background of ['beige', 'dark']) {
      for (const navStyle of ['text', 'icon-left', 'icon-top']) {
        await api.patch('/preferences', { locale, background, navStyle });
        await page.goto('/daily/list');
        await expect(page.locator('.topbar')).toHaveAttribute('data-nav-style', navStyle);
        await expect(page.locator('html')).toHaveAttribute('data-theme', background);
        for (const width of [1440, 641, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          await page.evaluate(() => document.fonts.ready);
          const bar = page.locator('.topbar');
          await expect(bar).toBeVisible();
          await expect(bar).toHaveCSS('height', `${width <= 640 ? 64 : navStyle === 'icon-top' ? 64 : 48}px`);
          const geometry = await bar.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const controls = Array.from(element.querySelectorAll('a, button')).filter((control) => control.getBoundingClientRect().width > 0);
            return {
              overflow: element.scrollWidth - element.clientWidth,
              controls: controls.map((control) => {
                const box = control.getBoundingClientRect();
                return { label: control.textContent?.trim(), inside: box.left >= rect.left && box.right <= rect.right + 1 && box.top >= rect.top && box.bottom <= rect.bottom + 1 };
              }),
              clippedLabels: Array.from(element.querySelectorAll('.topbar-item')).filter((item) => item.scrollWidth > item.clientWidth + 1).map((item) => item.textContent?.trim()),
            };
          });
          expect(geometry.overflow, `${locale} ${background} ${navStyle} ${width}`).toBeLessThanOrEqual(1);
          expect(geometry.controls.filter((control) => !control.inside)).toEqual([]);
          expect(geometry.clippedLabels).toEqual([]);
          await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(4);
          if (width <= 640) {
            await expect(page.locator('.topbar-menu-button')).toHaveCSS('width', '44px');
            await expect(page.locator('.topbar-menu-button')).toHaveCSS('height', '44px');
          } else {
            const brand = (await page.locator('.topbar-brand-name').boundingBox())!;
            const nav = (await page.locator('.topbar-nav').boundingBox())!;
            const actions = (await page.locator('.topbar-actions').boundingBox())!;
            expect(brand.x + brand.width, `${locale} ${navStyle} ${width} brand`).toBeLessThanOrEqual(nav.x + 1);
            expect(nav.x + nav.width, `${locale} ${navStyle} ${width} actions`).toBeLessThanOrEqual(actions.x + 1);
          }
          if (width === 1440 || navStyle === 'icon-left') {
            await page.screenshot({ path: `dist/screenshots/topbar-${locale}-${background}-${navStyle}-${width}.png` });
          }
        }
      }
    }
  }
  expect(errors).toEqual([]);
});
