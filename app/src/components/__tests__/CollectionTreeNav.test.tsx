import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CollectionTreeNav } from '../CollectionTreeNav';
import {
  fetchCollections,
  apiUpdateCollection,
  fetchSavedColors,
  apiAddSavedColor,
} from '../../api/client';

vi.mock('react-router', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  useLocation: vi.fn(() => ({ pathname: '/' })),
}));

vi.mock('../../api/client', () => ({
  fetchCollections: vi.fn(),
  apiCreateCollection: vi.fn(),
  apiUpdateCollection: vi.fn(),
  apiDeleteCollection: vi.fn(),
  fetchSavedColors: vi.fn(),
  apiAddSavedColor: vi.fn(),
  PALETTE_COLORS: ['#65788a'],
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
    vi.mocked(fetchSavedColors).mockResolvedValue([]);
    vi.mocked(apiAddSavedColor).mockResolvedValue([]);
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
        color: '#65788a',
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
        color: '#7dbfb2',
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

  describe('row context menu', () => {
    const workCollection = {
      id: 'c1',
      userId: 'u1',
      name: 'Work',
      color: '#65788a',
      parentId: null,
      isInbox: false,
      isArchived: false,
      orderValue: 0,
      createdAt: '',
      updatedAt: '',
    };

    async function openRowMenu() {
      vi.mocked(fetchCollections).mockResolvedValue([workCollection]);
      renderWithQuery(<CollectionTreeNav />);
      const row = (await screen.findByText('Work')).closest('.collection-row')!;
      fireEvent.contextMenu(row, { clientX: 30, clientY: 60 });
      return screen.getByRole('menu');
    }

    it('lists "Change color…" as the first item', async () => {
      const menu = await openRowMenu();
      const labels = within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent);

      expect(labels).toEqual(['Change color…', 'Rename', 'Add sub-collection', 'Delete']);
    });

    it('opens the color picker seeded with the row color', async () => {
      const menu = await openRowMenu();
      fireEvent.click(within(menu).getByText('Change color…'));

      const picker = await screen.findByRole('dialog', { name: 'Change color' });
      expect(within(picker).getByLabelText('Color value')).toHaveValue('#65788a');
    });

    it('applying a color patches only that collection', async () => {
      vi.mocked(apiUpdateCollection).mockResolvedValue({ ...workCollection, color: '#d56b64' });

      const menu = await openRowMenu();
      fireEvent.click(within(menu).getByText('Change color…'));

      const picker = await screen.findByRole('dialog', { name: 'Change color' });
      const input = within(picker).getByLabelText('Color value');
      fireEvent.change(input, { target: { value: '#d56b64' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() =>
        expect(apiUpdateCollection).toHaveBeenCalledWith('c1', { color: '#d56b64' }),
      );
      expect(apiUpdateCollection).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(apiAddSavedColor).toHaveBeenCalledWith('#d56b64'));
    });
  });
});
