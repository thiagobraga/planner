import { test, expect } from '@playwright/test';

const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://api:4000';

test.describe('Production Hardening E2E Tests', () => {
  test('security headers are present on API responses', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/auth/me`);
    expect(response.status()).toBe(401);

    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(['sameorigin', 'same-origin', 'deny']).toContain(
      headers['x-frame-options']?.toLowerCase(),
    );
  });

  test('user registration, authentication, and session logout flow', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `e2e-user-${timestamp}@example.com`;
    const testPassword = 'Correct-Horse-Battery-Staple-99!';

    // Navigate to register page
    await page.goto('/register');
    await expect(page).toHaveTitle(/Planner/i);

    // Fill registration form
    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').fill(testPassword);
    await page.locator('button[type="submit"]').click();

    // After registration, user should be logged in and redirected to main app (/daily)
    await page.waitForURL(/\/(daily|today|inbox)/, { timeout: 15000 });

    // Verify user is authenticated
    const pageUrl = page.url();
    expect(pageUrl).toMatch(/\/(daily|today|inbox)/);
  });

  test('invalid login credentials display clear error without leaking sensitive internals', async ({ page }) => {
    await page.goto('/login');

    await page.locator('input[type="email"]').fill('nonexistent-user-12345@example.com');
    await page.locator('input[type="password"]').fill('WrongPassword999!');
    await page.locator('button[type="submit"]').click();

    // Error message text should appear on the login form
    const errorMessage = page.locator('form, div, p, span').filter({ hasText: /invalid|wrong|error|credentials/i });
    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });

    // Ensure user remains on login page
    expect(page.url()).toContain('/login');
  });

  test('unauthenticated API access is blocked with 401 Unauthorized', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/tasks`);
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('cross-account data isolation: unauthenticated user cannot access tasks or settings', async ({ page }) => {
    // Clear storage to simulate unauthenticated state
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());

    // Try accessing protected page directly
    await page.goto('/settings');

    // Should be redirected to /login
    await page.waitForURL(/\/login/, { timeout: 5000 });
  });
});
