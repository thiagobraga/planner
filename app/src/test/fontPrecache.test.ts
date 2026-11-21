import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getManifest } from 'workbox-build';

let directory: string | undefined;

afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});

describe('font precache', () => {
  it('discovers bundled assets and Lora while leaving optional fonts for runtime caching', async () => {
    directory = mkdtempSync(join(tmpdir(), 'planner-font-precache-'));
    mkdirSync(join(directory, 'fonts'));
    mkdirSync(join(directory, 'assets'));
    for (const file of [
      'fonts/lora-latin-normal.woff2',
      'fonts/lora-latin-italic.woff2',
      'fonts/playpen-latin-normal.woff2',
      'fonts/hubballi-latin-normal.woff2',
      'assets/index.js',
      'assets/index.css',
    ]) writeFileSync(join(directory, file), file);

    const manifest = await getManifest({
      globDirectory: directory,
      globPatterns: ['**/*.{js,css,svg,png,ico,woff2}'],
      globIgnores: ['**/images/splash/**', '**/fonts/playpen-*.woff2', '**/fonts/hubballi-*.woff2'],
    });

    expect(manifest.warnings).toEqual([]);
    expect(manifest.manifestEntries.map(({ url }) => url).sort()).toEqual([
      'assets/index.css',
      'assets/index.js',
      'fonts/lora-latin-italic.woff2',
      'fonts/lora-latin-normal.woff2',
    ]);
  });
});
