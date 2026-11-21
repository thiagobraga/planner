import { mkdir } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './coverage-fixture';

const themes = [
  { id: 'white', name: 'White' },
  { id: 'beige', name: 'Beige' },
  { id: 'dark', name: 'Dark' },
  { id: 'nord-light', name: 'Nord Light' },
  { id: 'nord-dark', name: 'Nord Dark' },
] as const;

// Styleguide is admin-only. Supply a dedicated test admin on the isolated stack.
test.describe('Theme palette reference', () => {
  test.skip(!process.env.E2E_PALETTE_ADMIN_EMAIL || !process.env.E2E_PALETTE_ADMIN_PASSWORD,
    'Requires E2E_PALETTE_ADMIN_EMAIL and E2E_PALETTE_ADMIN_PASSWORD');

  for (const width of [1440, 390]) {
    test(`all palettes preserve the saved theme and remain readable at ${width}px`, async ({ page }) => {
      test.setTimeout(180_000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/login');
      await page.locator('input[type="email"]').fill(process.env.E2E_PALETTE_ADMIN_EMAIL!);
      await page.locator('input[type="password"]').fill(process.env.E2E_PALETTE_ADMIN_PASSWORD!);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(/\/(daily|today|inbox)/);
      await mkdir('dist/screenshots', { recursive: true });

      for (const theme of themes) {
        await page.goto('/settings/appearance');
        const radio = page.getByRole('radiogroup', { name: 'Theme', exact: true })
          .getByRole('radio', { name: theme.name, exact: true });
        await radio.click();
        await expect(radio).toHaveAttribute('aria-checked', 'true');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);
        await page.goto('/styleguide');
        await expect(page.getByRole('heading', { name: 'Styleguide', exact: true })).toBeVisible();

        let preferenceWrites = 0;
        const countWrite = (request: import('@playwright/test').Request) => {
          if (request.method() === 'PATCH' && request.url().includes('/preferences')) preferenceWrites++;
        };
        page.on('request', countWrite);
        for (const preview of themes) {
          const palette = page.getByRole('region', { name: `${preview.name} palette`, exact: true });
          await expect(palette).toBeAttached();
          await expect(palette.locator('.theme-palette-swatch')).toHaveCount(66);
          await expect(palette.getByText('--color-ink', { exact: true })).toBeVisible();
          await expect(palette.getByText('--color-danger', { exact: true })).toBeVisible();
        }
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const contrastFailures = await page.evaluate(() => {
          const probe = document.createElement('span');
          document.body.append(probe);
          const luminance = (token: string) => {
            probe.style.color = `var(${token})`;
            const rgb = getComputedStyle(probe).color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
            const linear = rgb.map(channel => {
              const value = channel / 255;
              return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
            });
            return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
          };
          const pairs = [
            ['--color-ink', '--planner-page-bg', 4.5],
            ['--color-ink-light', '--planner-card-bg', 4.5],
            ['--color-accent-text', '--planner-page-bg', 4.5],
            ['--color-danger-text', '--planner-overlay-bg', 4.5],
            ['--color-on-danger', '--color-danger', 4.5],
            ['--color-focus', '--planner-page-bg', 3],
          ] as const;
          const failures = pairs.flatMap(([foreground, background, minimum]) => {
            const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
            const ratio = (values[0] + 0.05) / (values[1] + 0.05);
            return ratio < minimum ? [`${foreground} on ${background}: ${ratio.toFixed(2)}`] : [];
          });
          probe.remove();
          return failures;
        });
        expect(contrastFailures, theme.name).toEqual([]);
        await page.evaluate(() => document.fonts.ready);
        await page.getByRole('region', { name: `${theme.name} palette`, exact: true })
          .evaluate(element => element.scrollIntoView({ block: 'start' }));
        await page.screenshot({ path: `dist/screenshots/palettes-${theme.id}-${width}.png`, fullPage: true });
        expect(preferenceWrites).toBe(0);
        page.off('request', countWrite);

        await page.getByRole('button', { name: 'Small', exact: true }).first().focus();
        await expect(page.getByRole('button', { name: 'Small', exact: true }).first()).toBeFocused();
        await page.goto('/daily/list');
        await expect(page.locator('main')).toBeVisible();
        await page.keyboard.press('q');
        await expect(page.getByRole('dialog', { name: 'Quick add task' })).toBeVisible();
        await page.screenshot({ path: `dist/screenshots/palette-controls-${theme.id}-${width}.png`, fullPage: true });
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog', { name: 'Quick add task' })).not.toBeVisible();
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);
      }
      expect(errors).toEqual([]);
    });
  }
});
