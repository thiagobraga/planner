const STORAGE_KEY = 'planner.collections.collapsed.v1';

function getStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadCollapsedCollectionIds(storage: Storage | undefined = getStorage()): Set<string> {
  if (!storage) return new Set();
  try {
    const values: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveCollapsedCollectionIds(ids: ReadonlySet<string>, storage: Storage | undefined = getStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Collapse state is local presentation state and should not block navigation.
  }
}
