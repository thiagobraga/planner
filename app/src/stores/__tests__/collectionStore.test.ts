import { describe, it, expect, beforeEach } from 'vitest';
import { useCollectionStore, buildCollectionTree } from '../collectionStore';
import type { ApiCollection } from '../../api/client';

function makeCollection(overrides: Partial<ApiCollection> & { id: string }): ApiCollection {
  return {
    userId: 'user-1',
    parentId: null,
    name: 'Test',
    color: 'blue',
    isInbox: false,
    isArchived: false,
    orderValue: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('useCollectionStore', () => {
  beforeEach(() => {
    useCollectionStore.setState({ collections: [] });
  });

  it('setCollections replaces state', () => {
    const collections = [makeCollection({ id: '1' }), makeCollection({ id: '2' })];
    useCollectionStore.getState().setCollections(collections);
    expect(useCollectionStore.getState().collections).toEqual(collections);
  });

  it('addCollection appends to array', () => {
    const c1 = makeCollection({ id: '1' });
    const c2 = makeCollection({ id: '2' });
    useCollectionStore.getState().addCollection(c1);
    useCollectionStore.getState().addCollection(c2);
    expect(useCollectionStore.getState().collections).toEqual([c1, c2]);
  });

  it('updateCollection patches by id', () => {
    const c1 = makeCollection({ id: '1', name: 'Original' });
    useCollectionStore.getState().addCollection(c1);
    useCollectionStore.getState().updateCollection('1', { name: 'Updated' });
    expect(useCollectionStore.getState().collections[0].name).toBe('Updated');
  });

  it('removeCollection removes by id', () => {
    const c1 = makeCollection({ id: '1' });
    const c2 = makeCollection({ id: '2' });
    useCollectionStore.getState().setCollections([c1, c2]);
    useCollectionStore.getState().removeCollection('1');
    expect(useCollectionStore.getState().collections).toEqual([c2]);
  });
});

describe('buildCollectionTree', () => {
  it('returns nested tree sorted by orderValue then name', () => {
    const collections: ApiCollection[] = [
      makeCollection({ id: '1', name: 'Alpha', orderValue: 1 }),
      makeCollection({ id: '2', name: 'Beta', orderValue: 2, parentId: '1' }),
      makeCollection({ id: '3', name: 'Gamma', orderValue: 3, parentId: '1' }),
    ];
    const tree = buildCollectionTree(collections);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('1');
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].id).toBe('2');
    expect(tree[0].children[1].id).toBe('3');
  });

  it('sorts children by orderValue then name', () => {
    const collections: ApiCollection[] = [
      makeCollection({ id: '1', orderValue: 1 }),
      makeCollection({ id: 'a', name: 'A', orderValue: 1, parentId: '1' }),
      makeCollection({ id: 'b', name: 'B', orderValue: 0, parentId: '1' }),
    ];
    const tree = buildCollectionTree(collections);
    expect(tree[0].children[0].id).toBe('b');
    expect(tree[0].children[1].id).toBe('a');
  });

  it('filters out archived collections', () => {
    const collections: ApiCollection[] = [
      makeCollection({ id: '1', name: 'Active' }),
      makeCollection({ id: '2', name: 'Archived', isArchived: true }),
    ];
    const tree = buildCollectionTree(collections);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('1');
  });

  it('filters out inbox collection', () => {
    const collections: ApiCollection[] = [
      makeCollection({ id: '1', name: 'Normal' }),
      makeCollection({ id: '2', name: 'Inbox', isInbox: true }),
    ];
    const tree = buildCollectionTree(collections);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('1');
  });

  it('returns empty array when only archived and inbox exist', () => {
    const collections: ApiCollection[] = [
      makeCollection({ id: '1', isInbox: true }),
      makeCollection({ id: '2', isArchived: true }),
    ];
    expect(buildCollectionTree(collections)).toEqual([]);
  });

  it('returns multiple roots sorted', () => {
    const collections: ApiCollection[] = [
      makeCollection({ id: 'b', name: 'B', orderValue: 2 }),
      makeCollection({ id: 'a', name: 'A', orderValue: 1 }),
    ];
    const tree = buildCollectionTree(collections);
    expect(tree).toHaveLength(2);
    expect(tree[0].id).toBe('a');
    expect(tree[1].id).toBe('b');
  });

  it('resolves color hex from palette name', () => {
    const collections: ApiCollection[] = [
      makeCollection({ id: '1', color: 'berry_red' }),
    ];
    const tree = buildCollectionTree(collections);
    expect(tree[0].color).toBe('#b8255f');
    expect(tree[0].colorName).toBe('berry_red');
  });

  it('handles empty collections list', () => {
    expect(buildCollectionTree([])).toEqual([]);
  });
});
