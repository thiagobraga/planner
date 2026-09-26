import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = path.resolve(import.meta.dirname, '../..');
const PUBLIC = path.join(APP, 'public');
const indexHtml = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

function publicFile(url: string): string {
  return path.join(PUBLIC, url.replace(/^\//, ''));
}

// PNG layout: 8-byte signature, then the IHDR chunk (width @16, height @20, color type @25).
function readPng(file: string) {
  const buf = fs.readFileSync(file);
  expect(buf.subarray(1, 4).toString('latin1')).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), hasAlpha: [4, 6].includes(buf[25]) };
}

function expectPng(url: string, width: number, height: number) {
  const file = publicFile(url);
  expect(fs.existsSync(file), `${url} exists`).toBe(true);
  const png = readPng(file);
  expect({ url, width: png.width, height: png.height }).toEqual({ url, width, height });
  return png;
}

describe.each(['manifest.webmanifest', 'manifest.dev.webmanifest'])('%s', (name) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC, name), 'utf8')) as {
    background_color: string;
    theme_color: string;
    icons: ManifestIcon[];
  };

  it('lists any + maskable icons at 192 and 512', () => {
    const listed = manifest.icons.map((icon) => `${icon.purpose} ${icon.sizes}`).sort();
    expect(listed).toEqual(['any 192x192', 'any 512x512', 'maskable 192x192', 'maskable 512x512']);
  });

  it('points every icon at a PNG of the declared size', () => {
    for (const icon of manifest.icons) {
      const [width, height] = icon.sizes.split('x').map(Number);
      expect(icon.type).toBe('image/png');
      expectPng(icon.src, width, height);
    }
  });

  it('ships real maskable icons: opaque and different from the any icons', () => {
    for (const size of ['192x192', '512x512']) {
      const any = manifest.icons.find((icon) => icon.purpose === 'any' && icon.sizes === size)!;
      const maskable = manifest.icons.find((icon) => icon.purpose === 'maskable' && icon.sizes === size)!;
      expect(readPng(publicFile(maskable.src)).hasAlpha).toBe(false);
      expect(fs.readFileSync(publicFile(maskable.src)).equals(fs.readFileSync(publicFile(any.src)))).toBe(false);
    }
  });

  it('uses cream for the Android splash background', () => {
    expect(manifest.background_color).toBe('#f5f0e8');
    expect(manifest.theme_color).toBe('#f5f0e8');
  });
});

describe('index.html icons', () => {
  it('links the favicon.ico with 16, 32 and 48px images', () => {
    expect(indexHtml).toContain('<link rel="icon" href="/favicon.ico"');
    const ico = fs.readFileSync(path.join(PUBLIC, 'favicon.ico'));
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => ico[6 + 16 * i]).sort((a, b) => a - b);
    expect(sizes).toEqual([16, 32, 48]);
  });

  it('links an opaque 180px apple-touch-icon', () => {
    const href = indexHtml.match(/<link rel="apple-touch-icon" href="([^"]+)"/)?.[1];
    expect(href).toBeDefined();
    expect(expectPng(href!, 180, 180).hasAlpha).toBe(false);
  });

  it('links the 32px PNG favicon', () => {
    expectPng('/images/icons/icon-32x32.png', 32, 32);
    expect(indexHtml).toContain('href="/images/icons/icon-32x32.png"');
  });
});

describe('iOS launch images', () => {
  const links = [
    ...indexHtml.matchAll(
      /<link rel="apple-touch-startup-image" media="screen and \(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: (portrait|landscape)\)" href="([^"]+)">/g,
    ),
  ].map(([, dw, dh, dpr, orientation, href]) => ({ dw: +dw, dh: +dh, dpr: +dpr, orientation, href }));

  it('covers 22 devices in both orientations', () => {
    expect(links).toHaveLength(44);
    expect(new Set(links.map((link) => link.href)).size).toBe(44);
    expect(indexHtml.match(/apple-touch-startup-image/g)).toHaveLength(44 + 2);
  });

  it('sizes each image to its device in CSS px times pixel ratio', () => {
    for (const { dw, dh, dpr, orientation, href } of links) {
      const [w, h] = orientation === 'portrait' ? [dw * dpr, dh * dpr] : [dh * dpr, dw * dpr];
      expect(href).toBe(`/images/splash/ios/apple-splash-${w}x${h}.png`);
      expect(expectPng(href, w, h).hasAlpha).toBe(false);
    }
  });

  it('has no launch image on disk that index.html does not link', () => {
    const onDisk = fs.readdirSync(path.join(PUBLIC, 'images/splash/ios')).map((f) => `/images/splash/ios/${f}`);
    expect(onDisk.sort()).toEqual(links.map((link) => link.href).sort());
  });
});

describe('in-app logos', () => {
  it.each([
    [16, 16],
    [32, 32],
    [28, 38],
    [56, 76],
    [64, 64],
    [128, 128],
  ])('ships a transparent %ix%i logo', (width, height) => {
    expect(expectPng(`/images/logo/logo-${width}x${height}.png`, width, height).hasAlpha).toBe(true);
  });
});

describe('old artwork', () => {
  it('is gone from disk and from every reference', () => {
    expect(fs.readdirSync(path.join(PUBLIC, 'images')).filter((f) => f.startsWith('bulletjournal-planner'))).toEqual([]);
    const sources = [
      path.join(APP, 'index.html'),
      path.join(PUBLIC, 'manifest.webmanifest'),
      path.join(PUBLIC, 'manifest.dev.webmanifest'),
      path.join(APP, '../README.md'),
      ...fs
        .readdirSync(path.join(APP, 'src'), { recursive: true, encoding: 'utf8' })
        .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('pwaAssets.test.ts'))
        .map((f) => path.join(APP, 'src', f)),
    ];
    const offenders = sources.filter((file) => fs.readFileSync(file, 'utf8').includes('bulletjournal-planner'));
    expect(offenders).toEqual([]);
  });
});
