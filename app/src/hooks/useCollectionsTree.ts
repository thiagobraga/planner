import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiCreateCollection, apiDeleteCollection, apiUpdateCollection, fetchCollections, PALETTE_COLORS } from '../api/client';
import { buildCollectionTree } from '../stores/collectionStore';
import { patchById, runOptimistic, upsertById } from '../stores/optimistic';
import { loadCollapsedCollectionIds, saveCollapsedCollectionIds } from '../utils/collectionCollapseStorage';
import type { ApiCollection } from '../types/api';
import type { CollectionTreeNode } from '../types/collections';

export function useCollectionsTree(activeId?: string) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const activeIdRef = useRef(activeId);
  useLayoutEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const { data: rawCollections = [] } = useQuery<ApiCollection[]>({
    queryKey: ['collections'],
    queryFn: fetchCollections,
  });

  const collections = useMemo(() => buildCollectionTree(rawCollections), [rawCollections]);

  const [addingRoot, setAddingRoot] = useState(false);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CollectionTreeNode | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => loadCollapsedCollectionIds());
  useEffect(() => saveCollapsedCollectionIds(collapsedIds), [collapsedIds]);

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
    setAddingRoot(true);
    setAddingSubFor(null);
    setRenamingId(null);
    setEditingName('');
    setMenuOpenId(null);
  };

  const handleSaveRoot = () => {
    const trimmed = editingName.trim();
    setAddingRoot(false);
    setEditingName('');
    if (!trimmed) return;
    apiCreateCollection({ name: trimmed, color: nextColor() })
      .then(() => qc.invalidateQueries({ queryKey: ['collections'] }))
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  const handleRename = (node: CollectionTreeNode) => {
    setRenamingId(node.id);
    setAddingRoot(false);
    setAddingSubFor(null);
    setEditingName(node.name);
  };

  const handleSaveRename = (node: CollectionTreeNode) => {
    const trimmed = editingName.trim();
    setRenamingId(null);
    setEditingName('');
    if (!trimmed || trimmed === node.name) return;
    apiUpdateCollection(node.id, { name: trimmed })
      .then(() => qc.invalidateQueries({ queryKey: ['collections'] }))
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  const handleAddSub = (node: CollectionTreeNode) => {
    setAddingSubFor(node.id);
    setCollapsed(node.id, false);
    setAddingRoot(false);
    setRenamingId(null);
    setEditingName('');
  };

  const handleSaveNewSub = (parentId: string) => {
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
        if (activeIdRef.current === id) navigate('/collections', { replace: true });
      })
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  const cancelEditing = () => {
    setAddingRoot(false);
    setAddingSubFor(null);
    setRenamingId(null);
    setEditingName('');
  };

  return {
    collections,
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
