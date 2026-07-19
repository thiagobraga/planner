const STORAGE_KEY = 'planner.habits.collapsed.v1';

function getStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function toStringSet(values: unknown): Set<string> {
  if (!Array.isArray(values)) return new Set();
  return new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0));
}

/** Loads the persisted habit collapse state from localStorage. */
export function loadCollapsedHabitIds(storage: Storage | undefined = getStorage()): Set<string> {
  if (!storage) return new Set();

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return toStringSet(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

/** Persists the current habit collapse state to localStorage. */
export function saveCollapsedHabitIds(
  collapsed: ReadonlySet<string>,
  storage: Storage | undefined = getStorage(),
): void {
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]));
  } catch {
    // Ignore storage quota / availability failures. Collapse state is a view
    // preference, so the page should still function if persistence is blocked.
  }
}

/**
 * Removes ids that no longer exist in the current habit tree so deleted habits
 * do not accumulate in storage forever.
 */
export function pruneCollapsedHabitIds(
  collapsed: ReadonlySet<string>,
  validIds: ReadonlySet<string>,
): Set<string> {
  const next = new Set<string>();
  for (const id of collapsed) {
    if (validIds.has(id)) next.add(id);
  }
  return next;
}
