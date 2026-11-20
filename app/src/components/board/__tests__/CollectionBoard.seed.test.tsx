import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/render';
import { CollectionBoard } from '../CollectionBoard';
import { PlannerDragProvider } from '../../../contexts/PlannerDragContext';
import { apiSeedStatuses } from '../../../api/client';
import type { ApiStatus } from '../../../types/api';

vi.mock('../../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/client')>()),
  apiSeedStatuses: vi.fn().mockResolvedValue([]),
}));

const status: ApiStatus = {
  id: 's1', collectionId: 'c1', name: 'Todo', color: '#adb9c1', orderValue: 0,
  nextStatusMode: 'default', nextStatusId: null, acceptStatusId: null, rejectStatusId: null,
  createdAt: '2026-11-20T00:00:00Z', updatedAt: '2026-11-20T00:00:00Z',
};

function renderBoard(statuses: ApiStatus[]) {
  return renderWithProviders(
    <PlannerDragProvider>
      <CollectionBoard
        collectionId="c1"
        queryKey={['collection', 'c1']}
        groupBy="status"
        tasks={[]}
        statuses={statuses}
        completionStatusId={null}
        sections={[]}
        boardOrder={{}}
      />
    </PlannerDragProvider>,
  );
}

describe('CollectionBoard status seeding', () => {
  beforeEach(() => vi.mocked(apiSeedStatuses).mockClear());

  it('seeds default statuses for a collection that has none', async () => {
    renderBoard([]);
    await waitFor(() => expect(apiSeedStatuses).toHaveBeenCalledWith('c1'));
  });

  it('does not post a seed, and refetch the view, when statuses already exist', async () => {
    renderBoard([status]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(apiSeedStatuses).not.toHaveBeenCalled();
  });
});
