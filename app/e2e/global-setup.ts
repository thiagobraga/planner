import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { request as apiRequest } from '@playwright/test';

import { API_ORIGIN, API_PATH, BASE_URL, STORAGE_STATE_PATH } from './fixtures/api';

export default async function globalSetup(): Promise<void> {
  fs.mkdirSync(path.dirname(STORAGE_STATE_PATH), { recursive: true });

  const request = await apiRequest.newContext({
    baseURL: API_ORIGIN,
    ignoreHTTPSErrors: true,
  });

  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `playwright-${suffix}@example.com`;
  const password = 'Correct-Horse-Battery-Staple-99!';

  async function failWithBody(label: string, response: { status(): number; statusText(): string; text(): Promise<string> }): Promise<never> {
    throw new Error(`${label}: ${response.status()} ${response.statusText()} ${await response.text()}`);
  }

  const registerResponse = await request.post(`${API_PATH}/auth/register`, {
    data: {
      email,
      password,
      displayName: 'Playwright',
      timeZone: 'UTC',
    },
    failOnStatusCode: false,
  });
  if (registerResponse.status() < 200 || registerResponse.status() >= 300) {
    await failWithBody('Failed to register Playwright user', registerResponse);
  }

  const loginResponse = await request.post(`${API_PATH}/auth/login`, {
    data: { email, password },
    failOnStatusCode: false,
  });
  if (loginResponse.status() < 200 || loginResponse.status() >= 300) {
    await failWithBody('Failed to log in Playwright user', loginResponse);
  }

  const state = await request.storageState();
  const sessionCookie = state.cookies.find((cookie) => cookie.name.endsWith('_session'));
  if (!sessionCookie) {
    throw new Error('Failed to capture session cookie for Playwright storage state');
  }

  const storageState = {
    cookies: state.cookies,
    origins: [
      {
        origin: new URL(BASE_URL).origin,
        localStorage: [
          {
            name: 'planner_token',
            value: sessionCookie.value,
          },
        ],
      },
    ],
  };

  fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(storageState, null, 2));
  await request.dispose();
}
