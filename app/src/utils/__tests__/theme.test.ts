import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveTheme, THEME_COLORS, updateDocumentThemeColor } from '../theme';
import type { ResolvedTheme } from '../../types/theme';

describe('updateDocumentThemeColor', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#ebe6de">';
  });

  afterEach(() => {
    document.head.innerHTML = '';
  });

  it.each([['nord-light', '#eceff4'], ['nord-dark', '#2e3440']] as const)('uses %s page color for browser chrome', (theme, color) => {
    updateDocumentThemeColor(theme);
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', color);
  });

  it('matches the white theme nav bar', () => {
    updateDocumentThemeColor('white');

    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#f1f1f1');
  });

  it('restores the beige nav bar color for the beige background', () => {
    updateDocumentThemeColor('white');
    updateDocumentThemeColor('beige');

    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#ebe6de');
  });

  it('keeps the existing meta node when the single tag already matches the target color', () => {
    const initial = document.querySelector('meta[name="theme-color"]');

    updateDocumentThemeColor('beige');

    const metas = document.querySelectorAll('meta[name="theme-color"]');
    expect(metas).toHaveLength(1);
    expect(metas[0]).toBe(initial);
  });

  it('replaces and deduplicates meta tags when the color changes so PWA chrome repaints', () => {
    document.head.innerHTML =
      '<link rel="icon" href="/favicon.ico"><meta name="theme-color" content="#ebe6de"><meta name="theme-color" content="#ebe6de">';
    const initial = document.querySelector('meta[name="theme-color"]');

    updateDocumentThemeColor('white');

    const metas = document.querySelectorAll('meta[name="theme-color"]');
    expect(metas).toHaveLength(1);
    expect(metas[0]).not.toBe(initial);
    expect(metas[0]).toHaveAttribute('content', '#f1f1f1');
    expect(document.head.querySelector('link[rel="icon"]')).not.toBeNull();
  });

  it('creates a theme-color meta tag when none exists and falls back to beige on invalid input', () => {
    document.head.innerHTML = '';

    updateDocumentThemeColor('constructor' as ResolvedTheme);

    const metas = document.querySelectorAll('meta[name="theme-color"]');
    expect(metas).toHaveLength(1);
    expect(metas[0]).toHaveAttribute('content', THEME_COLORS.beige);
  });

  it('keeps index.html pre-paint chrome map in sync with THEME_COLORS', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const match = html.match(/const chrome = (\{[^}]+\});/);
    expect(match).not.toBeNull();
    const parsed = Function(`return (${match![1]});`)() as Record<string, string>;
    expect(parsed).toEqual(THEME_COLORS);
  });
});

describe('dark theme', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#ebe6de">';
  });

  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('matches the dark theme nav bar', () => {
    updateDocumentThemeColor('dark');

    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#292219');
  });
});

describe('resolveTheme', () => {
  it.each(['nord-light', 'nord-dark'] as const)('keeps %s fixed across OS appearances', (theme) => {
    expect(resolveTheme(theme, true)).toBe(theme);
    expect(resolveTheme(theme, false)).toBe(theme);
  });

  it('returns fixed preferences unchanged regardless of the OS scheme', () => {
    expect(resolveTheme('beige', true)).toBe('beige');
    expect(resolveTheme('white', true)).toBe('white');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows the OS scheme for the system preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('beige');
  });
});
