import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CollectionTreeNav } from '../CollectionTreeNav';
import { fetchCollections } from '../../api/client';

vi.mock('react-router', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  useLocation: vi.fn(() => ({ pathname: '/' })),
}));

vi.mock('../../api/client', () => ({
  fetchCollections: vi.fn(),
  apiCreateCollection: vi.fn(),
  apiUpdateCollection: vi.fn(),
  apiDeleteCollection: vi.fn(),
  PALETTE_COLORS: [{ name: 'blue', hex: '#4073ff' }],
  paletteColorHex: vi.fn((name: string | undefined) =>
    name ? '#4073ff' : 'var(--color-ink-light)',
  ),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: vi.fn(({ children }: { children: React.ReactNode }) => <>{children}</>),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: 'transform 0ms',
    isDragging: false,
  })),
  arrayMove: vi.fn((arr: unknown[], from: number, to: number) => {
    const result = [...arr];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  }),
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Translate: {
      toString: vi.fn(() => ''),
    },
  },
}));

vi.mock('../../contexts/PlannerDragContext', () => ({
  usePlannerDrag: vi.fn(() => ({ activeDrag: null, overId: null })),
  usePlannerDragHandlers: vi.fn(),
}));

vi.mock('../ConfirmModal', () => ({
  ConfirmModal: vi.fn(() => null),
}));

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('CollectionTreeNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCollections).mockResolvedValue([]);
  });

  it('renders Collections header', () => {
    renderWithQuery(<CollectionTreeNav />);
    expect(screen.getByText('Collections')).toBeInTheDocument();
  });

  it('renders add (+) button', () => {
    renderWithQuery(<CollectionTreeNav />);
    expect(screen.getByLabelText('Add collection')).toBeInTheDocument();
  });

  it('renders collection items from data', async () => {
    vi.mocked(fetchCollections).mockResolvedValue([
      {
        id: 'c1',
        userId: 'u1',
        name: 'Work',
        color: 'blue',
        parentId: null,
        isInbox: false,
        isArchived: false,
        orderValue: 0,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'c2',
        userId: 'u1',
        name: 'Personal',
        color: 'green',
        parentId: null,
        isInbox: false,
        isArchived: false,
        orderValue: 1,
        createdAt: '',
        updatedAt: '',
      },
    ]);
    renderWithQuery(<CollectionTreeNav />);
    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('calls fetchCollections on mount', async () => {
    renderWithQuery(<CollectionTreeNav />);
    await waitFor(() => {
      expect(fetchCollections).toHaveBeenCalled();
    });
  });
});
