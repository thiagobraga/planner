import { beforeEach, describe, expect, it } from 'vitest';
import { resolveTheme, updateDocumentThemeColor } from '../theme';

describe('updateDocumentThemeColor', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#f5f0e8">';
  });

  it('uses white browser chrome for the white background', () => {
    updateDocumentThemeColor('white');

    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#ffffff');
  });

  it('restores the beige install fallback for the beige background', () => {
    updateDocumentThemeColor('white');
    updateDocumentThemeColor('beige');

    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#f5f0e8');
  });
});

describe('dark theme', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#f5f0e8">';
  });

  it('uses the dark title-bar color for the dark theme', () => {
    updateDocumentThemeColor('dark');

    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#221a14');
  });
});

describe('resolveTheme', () => {
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
