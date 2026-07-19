import { describe, it, expect, beforeEach } from 'vitest';
import { trackMove, isEchoedMove, isStructuralMove, resetTrackedMoves } from '../moveEcho';

beforeEach(() => resetTrackedMoves());

describe('isEchoedMove', () => {
  it('claims an event naming a tracked id', () => {
    trackMove(['a']);
    expect(isEchoedMove({ entityId: 'a' })).toBe(true);
  });

  it('claims an event whose affected ids include a tracked one', () => {
    trackMove(['child']);
    expect(isEchoedMove({ entityId: 'root', payload: { affectedIds: ['root', 'child'] } })).toBe(true);
  });

  it('ignores an unrelated event', () => {
    trackMove(['a']);
    expect(isEchoedMove({ entityId: 'b' })).toBe(false);
    expect(isEchoedMove({ entityId: 'b', payload: { affectedIds: ['c'] } })).toBe(false);
  });

  it('stops claiming once the move is released', () => {
    const release = trackMove(['a']);
    release();
    expect(isEchoedMove({ entityId: 'a' })).toBe(false);
  });

  it('keeps claiming while an overlapping move is still in flight', () => {
    const releaseFirst = trackMove(['a']);
    trackMove(['a']);

    releaseFirst();
    expect(isEchoedMove({ entityId: 'a' })).toBe(true);
  });

  it('ignores a release called twice, which would untrack somebody else’s move', () => {
    const release = trackMove(['a']);
    trackMove(['a']);

    release();
    release();

    expect(isEchoedMove({ entityId: 'a' })).toBe(true);
  });

  it('treats a repeated id within one move as a single claim', () => {
    const release = trackMove(['a', 'a']);
    release();
    expect(isEchoedMove({ entityId: 'a' })).toBe(false);
  });
});

describe('isStructuralMove', () => {
  it('recognises a move payload by its affected ids', () => {
    expect(isStructuralMove({ entityId: 'a', payload: { affectedIds: ['a', 'b'] } })).toBe(true);
  });

  it('does not mistake an ordinary edit for a move', () => {
    expect(isStructuralMove({ entityId: 'a', payload: { title: 'Renamed' } })).toBe(false);
    expect(isStructuralMove({ entityId: 'a' })).toBe(false);
  });
});
