// Colour maths for the collection colour picker. Every value the picker emits
// has to survive the API's `validateColor()` (api/src/utils/color.ts), which
// only accepts integer rgb/hsl components, `%` on saturation/lightness, and an
// alpha of `0`, `1`, `0.x` or `.x` - so formatting rounds to integers and
// clamps alpha to two decimals.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export interface ParsedColor {
  rgb: Rgb;
  alpha: number;
}

export type ColorFormat = 'hex' | 'rgb' | 'hsl';

export const COLOR_FORMATS: readonly ColorFormat[] = ['hex', 'rgb', 'hsl'];

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function clamp255(value: number): number {
  return clamp(Math.round(value), 0, 255);
}

function normalizeHue(h: number): number {
  const wrapped = h % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rr = clamp(r, 0, 255) / 255;
  const gg = clamp(g, 0, 255) / 255;
  const bb = clamp(b, 0, 255) / 255;

  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rr) h = 60 * (((gg - bb) / delta) % 6);
    else if (max === gg) h = 60 * ((bb - rr) / delta + 2);
    else h = 60 * ((rr - gg) / delta + 4);
  }

  return {
    h: normalizeHue(h),
    s: max === 0 ? 0 : (delta / max) * 100,
    v: max * 100,
  };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const hue = normalizeHue(h);
  const sat = clamp(s, 0, 100) / 100;
  const val = clamp(v, 0, 100) / 100;

  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;

  const [rr, gg, bb] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];

  return {
    r: clamp255((rr + m) * 255),
    g: clamp255((gg + m) * 255),
    b: clamp255((bb + m) * 255),
  };
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rr = clamp(r, 0, 255) / 255;
  const gg = clamp(g, 0, 255) / 255;
  const bb = clamp(b, 0, 255) / 255;

  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  if (delta !== 0) {
    if (max === rr) h = 60 * (((gg - bb) / delta) % 6);
    else if (max === gg) h = 60 * ((bb - rr) / delta + 2);
    else h = 60 * ((rr - gg) / delta + 4);
  }

  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return { h: normalizeHue(h), s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hue = normalizeHue(h);
  const sat = clamp(s, 0, 100) / 100;
  const lit = clamp(l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * lit - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lit - c / 2;

  const [rr, gg, bb] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];

  return {
    r: clamp255((rr + m) * 255),
    g: clamp255((gg + m) * 255),
    b: clamp255((bb + m) * 255),
  };
}

function hexPair(value: number): string {
  return clamp255(value).toString(16).padStart(2, '0');
}

export function rgbToHex(rgb: Rgb, alpha = 1): string {
  const base = `#${hexPair(rgb.r)}${hexPair(rgb.g)}${hexPair(rgb.b)}`;
  if (alpha >= 1) return base;
  return `${base}${hexPair(clamp(alpha, 0, 1) * 255)}`;
}

function expandShorthand(hex: string): string {
  return hex
    .split('')
    .map((ch) => ch + ch)
    .join('');
}

function parseHex(value: string): ParsedColor | null {
  const body = value.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(body)) return null;

  let full: string;
  if (body.length === 3 || body.length === 4) full = expandShorthand(body);
  else if (body.length === 6 || body.length === 8) full = body;
  else return null;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const alpha = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;

  return { rgb: { r, g, b }, alpha };
}

function parseNumber(part: string): number | null {
  const trimmed = part.trim().replace(/%$/, '');
  if (trimmed === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(trimmed)) return null;
  return Number(trimmed);
}

function parseFunctional(value: string): ParsedColor | null {
  const match = value.match(/^(rgba?|hsla?)\(([^)]*)\)$/i);
  if (!match) return null;

  const name = match[1].toLowerCase();
  const parts = match[2].split(',').map((part) => part.trim());
  if (parts.length !== 3 && parts.length !== 4) return null;

  const numbers = parts.map(parseNumber);
  if (numbers.some((n) => n === null)) return null;

  const [a, b, c, d] = numbers as number[];
  const alpha = parts.length === 4 ? clamp(d, 0, 1) : 1;

  if (name === 'rgb' || name === 'rgba') {
    return { rgb: { r: clamp255(a), g: clamp255(b), b: clamp255(c) }, alpha };
  }

  return { rgb: hslToRgb({ h: a, s: b, l: c }), alpha };
}

// Accepts the same surface the API accepts, plus whitespace tolerance, so text
// typed into the picker's input can be round-tripped before it is committed.
export function parseColor(value: string): ParsedColor | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith('#')) return parseHex(trimmed);
  return parseFunctional(trimmed);
}

// `validateColor()` accepts `0`, `1`, `0.x` and `.x` only - never `0.500` or
// exponent notation, which is what `toFixed`/`toString` can produce.
export function formatAlpha(alpha: number): string {
  const rounded = Math.round(clamp(alpha, 0, 1) * 100) / 100;
  if (rounded === 0) return '0';
  if (rounded === 1) return '1';
  return String(rounded);
}

export function formatColor(rgb: Rgb, alpha: number, format: ColorFormat): string {
  const a = clamp(alpha, 0, 1);
  const opaque = Math.round(a * 100) / 100 >= 1;

  if (format === 'hex') return rgbToHex(rgb, a);

  if (format === 'rgb') {
    const body = `${clamp255(rgb.r)}, ${clamp255(rgb.g)}, ${clamp255(rgb.b)}`;
    return opaque ? `rgb(${body})` : `rgba(${body}, ${formatAlpha(a)})`;
  }

  const hsl = rgbToHsl(rgb);
  const body = `${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%`;
  return opaque ? `hsl(${body})` : `hsla(${body}, ${formatAlpha(a)})`;
}

// Sidebar dots and swatches sit on cream; a light colour needs a darker
// outline to stay visible, and picker thumbs need a readable contrast ring.
export function isLightColor(rgb: Rgb): boolean {
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 160;
}
