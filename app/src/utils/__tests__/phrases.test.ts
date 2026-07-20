import { describe, it, expect } from 'vitest';
import { getPhrase } from '../phrases';

describe('getPhrase', () => {
  const sections = ['daily', 'inbox', 'habits', 'upcoming', 'monthly'] as const;

  for (const section of sections) {
    it(`returns a non-empty string for '${section}'`, () => {
      const phrase = getPhrase(section);
      expect(phrase).toBeTruthy();
      expect(typeof phrase).toBe('string');
      expect(phrase.length).toBeGreaterThan(0);
    });

    it(`returns varied output for '${section}' across calls`, () => {
      const results = new Set(Array.from({ length: 50 }, () => getPhrase(section)));
      expect(results.size).toBeGreaterThan(1);
    });
  }

  it('throws for invalid section key', () => {
    expect(() => getPhrase('invalid' as never)).toThrow();
  });
});
