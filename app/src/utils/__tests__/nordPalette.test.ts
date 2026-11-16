import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(import.meta.dirname, '../../styles/theme.css'), 'utf8');

function palette(theme: string): Record<string, string> {
  const block = css.match(new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]+)\\}`))?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2]]));
}

function luminance(hex: string): number {
  const values = hex.slice(1).match(/../g)!.map((part) => {
    const channel = parseInt(part, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe.each(['nord-light', 'nord-dark'])('%s palette', (theme) => {
  it('defines a complete palette with separate interaction and danger colors', () => {
    const colors = palette(theme);
    expect(colors['--planner-page-bg']).toBe(theme === 'nord-light' ? '#eceff4' : '#2e3440');
    expect(colors['--color-danger']).not.toBe(colors['--color-accent']);
    const existingTokens = Object.keys(palette('dark')).filter((token) => token.startsWith('--planner-'));
    for (const token of existingTokens) expect(colors[token], token).toBeDefined();
  });

  it('keeps normal text readable across page, control, card and overlay surfaces', () => {
    const colors = palette(theme);
    for (const foreground of ['--color-ink', '--color-ink-light', '--color-danger', '--color-accent']) {
      for (const surface of ['--planner-page-bg', '--planner-overlay-bg', '--planner-control-bg', '--planner-board-card-bg']) {
        expect(contrast(colors[foreground], colors[surface]), `${foreground} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps meaningful control borders and focus indicators visible', () => {
    const colors = palette(theme);
    for (const foreground of ['--color-border', '--color-accent']) {
      for (const surface of ['--planner-page-bg', '--planner-control-bg', '--planner-overlay-bg']) {
        expect(contrast(colors[foreground], colors[surface]), `${foreground} on ${surface}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
