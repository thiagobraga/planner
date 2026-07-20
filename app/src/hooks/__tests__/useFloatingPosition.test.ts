import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RefObject } from 'react';
import { useFloatingPosition } from '../useFloatingPosition';

function createRef<T>(element: T): RefObject<T> {
  return { current: element } as RefObject<T>;
}

describe('useFloatingPosition', () => {
  beforeEach(() => {
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: 1024,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: 768,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns default position when isOpen is false', () => {
    const floating = document.createElement('div');
    floating.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 200, right: 300, width: 300, height: 200, x: 0, y: 0 } as DOMRect);

    const { result } = renderHook(() =>
      useFloatingPosition(null, createRef(floating), {}, false)
    );

    expect(result.current).toEqual({ top: 0, left: 0, placement: 'below' });
  });

  it('sets exact coordinates from options.position', () => {
    const floating = document.createElement('div');
    floating.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 150, right: 200, width: 200, height: 150, x: 0, y: 0 } as DOMRect);

    const { result } = renderHook(() =>
      useFloatingPosition(null, createRef(floating), { position: { x: 100, y: 200 } }, true)
    );

    expect(result.current).toEqual({ top: 200, left: 100, placement: 'below' });
  });

  it('clamps right edge overflow for coordinate-based positioning', () => {
    const floating = document.createElement('div');
    floating.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 150, right: 300, width: 300, height: 150, x: 0, y: 0 } as DOMRect);

    const { result } = renderHook(() =>
      useFloatingPosition(null, createRef(floating), { position: { x: 1000, y: 200 } }, true)
    );

    expect(result.current).toEqual({ top: 200, left: 716, placement: 'below' });
  });

  it('clamps bottom edge overflow for coordinate-based positioning', () => {
    const floating = document.createElement('div');
    floating.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 150, right: 200, width: 200, height: 150, x: 0, y: 0 } as DOMRect);

    const { result } = renderHook(() =>
      useFloatingPosition(null, createRef(floating), { position: { x: 100, y: 700 } }, true)
    );

    expect(result.current).toEqual({ top: 610, left: 100, placement: 'below' });
  });

  it('ensures minimum padding from viewport edges for coordinate-based positioning', () => {
    const floating = document.createElement('div');
    floating.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 150, right: 200, width: 200, height: 150, x: 0, y: 0 } as DOMRect);

    const { result } = renderHook(() =>
      useFloatingPosition(null, createRef(floating), { position: { x: 2, y: 3 } }, true)
    );

    expect(result.current).toEqual({ top: 8, left: 8, placement: 'below' });
  });

  it('positions below trigger with align start', () => {
    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = () =>
      ({ top: 200, left: 100, bottom: 230, right: 300, width: 200, height: 30, x: 100, y: 200 } as DOMRect);

    const floating = document.createElement('div');
    floating.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 200, right: 300, width: 300, height: 200, x: 0, y: 0 } as DOMRect);

    const { result } = renderHook(() =>
      useFloatingPosition(
        createRef(trigger),
        createRef(floating),
        { placement: 'below', align: 'start' },
        true
      )
    );

    expect(result.current).toEqual({ top: 234, left: 100, placement: 'below' });
  });

  it('flips to above when not enough space below trigger', () => {
    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = () =>
      ({ top: 700, left: 100, bottom: 730, right: 300, width: 200, height: 30, x: 100, y: 700 } as DOMRect);

    const floating = document.createElement('div');
    floating.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 200, right: 300, width: 300, height: 200, x: 0, y: 0 } as DOMRect);

    const { result } = renderHook(() =>
      useFloatingPosition(
        createRef(trigger),
        createRef(floating),
        { align: 'start' },
        true
      )
    );

    expect(result.current).toEqual({ top: 496, left: 100, placement: 'above' });
  });

  it('positions to the right of the trigger', () => {
    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = () =>
      ({ top: 200, left: 100, bottom: 230, right: 300, width: 200, height: 30, x: 100, y: 200 } as DOMRect);

    const floating = document.createElement('div');
    floating.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 150, right: 200, width: 200, height: 150, x: 0, y: 0 } as DOMRect);

    const { result } = renderHook(() =>
      useFloatingPosition(
        createRef(trigger),
        createRef(floating),
        { placement: 'right' },
        true
      )
    );

    expect(result.current).toEqual({ top: 200, left: 300, placement: 'right' });
  });

  it('flips right placement to left on overflow', () => {
    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = () =>
      ({ top: 200, left: 800, bottom: 230, right: 1000, width: 200, height: 30, x: 800, y: 200 } as DOMRect);

    const floating = document.createElement('div');
    floating.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 150, right: 200, width: 200, height: 150, x: 0, y: 0 } as DOMRect);

    const { result } = renderHook(() =>
      useFloatingPosition(
        createRef(trigger),
        createRef(floating),
        { placement: 'right' },
        true
      )
    );

    expect(result.current).toEqual({ top: 200, left: 600, placement: 'left' });
  });

  it('adds scroll and resize event listeners and removes them on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const floating = document.createElement('div');
    floating.getBoundingClientRect = () =>
      ({ top: 0, left: 0, bottom: 150, right: 200, width: 200, height: 150, x: 0, y: 0 } as DOMRect);

    const { unmount } = renderHook(() =>
      useFloatingPosition(null, createRef(floating), { position: { x: 100, y: 200 } }, true)
    );

    expect(addSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
