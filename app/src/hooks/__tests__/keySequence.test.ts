import { describe, it, expect } from 'vitest';
import { matchSequence, createSequenceState, SEQUENCE_KEY_WINDOW_MS } from '../keySequence.js';
import type { SequenceState } from '../../types/keySequence.js';

function feed(keys: string[], opts: { isTextInputFocused?: boolean; gap?: number } = {}) {
  let state: SequenceState = createSequenceState();
  let matched = false;
  keys.forEach((key, i) => {
    const result = matchSequence('wasd', state, {
      key,
      isTextInputFocused: opts.isTextInputFocused ?? false,
      timestamp: i * (opts.gap ?? 100),
    });
    state = result.nextState;
    matched = result.matched;
  });
  return { matched, state };
}

describe('key sequence matcher', () => {
  it('matches w a s d typed in order', () => {
    expect(feed(['w', 'a', 's', 'd']).matched).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(feed(['W', 'A', 'S', 'D']).matched).toBe(true);
  });

  it('does not match a partial sequence', () => {
    expect(feed(['w', 'a', 's']).matched).toBe(false);
  });

  it('resets on a wrong key', () => {
    expect(feed(['w', 'a', 'x', 's', 'd']).matched).toBe(false);
  });

  it('restarts when the wrong key is the first key', () => {
    expect(feed(['w', 'w', 'a', 's', 'd']).matched).toBe(true);
  });

  it('times out when keys are too far apart', () => {
    expect(feed(['w', 'a', 's', 'd'], { gap: SEQUENCE_KEY_WINDOW_MS + 1 }).matched).toBe(false);
  });

  it('is ignored while a text input is focused', () => {
    expect(feed(['w', 'a', 's', 'd'], { isTextInputFocused: true }).matched).toBe(false);
  });

  it('ignores modifier key presses mid-sequence', () => {
    expect(feed(['w', 'Shift', 'a', 's', 'd']).matched).toBe(true);
  });

  it('clears the buffer after a match so it can fire again', () => {
    const { state } = feed(['w', 'a', 's', 'd']);
    expect(state.progress).toBe(0);
  });
});
