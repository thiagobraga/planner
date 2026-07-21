import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { HabitTimeline } from '../HabitTimeline';
import type { HabitSections } from '../../../utils/habitTree';

vi.mock('@dnd-kit/core', () => ({
  PointerSensor: class {},
  KeyboardSensor: class {},
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  }),
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@dnd-kit/utilities', () => ({}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock('../../../api/client', () => ({
  fetchHabits: vi.fn().mockResolvedValue([]),
  fetchHabitGroups: vi.fn().mockResolvedValue([]),
  fetchPreferences: vi.fn().mockResolvedValue({
    userId: 'test',
    timeZone: 'UTC',
    weekStart: 'sunday',
    theme: 'light',
    notificationsEnabled: false,
    font: 'lora',
    showDots: true,
    background: 'beige',
    smallCaps: false,
    hideCompletedTasks: false,
    hideOldNotes: false,
  }),
}));

vi.mock('../../../hooks/useSync', () => ({
  useSync: () => vi.fn(),
}));

/** The node the timeline hands to the drag overlay, captured as it publishes. */
let overlayNode: React.ReactNode = null;

vi.mock('../../../contexts/PlannerDragContext', () => ({
  usePlannerDrag: () => ({
    indentSteps: 0,
    overId: null,
    setOverlayNode: (node: React.ReactNode) => {
      overlayNode = node;
    },
  }),
}));

vi.mock('../../ui/ContextMenu', () => ({
  ContextMenu: ({ items }: { items: { type: string; label?: string; onClick?: () => void }[] }) => (
    <div data-testid="context-menu">
      {items
        .filter((item) => item.type === 'item')
        .map((item) => (
          <button key={item.label} type="button" onClick={item.onClick}>
            {item.label}
          </button>
        ))}
    </div>
  ),
}));

vi.mock('../../monthly/MonthSelector', () => ({
  MonthSelector: React.forwardRef(() => null),
}));

vi.mock('../../ui/StripNavigator', () => ({
  StripNavigator: () => null,
}));

vi.mock('../HabitNameInput', () => ({
  HabitNameInput: () => null,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const defaultProps = {
  sections: { ungrouped: [], groups: [] } as HabitSections,
  today: new Date(2026, 6, 18),
  year: 2026,
  month: 6,
  onMonthChange: vi.fn(),
  onToggleDay: vi.fn(),
  onStartEdit: vi.fn(),
  onCommitEdit: vi.fn(),
  onCancelEdit: vi.fn(),
  onAddHabit: vi.fn(),
  onAddGroup: vi.fn(),
  onToggleGroupIcon: vi.fn(),
  onDelete: vi.fn(),
  onToggleCollapse: vi.fn(),
  collapsed: new Set<string>(),
};

describe('HabitTimeline', () => {
  it('renders without crashing with empty data', () => {
    render(<HabitTimeline {...defaultProps} />, { wrapper: createWrapper() });
  });

  it('renders the new group button when there are no groups', () => {
    render(<HabitTimeline {...defaultProps} />, { wrapper: createWrapper() });
    expect(screen.getByText('New group')).toBeInTheDocument();
  });

  it('renders a group icon in one grid cell before the group name', () => {
    const sections: HabitSections = {
      ungrouped: [],
      groups: [
        {
          group: { id: 'morning', name: 'Morning routine', icon: '☀️', orderValue: 0 },
          habits: [],
        },
      ],
    };

    render(<HabitTimeline {...defaultProps} sections={sections} />, { wrapper: createWrapper() });

    const icon = screen.getByText('☀️');
    expect(icon).toHaveClass('h-6', 'w-6', 'justify-center');
    expect(icon.nextElementSibling).toHaveTextContent('Morning routine');
  });

  it('offers Remove icon immediately after Rename for a group with an icon', () => {
    const onToggleGroupIcon = vi.fn();
    const sections: HabitSections = {
      ungrouped: [],
      groups: [
        {
          group: { id: 'morning', name: 'Morning routine', icon: '☀️', orderValue: 0 },
          habits: [],
        },
      ],
    };

    render(
      <HabitTimeline
        {...defaultProps}
        sections={sections}
        onToggleGroupIcon={onToggleGroupIcon}
      />,
      { wrapper: createWrapper() },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Options for Morning routine' }));
    expect(
      Array.from(screen.getByTestId('context-menu').querySelectorAll('button')).map(
        (button) => button.textContent,
      ),
    ).toEqual(['Rename', 'Remove icon', 'Delete group']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove icon' }));
    expect(onToggleGroupIcon).toHaveBeenCalledWith('morning');
  });

  it('offers Add icon for a group without an icon', () => {
    const sections: HabitSections = {
      ungrouped: [],
      groups: [
        {
          group: { id: 'morning', name: 'Morning routine', icon: null, orderValue: 0 },
          habits: [],
        },
      ],
    };

    render(<HabitTimeline {...defaultProps} sections={sections} />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole('button', { name: 'Options for Morning routine' }));
    expect(screen.getByRole('button', { name: 'Add icon' })).toBeInTheDocument();
  });

  it('lifts a dragged habit as a whole row, carrying its sub-habits', () => {
    const child: HabitSections['ungrouped'][number] = {
      id: 'child',
      name: 'Drink 1L',
      parentId: 'water',
      groupId: null,
      orderValue: 0,
      completions: new Set(['2026-07-17']),
      children: [],
    };
    const sections: HabitSections = {
      ungrouped: [
        {
          id: 'water',
          name: 'Drink water',
          parentId: null,
          groupId: null,
          orderValue: 0,
          completions: new Set(['2026-07-17']),
          children: [child],
        },
      ],
      groups: [],
    };

    render(
      <HabitTimeline {...defaultProps} sections={sections} activeDragId="water" />,
      { wrapper: createWrapper() },
    );

    // The overlay is published as a node rather than a title, so the thing under
    // the pointer is the row itself - name, marks and the sub-habit it carries.
    const { container } = render(<>{overlayNode}</>, { wrapper: createWrapper() });
    expect(container.querySelector('.habit-timeline-block-preview')).toBeInTheDocument();
    expect(screen.getAllByText('Drink water').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('Drink 1L');
    expect(container.querySelectorAll('.habit-timeline-day-cell').length).toBeGreaterThan(0);
  });

  it('exposes a drag handle on habit rows and group headers', () => {
    const water: HabitSections['ungrouped'][number] = {
      id: 'water',
      name: 'Drink water',
      parentId: null,
      groupId: null,
      orderValue: 0,
      completions: new Set(),
      children: [],
    };
    const sections: HabitSections = {
      ungrouped: [water],
      groups: [
        {
          group: { id: 'morning', name: 'Morning', icon: null, orderValue: 0 },
          habits: [],
        },
      ],
    };

    const { container } = render(
      <HabitTimeline {...defaultProps} sections={sections} />,
      { wrapper: createWrapper() },
    );

    // The keyboard sensor only picks up from inside a [data-drag-handle], so
    // without these the rows are draggable by pointer only.
    expect(container.querySelectorAll('[data-drag-handle]').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText('Reorder Drink water')).toBeInTheDocument();
    expect(screen.getByLabelText('Reorder Morning')).toBeInTheDocument();
  });
});
