import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionsPage } from '../CollectionsPage';
import {
  apiAddSavedColor,
  apiCreateCollection,
  apiDeleteCollection,
  apiUpdateCollection,
  fetchCollections,
  fetchCollectionView,
  fetchPreferences,
  fetchSavedColors,
} from '../../api/client';

const mockFetchCollectionView = vi.mocked(fetchCollectionView);
const mockFetchCollections = vi.mocked(fetchCollections);
const mockFetchPreferences = vi.mocked(fetchPreferences);
const mockApiUpdateCollection = vi.mocked(apiUpdateCollection);
const mockApiCreateCollection = vi.mocked(apiCreateCollection);
const mockApiDeleteCollection = vi.mocked(apiDeleteCollection);
const mockFetchSavedColors = vi.mocked(fetchSavedColors);
const mockApiAddSavedColor = vi.mocked(apiAddSavedColor);

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchCollectionView: vi.fn(),
  fetchCollections: vi.fn(),
  fetchPreferences: vi.fn(),
  apiUpdateCollection: vi.fn(),
  apiCreateCollection: vi.fn(),
  apiDeleteCollection: vi.fn(),
  fetchSavedColors: vi.fn(),
  apiAddSavedColor: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }));
vi.mock('../../hooks/useTaskDrag', () => ({ useTaskDrag: vi.fn(() => ({ activeDragId: null })) }));
vi.mock('../../hooks/useSectionDrag', () => ({ useSectionDrag: vi.fn() }));
vi.mock('../../components/TaskList', () => ({ TaskList: () => <div data-testid="task-list" /> }));

const parentCollection = {
  id: 'parent-id',
  userId: 'user-1',
  parentId: null,
  name: 'Parent',
  color: '#7dbfb2',
  isInbox: false,
  isArchived: false,
  orderValue: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const childCollection = {
  id: 'test-collection-id',
  userId: 'user-1',
  parentId: 'parent-id',
  name: 'Test Collection',
  color: '#d56b64',
  isInbox: false,
  isArchived: false,
  orderValue: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const collectionViewData = {
  collection: { id: 'test-collection-id', name: 'Test Collection', color: '#d56b64', isInbox: false },
  tasks: [],
  collectionId: 'test-collection-id',
  sections: [],
  statuses: [],
  completionStatusId: null,
  boardOrder: {},
};

const defaultPreferences = {
  userId: 'user-1',
  locale: 'en' as const,
  timeZone: 'UTC',
  weekStart: 'monday' as const,
  theme: 'light' as const,
  notificationsEnabled: false,
  font: 'lora' as const,
  showDots: true,
  background: 'beige' as const,
  smallCaps: false,
  hideCompletedTasks: false,
  showNotes: true,
};

function renderPage(initialPath = '/collection/test-collection-id') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/collection/:id" element={<CollectionsPage />} />
          <Route path="/daily" element={<div>Daily Destination</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchCollectionView.mockResolvedValue(collectionViewData as never);
  mockFetchCollections.mockResolvedValue([parentCollection, childCollection]);
  mockFetchPreferences.mockResolvedValue(defaultPreferences);
  mockFetchSavedColors.mockResolvedValue([]);
  mockApiAddSavedColor.mockResolvedValue([]);
});

describe('CollectionsPage breadcrumb context menu', () => {
  async function openCrumbMenu(name: string) {
    renderPage();
    const crumb = (await screen.findByText(name)).closest('.collections-page-crumb')!;
    fireEvent.contextMenu(crumb, { clientX: 120, clientY: 30 });
    return screen.getByRole('menu');
  }

  it('offers the same collection actions as the sidebar', async () => {
    const menu = await openCrumbMenu('Test Collection');
    const labels = within(menu).getAllByRole('menuitem').map((item) => item.textContent);
    expect(labels).toEqual(['Change color…', 'Rename', 'Add sub-collection', 'Delete']);
  });

  it('targets the crumb that was right-clicked, not the current collection', async () => {
    const menu = await openCrumbMenu('Parent');
    fireEvent.click(within(menu).getByText('Change color…'));

    const picker = await screen.findByRole('dialog', { name: 'Change color' });
    expect(within(picker).getByLabelText('Color value')).toHaveValue('#7dbfb2');
  });

  it('recolors the crumb collection without touching its children', async () => {
    mockApiUpdateCollection.mockResolvedValue({ ...parentCollection, color: '#b7bf4e' });

    const menu = await openCrumbMenu('Parent');
    fireEvent.click(within(menu).getByText('Change color…'));

    const picker = await screen.findByRole('dialog', { name: 'Change color' });
    const input = within(picker).getByLabelText('Color value');
    fireEvent.change(input, { target: { value: '#b7bf4e' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(mockApiUpdateCollection).toHaveBeenCalledWith('parent-id', { color: '#b7bf4e' }));
    expect(mockApiUpdateCollection).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        screen.getByText('Test Collection').closest('.collections-page-crumb')?.querySelector('.collections-page-crumb-dot > span'),
      ).toHaveStyle({ background: '#d56b64' }),
    );
  });

  it('renames the crumb collection inline', async () => {
    mockApiUpdateCollection.mockResolvedValue({ ...childCollection, name: 'Renamed' });

    const menu = await openCrumbMenu('Test Collection');
    fireEvent.click(within(menu).getByText('Rename'));

    const input = await screen.findByLabelText('Rename');
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(mockApiUpdateCollection).toHaveBeenCalledWith('test-collection-id', { name: 'Renamed' }));
  });

  it('creates a sub-collection under the targeted crumb', async () => {
    mockApiCreateCollection.mockResolvedValue({
      ...childCollection,
      id: 'sub-id',
      name: 'Child Sub',
      parentId: 'test-collection-id',
    });

    const menu = await openCrumbMenu('Test Collection');
    fireEvent.click(within(menu).getByText('Add sub-collection'));

    const input = await screen.findByRole('textbox', { name: 'Collection name…' });
    fireEvent.change(input, { target: { value: 'Child Sub' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(mockApiCreateCollection).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Child Sub', parentId: 'test-collection-id' }),
      ),
    );
  });

  it('deletes the targeted collection after confirmation and navigates to daily when standalone', async () => {
    mockApiDeleteCollection.mockResolvedValue(undefined);

    const menu = await openCrumbMenu('Test Collection');
    fireEvent.click(within(menu).getByText('Delete'));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockApiDeleteCollection).toHaveBeenCalledWith('test-collection-id'));
    expect(await screen.findByText('Daily Destination')).toBeInTheDocument();
  });
});
