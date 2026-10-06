import { describe, it, expect } from 'vitest';
import { safeNextPath } from '../safeNext';

describe('safeNextPath', () => {
  it('keeps same-origin paths with their query', () => {
    expect(safeNextPath('/oauth/consent?request=abc')).toBe('/oauth/consent?request=abc');
  });

  it.each([null, undefined, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)'])(
    'rejects %s',
    (value) => {
      expect(safeNextPath(value)).toBeNull();
    },
  );
});
