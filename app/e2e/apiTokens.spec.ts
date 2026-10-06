import { expect, request, type Page } from '@playwright/test';
import { test } from './coverage-fixture';
import { API_URL } from './fixtures/api';

/** Covers Settings > Integrations: minting a token in the UI, using it as a bearer, and revoking it. */

async function registerAndLogin(page: Page) {
  const email = `e2e-api-tokens-${Date.now()}@example.com`;
  const password = 'Correct-Horse-Battery-Staple-99!';

  await page.goto('/register');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(daily|today|inbox)/, { timeout: 15000 });
}

test.describe('API tokens', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test('a token minted in Settings works as a bearer until it is revoked', async ({ page }) => {
    await page.goto('/settings/integrations');
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
    await expect(page.getByText('No tokens yet.')).toBeVisible();

    await page.getByRole('button', { name: 'New token' }).click();
    await page.getByPlaceholder('e.g. Claude Desktop on laptop').fill('E2E agent');
    await page.getByText('Read & write').click();
    await page.getByRole('button', { name: 'Create token' }).click();

    const secret = page.getByRole('textbox', { name: 'API tokens' });
    await expect(secret).toHaveValue(/^plnr_/);
    const rawToken = await secret.inputValue();

    await page.getByRole('button', { name: 'Done' }).click();
    await expect(secret).toBeHidden();
    await expect(page.getByRole('list', { name: 'API tokens' })).toContainText('E2E agent');

    // A fresh context carries no cookies, so only the bearer can authenticate it.
    const agent = await request.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { Authorization: `Bearer ${rawToken}` },
    });
    const created = await agent.post(`${API_URL}/tasks`, { data: { title: 'Filed by an agent' } });
    expect(created.status()).toBe(201);

    await page.goto('/inbox');
    await expect(page.getByText('Filed by an agent')).toBeVisible();

    await page.goto('/settings/integrations');
    await page.getByRole('button', { name: 'Revoke' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Revoke' }).click();
    await expect(page.getByText('No tokens yet.')).toBeVisible();

    const afterRevoke = await agent.get(`${API_URL}/views/inbox`);
    expect(afterRevoke.status()).toBe(401);
    await agent.dispose();
  });
});
