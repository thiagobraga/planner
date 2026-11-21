import { describe, expect, it } from 'vitest';
import { SHADE_STEPS, THEME_PALETTES } from '../themePalettes';

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(channel => parseInt(channel, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function tint(foreground: string, background: string, amount: number) {
  const channels = (hex: string) => hex.slice(1).match(/../g)!.map(channel => parseInt(channel, 16));
  const base = channels(background);
  return `#${channels(foreground).map((channel, index) => Math.round(channel * amount + base[index] * (1 - amount)).toString(16).padStart(2, '0')).join('')}`;
}

describe('Planner theme palettes', () => {
  it('defines all five themes with complete, distinct 50-950 shade scales', () => {
    expect(THEME_PALETTES.map(theme => theme.id)).toEqual(['white', 'beige', 'dark', 'nord-light', 'nord-dark']);
    for (const theme of THEME_PALETTES) {
      expect(theme.families.map(family => family.id)).toEqual(['neutral', 'accent', 'danger', 'warning', 'info', 'success']);
      for (const family of theme.families) {
        expect(family.shades.map(shade => shade.shade)).toEqual(SHADE_STEPS);
        expect(new Set(family.shades.map(shade => shade.value)).size).toBe(11);
        for (const shade of family.shades) expect(shade.value).toMatch(/^#[0-9a-f]{6}$/);
        family.shades.slice(1).forEach((shade, index) => {
          expect(luminance(family.shades[index].value), `${theme.id}: ${family.id}-${shade.shade}`).toBeGreaterThan(luminance(shade.value));
        });
      }
    }
  });

  it('retains the page and accent anchors of each theme', () => {
    const expected = [['#ffffff', '#c9483b'], ['#f5f0e8', '#c9483b'], ['#292219', '#d8705f'], ['#eceff4', '#45688e'], ['#2e3440', '#88c0d0']];
    THEME_PALETTES.forEach((theme, index) => {
      expect([theme.semantics['--planner-page-bg'], theme.semantics['--color-accent']]).toEqual(expected[index]);
    });
  });

  it('maps semantic tokens to available shades and records their usage', () => {
    for (const theme of THEME_PALETTES) {
      expect(Object.keys(theme.semantics).length).toBeGreaterThan(25);
      expect(theme.families.flatMap(family => family.shades.flatMap(shade => shade.usage))).toContain('--planner-board-column-bg');
      for (const [token, value] of Object.entries(theme.semantics)) {
        expect(theme.families.flatMap(family => family.shades).some(shade => shade.value === value && shade.usage.includes(token)), token).toBe(true);
      }
    }
  });

  it('keeps primary, secondary, state and filled-control text readable', () => {
    for (const theme of THEME_PALETTES) {
      const tokens = theme.semantics;
      for (const background of ['--planner-page-bg', '--planner-card-bg', '--planner-overlay-bg']) {
        for (const foreground of ['--color-ink', '--color-ink-light', '--color-accent-text', '--color-danger-text', '--color-warning', '--color-info', '--color-success']) {
          expect(contrast(tokens[foreground], tokens[background]), `${theme.id}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrast(tokens['--color-on-accent'], tokens['--color-accent']), theme.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens['--color-on-danger'], tokens['--color-danger']), theme.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens['--color-on-warning'], tokens['--color-priority-2']), theme.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens['--color-on-info'], tokens['--color-priority-3']), theme.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens['--color-focus'], tokens['--planner-page-bg']), theme.id).toBeGreaterThanOrEqual(3);
      for (const priority of ['--color-priority-2', '--color-priority-3']) {
        expect(contrast(tokens[priority], tokens['--planner-card-bg']), `${theme.id}: ${priority}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('keeps state text readable on tinted badges and menus', () => {
    for (const theme of THEME_PALETTES) {
      const tokens = theme.semantics;
      for (const [foreground, fill, amount] of [
        ['--color-danger-text', '--color-danger', 0.12],
        ['--color-success', '--color-success', 0.2],
        ['--color-warning', '--color-warning', 0.2],
        ['--color-info', '--color-info', 0.15],
      ] as const) {
        for (const background of ['--planner-page-bg', '--planner-card-bg', '--planner-overlay-bg']) {
          expect(contrast(tokens[foreground], tint(tokens[fill], tokens[background], amount)), `${theme.id}: ${foreground} tinted ${background}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});
