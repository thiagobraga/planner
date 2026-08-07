import { act, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CollectionTreeNav } from '../CollectionTreeNav';
import {
  fetchCollections,
  apiUpdateCollection,
  apiUpdatePreferences,
  fetchSavedColors,
  apiAddSavedColor,
  fetchPreferences,
  type ApiCollection,
  type Preferences,
} from '../../api/client';
import { useLocation } from 'react-router';

vi.mock('react-router', () => ({
  useNavigate: vi.fn(() => vi.fn()),
  useLocation: vi.fn(() => ({ pathname: '/' })),
}));

vi.mock('../../api/client', () => ({
  fetchCollections: vi.fn(),
  apiCreateCollection: vi.fn(),
  apiUpdateCollection: vi.fn(),
  apiDeleteCollection: vi.fn(),
  fetchPreferences: vi.fn(),
  apiUpdatePreferences: vi.fn(),
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

const basePreferences: Preferences = {
  userId: 'u1',
  locale: 'en',
  timeZone: 'UTC',
  weekStart: 'sunday',
  theme: 'system',
  notificationsEnabled: true,
  font: 'lora',
  showDots: true,
  background: 'beige',
  smallCaps: false,
  hideCompletedTasks: false,
  hideOldNotes: false,
  collapsedCollectionIds: [],
};

function collection(
  id: string,
  name: string,
  parentId: string | null,
  orderValue: number,
): ApiCollection {
  return {
    id,
    userId: 'u1',
    name,
    color: '#65788a',
    parentId,
    isInbox: false,
    isArchived: false,
    orderValue,
    createdAt: '',
    updatedAt: '',
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>),
    queryClient: qc,
  };
}

describe('CollectionTreeNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCollections).mockResolvedValue([]);
    vi.mocked(fetchSavedColors).mockResolvedValue([]);
    vi.mocked(apiAddSavedColor).mockResolvedValue([]);
    vi.mocked(fetchPreferences).mockResolvedValue(basePreferences);
    vi.mocked(apiUpdatePreferences).mockImplementation(async (patch) => ({ ...basePreferences, ...patch }));
    vi.mocked(useLocation).mockReturnValue({ pathname: '/' } as ReturnType<typeof useLocation>);
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

  it('shows chevrons only for parents and hides descendants recursively', async () => {
    vi.mocked(fetchCollections).mockResolvedValue([
      collection('root', 'Work', null, 0),
      collection('child', 'Planning', 'root', 1),
      collection('grandchild', 'Launch', 'child', 2),
      collection('leaf', 'Personal', null, 3),
    ]);

    renderWithQuery(<CollectionTreeNav />);

    const rootToggle = await screen.findByRole('button', { name: 'Collapse Work' });
    expect(rootToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Personal' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /(?:Collapse|Expand) Personal/ })).not.toBeInTheDocument();

    fireEvent.click(rootToggle);

    await waitFor(() => expect(screen.queryByText('Planning')).not.toBeInTheDocument());
    expect(screen.queryByText('Launch')).not.toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Work' })).toHaveAttribute('aria-expanded', 'false');
    expect(apiUpdatePreferences).toHaveBeenCalledWith({ collapsedCollectionIds: ['root'] });
  });

  it('folds nested and independent branches separately', async () => {
    vi.mocked(fetchCollections).mockResolvedValue([
      collection('work', 'Work', null, 0),
      collection('planning', 'Planning', 'work', 1),
      collection('launch', 'Launch', 'planning', 2),
      collection('personal', 'Personal', null, 3),
      collection('travel', 'Travel', 'personal', 4),
    ]);

    renderWithQuery(<CollectionTreeNav />);

    fireEvent.click(await screen.findByRole('button', { name: 'Collapse Planning' }));
    await waitFor(() => expect(screen.queryByText('Launch')).not.toBeInTheDocument());
    expect(screen.getByText('Travel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Personal' }));
    await waitFor(() => expect(screen.queryByText('Travel')).not.toBeInTheDocument());
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Planning')).toBeInTheDocument();
  });

  it('reveals the active descendant path without changing the saved preference', async () => {
    vi.mocked(fetchCollections).mockResolvedValue([
      collection('root', 'Work', null, 0),
      collection('child', 'Planning', 'root', 1),
      collection('grandchild', 'Launch', 'child', 2),
    ]);
    vi.mocked(fetchPreferences).mockResolvedValue({
      ...basePreferences,
      collapsedCollectionIds: ['root', 'child'],
    });
    vi.mocked(useLocation).mockReturnValue({ pathname: '/collection/grandchild' } as ReturnType<typeof useLocation>);

    renderWithQuery(<CollectionTreeNav />);

    expect(await screen.findByText('Launch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse Work' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Collapse Planning' })).toHaveAttribute('aria-expanded', 'true');
    expect(apiUpdatePreferences).not.toHaveBeenCalled();
  });

  it('rolls back the optimistic fold state when persistence fails', async () => {
    vi.mocked(fetchCollections).mockResolvedValue([
      collection('root', 'Work', null, 0),
      collection('child', 'Planning', 'root', 1),
    ]);
    vi.mocked(apiUpdatePreferences).mockRejectedValueOnce(new Error('offline'));

    renderWithQuery(<CollectionTreeNav />);
    fireEvent.click(await screen.findByRole('button', { name: 'Collapse Work' }));

    await waitFor(() => expect(screen.getByText('Planning')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Collapse Work' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('responds immediately to synchronized preference cache updates', async () => {
    vi.mocked(fetchCollections).mockResolvedValue([
      collection('root', 'Work', null, 0),
      collection('child', 'Planning', 'root', 1),
    ]);

    const { queryClient } = renderWithQuery(<CollectionTreeNav />);
    expect(await screen.findByText('Planning')).toBeInTheDocument();

    act(() => {
      queryClient.setQueryData<Preferences>(['preferences'], {
        ...basePreferences,
        collapsedCollectionIds: ['root'],
      });
    });

    await waitFor(() => expect(screen.queryByText('Planning')).not.toBeInTheDocument());
  });

  it('removes inline row actions while retaining context-menu actions', async () => {
    vi.mocked(fetchCollections).mockResolvedValue([collection('work', 'Work', null, 0)]);
    renderWithQuery(<CollectionTreeNav />);

    const row = (await screen.findByText('Work')).closest('.collection-row')!;
    expect(within(row).queryByRole('button', { name: /Add sub-collection/ })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /Delete Work/ })).not.toBeInTheDocument();

    fireEvent.contextMenu(row, { clientX: 30, clientY: 60 });
    expect(screen.getByRole('menuitem', { name: 'Add sub-collection' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
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
