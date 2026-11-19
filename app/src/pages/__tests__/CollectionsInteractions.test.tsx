import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionsDetailRoute, CollectionsLanding, CollectionsLayout } from '../CollectionsLayout';
import { PlannerDragProvider } from '../../contexts/PlannerDragContext';
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
  apiDeleteCollection: vi.fn(),
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
  localStorage.clear();
  vi.mocked(fetchCollections).mockResolvedValue(collections);
  vi.mocked(fetchPreferences).mockResolvedValue(preferences);
  vi.mocked(fetchSavedColors).mockResolvedValue([]);
  vi.mocked(apiAddSavedColor).mockResolvedValue([]);
  vi.mocked(apiDeleteCollection).mockResolvedValue(undefined);
  vi.mocked(apiCreateCollection).mockImplementation(async (input) => ({
    id: '44444444-4444-4444-8444-444444444444',
    userId: 'u1',
    parentId: input.parentId ?? null,
    name: input.name,
    color: input.color ?? '#65788a',
    isInbox: false,
    isArchived: false,
    orderValue: 2,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }));
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
  it('opens only one color picker at a time from tree dots and commits a new color', async () => {
    renderApp('/collections');
    const tree = screen.getByRole('region', { name: 'Collection tree' });
    const workRow = (await within(tree).findByRole('link', { name: 'Work' })).closest('.collections-index-row')!;
    const homeRow = within(tree).getByRole('link', { name: 'Home' }).closest('.collections-index-row')!;

    fireEvent.click(within(workRow).getByRole('button', { name: 'Change color for Work' }));
    const picker = await screen.findByRole('dialog', { name: 'Change color' });
    expect(within(picker).getByLabelText('Color value')).toHaveValue('#65788a');

    // Clicking another row dot swaps the picker rather than stacking two dialogs.
    fireEvent.click(within(homeRow).getByRole('button', { name: 'Change color for Home' }));
    expect(screen.getAllByRole('dialog', { name: 'Change color' })).toHaveLength(1);
    const input = within(screen.getByRole('dialog', { name: 'Change color' })).getByLabelText('Color value');
    expect(input).toHaveValue('#8a9a65');

    fireEvent.change(input, { target: { value: '#c9483b' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(apiUpdateCollection).toHaveBeenCalledWith(HOME_ID, { color: '#c9483b' }));
  });

  it('opens the color picker from the accessible breadcrumb dot button', async () => {
    renderApp(`/collection/${WORK_ID}`);
    const detail = screen.getByRole('region', { name: 'Collection details' });
    await within(detail).findByRole('heading', { name: 'Work' });

    fireEvent.click(within(detail).getByRole('button', { name: 'Change color for Work' }));
    const picker = await screen.findByRole('dialog', { name: 'Change color' });
    expect(within(picker).getByLabelText('Color value')).toHaveValue('#65788a');
  });

  it('splits vertically and horizontally without duplicating panes, and promotes the next pane when closing primary', async () => {
    renderApp(`/collection/${WORK_ID}`);
    const tree = screen.getByRole('region', { name: 'Collection tree' });
    const detail = screen.getByRole('region', { name: 'Collection details' });
    await within(detail).findByRole('heading', { name: 'Work' });

    const homeRow = within(tree).getByRole('link', { name: 'Home' }).closest('.collections-index-row')!;
    fireEvent.contextMenu(homeRow, { clientX: 120, clientY: 120 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Split vertically' }));

    expect(detail).toHaveAttribute('data-split', 'vertical');
    expect(await within(detail).findByRole('heading', { name: 'Home' })).toBeVisible();
    expect(within(detail).getByRole('heading', { name: 'Work' })).toBeVisible();
    expect(within(detail).getAllByRole('button', { name: 'Close pane' })).toHaveLength(2);

    // Splitting the same collection horizontally changes direction without duplicating the pane.
    fireEvent.contextMenu(homeRow, { clientX: 120, clientY: 120 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Split horizontally' }));
    expect(detail).toHaveAttribute('data-split', 'horizontal');
    expect(within(detail).getAllByRole('button', { name: 'Close pane' })).toHaveLength(2);

    // Closing the primary pane promotes Home and exits split mode.
    fireEvent.click(within(detail).getAllByRole('button', { name: 'Close pane' })[0]);
    await waitFor(() => expect(detail).not.toHaveAttribute('data-split'));
    expect(await within(detail).findByRole('heading', { name: 'Home' })).toBeVisible();
  });

  it('prunes a secondary split pane immediately when deleted from the tree', async () => {
    renderApp(`/collection/${WORK_ID}`);
    const tree = screen.getByRole('region', { name: 'Collection tree' });
    const detail = screen.getByRole('region', { name: 'Collection details' });
    await within(detail).findByRole('heading', { name: 'Work' });

    const homeRow = within(tree).getByRole('link', { name: 'Home' }).closest('.collections-index-row')!;
    fireEvent.contextMenu(homeRow, { clientX: 120, clientY: 120 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Split vertically' }));
    expect(await within(detail).findByRole('heading', { name: 'Home' })).toBeVisible();

    fireEvent.contextMenu(homeRow, { clientX: 120, clientY: 120 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const confirmDialog = await screen.findByRole('dialog');
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(apiDeleteCollection).toHaveBeenCalledWith(HOME_ID));
    await waitFor(() => expect(detail).not.toHaveAttribute('data-split'));
    expect(within(detail).getByRole('heading', { name: 'Work' })).toBeVisible();
  });

  it('opens and toggles the children menu from the collection title and adds a sub-collection', async () => {
    renderApp(`/collection/${WORK_ID}`);
    const detail = screen.getByRole('region', { name: 'Collection details' });
    const heading = await within(detail).findByRole('heading', { name: 'Work' });
    const trigger = within(heading).getByRole('button', { name: 'Work' });

    fireEvent.click(trigger);
    const menu = screen.getByRole('menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(within(menu).getByRole('menuitem', { name: 'Design' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Add sub-collection' })).toBeInTheDocument();

    // Clicking the title trigger again toggles the menu closed.
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // Opening again and choosing Add sub-collection submits once on Enter+Blur.
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Add sub-collection' }));
    const subInput = within(detail).getByRole('textbox', { name: 'Collection name…' });
    fireEvent.change(subInput, { target: { value: 'Research' } });
    fireEvent.keyDown(subInput, { key: 'Enter' });
    fireEvent.blur(subInput);

    await waitFor(() => expect(apiCreateCollection).toHaveBeenCalledTimes(1));
    expect(apiCreateCollection).toHaveBeenCalledWith(expect.objectContaining({ name: 'Research', parentId: WORK_ID }));

    // Navigating via the children menu updates the active collection.
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Design' }));
    expect(await within(detail).findByRole('heading', { name: /Design/ })).toBeVisible();
  });

  it('uses accessible 24px inline inputs for adding root and child collections', async () => {
    renderApp('/collections');
    await screen.findByText('Work');

    fireEvent.click(screen.getByRole('button', { name: 'Add collection' }));
    const rootInput = screen.getByRole('textbox', { name: 'Collection name…' });
    expect(rootInput).toHaveClass('collections-inline-input');
    expect(rootInput.parentElement).toHaveClass('h-6');
    fireEvent.keyDown(rootInput, { key: 'Escape' });

    const workRow = screen.getByRole('link', { name: 'Work' }).closest('.collections-index-row')!;
    fireEvent.contextMenu(workRow, { clientX: 100, clientY: 100 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add sub-collection' }));

    const subInput = screen.getByRole('textbox', { name: 'Collection name…' });
    expect(subInput).toHaveClass('collections-inline-input');
    expect(subInput.parentElement).toHaveClass('h-6');
  });
});
