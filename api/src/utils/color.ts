import { AppError } from './AppError.js';

function isHexDigit(code: number): boolean {
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102);
}

function isDigits(value: string, maxLength: number): boolean {
  if (value.length === 0 || value.length > maxLength) {
    return false;
  }

  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 48 || code > 57) {
      return false;
    }
  }

  return true;
}

function isAlpha(value: string): boolean {
  if (value === '0' || value === '1') {
    return true;
  }

  if (value.length < 2) {
    return false;
  }

  if (value[0] === '.') {
    return isDigits(value.slice(1), value.length - 1);
  }

  if (value.startsWith('0.')) {
    return isDigits(value.slice(2), value.length - 2);
  }

  return false;
}

function isHexColor(value: string): boolean {
  if (value[0] !== '#') {
    return false;
  }

  const length = value.length - 1;
  if (length !== 3 && length !== 4 && length !== 6 && length !== 8) {
    return false;
  }

  for (let i = 1; i < value.length; i += 1) {
    if (!isHexDigit(value.charCodeAt(i))) {
      return false;
    }
  }

  return true;
}

function isRgbComponent(value: string): boolean {
  return isDigits(value, 3);
}

function isHueComponent(value: string): boolean {
  return isDigits(value, 3);
}

function isHslComponent(value: string): boolean {
  return value.endsWith('%') && isDigits(value.slice(0, -1), 3);
}

function isFunctionalColor(
  value: string,
  name: 'rgb' | 'rgba' | 'hsl' | 'hsla',
): boolean {
  if (!value.startsWith(`${name}(`) || !value.endsWith(')')) {
    return false;
  }

  const parts = value.slice(name.length + 1, -1).split(',').map((part) => part.trim());
  const requiredParts = 3;
  const allowsAlpha = name === 'rgba' || name === 'hsla';

  if (parts.length !== requiredParts && !(allowsAlpha && parts.length === requiredParts + 1)) {
    return false;
  }

  if (parts.slice(0, 3).some((part) => part.length === 0)) {
    return false;
  }

  if (name === 'rgb' || name === 'rgba') {
    if (!parts.slice(0, 3).every((part) => isRgbComponent(part))) {
      return false;
    }
  } else {
    if (!isHueComponent(parts[0]) || !parts.slice(1, 3).every((part) => isHslComponent(part))) {
      return false;
    }
  }

  if (parts.length === 4 && !isAlpha(parts[3])) {
    return false;
  }

  return true;
}

function isValidColor(value: string): boolean {
  return (
    isHexColor(value) ||
    isFunctionalColor(value, 'rgb') ||
    isFunctionalColor(value, 'rgba') ||
    isFunctionalColor(value, 'hsl') ||
    isFunctionalColor(value, 'hsla')
  );
}

export function validateColor(color: unknown): string {
  if (typeof color !== 'string' || !isValidColor(color)) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      statusCode: 400,
      details: [{ field: 'color', message: 'Color must be a valid hex, rgb(a), or hsl(a) value' }],
    });
  }

  return color;
}
