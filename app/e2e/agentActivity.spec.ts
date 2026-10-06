import { expect, request, type Page } from '@playwright/test';
import { test } from './coverage-fixture';
import { API_URL } from './fixtures/api';

/** Covers agent attribution: token-made changes listed in Settings and announced live when opted in. */

async function registerAndLogin(page: Page) {
  const email = `e2e-agent-activity-${Date.now()}@example.com`;
  const password = 'Correct-Horse-Battery-Staple-99!';

  await page.goto('/register');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(daily|today|inbox)/, { timeout: 15000 });
}

test.describe('Agent activity', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test('lists what a token did and announces new changes live once enabled', async ({ page }) => {
    await page.goto('/settings/integrations');
    await page.getByRole('button', { name: 'New token' }).click();
    await page.getByPlaceholder('e.g. Claude Desktop on laptop').fill('Nightly agent');
    await page.getByText('Read & write').click();
    await page.getByRole('button', { name: 'Create token' }).click();
    const rawToken = await page.getByRole('textbox', { name: 'API tokens' }).inputValue();
    await page.getByRole('button', { name: 'Done' }).click();

    const agent = await request.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { Authorization: `Bearer ${rawToken}` },
    });
    expect((await agent.post(`${API_URL}/tasks`, { data: { title: 'Agent wrote this' } })).status()).toBe(201);

    const recent = page.getByRole('list', { name: 'Recent agent activity' });
    await expect(recent).toContainText('Created "Agent wrote this"');
    await expect(recent).toContainText('via Nightly agent');

    await page.getByRole('button', { name: 'Activity for Nightly agent' }).click();
    await expect(page.getByRole('list', { name: 'Activity for Nightly agent' })).toContainText('Agent wrote this');

    // Stay on the page: a reload would race the agent's write against the socket reconnecting.
    await page.getByText('Notify me when an agent changes my tasks').click();
    await expect(page.getByRole('switch', { name: 'Notify me when an agent changes my tasks' })).toBeChecked();
    expect((await agent.post(`${API_URL}/tasks`, { data: { title: 'Second agent task' } })).status()).toBe(201);
    await expect(page.getByRole('status').filter({ hasText: 'Nightly agent added "Second agent task"' })).toBeVisible();

    await agent.dispose();
  });
});
