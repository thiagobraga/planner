import { useCallback, useMemo, useRef, useState } from 'react';
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
import { childCollectionsOf, getHierarchicalColor } from '../utils/collectionTree';

export function useCollectionBreadcrumbs(
  id: string,
  collections: ApiCollection[],
  fallbackCollection?: { id: string; name: string; color: string },
  options?: {
    onNavigateCollection?: (targetId: string) => void;
    onCollectionDeleted?: (targetId: string) => void;
  },
) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [crumbMenu, setCrumbMenuState] = useState<CollectionCrumbMenuState | null>(null);
  const [childrenMenu, setChildrenMenuState] = useState<{ position: { x: number; y: number } } | null>(null);
  const [crumbColorPicker, setCrumbColorPickerState] = useState<CollectionCrumbColorPickerState | null>(null);
  const [renamingCrumbId, setRenamingCrumbIdState] = useState<string | null>(null);
  const [crumbDraft, setCrumbDraft] = useState('');
  const [subAddingParentId, setSubAddingParentIdState] = useState<string | null>(null);
  const [subNewName, setSubNewName] = useState('');
  const [deletingCollection, setDeletingCollection] = useState<DeletingCollectionState | null>(null);
  const renameSettledRef = useRef(false);
  const subSettledRef = useRef(false);

  const setCrumbMenu = useCallback((next: CollectionCrumbMenuState | null) => {
    setCrumbMenuState(next);
    if (next) {
      setChildrenMenuState(null);
      setCrumbColorPickerState(null);
    }
  }, []);

  const setChildrenMenu = useCallback((next: { position: { x: number; y: number } } | null) => {
    setChildrenMenuState(next);
    if (next) {
      setCrumbMenuState(null);
      setCrumbColorPickerState(null);
    }
  }, []);

  const toggleChildrenMenu = useCallback((position: { x: number; y: number }) => {
    setChildrenMenuState((prev) => {
      if (prev) return null;
      setCrumbMenuState(null);
      setCrumbColorPickerState(null);
      return { position };
    });
  }, []);

  const setCrumbColorPicker = useCallback((next: CollectionCrumbColorPickerState | null) => {
    setCrumbColorPickerState(next);
    if (next) {
      setCrumbMenuState(null);
      setChildrenMenuState(null);
    }
  }, []);

  const toggleCrumbColorPicker = useCallback((next: CollectionCrumbColorPickerState) => {
    setCrumbColorPickerState((prev) => {
      if (prev?.collectionId === next.collectionId) return null;
      setCrumbMenuState(null);
      setChildrenMenuState(null);
      return next;
    });
  }, []);

  const setRenamingCrumbId = useCallback((next: string | null) => {
    renameSettledRef.current = next === null;
    setRenamingCrumbIdState(next);
  }, []);

  const setSubAddingParentId = useCallback((next: string | null) => {
    subSettledRef.current = next === null;
    setSubAddingParentIdState(next);
  }, []);

  const childCollections = useMemo<CollectionCrumb[]>(
    () =>
      childCollectionsOf(collections, id).map((c) => ({ id: c.id, name: c.name, color: c.color })),
    [collections, id],
  );

  const customNavigate = options?.onNavigateCollection;
  const onCollectionDeleted = options?.onCollectionDeleted;

  const navigateToCollection = useCallback(
    (targetId: string) => {
      if (customNavigate) customNavigate(targetId);
      else navigate(`/collection/${targetId}`);
    },
    [customNavigate, navigate],
  );

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
        onRevert: (revert) => qc.setQueryData<ApiCollection[]>(['collections'], (prev) => revert(prev ?? [])),
        onSuccess: (updated) => setCollectionsCache((prev) => upsertById(prev, updated)),
      }).catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
    },
    [collections, qc, setCollectionsCache],
  );

  const handleCrumbRename = useCallback(
    (collectionId: string) => {
      if (renameSettledRef.current || renamingCrumbId !== collectionId) return;
      renameSettledRef.current = true;
      const trimmed = crumbDraft.trim();
      setRenamingCrumbIdState(null);
      if (!trimmed) return;
      setCollectionsCache((prev) => patchById(prev, collectionId, { name: trimmed }));
      apiUpdateCollection(collectionId, { name: trimmed }).catch(() =>
        qc.invalidateQueries({ queryKey: ['collections'] }),
      );
    },
    [crumbDraft, qc, renamingCrumbId, setCollectionsCache],
  );

  const handleCrumbCommitSub = useCallback(() => {
    if (subSettledRef.current || !subAddingParentId) return;
    subSettledRef.current = true;
    const parentId = subAddingParentId;
    const trimmed = subNewName.trim();
    setSubAddingParentIdState(null);
    setSubNewName('');
    if (!trimmed) return;
    const color = getHierarchicalColor('temp-id', parentId, collections);
    apiCreateCollection({ name: trimmed, color: color || PALETTE_COLORS[0], parentId })
      .then((created) => setCollectionsCache((prev) => [...prev, created]))
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  }, [collections, qc, setCollectionsCache, subAddingParentId, subNewName]);

  const handleCancelSub = useCallback(() => {
    subSettledRef.current = true;
    setSubAddingParentIdState(null);
    setSubNewName('');
  }, []);

  const handleConfirmDeleteCollection = useCallback(() => {
    if (!deletingCollection) return;
    const target = deletingCollection.id;
    setDeletingCollection(null);
    setCollectionsCache((prev) => prev.filter((c) => c.id !== target));
    apiDeleteCollection(target)
      .then(() => {
        if (onCollectionDeleted) onCollectionDeleted(target);
        else navigate('/daily');
      })
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  }, [deletingCollection, navigate, onCollectionDeleted, qc, setCollectionsCache]);

  return {
    trail,
    childCollections,
    childrenMenu,
    setChildrenMenu,
    toggleChildrenMenu,
    navigateToCollection,
    crumbMenu,
    setCrumbMenu,
    crumbColorPicker,
    setCrumbColorPicker,
    toggleCrumbColorPicker,
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
