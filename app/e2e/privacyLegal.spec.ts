import { mkdir, readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './coverage-fixture';

test.describe('Privacy, Terms & Account Data Management', () => {
  test('publicly renders Privacy Policy and Terms of Service without authentication', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mkdir('dist/screenshots', { recursive: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/privacy');

    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Data We Collect & Legal Basis' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Cookie Policy' })).toBeVisible();
    await expect(page.getByText('No cookie consent banner is required')).toBeVisible();
    await page.screenshot({ path: 'dist/screenshots/privacy-policy-desktop.png', fullPage: false });

    // Switch language to Portuguese and back to English
    await page.getByRole('button', { name: 'PT-BR', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Política de Privacidade' })).toBeVisible();
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'dist/screenshots/privacy-policy-mobile.png', fullPage: false });

    // Navigate to Terms of Service
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/terms');
    await expect(page.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: '1. Service Description' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: '6. Governing Law' })).toBeVisible();
    await page.screenshot({ path: 'dist/screenshots/terms-of-service-desktop.png', fullPage: false });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'dist/screenshots/terms-of-service-mobile.png', fullPage: false });

    expect(errors).toEqual([]);
  });

  test('shows legal links on Login and consent notice on Register, exports data, and deletes account', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mkdir('dist/screenshots', { recursive: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/login');
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    await expect(page.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');

    await page.goto('/register');
    await expect(page.getByText(/By creating an account, you agree to our/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
    await expect(page.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    await page.screenshot({ path: 'dist/screenshots/register-consent-desktop.png' });

    const email = `e2e-privacy-${Date.now()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple-99!';

    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(daily|today|inbox)/, { timeout: 15000 });

    await page.goto('/settings/general');
    const dataHeading = page.getByRole('heading', { name: 'Data & Privacy' });
    await dataHeading.scrollIntoViewIfNeeded();
    await expect(dataHeading).toBeVisible();
    await page.screenshot({ path: 'dist/screenshots/settings-data-privacy-desktop.png' });

    // Export account data and inspect downloaded JSON
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export data' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^planner-data-export-\d{4}-\d{2}-\d{2}\.json$/);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const exportedJson = JSON.parse(await readFile(filePath!, 'utf-8')) as {
      user: { email: string };
      collections: Array<{ name: string }>;
    };
    expect(exportedJson.user.email).toBe(email);
    expect(exportedJson.user).not.toHaveProperty('password_hash');
    expect(exportedJson.collections.some((c) => c.name === 'Inbox')).toBe(true);

    // Delete account via confirmation modal
    await page.getByRole('button', { name: 'Delete account' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Delete account?')).toBeVisible();
    await page.screenshot({ path: 'dist/screenshots/settings-delete-account-modal.png' });

    await dialog.getByRole('button', { name: 'Delete account' }).click();
    await page.waitForURL(/\/login/, { timeout: 15000 });

    // Verify login fails after deletion
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole('alert')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
