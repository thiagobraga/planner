import { describe, expect, it } from 'vitest';
import { randomHabitGroupIcon } from '../habitGroupIcon';

describe('randomHabitGroupIcon', () => {
  it('selects from the temporary icon pool', () => {
    expect(randomHabitGroupIcon(() => 0)).toBe('☀️');
    expect(randomHabitGroupIcon(() => 0.999)).toBe('🎯');
  });
});
