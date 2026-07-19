import { beforeEach, describe, expect, it } from 'vitest';
import { updateDocumentThemeColor } from '../theme';

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
