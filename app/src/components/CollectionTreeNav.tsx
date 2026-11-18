import { Fragment, useMemo, useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { usePlannerDragHandlers } from '../contexts/usePlannerDrag';
import { Plus } from 'lucide-react';
import { fetchCollections, apiCreateCollection, apiUpdateCollection, apiDeleteCollection, PALETTE_COLORS } from '../api/client';
import type { ApiCollection } from '../types/api';
import { runOptimistic, patchById, upsertById } from '../stores/optimistic';
import { ConfirmModal } from './ConfirmModal';
import { useI18n } from '../i18n/I18nContext';
import { loadCollapsedCollectionIds, saveCollapsedCollectionIds } from '../utils/collectionCollapseStorage';
import {
  SUB_INPUT_PADDING_CLASSES,
  ancestorIds,
  flattenCollections,
  getHierarchicalColor,
  getProjection,
  reorderVisibleCollections,
  visibleCollections,
} from '../utils/collectionTree';
import { SortableCollectionRow } from './collections/SortableCollectionRow';

export { flattenCollections, getHierarchicalColor, visibleCollections };

// Module-scoped ref for the current drag-over target (kept off render state to
// avoid re-renders on every pointer move while still feeding getProjection).
const overIdRef: { current: string | null } = { current: null };

export function CollectionTreeNav() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { data: collections = [] } = useQuery({ queryKey: ['collections'], queryFn: fetchCollections });

  const flat = useMemo(() => flattenCollections(collections), [collections]);
  const selectedCollectionId = location.pathname.match(/^\/collection\/([^/]+)$/)?.[1] ?? null;
  const collectionIds = useMemo(() => new Set(flat.map((item) => item.id)), [flat]);
  const [storedCollapsedIds, setStoredCollapsedIds] = useState<Set<string>>(() => loadCollapsedCollectionIds());
  const normalizedCollapsedIds = useMemo(
    () => [...storedCollapsedIds].filter((id) => collectionIds.has(id)),
    [collectionIds, storedCollapsedIds],
  );
  const collapsedIds = useMemo(() => new Set(normalizedCollapsedIds), [normalizedCollapsedIds]);
  useEffect(() => {
    saveCollapsedCollectionIds(collapsedIds);
  }, [collapsedIds]);
  const revealedIds = useMemo(() => ancestorIds(flat, selectedCollectionId), [flat, selectedCollectionId]);
  const visibleFlat = useMemo(
    () => visibleCollections(flat, collapsedIds, revealedIds),
    [collapsedIds, flat, revealedIds],
  );
  const parentIds = useMemo(
    () => new Set(flat.flatMap((item) => (item.parentId ? [item.parentId] : []))),
    [flat],
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [subAddingParentId, setSubAddingParentId] = useState<string | null>(null);
  const [subNewName, setSubNewName] = useState('');
  const [deletingCollection, setDeletingCollection] = useState<{ id: string; name: string } | null>(null);

  const projection =
    activeId && visibleFlat.length
      ? getProjection(visibleFlat, activeId, overIdRef.current ?? activeId, offsetLeft)
      : null;

  const handleToggleCollapsed = (id: string) => {
    setStoredCollapsedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setCollectionsCache = useCallback(
    (updater: (prev: ApiCollection[]) => ApiCollection[]) => {
      qc.setQueryData<ApiCollection[]>(['collections'], (prev) => updater(prev ?? []));
    },
    [qc],
  );

  const nextColor = () => PALETTE_COLORS[collections.length % PALETTE_COLORS.length];

  const handleCreate = (name: string, parentId: string | null) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    let color = nextColor();
    if (parentId) {
      color = getHierarchicalColor('temp-id', parentId, collections);
    }
    apiCreateCollection({ name: trimmed, color, parentId })
      .then((created) => setCollectionsCache((prev) => [...prev, created]))
      .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  const handleCommitNewCollection = () => {
    if (!adding) return;
    setAdding(false);
    handleCreate(newName, null);
    setNewName('');
  };

  const handleStartSubCollection = (parentId: string) => {
    setAdding(false);
    setNewName('');
    setEditingId(null);
    setSubAddingParentId(parentId);
    setSubNewName('');
  };

  const handleCommitSubCollection = () => {
    if (!subAddingParentId) return;
    const parentId = subAddingParentId;
    setSubAddingParentId(null);
    handleCreate(subNewName, parentId);
    setSubNewName('');
  };

  const handleRename = (id: string, name: string) => {
    const trimmed = name.trim();
    if (editingId !== id) return;
    setEditingId(null);
    if (!trimmed) return;
    setCollectionsCache((prev) => prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
    apiUpdateCollection(id, { name: trimmed }).catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  const handleDelete = (id: string, name: string) => {
    setDeletingCollection({ id, name });
  };

  // A manual recolor is deliberately flat: only this row changes. The shade
  // family in getHierarchicalColor() still governs creation and drag-reparent.
  const handleColorChange = (id: string, color: string) => {
    void runOptimistic<ApiCollection, ApiCollection>({
      state: collections,
      apply: (prev) => patchById(prev, id, { color }),
      call: () => apiUpdateCollection(id, { color }),
      onApply: (next) => qc.setQueryData<ApiCollection[]>(['collections'], next),
      onRevert: (snapshot) => qc.setQueryData<ApiCollection[]>(['collections'], snapshot),
      onSuccess: (updated) => setCollectionsCache((prev) => upsertById(prev, updated)),
    }).catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const proj = projection;
    const { over } = event;
    setActiveId(null);
    setOffsetLeft(0);
    overIdRef.current = null;
    if (!over || !proj) return;

    const activeIndex = visibleFlat.findIndex((i) => i.id === event.active.id);
    const overIndex = visibleFlat.findIndex((i) => i.id === over.id);
    // The shared context also offers the Inbox nav item as a collection target.
    // It is a valid place to drop a *task*, but not a peer in this sortable list.
    if (activeIndex === -1 || overIndex === -1) return;

    const reordered = reorderVisibleCollections(flat, visibleFlat, activeIndex, overIndex).map((item) =>
      item.id === event.active.id ? { ...item, parentId: proj.parentId } : item,
    );

    // Reassign order by global position; persist anything whose parent/order/color changed.
    const orderById = new Map(reordered.map((item, idx) => [item.id, idx]));
    const changed: Array<{ id: string; parentId: string | null; orderValue: number; color?: string }> = [];

    const pendingParentUpdates = new Map<string, string | null>();
    pendingParentUpdates.set(event.active.id as string, proj.parentId);

    const descendants = new Set<string>();
    const findDescendants = (parentId: string) => {
      for (const p of collections) {
        if (p.parentId === parentId) {
          descendants.add(p.id);
          findDescendants(p.id);
        }
      }
    };
    findDescendants(event.active.id as string);

    setCollectionsCache((prev) =>
      prev.map((p) => {
        if (!orderById.has(p.id)) return p;
        const orderValue = orderById.get(p.id)!;
        const parentId = p.id === event.active.id ? proj.parentId : p.parentId;

        let color = p.color;
        if (p.id === event.active.id || descendants.has(p.id)) {
          color = getHierarchicalColor(p.id, parentId, prev, pendingParentUpdates);
        }

        if (p.orderValue !== orderValue || p.parentId !== parentId || p.color !== color) {
          changed.push({ id: p.id, parentId, orderValue, color });
        }
        return { ...p, orderValue, parentId, color };
      }),
    );

    Promise.all(
      changed.map((c) =>
        apiUpdateCollection(c.id, { parentId: c.parentId, orderValue: c.orderValue, color: c.color }),
      ),
    ).catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
  };

  // Collection drags run on the shell-level DndContext rather than a private one.
  // A private context could not see a drag that started on a task row in the
  // page, which is exactly the gesture that files a task into a collection.
  usePlannerDragHandlers('collection', {
    onDragStart: ({ active }: DragStartEvent) => setActiveId(String(active.id)),
    onDragMove: ({ delta, over }: DragMoveEvent) => {
      setOffsetLeft(delta.x);
      overIdRef.current = over ? String(over.id) : null;
    },
    onDragEnd: handleDragEnd,
    onDragCancel: () => {
      setActiveId(null);
      setOffsetLeft(0);
      overIdRef.current = null;
    },
  });

  return (
    <div className="mt-6 flex-1">
      <div className="flex items-center justify-between px-3">
        <a
          href="/collections"
          onClick={(e) => {
            e.preventDefault();
            navigate('/collections');
          }}
          className="text-[10px] leading-6 tracking-widest uppercase text-ink-light font-medium hover:text-ink transition-colors no-underline"
        >
          {t('nav.collections')}
        </a>
        <button
          type="button"
          aria-label={t('page.addCollection')}
          title={t('page.addCollection')}
          onClick={() => {
            setAdding(true);
            setNewName('');
          }}
          className="bg-transparent border-0 cursor-pointer text-ink-light flex items-center p-0"
        >
          <Plus size={14} strokeWidth={1.5} />
        </button>
      </div>

      <SortableContext items={visibleFlat.map((f) => f.id)} strategy={verticalListSortingStrategy}>
        {visibleFlat.map((item) => (
          <Fragment key={item.id}>
            <SortableCollectionRow
              item={item}
              depth={activeId === item.id && projection ? projection.depth : item.depth}
              isActive={selectedCollectionId === item.id}
              isEditing={editingId === item.id}
              hasChildren={parentIds.has(item.id)}
              isExpanded={!collapsedIds.has(item.id) || revealedIds.has(item.id)}
              draft={draft}
              onNavigate={() => navigate(`/collection/${item.id}`)}
              onStartRename={() => {
                setEditingId(item.id);
                setDraft(item.name);
              }}
              onDraftChange={setDraft}
              onCommitRename={() => handleRename(item.id, draft)}
              onCancelRename={() => setEditingId(null)}
              onToggleCollapsed={() => handleToggleCollapsed(item.id)}
              onAddSub={() => handleStartSubCollection(item.id)}
              onDelete={() => handleDelete(item.id, item.name)}
              onColorCommit={(color) => handleColorChange(item.id, color)}
            />
            {subAddingParentId === item.id && (
              <div
                className={`flex items-center h-6 pr-2 ${SUB_INPUT_PADDING_CLASSES[Math.min(item.depth, SUB_INPUT_PADDING_CLASSES.length - 1)]}`}
              >
                <input
                  autoFocus
                  value={subNewName}
                  onChange={(e) => setSubNewName(e.target.value)}
                  onBlur={handleCommitSubCollection}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitSubCollection();
                    if (e.key === 'Escape') {
                      setSubAddingParentId(null);
                      setSubNewName('');
                    }
                  }}
                  placeholder={t('page.collectionName')}
                  className="flex-1 min-w-0 h-6 text-[13px] leading-6 text-ink bg-transparent border-0 border-b border-border-subtle outline-none px-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                />
              </div>
            )}
          </Fragment>
        ))}
      </SortableContext>

      {adding && (
        <div className="px-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleCommitNewCollection}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitNewCollection();
              if (e.key === 'Escape') setAdding(false);
            }}
            placeholder={t('page.collectionName')}
            className="w-full h-6 text-[13px] leading-6 text-ink bg-transparent border-0 border-b border-border-subtle outline-none px-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
          />
        </div>
      )}

      {flat.length === 0 && !adding && (
        <div className="text-xs leading-6 text-ink-light px-3 opacity-60">
          {t('page.noCollections')}
        </div>
      )}

      <ConfirmModal
        isOpen={deletingCollection !== null}
        title={t('page.deleteCollection')}
        message={t('page.deleteCollectionMessage', { name: deletingCollection?.name ?? '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          if (deletingCollection) {
            setCollectionsCache((prev) => prev.filter((p) => p.id !== deletingCollection.id));
            apiDeleteCollection(deletingCollection.id)
              .then(() => navigate('/daily'))
              .catch(() => qc.invalidateQueries({ queryKey: ['collections'] }));
            setDeletingCollection(null);
          }
        }}
        onCancel={() => setDeletingCollection(null)}
      />
    </div>
  );
}
