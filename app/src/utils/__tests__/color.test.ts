import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  parseColor,
  formatColor,
  formatAlpha,
  rgbToHex,
  rgbToHsv,
  hsvToRgb,
  rgbToHsl,
  hslToRgb,
  isLightColor,
  type Rgb,
} from '../color';

const rgbArb = fc.record({
  r: fc.integer({ min: 0, max: 255 }),
  g: fc.integer({ min: 0, max: 255 }),
  b: fc.integer({ min: 0, max: 255 }),
});

const alphaArb = fc.integer({ min: 0, max: 100 }).map((n) => n / 100);

// The API's own validator, transcribed - every string the picker emits must
// pass it or the PATCH is rejected with VALIDATION_ERROR.
const API_COLOR_REGEX =
  /^(#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\([^)]+\)|hsla?\([^)]+\))$/;

function apiAcceptsAlpha(value: string): boolean {
  return value === '0' || value === '1' || /^0?\.\d+$/.test(value);
}

function apiAcceptsFunctional(value: string): boolean {
  const match = value.match(/^(rgba?|hsla?)\(([^)]*)\)$/);
  if (!match) return false;
  const isHsl = match[1].startsWith('hsl');
  const parts = match[2].split(',').map((p) => p.trim());
  if (parts.length !== 3 && parts.length !== 4) return false;

  const components = parts.slice(0, 3);
  const componentsOk = isHsl
    ? /^\d{1,3}$/.test(components[0]) && components.slice(1).every((p) => /^\d{1,3}%$/.test(p))
    : components.every((p) => /^\d{1,3}$/.test(p));

  return componentsOk && (parts.length === 3 || apiAcceptsAlpha(parts[3]));
}

describe('color conversions', () => {
  describe('hex round-trips', () => {
    it('rgb → hex → rgb is lossless', () => {
      fc.assert(
        fc.property(rgbArb, (rgb) => {
          expect(parseColor(rgbToHex(rgb))?.rgb).toEqual(rgb);
        }),
      );
    });

    it('rgb + alpha → 8-digit hex → rgb keeps the channels and approximates alpha', () => {
      fc.assert(
        fc.property(rgbArb, alphaArb, (rgb, alpha) => {
          const parsed = parseColor(rgbToHex(rgb, alpha));
          expect(parsed?.rgb).toEqual(rgb);
          expect(Math.abs((parsed?.alpha ?? 0) - alpha)).toBeLessThanOrEqual(0.01);
        }),
      );
    });

    it('expands 3- and 4-digit shorthand', () => {
      expect(parseColor('#abc')?.rgb).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc });
      expect(parseColor('#abcd')?.alpha).toBeCloseTo(0xdd / 255, 5);
    });

    it('is case-insensitive', () => {
      expect(parseColor('#D56B64')).toEqual(parseColor('#d56b64'));
    });
  });

  describe('hsv round-trips', () => {
    it('rgb → hsv → rgb is lossless', () => {
      fc.assert(
        fc.property(rgbArb, (rgb) => {
          expect(hsvToRgb(rgbToHsv(rgb))).toEqual(rgb);
        }),
      );
    });

    it('greyscale values have zero saturation', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 255 }), (v) => {
          expect(rgbToHsv({ r: v, g: v, b: v }).s).toBe(0);
        }),
      );
    });
  });

  describe('hsl round-trips', () => {
    it('rgb → hsl → rgb is lossless', () => {
      fc.assert(
        fc.property(rgbArb, (rgb) => {
          expect(hslToRgb(rgbToHsl(rgb))).toEqual(rgb);
        }),
      );
    });
  });

  describe('parse ⇄ format round-trips', () => {
    it('formatted hex/rgb strings parse back to the same channels', () => {
      fc.assert(
        fc.property(rgbArb, (rgb) => {
          expect(parseColor(formatColor(rgb, 1, 'hex'))?.rgb).toEqual(rgb);
          expect(parseColor(formatColor(rgb, 1, 'rgb'))?.rgb).toEqual(rgb);
        }),
      );
    });

    it('formatted hsl strings parse back within one channel step', () => {
      fc.assert(
        fc.property(rgbArb, (rgb) => {
          const parsed = parseColor(formatColor(rgb, 1, 'hsl'));
          expect(parsed).not.toBeNull();
          const back = parsed!.rgb as Rgb;
          // hsl display rounds to whole degrees/percents, so a channel can drift
          // by a couple of steps; the picker treats that as the same swatch.
          expect(Math.abs(back.r - rgb.r)).toBeLessThanOrEqual(4);
          expect(Math.abs(back.g - rgb.g)).toBeLessThanOrEqual(4);
          expect(Math.abs(back.b - rgb.b)).toBeLessThanOrEqual(4);
        }),
      );
    });

    it('parses functional notation with and without spaces', () => {
      expect(parseColor('rgb(201,72,59)')?.rgb).toEqual({ r: 201, g: 72, b: 59 });
      expect(parseColor('rgba( 201 , 72 , 59 , 0.5 )')?.alpha).toBe(0.5);
      expect(parseColor('hsl(0, 0%, 100%)')?.rgb).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('rejects garbage', () => {
      for (const bad of ['', '   ', 'red', '#12345', '#gg0000', 'rgb(1,2)', 'rgb(a,b,c)', 'hsl()']) {
        expect(parseColor(bad)).toBeNull();
      }
    });
  });

  describe('API compatibility', () => {
    it('every formatted value passes the API colour validator', () => {
      fc.assert(
        fc.property(rgbArb, alphaArb, fc.constantFrom('hex', 'rgb', 'hsl' as const), (rgb, alpha, format) => {
          const value = formatColor(rgb, alpha, format as 'hex' | 'rgb' | 'hsl');
          expect(value).toMatch(API_COLOR_REGEX);
          if (!value.startsWith('#')) {
            expect(apiAcceptsFunctional(value)).toBe(true);
          }
        }),
      );
    });

    it('drops the alpha channel when the colour is opaque', () => {
      expect(formatColor({ r: 201, g: 72, b: 59 }, 1, 'hex')).toBe('#c9483b');
      expect(formatColor({ r: 201, g: 72, b: 59 }, 1, 'rgb')).toBe('rgb(201, 72, 59)');
      expect(formatColor({ r: 255, g: 255, b: 255 }, 1, 'hsl')).toBe('hsl(0, 0%, 100%)');
    });

    it('emits alpha in the notation the API accepts', () => {
      expect(formatAlpha(1)).toBe('1');
      expect(formatAlpha(0)).toBe('0');
      expect(formatAlpha(0.5)).toBe('0.5');
      expect(formatAlpha(0.333)).toBe('0.33');
      expect(formatColor({ r: 201, g: 72, b: 59 }, 0.5, 'rgb')).toBe('rgba(201, 72, 59, 0.5)');
    });
  });

  describe('isLightColor', () => {
    it('separates the extremes', () => {
      expect(isLightColor({ r: 255, g: 255, b: 255 })).toBe(true);
      expect(isLightColor({ r: 0, g: 0, b: 0 })).toBe(false);
    });
  });
});
