import { describe, expect, it } from 'vitest';
import { AppError } from '../AppError.js';
import { validateColor } from '../color.js';

function expectInvalidColor(value: unknown): void {
  expect(() => validateColor(value)).toThrow(AppError);
}

describe('validateColor', () => {
  it('accepts hex colors with 3, 4, 6, or 8 digits', () => {
    expect(validateColor('#abc')).toBe('#abc');
    expect(validateColor('#abcd')).toBe('#abcd');
    expect(validateColor('#aabbcc')).toBe('#aabbcc');
    expect(validateColor('#aabbccdd')).toBe('#aabbccdd');
  });

  it('accepts rgb and rgba colors', () => {
    expect(validateColor('rgb(0, 12, 255)')).toBe('rgb(0, 12, 255)');
    expect(validateColor('rgba(12,34,56,0.5)')).toBe('rgba(12,34,56,0.5)');
    expect(validateColor('rgba(12, 34, 56, .5)')).toBe('rgba(12, 34, 56, .5)');
  });

  it('accepts hsl and hsla colors', () => {
    expect(validateColor('hsl(120, 50%, 40%)')).toBe('hsl(120, 50%, 40%)');
    expect(validateColor('hsla(120,50%,40%,1)')).toBe('hsla(120,50%,40%,1)');
  });

  it('rejects invalid color strings', () => {
    expectInvalidColor('hotpink');
    expectInvalidColor('#12');
    expectInvalidColor('rgb(1, 2)');
    expectInvalidColor('rgba(1, 2, 3, 2)');
    expectInvalidColor('hsl(1, 2, 3)');
    expectInvalidColor(123);
  });
});
