import { expect, request, type Page } from '@playwright/test';
import { test } from './coverage-fixture';
import { API_URL } from './fixtures/api';

/** Covers the MCP endpoint end to end: token from Settings, tools/call over HTTP, live update in an open tab. */

const ACCEPT = 'application/json, text/event-stream';

async function registerAndLogin(page: Page) {
  const email = `e2e-mcp-${Date.now()}@example.com`;
  const password = 'Correct-Horse-Battery-Staple-99!';

  await page.goto('/register');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(daily|today|inbox)/, { timeout: 15000 });
}

async function mintWriteToken(page: Page): Promise<string> {
  await page.goto('/settings/integrations');
  await page.getByRole('button', { name: 'New token' }).click();
  await page.getByPlaceholder('e.g. Claude Desktop on laptop').fill('E2E MCP agent');
  await page.getByText('Read & write').click();
  await page.getByRole('button', { name: 'Create token' }).click();
  const secret = page.getByRole('textbox', { name: 'API tokens' });
  await expect(secret).toHaveValue(/^plnr_/);
  const raw = await secret.inputValue();

  const panel = page.getByRole('region', { name: 'Connect an AI agent' });
  await expect(panel).toContainText(`Bearer ${raw}`);
  await expect(panel).toContainText('/api/v1/mcp');
  return raw;
}

test.describe('MCP server', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test('a task created through MCP appears in an open Inbox without a reload', async ({ page }) => {
    const rawToken = await mintWriteToken(page);

    await page.goto('/inbox');
    await expect(page.getByText('Filed via MCP')).toHaveCount(0);

    const agent = await request.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { Authorization: `Bearer ${rawToken}`, Accept: ACCEPT },
    });
    const response = await agent.post(`${API_URL}/mcp`, {
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'create_task', arguments: { title: 'Filed via MCP' } },
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.result.content[0].text).toMatch(/^Created - \[ \] Filed via MCP/);

    await expect(page.getByText('Filed via MCP')).toBeVisible();
    await agent.dispose();
  });
});
