import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readStyles(path: string): string {
  return readFileSync(path, 'utf8').replace(
    /@import\s+["'](\.[^"']+)["'];/g,
    (_, relative: string) => readStyles(resolve(dirname(path), relative)),
  );
}

describe('application theme palette', () => {
  it('preserves every palette and application theme declaration', () => {
    const css = readStyles(resolve(import.meta.dirname, '../../index.css')).replace(/\/\*[\s\S]*?\*\//g, '');
    const declarations: Record<string, Record<string, string>> = {};

    for (const match of css.matchAll(/(@theme|:root(?:\[data-theme="(?:white|dark)"\])?)\s*\{([^{}]*)\}/g)) {
      const selector = match[1];
      declarations[selector] ??= {};
      for (const declaration of match[2].split(';')) {
        const separator = declaration.indexOf(':');
        if (separator < 0) continue;
        declarations[selector][declaration.slice(0, separator).trim()] = declaration.slice(separator + 1).trim();
      }
    }

    expect(declarations).toMatchSnapshot();
  });
});
