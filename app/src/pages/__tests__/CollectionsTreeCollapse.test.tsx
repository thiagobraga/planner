import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionsLanding, CollectionsLayout } from '../CollectionsLayout';
import { fetchCollections } from '../../api/client';
import type { ApiCollection } from '../../types/api';

vi.mock('../../hooks/useSync', () => ({ useSync: vi.fn() }));
vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  fetchCollections: vi.fn(),
}));

const STORAGE_KEY = 'planner.collections.collapsed.v1';

function collection(id: string, name: string, parentId: string | null): ApiCollection {
  return {
    id, userId: 'u1', parentId, name, color: '#65788a', isInbox: false, isArchived: false,
    orderValue: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  } as ApiCollection;
}

const tree = [
  collection('work', 'Work', null),
  collection('design', 'Design', 'work'),
  collection('icons', 'Icons', 'design'),
  collection('home', 'Home', null),
];

function renderTree() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/collections']}>
        <Routes>
          <Route element={<CollectionsLayout />}>
            <Route path="/collections" element={<CollectionsLanding />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const toggle = (verb: 'Collapse' | 'Expand', name: string) => screen.getByRole('button', { name: `${verb} ${name}` });

beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetchCollections).mockReset().mockResolvedValue(tree);
});

describe('collections tree collapse', () => {
  it('shows a toggle only on collections with children, wired to its children group', async () => {
    renderTree();
    await screen.findByText('Icons');

    const work = toggle('Collapse', 'Work');
    expect(work).toHaveAttribute('aria-expanded', 'true');
    const group = document.getElementById(work.getAttribute('aria-controls')!);
    expect(group).toContainElement(screen.getByText('Design'));
    expect(toggle('Collapse', 'Design')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('button', { name: /(Collapse|Expand) (Icons|Home)/ })).toBeNull();
  });

  it('collapses and expands a parent and a nested child', async () => {
    renderTree();
    await screen.findByText('Icons');

    fireEvent.click(toggle('Collapse', 'Design'));
    expect(screen.queryByText('Icons')).not.toBeVisible();
    expect(screen.getByText('Design')).toBeVisible();
    expect(toggle('Expand', 'Design')).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle('Collapse', 'Work'));
    expect(screen.queryByText('Design')).not.toBeVisible();
    expect(screen.getByText('Home')).toBeVisible();

    fireEvent.click(toggle('Expand', 'Work'));
    expect(screen.getByText('Design')).toBeVisible();
    expect(screen.queryByText('Icons')).not.toBeVisible();

    fireEvent.click(toggle('Expand', 'Design'));
    expect(screen.getByText('Icons')).toBeVisible();
  });

  it('persists collapsed collections across reloads', async () => {
    const { unmount } = renderTree();
    await screen.findByText('Icons');
    fireEvent.click(toggle('Collapse', 'Design'));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(['design']);
    unmount();

    renderTree();
    await screen.findByText('Design');
    expect(toggle('Expand', 'Design')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Icons')).not.toBeVisible();
  });
});
