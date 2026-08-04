import { AppError } from './AppError.js';

const HEX_REGEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_REGEX = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+))?\s*\)$/;
const HSL_REGEX = /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(?:,\s*(?:0|1|0?\.\d+))?\s*\)$/;

export function validateColor(color: unknown): string {
  if (
    typeof color !== 'string' ||
    !(HEX_REGEX.test(color) || RGB_REGEX.test(color) || HSL_REGEX.test(color))
  ) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      statusCode: 400,
      details: [{ field: 'color', message: 'Color must be a valid hex, rgb(a), or hsl(a) value' }],
    });
  }

  return color;
}
