import crypto from 'node:crypto';
import { expect, request } from '@playwright/test';
import { test } from './coverage-fixture';
import { API_URL, BASE_URL } from './fixtures/api';

/** Covers the OAuth sign-in a hosted MCP client (claude.ai, ChatGPT) runs, as a signed-out user would see it. */

const ORIGIN = new URL(BASE_URL).origin;
const MCP_URL = `${ORIGIN}/api/v1/mcp`;
// A loopback callback the browser never actually reaches: the test intercepts it.
const REDIRECT = 'http://127.0.0.1:9/oauth/callback';
const PASSWORD = 'Correct-Horse-Battery-Staple-99!';

test.describe('MCP OAuth sign-in', () => {
  test('log in, consent, exchange the code, call MCP, then disconnect from Settings', async ({ page }) => {
    const api = await request.newContext({ ignoreHTTPSErrors: true });
    const email = `e2e-oauth-${Date.now()}@example.com`;
    expect((await api.post(`${API_URL}/auth/register`, { data: { email, password: PASSWORD, timeZone: 'UTC' } })).ok()).toBe(true);

    const registration = await api.post(`${ORIGIN}/api/oauth/register`, {
      data: {
        client_name: 'E2E Assistant',
        redirect_uris: [REDIRECT],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      },
    });
    expect(registration.status()).toBe(201);
    const clientId = (await registration.json()).client_id as string;

    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const authorizeUrl = new URL(`${ORIGIN}/api/oauth/authorize`);
    for (const [key, value] of Object.entries({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'e2e-state',
      scope: 'read write',
      resource: MCP_URL,
    })) {
      authorizeUrl.searchParams.set(key, value);
    }

    let callback: URL | undefined;
    await page.route(`${REDIRECT}**`, async (route) => {
      callback = new URL(route.request().url());
      await route.fulfill({ status: 200, body: 'ok' });
    });

    // Signed out: the consent page sends us to log in and then straight back.
    await page.goto(authorizeUrl.href);
    await expect(page).toHaveURL(/\/login\?next=/);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();

    await expect(page.getByRole('heading', { name: 'E2E Assistant wants to use your Planner' })).toBeVisible();
    await expect(page.getByText('You will be sent back to 127.0.0.1:9.')).toBeVisible();
    await page.getByRole('button', { name: 'Allow read & write' }).click();

    await expect.poll(() => callback?.searchParams.get('code') ?? null).not.toBeNull();
    expect(callback!.searchParams.get('state')).toBe('e2e-state');

    const token = await api.post(`${ORIGIN}/api/oauth/token`, {
      form: {
        grant_type: 'authorization_code',
        client_id: clientId,
        code: callback!.searchParams.get('code')!,
        code_verifier: verifier,
        redirect_uri: REDIRECT,
        resource: MCP_URL,
      },
    });
    expect(token.status()).toBe(200);
    const accessToken = (await token.json()).access_token as string;

    const callMcp = () =>
      api.post(MCP_URL, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json, text/event-stream' },
        data: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
      });
    const tools = await callMcp();
    expect(tools.status()).toBe(200);
    expect(JSON.stringify(await tools.json())).toContain('create_task');

    await page.goto('/settings/integrations');
    const apps = page.getByRole('list', { name: 'Connected apps' });
    await expect(apps).toContainText('E2E Assistant');
    await apps.getByRole('button', { name: 'Disconnect' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Disconnect' }).click();
    await expect(apps).toBeHidden();

    expect((await callMcp()).status()).toBe(401);
    await api.dispose();
  });
});
