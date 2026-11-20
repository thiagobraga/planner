import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionsDetailRoute, CollectionsLanding, CollectionsLayout } from '../CollectionsLayout';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
import { useCollectionsViewStore } from '../../stores/collectionsViewStore';
import {
  apiAddSavedColor,
  apiUpdateCollection,
  fetchCollections,
  fetchCollectionView,
  fetchPreferences,
  fetchSavedColors,
} from '../../api/client';
import type { ApiCollection, Preferences } from '../../types/api';

vi.mock('../../hooks/useSync', () => ({ useSync: vi.fn() }));
vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchCollections: vi.fn(),
  fetchCollectionView: vi.fn(),
  fetchPreferences: vi.fn(),
  fetchSavedColors: vi.fn(),
  apiAddSavedColor: vi.fn(),
  apiUpdateCollection: vi.fn(),
  apiCreateCollection: vi.fn(),
}));

const WORK_ID = '11111111-1111-4111-8111-111111111111';
const DESIGN_ID = '22222222-2222-4222-8222-222222222222';
const HOME_ID = '33333333-3333-4333-8333-333333333333';

const collections: ApiCollection[] = [
  {
    id: WORK_ID, userId: 'u1', parentId: null, name: 'Work', color: '#65788a',
    isInbox: false, isArchived: false, orderValue: 0,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: DESIGN_ID, userId: 'u1', parentId: WORK_ID, name: 'Design', color: '#b08b8a',
    isInbox: false, isArchived: false, orderValue: 0,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: HOME_ID, userId: 'u1', parentId: null, name: 'Home', color: '#8a9a65',
    isInbox: false, isArchived: false, orderValue: 1,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  },
];

const preferences: Preferences = {
  userId: 'u1', locale: 'en', timeZone: 'UTC', weekStart: 'sunday', theme: 'light',
  notificationsEnabled: false, font: 'lora', showDots: true, background: 'beige',
  smallCaps: false, hideCompletedTasks: false, showNotes: true,
};

function renderApp(initialPath = `/collection/${WORK_ID}`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlannerDragProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route element={<CollectionsLayout />}>
              <Route path="/collections" element={<CollectionsLanding />} />
              <Route path="/collection/:id" element={<CollectionsDetailRoute />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </PlannerDragProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useCollectionsViewStore.getState().reset();
  vi.mocked(fetchCollections).mockResolvedValue(collections);
  vi.mocked(fetchPreferences).mockResolvedValue(preferences);
  vi.mocked(fetchSavedColors).mockResolvedValue([]);
  vi.mocked(apiAddSavedColor).mockResolvedValue([]);
  vi.mocked(apiUpdateCollection).mockImplementation(async (id, patch) => ({
    ...collections.find((c) => c.id === id)!,
    ...patch,
  }));
  vi.mocked(fetchCollectionView).mockImplementation(async (id) => {
    const col = collections.find((c) => c.id === id)!;
    return {
      collection: col,
      tasks: [],
      sections: [],
      statuses: [],
      completionStatusId: null,
      boardOrder: {},
    };
  });
});

