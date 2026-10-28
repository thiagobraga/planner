// Pure matcher for multi-key sequences like the `wasd` easter egg. Kept apart
// from shortcuts.ts because chords there are fixed two-key bindings that call
// preventDefault; a sequence must let every key through to the page.

import type { SequenceKeyEvent, SequenceState } from '../types/keySequence';

export const SEQUENCE_KEY_WINDOW_MS = 1000;

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

export function createSequenceState(): SequenceState {
  return { progress: 0, lastAt: 0 };
}

export function matchSequence(
  sequence: string,
  state: SequenceState,
  event: SequenceKeyEvent,
): { matched: boolean; nextState: SequenceState } {
  if (event.isTextInputFocused) return { matched: false, nextState: createSequenceState() };
  if (MODIFIER_KEYS.has(event.key)) return { matched: false, nextState: state };

  const key = event.key.toLowerCase();
  const expired = state.progress > 0 && event.timestamp - state.lastAt > SEQUENCE_KEY_WINDOW_MS;
  let progress = expired ? 0 : state.progress;

  if (key !== sequence[progress]) {
    // A wrong key can still be the start of a fresh attempt (`wwasd`).
    progress = key === sequence[0] ? 0 : -1;
  }
  progress += 1;

  if (progress === sequence.length) return { matched: true, nextState: createSequenceState() };
  return { matched: false, nextState: { progress, lastAt: event.timestamp } };
}
