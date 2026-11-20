import { describe, expect, it } from 'vitest';
import { childCollectionsOf, flattenCollections } from '../collectionTree';
import type { ApiCollection } from '../../types/api';

const col = (id: string, name: string, orderValue: number, parentId: string | null = 'dev'): ApiCollection =>
  ({ id, name, color: '#c9483b', orderValue, parentId, isArchived: false, isInbox: false }) as ApiCollection;

describe('childCollectionsOf', () => {
  it('lists children in the same order as the sidebar tree, ties broken by name', () => {
    const collections = [
      col('dev', 'dev', 0, null),
      col('p', 'planner', 0),
      col('o', 'openclaw', 0),
      col('u', 'underground014', 0),
      col('a', 'ai-usage-bar', 0),
      col('old', 'archived', 0),
    ];
    collections[5].isArchived = true;
    const tree = flattenCollections(collections).filter((entry) => entry.parentId === 'dev').map((entry) => entry.name);
    expect(childCollectionsOf(collections, 'dev').map((entry) => entry.name)).toEqual(tree);
    expect(tree).toEqual(['ai-usage-bar', 'openclaw', 'planner', 'underground014']);
  });
});
