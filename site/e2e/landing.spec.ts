import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const themes = { beige: 'rgb(245, 240, 232)', white: 'rgb(255, 255, 255)', dark: 'rgb(41, 34, 25)' };
const sizes = {
  desktop: { width: 1440, height: 1000 },
  tablet: { width: 768, height: 1024 },
  phone: { width: 390, height: 844 },
};

for (const [size, viewport] of Object.entries(sizes)) {
  for (const [theme, background] of Object.entries(themes)) {
    test(`${theme} theme at ${size}: complete page, persistence and assets`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      await expect(page).toHaveTitle(/Planner/);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (size === 'phone') await page.getByRole('button', { name: 'Toggle menu' }).click();
      const switcher = page.getByRole('group', { name: size === 'phone' ? 'Mobile theme' : 'Desktop theme' });
      await switcher.getByRole('button', { name: new RegExp(theme, 'i') }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('body')).toHaveCSS('background-color', background);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('body')).toHaveCSS('background-color', background);
      await page.evaluate(async () => { await document.fonts.ready; });
      for (const image of await page.locator('img').all()) {
        await image.scrollIntoViewIfNeeded();
        await expect(image).toHaveJSProperty('complete', true);
        await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      }
      await page.locator('footer').scrollIntoViewIfNeeded();
      await expect(page.locator('footer')).toBeVisible();
      for (const heading of await page.getByRole('heading', { level: 2 }).all()) await expect(heading).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(await page.locator('img').evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
      expect(await page.locator('.reveal').evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === '1'))).toBe(true);
      await expect(page.locator('vite-error-overlay')).toHaveCount(0);
      await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
      expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
      expect(errors).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, 0));
      const directory = resolve('../app/dist/screenshots');
      await mkdir(directory, { recursive: true });
      await page.screenshot({ path: `${directory}/landing-${theme}-${size}.png`, fullPage: true, animations: 'disabled' });
    });
  }
}

test('showcase, FAQ, destinations and keyboard work without API requests', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', request => { if (/\/api\/|\/socket.io/.test(request.url())) apiRequests.push(request.url()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('link', { name: 'See it in action' }).click();
  await expect(page).toHaveURL(/#showcase$/);
  const desk = page.getByRole('tab', { name: 'Desk', exact: true });
  await desk.focus();
  await desk.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Desktop' })).toBeFocused();
  await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Desktop');
  await page.getByRole('tab', { name: 'Desktop' }).press('End');
  await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Mobile');
  await page.getByRole('tab', { name: 'Mobile' }).press('Home');
  await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Desk');
  const question = page.getByRole('button', { name: /Can I self-host/ });
  await question.click();
  await expect(question).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('region', { name: /Can I self-host/ })).toBeVisible();
  await question.press('Enter');
  await expect(question).toHaveAttribute('aria-expanded', 'false');
  const applicationURL = (process.env.VITE_APP_URL || 'https://planner.thiagobraga.dev').replace(/\/+$/, '');
  await expect(page.getByRole('link', { name: /Start journaling/ })).toHaveAttribute('href', `${applicationURL}/register`);
  await expect(page.getByRole('link', { name: 'GitHub', exact: true })).toHaveAttribute('href', 'https://github.com/thiagobraga/planner');
  expect(apiRequests).toEqual([]);
});

test('mobile navigation closes on anchors and Escape', async ({ page }) => {
  await page.setViewportSize(sizes.phone);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Toggle menu' });
  await toggle.click();
  await page.locator('#mobile-navigation').getByRole('link', { name: 'Features', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page).toHaveURL(/#features$/);
  await toggle.click();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
});

test('stored theme applies before the application script executes', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('planner-site-theme', 'dark'));
  await page.route('**/*.js', route => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', themes.dark);
});

test('invalid or unavailable storage falls back and content survives missing reveal support', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('planner-site-theme', 'invalid');
    Object.defineProperty(window, 'IntersectionObserver', { value: undefined });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'beige');
  await page.locator('footer').scrollIntoViewIfNeeded();
  expect(await page.locator('.reveal').evaluateAll(elements => elements.every(element => getComputedStyle(element).opacity === '1'))).toBe(true);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('group', { name: 'Desktop theme' }).getByRole('button', { name: /Dark/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
