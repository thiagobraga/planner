import { mkdir } from 'node:fs/promises';
import { expect, STORAGE_STATE_PATH, test } from './fixtures/api';

test.describe('i18next language switching and persistence', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('starts in English with empty cache and persists cached locale across reload on public pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/privacy');

    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.getByRole('button', { name: 'PT-BR', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Política de Privacidade' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    expect(await page.evaluate(() => window.localStorage.getItem('planner_locale'))).toBe('pt-BR');

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Política de Privacidade' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');

    expect(errors).toEqual([]);
  });
});

test.describe('i18next authenticated settings preference flow', () => {
  test.use({ storageState: STORAGE_STATE_PATH });

  test('switches language in Settings, persists across reload, and restores English', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mkdir('dist/screenshots', { recursive: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/settings/general');

    await expect(page.getByRole('heading', { level: 1, name: /Settings|Configurações/ })).toBeVisible();
    const savePt = page.waitForResponse(
      (res) => res.url().includes('/preferences') && res.request().method() === 'PATCH',
    );
    await page.getByText('Português (Brasil)', { exact: true }).click();
    expect((await savePt).ok()).toBeTruthy();

    await expect(page.getByRole('heading', { level: 1, name: 'Configurações', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await page.screenshot({ path: 'dist/screenshots/i18n-settings-pt-br-desktop.png' });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { level: 1, name: 'Configurações', exact: true })).toBeVisible();
    await page.screenshot({ path: 'dist/screenshots/i18n-settings-pt-br-mobile.png' });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Configurações', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');

    const saveEn = page.waitForResponse(
      (res) => res.url().includes('/preferences') && res.request().method() === 'PATCH',
    );
    await page.getByText('English', { exact: true }).click();
    expect((await saveEn).ok()).toBeTruthy();
    await expect(page.getByRole('heading', { level: 1, name: 'Settings', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.screenshot({ path: 'dist/screenshots/i18n-settings-en-desktop.png' });

    expect(errors).toEqual([]);
  });
});
