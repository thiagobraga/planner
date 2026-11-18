import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  apiCreateCollection,
  apiDeleteCollection,
  apiUpdateCollection,
  PALETTE_COLORS,
} from '../api/client';
import type { ApiCollection } from '../types/api';
import type {
  CollectionCrumb,
  CollectionCrumbColorPickerState,
  CollectionCrumbMenuState,
  DeletingCollectionState,
} from '../types/collections';
import { runOptimistic, patchById, upsertById } from '../stores/optimistic';
import { getHierarchicalColor } from '../utils/collectionTree';

export function useCollectionBreadcrumbs(
  id: string,
  collections: ApiCollection[],
  fallbackCollection?: { id: string; name: string; color: string },
) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [crumbMenu, setCrumbMenu] = useState<CollectionCrumbMenuState | null>(null);
  const [crumbColorPicker, setCrumbColorPicker] = useState<CollectionCrumbColorPickerState | null>(null);
  const [renamingCrumbId, setRenamingCrumbId] = useState<string | null>(null);
  const [crumbDraft, setCrumbDraft] = useState('');
  const [subAddingParentId, setSubAddingParentId] = useState<string | null>(null);
  const [subNewName, setSubNewName] = useState('');
  const [deletingCollection, setDeletingCollection] = useState<DeletingCollectionState | null>(null);

  // A sub-collection reads as a breadcrumb of its ancestors, so its place in the
  // tree is visible from the page itself. Falls back to the view payload when the
  // sidebar store has not loaded yet.
  const trail = useMemo<CollectionCrumb[]>(() => {
    const byId = new Map(collections.map((c) => [c.id, c]));
    const out: CollectionCrumb[] = [];
    const seen = new Set<string>();

    let current = byId.get(id);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      out.unshift({ id: current.id, name: current.name, color: current.color });
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }

    if (out.length > 0) return out;
    return fallbackCollection
      ? [{ id: fallbackCollection.id, name: fallbackCollection.name, color: fallbackCollection.color }]
      : [];
  }, [collections, id, fallbackCollection]);

  const setCollectionsCache = useCallback(
    (updater: (prev: ApiCollection[]) => ApiCollection[]) => {
      qc.setQueryData<ApiCollection[]>(['collections'], (prev) => updater(prev ?? []));
    },
    [qc],
  );

  // Same flat recolor the sidebar performs: only the targeted crumb changes.
  const handleCrumbColorCommit = useCallback(
    (collectionId: string, color: string) => {
      void runOptimistic<ApiCollection, ApiCollection>({
        state: collections,
        apply: (prev) => patchById(prev, collectionId, { color }),
        call: () => apiUpdateCollection(collectionId, { color }),
        onApply: (next) => qc.setQueryData<ApiCollection[]>(['collections'], next),
        onRevert: (snapshot) => qc.setQueryData<ApiCollection[]>(['collections'], snapshot),
        onSuccess: (updated) => setCollectionsCache((prev) => upsertById(prev, updated)),
      }).catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
    },
    [collections, qc, setCollectionsCache],
  );

  const handleCrumbRename = useCallback(
    (collectionId: string) => {
      const trimmed = crumbDraft.trim();
      if (renamingCrumbId !== collectionId) return;
      setRenamingCrumbId(null);
      if (!trimmed) return;
      setCollectionsCache((prev) => patchById(prev, collectionId, { name: trimmed }));
      apiUpdateCollection(collectionId, { name: trimmed }).catch(() =>
        qc.invalidateQueries({ queryKey: ['collections'] }),
      );
    },
    [crumbDraft, qc, renamingCrumbId, setCollectionsCache],
  );

  const handleCrumbCommitSub = useCallback(() => {
    if (!subAddingParentId) return;
    const parentId = subAddingParentId;
    const trimmed = subNewName.trim();
    setSubAddingParentId(null);
    setSubNewName('');
    if (!trimmed) return;
    const color = getHierarchicalColor('temp-id', parentId, collections);
    apiCreateCollection({ name: trimmed, color: color || PALETTE_COLORS[0], parentId })
      .then((created) => setCollectionsCache((prev) => [...prev, created]))
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  }, [collections, qc, setCollectionsCache, subAddingParentId, subNewName]);

  const handleCancelSub = useCallback(() => {
    setSubAddingParentId(null);
    setSubNewName('');
  }, []);

  const handleConfirmDeleteCollection = useCallback(() => {
    if (!deletingCollection) return;
    const target = deletingCollection.id;
    setDeletingCollection(null);
    setCollectionsCache((prev) => prev.filter((c) => c.id !== target));
    apiDeleteCollection(target)
      .then(() => navigate('/daily'))
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  }, [deletingCollection, navigate, qc, setCollectionsCache]);

  return {
    trail,
    crumbMenu,
    setCrumbMenu,
    crumbColorPicker,
    setCrumbColorPicker,
    renamingCrumbId,
    setRenamingCrumbId,
    crumbDraft,
    setCrumbDraft,
    subAddingParentId,
    setSubAddingParentId,
    subNewName,
    setSubNewName,
    deletingCollection,
    setDeletingCollection,
    handleCrumbColorCommit,
    handleCrumbRename,
    handleCrumbCommitSub,
    handleCancelSub,
    handleConfirmDeleteCollection,
  };
}
