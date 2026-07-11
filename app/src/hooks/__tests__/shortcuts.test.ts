import { describe, it, expect } from 'vitest';
import { matchKey, createMatcherState, DEFAULT_BINDINGS, CHORD_WINDOW_MS } from '../shortcuts.js';

function ev(key: string, opts: { isTextInputFocused?: boolean; timestamp?: number } = {}) {
  return {
    key,
    isTextInputFocused: opts.isTextInputFocused ?? false,
    timestamp: opts.timestamp ?? 0,
  };
}

describe('shortcuts matcher', () => {
  it('q opens quick-add when no text input focused', () => {
    const { action } = matchKey(DEFAULT_BINDINGS, createMatcherState(), ev('q'));
    expect(action).toBe('quickAdd:open');
  });

  it('q is suppressed while a text input is focused', () => {
    const { action } = matchKey(DEFAULT_BINDINGS, createMatcherState(), ev('q', { isTextInputFocused: true }));
    expect(action).toBeNull();
  });

  it('/ focuses search', () => {
    const { action } = matchKey(DEFAULT_BINDINGS, createMatcherState(), ev('/'));
    expect(action).toBe('search:focus');
  });

  it('? opens help', () => {
    const { action } = matchKey(DEFAULT_BINDINGS, createMatcherState(), ev('?'));
    expect(action).toBe('help:open');
  });

  it('Enter and Delete fire when no text input focused (context=global)', () => {
    expect(matchKey(DEFAULT_BINDINGS, createMatcherState(), ev('Enter')).action).toBe('task:editSelected');
    expect(matchKey(DEFAULT_BINDINGS, createMatcherState(), ev('Delete')).action).toBe('task:confirmDelete');
  });

  it('Enter and Delete are suppressed while text input is focused', () => {
    expect(matchKey(DEFAULT_BINDINGS, createMatcherState(), ev('Enter', { isTextInputFocused: true })).action).toBeNull();
    expect(matchKey(DEFAULT_BINDINGS, createMatcherState(), ev('Delete', { isTextInputFocused: true })).action).toBeNull();
  });

  it('Escape closes dialogs', () => {
    expect(matchKey(DEFAULT_BINDINGS, createMatcherState(), ev('Escape')).action).toBe('dialog:close');
  });

  it('g+i navigates to inbox within chord window', () => {
    const s0 = createMatcherState();
    const { action: a1, nextState: s1 } = matchKey(DEFAULT_BINDINGS, s0, ev('g', { timestamp: 0 }));
    expect(a1).toBeNull();
    const { action: a2 } = matchKey(DEFAULT_BINDINGS, s1, ev('i', { timestamp: 500 }));
    expect(a2).toBe('navigate:inbox');
  });

  it('g+t navigates to daily', () => {
    const s0 = createMatcherState();
    const { nextState: s1 } = matchKey(DEFAULT_BINDINGS, s0, ev('g', { timestamp: 0 }));
    const { action } = matchKey(DEFAULT_BINDINGS, s1, ev('t', { timestamp: 100 }));
    expect(action).toBe('navigate:daily');
  });

  it('g+u navigates to upcoming', () => {
    const s0 = createMatcherState();
    const { nextState: s1 } = matchKey(DEFAULT_BINDINGS, s0, ev('g', { timestamp: 0 }));
    const { action } = matchKey(DEFAULT_BINDINGS, s1, ev('u', { timestamp: 999 }));
    expect(action).toBe('navigate:upcoming');
  });

  it('chord expires after CHORD_WINDOW_MS', () => {
    const s0 = createMatcherState();
    const { nextState: s1 } = matchKey(DEFAULT_BINDINGS, s0, ev('g', { timestamp: 0 }));
    const { action } = matchKey(DEFAULT_BINDINGS, s1, ev('i', { timestamp: CHORD_WINDOW_MS + 1 }));
    expect(action).toBeNull();
  });

  it('chord does not start while text input is focused', () => {
    const s0 = createMatcherState();
    const { nextState: s1 } = matchKey(DEFAULT_BINDINGS, s0, ev('g', { isTextInputFocused: true, timestamp: 0 }));
    expect(s1.pendingChord).toBeNull();
  });

  it('failed chord completion (g then x) drops pending state', () => {
    const s0 = createMatcherState();
    const { nextState: s1 } = matchKey(DEFAULT_BINDINGS, s0, ev('g', { timestamp: 0 }));
    const { action, nextState: s2 } = matchKey(DEFAULT_BINDINGS, s1, ev('x', { timestamp: 100 }));
    expect(action).toBeNull();
    expect(s2.pendingChord).toBeNull();
  });
});
