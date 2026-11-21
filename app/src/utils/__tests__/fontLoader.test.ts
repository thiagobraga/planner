import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureFontLoaded } from '../fontLoader';

const readAppFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('ensureFontLoaded', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('uses bundled styles without adding external font stylesheets', async () => {
    await ensureFontLoaded('lora');
    await ensureFontLoaded('playpen');
    await ensureFontLoaded('hubballi');
    await ensureFontLoaded('playpen');
    expect(document.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(0);
  });

  it('preloads only local regular Lora on initial navigation', () => {
    const html = readAppFile('index.html');
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    expect(html).toMatch(/rel="preload"[^>]+href="\/fonts\/lora-latin-normal\.woff2"[^>]+crossorigin/);
    expect(html).not.toMatch(/rel="preload"[^>]+(?:playpen|hubballi|italic)/);
  });

  it.each(['lora', 'playpen', 'hubballi'])('serves %s font faces locally with swap', (font) => {
    const css = readAppFile(`src/styles/fonts/${font}.css`);
    expect(css).toContain('font-display: swap');
    expect(css).toMatch(/url\('\/fonts\//);
    expect(css).not.toMatch(/https?:/);
  });
});
