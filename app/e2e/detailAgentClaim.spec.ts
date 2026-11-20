import { expect, request, type Page } from '@playwright/test';
import { test } from './coverage-fixture';
import { API_URL } from './fixtures/api';

/** An agent's claim and comments show in the task detail panel, with the token's label and live links. */

async function registerAndLogin(page: Page) {
  await page.goto('/register');
  await page.locator('input[type="email"]').fill(`e2e-detail-claim-${Date.now()}@example.com`);
  await page.locator('input[type="password"]').fill('Correct-Horse-Battery-Staple-99!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(daily|today|inbox)/, { timeout: 15000 });
}

test('shows the agent claim, comment author and comment link in the detail panel', async ({ page }) => {
  await registerAndLogin(page);
  await page.goto('/settings/integrations');
  await page.getByRole('button', { name: 'New token' }).click();
  await page.getByPlaceholder('e.g. Claude Desktop on laptop').fill('Night agent');
  await page.getByText('Read & write').click();
  await page.getByRole('button', { name: 'Create token' }).click();
  const rawToken = await page.getByRole('textbox', { name: 'API tokens' }).inputValue();
  await page.getByRole('button', { name: 'Done' }).click();

  const agent = await request.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Authorization: `Bearer ${rawToken}`, Accept: 'application/json, text/event-stream' },
  });
  const created = await agent.post(`${API_URL}/tasks`, { data: { title: 'Agent picked this up' } });
  expect(created.status()).toBe(201);
  const taskId = (await created.json()).id as string;
  const claim = await agent.post(`${API_URL}/mcp`, {
    data: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'claim_task', arguments: { id: taskId } } },
  });
  expect(claim.status()).toBe(200);
  expect((await agent.post(`${API_URL}/tasks/${taskId}/comments`, { data: { body: 'PR opened: https://github.com/example/repo/pull/1' } })).status()).toBe(201);

  await page.goto(`/inbox?task=${taskId}`);
  const panel = page.getByRole('complementary', { name: 'Task details' });
  await expect(panel.getByText('Claimed by Night agent')).toBeVisible();
  await expect(panel.locator('.detail-comment-actor')).toHaveText('Night agent');
  await expect(panel.getByRole('link', { name: 'https://github.com/example/repo/pull/1' })).toHaveAttribute('rel', 'noopener noreferrer');
  await page.screenshot({ path: 'dist/screenshots/detail-agent-claim-desktop.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('dialog', { name: 'Task details' }).getByText('Claimed by Night agent')).toBeVisible();
  await page.screenshot({ path: 'dist/screenshots/detail-agent-claim-390.png', fullPage: false });
  await agent.dispose();
});
