import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlannerDragProvider, usePlannerDrag } from '../PlannerDragContext';

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSensor: () => null,
  useSensors: () => [],
  PointerSensor: class {},
  KeyboardSensor: class {},
}));

vi.mock('@dnd-kit/sortable', () => ({
  sortableKeyboardCoordinates: vi.fn(),
}));

vi.mock('../../components/dnd/sensors', () => ({
  PlannerPointerSensor: class {},
  PlannerKeyboardSensor: class {},
  PRESS_ACTIVATION: { delay: 180, tolerance: 8 },
}));

vi.mock('../../components/dnd/collision', () => ({
  plannerCollisionDetection: vi.fn(),
}));

vi.mock('../../utils/dragIndent', () => ({
  createIndentTracker: () => ({
    move: vi.fn(),
    enterRow: vi.fn(),
    offset: () => 0,
    reset: vi.fn(),
  }),
}));

function TestConsumer() {
  const ctx = usePlannerDrag();
  return (
    <div data-testid="drag-context">
      <span data-testid="active-drag">{JSON.stringify(ctx.activeDrag)}</span>
      <span data-testid="overlay">{JSON.stringify(ctx.overlay)}</span>
      <span data-testid="overlay-node">{ctx.overlayNode ? 'has-node' : 'null'}</span>
      <span data-testid="has-moved">{String(ctx.hasMoved)}</span>
      <span data-testid="indent-steps">{ctx.indentSteps}</span>
      <span data-testid="over-id">{ctx.overId}</span>
      <span data-testid="announce-fn">{typeof ctx.announce}</span>
      <span data-testid="register-handlers-fn">{typeof ctx.registerHandlers}</span>
      <span data-testid="set-overlay-fn">{typeof ctx.setOverlay}</span>
      <span data-testid="set-overlay-node-fn">{typeof ctx.setOverlayNode}</span>
    </div>
  );
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <PlannerDragProvider>{children}</PlannerDragProvider>;
}

describe('PlannerDragContext', () => {
  it('renders children', () => {
    render(
      <TestWrapper>
        <div data-testid="child">child content</div>
      </TestWrapper>,
    );
    expect(screen.getByTestId('child')).toHaveTextContent('child content');
  });

  it('does not crash on basic render', () => {
    expect(() =>
      render(
        <TestWrapper>
          <TestConsumer />
        </TestWrapper>,
      ),
    ).not.toThrow();
  });

  it('usePlannerDrag returns expected context shape', () => {
    render(
      <TestWrapper>
        <TestConsumer />
      </TestWrapper>,
    );

    expect(screen.getByTestId('active-drag')).toHaveTextContent('null');
    expect(screen.getByTestId('overlay')).toHaveTextContent('null');
    expect(screen.getByTestId('overlay-node')).toHaveTextContent('null');
    expect(screen.getByTestId('has-moved')).toHaveTextContent('false');
    expect(screen.getByTestId('indent-steps')).toHaveTextContent('0');
    expect(screen.getByTestId('over-id')).toBeEmptyDOMElement();
    expect(screen.getByTestId('announce-fn')).toHaveTextContent('function');
    expect(screen.getByTestId('register-handlers-fn')).toHaveTextContent('function');
    expect(screen.getByTestId('set-overlay-fn')).toHaveTextContent('function');
    expect(screen.getByTestId('set-overlay-node-fn')).toHaveTextContent('function');
  });

  it('throws when usePlannerDrag is used outside PlannerDragProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function BadConsumer() {
      usePlannerDrag();
      return null;
    }

    expect(() => render(<BadConsumer />)).toThrow(
      'usePlannerDrag must be used inside PlannerDragProvider',
    );

    consoleSpy.mockRestore();
  });

  it('setOverlay updates the overlay value', () => {
    function ControlConsumer() {
      const ctx = usePlannerDrag();
      return (
        <button
          data-testid="set-overlay-btn"
          onClick={() => ctx.setOverlay({ title: 'Test Task', descendantCount: 3 })}
        >
          Set Overlay
        </button>
      );
    }

    render(
      <TestWrapper>
        <ControlConsumer />
        <TestConsumer />
      </TestWrapper>,
    );

    expect(screen.getByTestId('overlay')).toHaveTextContent('null');

    fireEvent.click(screen.getByTestId('set-overlay-btn'));

    expect(screen.getByTestId('overlay')).toHaveTextContent('"title":"Test Task"');
    expect(screen.getByTestId('overlay')).toHaveTextContent('"descendantCount":3');
  });

  it('setOverlayNode updates the overlay node', () => {
    function ControlConsumer() {
      const ctx = usePlannerDrag();
      return (
        <button
          data-testid="set-node-btn"
          onClick={() => ctx.setOverlayNode(<span>Drag Node</span>)}
        >
          Set Node
        </button>
      );
    }

    render(
      <TestWrapper>
        <ControlConsumer />
        <TestConsumer />
      </TestWrapper>,
    );

    expect(screen.getByTestId('overlay-node')).toHaveTextContent('null');

    fireEvent.click(screen.getByTestId('set-node-btn'));

    expect(screen.getByTestId('overlay-node')).toHaveTextContent('has-node');
  });

  it('announce function updates the live region for screen readers', () => {
    function ControlConsumer() {
      const ctx = usePlannerDrag();
      return (
        <button data-testid="announce-btn" onClick={() => ctx.announce('Task moved to top')}>
          Announce
        </button>
      );
    }

    render(
      <TestWrapper>
        <ControlConsumer />
      </TestWrapper>,
    );

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveTextContent('');

    fireEvent.click(screen.getByTestId('announce-btn'));

    expect(liveRegion).toHaveTextContent('Task moved to top');
  });

  it('registerHandlers returns an unregister function', () => {
    function ControlConsumer() {
      const ctx = usePlannerDrag();
      const unregister = ctx.registerHandlers('task', {});
      return (
        <span data-testid="unregister-type">{typeof unregister}</span>
      );
    }

    render(
      <TestWrapper>
        <ControlConsumer />
      </TestWrapper>,
    );

    expect(screen.getByTestId('unregister-type')).toHaveTextContent('function');
  });
});
