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
  it('pairs selected native options with the accessible accent foreground', () => {
    const css = readStyles(resolve(import.meta.dirname, '../../index.css'));
    const checked = css.match(/option:checked\s*\{([^}]+)\}/)?.[1];
    expect(checked).toContain('background-color: var(--color-accent)');
    expect(checked).toContain('color: var(--color-on-accent)');
    expect(checked).not.toContain('--color-accent-light');
  });

  it('preserves every palette and application theme declaration', () => {
    const css = readStyles(resolve(import.meta.dirname, '../../index.css')).replace(/\/\*[\s\S]*?\*\//g, '');
    const declarations: Record<string, Record<string, string>> = {};

    for (const match of css.matchAll(/(@theme|:root(?:\[data-theme="(?:white|dark|nord-light|nord-dark)"\])?)\s*\{([^{}]*)\}/g)) {
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
