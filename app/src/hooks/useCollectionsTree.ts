import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiCreateCollection, apiDeleteCollection, apiUpdateCollection, fetchCollections, PALETTE_COLORS } from '../api/client';
import { buildCollectionTree } from '../stores/collectionStore';
import { patchById, runOptimistic, upsertById } from '../stores/optimistic';
import { loadCollapsedCollectionIds, saveCollapsedCollectionIds } from '../utils/collectionCollapseStorage';
import type { ApiCollection } from '../types/api';
import type { CollectionRowColorPickerTarget, CollectionTreeNode } from '../types/collections';

export function useCollectionsTree(
  activeId?: string,
  options?: { onCollectionDeleted?: (id: string) => void },
) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const activeIdRef = useRef(activeId);
  const onDeletedRef = useRef(options?.onCollectionDeleted);
  useLayoutEffect(() => {
    activeIdRef.current = activeId;
    onDeletedRef.current = options?.onCollectionDeleted;
  }, [activeId, options?.onCollectionDeleted]);

  const { data: rawCollections = [], isSuccess: collectionsLoaded } = useQuery<ApiCollection[]>({
    queryKey: ['collections'],
    queryFn: fetchCollections,
  });

  const collections = useMemo(() => buildCollectionTree(rawCollections), [rawCollections]);

  const [addingRoot, setAddingRoot] = useState(false);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [menuOpenId, setMenuOpenIdState] = useState<string | null>(null);
  const [colorPickerTarget, setColorPickerTargetState] = useState<CollectionRowColorPickerTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CollectionTreeNode | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => loadCollapsedCollectionIds());
  const editSettledRef = useRef(false);
  useEffect(() => saveCollapsedCollectionIds(collapsedIds), [collapsedIds]);

  const setMenuOpenId = useCallback((id: string | null) => {
    setMenuOpenIdState(id);
    if (id !== null) setColorPickerTargetState(null);
  }, []);

  const setColorPickerTarget = useCallback((target: CollectionRowColorPickerTarget | null) => {
    setColorPickerTargetState(target);
    if (target !== null) setMenuOpenIdState(null);
  }, []);

  const setCollapsed = (id: string, collapsed: boolean) => {
    setCollapsedIds((prev) => {
      if (prev.has(id) === collapsed) return prev;
      const next = new Set(prev);
      if (collapsed) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const nextColor = () => PALETTE_COLORS[rawCollections.length % PALETTE_COLORS.length];

  const startAddRoot = () => {
    editSettledRef.current = false;
    setAddingRoot(true);
    setAddingSubFor(null);
    setRenamingId(null);
    setEditingName('');
    setMenuOpenId(null);
    setColorPickerTarget(null);
  };

  const handleSaveRoot = () => {
    if (editSettledRef.current) return;
    editSettledRef.current = true;
    const trimmed = editingName.trim();
    setAddingRoot(false);
    setEditingName('');
    if (!trimmed) return;
    apiCreateCollection({ name: trimmed, color: nextColor() })
      .then(() => qc.invalidateQueries({ queryKey: ['collections'] }))
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  const handleRename = (node: CollectionTreeNode) => {
    editSettledRef.current = false;
    setRenamingId(node.id);
    setAddingRoot(false);
    setAddingSubFor(null);
    setEditingName(node.name);
  };

  const handleSaveRename = (node: CollectionTreeNode) => {
    if (editSettledRef.current) return;
    editSettledRef.current = true;
    const trimmed = editingName.trim();
    setRenamingId(null);
    setEditingName('');
    if (!trimmed || trimmed === node.name) return;
    apiUpdateCollection(node.id, { name: trimmed })
      .then(() => qc.invalidateQueries({ queryKey: ['collections'] }))
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  const handleAddSub = (node: CollectionTreeNode) => {
    editSettledRef.current = false;
    setAddingSubFor(node.id);
    setCollapsed(node.id, false);
    setAddingRoot(false);
    setRenamingId(null);
    setEditingName('');
  };

  const handleSaveNewSub = (parentId: string) => {
    if (editSettledRef.current) return;
    editSettledRef.current = true;
    const trimmed = editingName.trim();
    setAddingSubFor(null);
    setEditingName('');
    if (!trimmed) return;
    apiCreateCollection({ name: trimmed, parentId, color: nextColor() })
      .then(() => qc.invalidateQueries({ queryKey: ['collections'] }))
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  // Flat recolor, matching the sidebar and the collection page breadcrumb:
  // children keep whatever colour they already have.
  const handleColorCommit = (node: CollectionTreeNode, color: string) => {
    void runOptimistic<ApiCollection, ApiCollection>({
      state: rawCollections,
      apply: (prev) => patchById(prev, node.id, { color }),
      call: () => apiUpdateCollection(node.id, { color }),
      onApply: (next) => qc.setQueryData<ApiCollection[]>(['collections'], next),
      onRevert: (snapshot) => qc.setQueryData<ApiCollection[]>(['collections'], snapshot),
      onSuccess: (updated) =>
        qc.setQueryData<ApiCollection[]>(['collections'], (prev) => upsertById(prev ?? [], updated)),
    }).catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    apiDeleteCollection(id)
      .then(() => {
        qc.invalidateQueries({ queryKey: ['collections'] });
        if (onDeletedRef.current) {
          onDeletedRef.current(id);
        } else if (activeIdRef.current === id) {
          navigate('/collections', { replace: true });
        }
      })
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  const cancelEditing = () => {
    editSettledRef.current = true;
    setAddingRoot(false);
    setAddingSubFor(null);
    setRenamingId(null);
    setEditingName('');
  };

  return {
    collections,
    rawCollections,
    collectionsLoaded,
    archivedActive: rawCollections.some((collection) => collection.id === activeId && collection.isArchived),
    addingRoot,
    startAddRoot,
    handleSaveRoot,
    cancelEditing,
    deleteTarget,
    confirmDelete,
    setDeleteTarget,
    rowProps: {
      activeId,
      menuOpenId,
      setMenuOpenId,
      colorPickerTarget,
      onOpenColorPicker: setColorPickerTarget,
      renamingId,
      addingSubFor,
      editingName,
      setEditingName,
      onRename: handleRename,
      onAddSub: handleAddSub,
      onDelete: setDeleteTarget,
      onSaveRename: handleSaveRename,
      onCancelRename: cancelEditing,
      onColorCommit: handleColorCommit,
      onSaveNewSub: handleSaveNewSub,
      onCancelNewSub: cancelEditing,
      collapsedIds,
      onToggleCollapsed: (id: string) => setCollapsed(id, !collapsedIds.has(id)),
    },
  };
}
