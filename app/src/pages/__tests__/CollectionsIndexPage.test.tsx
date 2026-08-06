import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollectionsIndexPage } from '../CollectionsIndexPage';
import {
  fetchCollections,
  apiCreateCollection,
  apiDeleteCollection,
  apiUpdateCollection,
  fetchSavedColors,
  apiAddSavedColor,
} from '../../api/client';

const mockFetchCollections = vi.mocked(fetchCollections);
const mockApiCreateCollection = vi.mocked(apiCreateCollection);
const mockApiDeleteCollection = vi.mocked(apiDeleteCollection);
const mockApiUpdateCollection = vi.mocked(apiUpdateCollection);
const mockFetchSavedColors = vi.mocked(fetchSavedColors);
const mockApiAddSavedColor = vi.mocked(apiAddSavedColor);

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchCollections: vi.fn(),
  apiCreateCollection: vi.fn(),
  apiDeleteCollection: vi.fn(),
  apiUpdateCollection: vi.fn(),
  fetchSavedColors: vi.fn(),
  apiAddSavedColor: vi.fn(),
}));

vi.mock('../../stores/collectionStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../stores/collectionStore')>();
  return {
    ...actual,
    buildCollectionTree: actual.buildCollectionTree,
  };
});

const sampleCollections = [
  {
    id: 'col-1',
    userId: 'u1',
    parentId: null,
    name: 'Work',
    color: '#65788a',
    isInbox: false,
    isArchived: false,
    orderValue: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'col-2',
    userId: 'u1',
    parentId: null,
    name: 'Personal',
    color: '#c98079',
    isInbox: false,
    isArchived: false,
    orderValue: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'col-3',
    userId: 'u1',
    parentId: 'col-1',
    name: 'Design',
    color: '#b08b8a',
    isInbox: false,
    isArchived: false,
    orderValue: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'inbox-1',
    userId: 'u1',
    parentId: null,
    name: 'Inbox',
    color: '#bababa',
    isInbox: true,
    isArchived: false,
    orderValue: -1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

function renderPage(initialPath = '/collections') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/collections" element={<CollectionsIndexPage />} />
          <Route path="/collection/:id" element={<div>CollectionDetail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockFetchCollections.mockReset();
  mockApiCreateCollection.mockReset();
  mockApiDeleteCollection.mockReset();
  mockApiUpdateCollection.mockReset();
  mockFetchSavedColors.mockReset();
  mockApiAddSavedColor.mockReset();

  mockFetchCollections.mockResolvedValue(sampleCollections);
  mockFetchSavedColors.mockResolvedValue([]);
  mockApiAddSavedColor.mockResolvedValue([]);
});

describe('CollectionsIndexPage', () => {
  it('renders the page title', async () => {
    renderPage();

    const title = await screen.findByText('Collections');
    expect(title).toBeInTheDocument();
    expect(title.tagName.toLowerCase()).toBe('h1');
  });

  it('renders the subtitle', async () => {
    renderPage();

    expect(await screen.findByText('Your projects at a glance')).toBeInTheDocument();
  });

  it('renders parent and child collections in the hierarchy', async () => {
    renderPage();

    expect(await screen.findByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Design')).toBeInTheDocument();
  });

  it('does not render inbox collections', async () => {
    renderPage();

    await screen.findByText('Work');
    expect(screen.queryByText('Inbox')).not.toBeInTheDocument();
  });

  it('shows empty state when no collections exist', async () => {
    mockFetchCollections.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('No collections yet')).toBeInTheDocument();
  });

  it('renders the add collection button', async () => {
    renderPage();

    const addButton = await screen.findByRole('button', { name: 'Add collection' });
    expect(addButton).toBeInTheDocument();
  });

  it('shows inline input when add button is clicked', async () => {
    renderPage();

    const addButton = await screen.findByRole('button', { name: 'Add collection' });
    fireEvent.click(addButton);

    expect(screen.getByPlaceholderText('Collection name…')).toBeInTheDocument();
  });

  it('navigates to collection detail on row click', async () => {
    renderPage();

    const workLink = await screen.findByText('Work');
    fireEvent.click(workLink.closest('.collections-index-row')!);

    expect(await screen.findByText('CollectionDetail')).toBeInTheDocument();
  });

  it('does not render chevron icons on collection rows', async () => {
    renderPage();

    await screen.findByText('Work');
    const chevrons = document.querySelectorAll('.collections-index-row svg.lucide-chevron-right');
    expect(chevrons.length).toBe(0);
  });

  it('keeps collection rows on the 24px grid step', async () => {
    renderPage();

    await screen.findByText('Work');
    const row = document.querySelector('.collections-index-row');
    expect(row).toHaveClass('h-6');
  });

  it('creates a collection when Enter is pressed in the add input', async () => {
    mockApiCreateCollection.mockResolvedValue({
      id: 'new-1',
      userId: 'u1',
      parentId: null,
      name: 'New Collection',
      color: '#65788a',
      isInbox: false,
      isArchived: false,
      orderValue: 10,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    renderPage();

    const addButton = await screen.findByRole('button', { name: 'Add collection' });
    fireEvent.click(addButton);

    const input = screen.getByPlaceholderText('Collection name…');
    fireEvent.change(input, { target: { value: 'New Collection' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockApiCreateCollection).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Collection' }),
      );
    });
  });

  describe('row context menu', () => {
    async function openRowMenu(name: string) {
      renderPage();
      const row = (await screen.findByText(name)).closest('.collections-index-row')!;
      fireEvent.contextMenu(row, { clientX: 200, clientY: 80 });
      return screen.getByRole('menu');
    }

    it('lists "Change color…" as the first action', async () => {
      const menu = await openRowMenu('Work');
      const labels = within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent);

      expect(labels).toEqual(['Change color…', 'Rename', 'Add sub-collection', 'Delete']);
    });

    it('opens the picker seeded with the row colour and recolors only that row', async () => {
      mockApiUpdateCollection.mockResolvedValue({ ...sampleCollections[0], color: '#b7bf4e' });

      const menu = await openRowMenu('Work');
      fireEvent.click(within(menu).getByText('Change color…'));

      const picker = await screen.findByRole('dialog', { name: 'Change color' });
      const input = within(picker).getByLabelText('Color value');
      expect(input).toHaveValue('#65788a');

      fireEvent.change(input, { target: { value: '#b7bf4e' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() =>
        expect(mockApiUpdateCollection).toHaveBeenCalledWith('col-1', { color: '#b7bf4e' }),
      );
      expect(mockApiUpdateCollection).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(mockApiAddSavedColor).toHaveBeenCalledWith('#b7bf4e'));
    });
  });
});
