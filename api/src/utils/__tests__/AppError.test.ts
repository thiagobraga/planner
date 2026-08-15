import { describe, it, expect } from 'vitest';
import { AppError } from '../AppError.js';

describe('AppError', () => {
  it('sets provided properties and preserves prototype', () => {
    const err = new AppError({
      code: 'E_TEST',
      message: 'Test message',
      statusCode: 400,
      details: [{ field: 'x' }],
    });

    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('E_TEST');
    expect(err.message).toBe('Test message');
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual([{ field: 'x' }]);

    // ensure instanceof works across compiled boundaries
    expect(Object.getPrototypeOf(err)).toBe(AppError.prototype);
  });
});