describe('collections interactions', () => {
  it('opens the color picker when clicking a collection circle in the tree', async () => {
    renderApp('/collections');
    const workRow = (await screen.findByText('Work')).closest('.collections-index-row')!;
    const dotButton = within(workRow).getByRole('button', { name: 'Change color…' });

    fireEvent.click(dotButton);

    const picker = await screen.findByRole('dialog', { name: 'Change color' });
    expect(within(picker).getByLabelText('Color value')).toHaveValue('#65788a');
  });

  it('limits vertical and horizontal splits to two panes, replacing the second pane on subsequent splits', async () => {
    renderApp(`/collection/${WORK_ID}`);
    const detail = screen.getByRole('region', { name: 'Collection details' });
    await within(detail).findByRole('heading', { name: 'Work' });

    const treeRows = screen.getByRole('region', { name: 'Collection tree' }).querySelectorAll('.collections-index-row');
    const designRow = treeRows[1];
    const homeRow = treeRows[2];

    fireEvent.contextMenu(homeRow, { clientX: 120, clientY: 120 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Split vertically' }));

    expect(detail).toHaveAttribute('data-split', 'vertical');
    expect(detail.querySelectorAll('.collections-split-pane')).toHaveLength(2);
    expect(await within(detail).findByRole('heading', { name: 'Home' })).toBeVisible();
    expect(within(detail).getByRole('heading', { name: 'Work' })).toBeVisible();

    fireEvent.contextMenu(designRow, { clientX: 120, clientY: 120 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Split vertically' }));

    expect(detail).toHaveAttribute('data-split', 'vertical');
    expect(detail.querySelectorAll('.collections-split-pane')).toHaveLength(2);
    expect(await within(detail).findByRole('heading', { name: /Design/ })).toBeVisible();
    expect(within(detail).queryByRole('heading', { name: 'Home' })).not.toBeInTheDocument();
    expect(within(detail).getByRole('heading', { name: 'Work' })).toBeVisible();

    fireEvent.contextMenu(homeRow, { clientX: 120, clientY: 120 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Split horizontally' }));

    expect(detail).toHaveAttribute('data-split', 'horizontal');
    expect(detail.querySelectorAll('.collections-split-pane')).toHaveLength(2);
    expect(await within(detail).findByRole('heading', { name: 'Home' })).toBeVisible();
    expect(within(detail).queryByRole('heading', { name: /Design/ })).not.toBeInTheDocument();

    const closeButtons = within(detail).getAllByRole('button', { name: 'Close pane' });
    expect(closeButtons).toHaveLength(2);
    fireEvent.click(closeButtons[1]);

    await waitFor(() => expect(detail).not.toHaveAttribute('data-split'));
    expect(within(detail).getByRole('heading', { name: 'Work' })).toBeVisible();
    expect(within(detail).queryByRole('heading', { name: 'Home' })).not.toBeInTheDocument();
  });

  it('promotes the second pane when closing the primary split pane', async () => {
    renderApp(`/collection/${WORK_ID}`);
    const detail = screen.getByRole('region', { name: 'Collection details' });
    await within(detail).findByRole('heading', { name: 'Work' });

    const homeRow = screen.getByRole('region', { name: 'Collection tree' }).querySelectorAll('.collections-index-row')[2];
    fireEvent.contextMenu(homeRow, { clientX: 120, clientY: 120 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Split vertically' }));

    expect(await within(detail).findByRole('heading', { name: 'Home' })).toBeVisible();
    const closeButtons = within(detail).getAllByRole('button', { name: 'Close pane' });
    fireEvent.click(closeButtons[0]);

    await waitFor(() => expect(detail).not.toHaveAttribute('data-split'));
    expect(await within(detail).findByRole('heading', { name: 'Home' })).toBeVisible();
    expect(within(detail).queryByRole('heading', { name: 'Work' })).not.toBeInTheDocument();
  });

  it('opens a children and add-sub-collection menu when clicking the collection name on the detail page', async () => {
    renderApp(`/collection/${WORK_ID}`);
    const detail = screen.getByRole('region', { name: 'Collection details' });
    const heading = await within(detail).findByRole('heading', { name: 'Work' });

    fireEvent.click(within(heading).getByRole('button', { name: 'Work' }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Design' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Add sub-collection' })).toBeInTheDocument();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Design' }));
    expect(await within(detail).findByRole('heading', { name: /Design/ })).toBeVisible();
  });

  it('uses consistent 24px inline inputs for adding root and child collections', async () => {
    renderApp('/collections');
    await screen.findByText('Work');

    fireEvent.click(screen.getByRole('button', { name: 'Add collection' }));
    const rootInput = screen.getByPlaceholderText('Collection name…');
    expect(rootInput).toHaveClass('collections-inline-input');
    expect(rootInput.parentElement).toHaveClass('h-6');

    const workRow = screen.getByText('Work').closest('.collections-index-row')!;
    fireEvent.contextMenu(workRow, { clientX: 100, clientY: 100 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add sub-collection' }));

    const subInput = screen.getByPlaceholderText('Collection name…');
    expect(subInput).toHaveClass('collections-inline-input');
    expect(subInput.parentElement).toHaveClass('h-6');
  });

  it('shows an empty details pane on the landing route', async () => {
    renderApp('/collections');
    await screen.findByText('Work');
    expect(screen.queryByText('Select a collection')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New collection' })).not.toBeInTheDocument();
  });

  it('remembers the selected collection until the page reloads', async () => {
    const first = renderApp(`/collection/${WORK_ID}`);
    await within(screen.getByRole('region', { name: 'Collection details' })).findByRole('heading', { name: 'Work' });
    first.unmount();

    renderApp('/collections');
    const detail = screen.getByRole('region', { name: 'Collection details' });
    expect(await within(detail).findByRole('heading', { name: 'Work' })).toBeVisible();
  });

  it('remembers the split view with its selected collection', async () => {
    const first = renderApp(`/collection/${WORK_ID}`);
    const detail = screen.getByRole('region', { name: 'Collection details' });
    await within(detail).findByRole('heading', { name: 'Work' });
    const homeRow = screen.getByRole('region', { name: 'Collection tree' }).querySelectorAll('.collections-index-row')[2];
    fireEvent.contextMenu(homeRow, { clientX: 120, clientY: 120 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Split horizontally' }));
    await within(detail).findByRole('heading', { name: 'Home' });
    first.unmount();

    renderApp('/collections');
    const restored = screen.getByRole('region', { name: 'Collection details' });
    await waitFor(() => expect(restored).toHaveAttribute('data-split', 'horizontal'));
    expect(await within(restored).findByRole('heading', { name: 'Home' })).toBeVisible();
    expect(within(restored).getByRole('heading', { name: 'Work' })).toBeVisible();
  });

  it('forgets a remembered collection once it is deleted', async () => {
    useCollectionsViewStore.getState().remember(WORK_ID);
    useCollectionsViewStore.getState().forget(WORK_ID);
    renderApp('/collections');
    await screen.findByText('Work');
    expect(screen.getByRole('region', { name: 'Collection details' }).querySelector('h1,h2')).toBeNull();
  });
});
