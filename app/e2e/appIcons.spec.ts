import { expect } from '@playwright/test';
import { test } from './coverage-fixture';

interface ManifestIcon {
  src: string;
  purpose: string;
}

test.describe('App icons and launch images', () => {
  test('every icon and launch image linked from index.html is served as an image', async ({ page, request }) => {
    await page.goto('/login');
    const hrefs = await page
      .locator('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-startup-image"]')
      .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));

    expect(hrefs.filter((href) => href.includes('/images/splash/ios/'))).toHaveLength(44);
    for (const href of hrefs) {
      const response = await request.get(href);
      expect(response.status(), href).toBe(200);
      expect(response.headers()['content-type'], href).toMatch(/^image\//);
    }
  });

  test('the linked manifest lists reachable any and maskable icons', async ({ page, request }) => {
    await page.goto('/login');
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();

    const manifest = (await (await request.get(manifestHref!)).json()) as { icons: ManifestIcon[] };
    expect(manifest.icons.map((icon) => icon.purpose).sort()).toEqual(['any', 'any', 'maskable', 'maskable']);
    for (const icon of manifest.icons) {
      const response = await request.get(icon.src);
      expect(response.status(), icon.src).toBe(200);
      expect(response.headers()['content-type'], icon.src).toBe('image/png');
    }
  });

  test.describe('on a retina screen', () => {
    test.use({ deviceScaleFactor: 2 });

    test('the login logo loads its 2x source', async ({ page }) => {
      await page.goto('/login');
      const logo = page.locator('img[src="/images/logo/logo-64x64.png"]');
      await expect(logo).toBeVisible();
      await expect
        .poll(() => logo.evaluate((img: HTMLImageElement) => (img.complete && img.naturalWidth > 0 ? img.currentSrc : '')))
        .toMatch(/\/images\/logo\/logo-128x128\.png$/);
    });
  });
});
