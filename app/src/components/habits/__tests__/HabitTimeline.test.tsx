import { render, screen } from '@testing-library/react';
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

vi.mock('../../../contexts/PlannerDragContext', () => ({
  usePlannerDrag: () => ({
    indentSteps: 0,
    overId: null,
  }),
}));

vi.mock('../../ui/ContextMenu', () => ({
  ContextMenu: () => null,
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
          group: { id: 'morning', name: 'Morning', orderValue: 0 },
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
