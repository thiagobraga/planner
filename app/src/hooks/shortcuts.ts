// Pure keyboard-shortcut matcher. Decoupled from React/DOM so it's unit-testable.
//
// Bindings:
//   - Single key: { key: 'q', action: ... }
//   - Chord (sequence within window): { keys: ['g', 'i'], action: ... }
//   - Context: 'global' (only when no text input is focused) or 'always'
//
// The handler is driven by feeding keydown events through `handleKey`. Active
// chords time out after CHORD_WINDOW_MS.

export const CHORD_WINDOW_MS = 1000;

export type ShortcutContext = 'global' | 'always';

export interface SingleBinding {
  key: string;
  context?: ShortcutContext;
  action: string;
}

export interface ChordBinding {
  keys: [string, string]; // length-2 chord (sufficient for the spec)
  context?: ShortcutContext;
  action: string;
}

export type Binding = SingleBinding | ChordBinding;

export interface KeyEvent {
  key: string;
  isTextInputFocused: boolean;
  timestamp: number;
}

export interface MatcherState {
  pendingChord: { firstKey: string; firstAt: number } | null;
}

export function createMatcherState(): MatcherState {
  return { pendingChord: null };
}

export function isChord(b: Binding): b is ChordBinding {
  return 'keys' in b;
}

export function matchKey(
  bindings: Binding[],
  state: MatcherState,
  event: KeyEvent,
): { action: string | null; nextState: MatcherState } {
  // If we have a pending chord, try to complete it with the second key.
  if (state.pendingChord) {
    const { firstKey, firstAt } = state.pendingChord;
    const elapsed = event.timestamp - firstAt;

    if (elapsed > CHORD_WINDOW_MS) {
      // Expired; fall through and start fresh.
      state = { pendingChord: null };
    } else {
      const chord = bindings.find(
        (b): b is ChordBinding => isChord(b) && b.keys[0] === firstKey && b.keys[1] === event.key,
      );
      if (chord) {
        const allowed = chord.context !== 'global' || !event.isTextInputFocused;
        return {
          action: allowed ? chord.action : null,
          nextState: { pendingChord: null },
        };
      }
      // Failed chord completion: drop the pending state and try as a single key.
      state = { pendingChord: null };
    }
  }

  // Try single-key bindings first.
  const single = bindings.find(
    (b): b is SingleBinding => !isChord(b) && b.key === event.key,
  );
  if (single) {
    const allowed = single.context !== 'global' || !event.isTextInputFocused;
    return { action: allowed ? single.action : null, nextState: state };
  }

  // Begin a new chord if this key is the prefix of any chord binding.
  const chordPrefix = bindings.find(
    (b): b is ChordBinding => isChord(b) && b.keys[0] === event.key,
  );
  if (chordPrefix) {
    const allowed = chordPrefix.context !== 'global' || !event.isTextInputFocused;
    if (allowed) {
      return {
        action: null,
        nextState: { pendingChord: { firstKey: event.key, firstAt: event.timestamp } },
      };
    }
  }

  return { action: null, nextState: state };
}

export const DEFAULT_BINDINGS: Binding[] = [
  { key: 'q', context: 'global', action: 'quickAdd:open' },
  { key: '/', context: 'global', action: 'search:focus' },
  { key: '?', context: 'global', action: 'help:open' },
  { key: 'Enter', context: 'global', action: 'task:editSelected' },
  { key: 'Delete', context: 'global', action: 'task:confirmDelete' },
  { key: 'Escape', context: 'always', action: 'dialog:close' },
  { keys: ['g', 'i'], context: 'global', action: 'navigate:inbox' },
  { keys: ['g', 't'], context: 'global', action: 'navigate:daily' },
  { keys: ['g', 'u'], context: 'global', action: 'navigate:upcoming' },
];
