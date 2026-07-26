import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VirtualDay } from '../VirtualDay';

let intersectionObservers: MockIntersectionObserver[] = [];
let resizeObservers: MockResizeObserver[] = [];

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly observe = vi.fn((target: Element) => {
    this.targets.push(target);
  });

  readonly disconnect = vi.fn();

  readonly unobserve = vi.fn();

  private readonly targets: Element[] = [];

  constructor(private readonly callback: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this);
    intersectionObservers.push(this);
  }

  trigger(isIntersecting: boolean) {
    const target = this.targets[0] ?? document.createElement('div');
    this.callback(
      [
        {
          isIntersecting,
          target,
          boundingClientRect: { top: 0 } as DOMRectReadOnly,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }
}

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  readonly observe = vi.fn((target: Element) => {
    Object.defineProperty(target, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        width: 480,
        height: 136,
        top: 0,
        left: 0,
        bottom: 136,
        right: 480,
        toJSON: () => ({}),
      }),
    });
    this.callback(
      [
        {
          contentRect: { width: 480, height: 136 } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  });

  readonly disconnect = vi.fn();

  readonly unobserve = vi.fn();

  constructor(private readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
    resizeObservers.push(this);
  }
}

beforeEach(() => {
  intersectionObservers = [];
  resizeObservers = [];

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('VirtualDay', () => {
  it('unmounts its children and keeps a measured placeholder when it leaves the viewport', async () => {
    render(
      <VirtualDay date="2026-07-26">
        <div data-testid="day-content">Daily content</div>
      </VirtualDay>,
    );

    const observer = intersectionObservers[0];
    const root = screen.getByTestId('day-content').closest('[data-day-date]') as HTMLElement;

    act(() => {
      observer.trigger(false);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('day-content')).not.toBeInTheDocument();
    });

    expect(screen.getByText('2026-07-26')).toBeInTheDocument();
    expect(root).toHaveStyle({ height: '136px' });
    expect(root).toHaveAttribute('data-virtualized', 'true');
  });

  it('keeps children mounted when keepMounted is true', async () => {
    render(
      <VirtualDay date="2026-07-26" keepMounted>
        <div data-testid="day-content">Daily content</div>
      </VirtualDay>,
    );

    const observer = intersectionObservers[0];
    const root = screen.getByTestId('day-content').closest('[data-day-date]') as HTMLElement;

    act(() => {
      observer.trigger(false);
    });

    await waitFor(() => {
      expect(screen.getByTestId('day-content')).toBeInTheDocument();
    });

    expect(screen.queryByText('2026-07-26')).not.toBeInTheDocument();
    expect(root).toHaveAttribute('data-virtualized', 'false');
  });
});
