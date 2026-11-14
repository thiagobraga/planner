import { beforeEach, describe, expect, it } from 'vitest';
import { resolveTheme, updateDocumentThemeColor } from '../theme';

describe('updateDocumentThemeColor', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#ebe6de">';
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
});

describe('dark theme', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#ebe6de">';
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
