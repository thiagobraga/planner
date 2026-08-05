import { Fragment, useMemo, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { usePlannerDrag, usePlannerDragHandlers } from '../contexts/PlannerDragContext';
import type { CollectionDragData, CollectionDropData } from '../types/drag';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Pencil, FolderPlus, Trash2 } from 'lucide-react';
import { ContextMenu } from './ui/ContextMenu';
import {
  fetchCollections,
  apiCreateCollection,
  apiUpdateCollection,
  apiDeleteCollection,
  PALETTE_COLORS,
  type ApiCollection,
} from '../api/client';
import { ConfirmModal } from './ConfirmModal';
import { useI18n } from '../i18n/I18nContext';

const INDENT = 22;
const MAX_DEPTH = 4; // backend enforces nesting depth of 4
// pl-3 (12px) base, then a flat 10px step per depth - the original depth-0→1 distance -
// so every level reads the same distance instead of the first step alone being narrower.
const DEPTH_PADDING_CLASSES = ['pl-3', 'pl-[22px]', 'pl-[32px]', 'pl-[42px]', 'pl-[52px]'] as const;
// Indentation for the new-subcollection input: parent depth → parent base + 10 px.
// depth-0 parent: pl-3 (12) + 10 = 22 px, depth-1: 22+10=32, depth-2: 32+10=42, …
const SUB_INPUT_PADDING_CLASSES = ['pl-[22px]', 'pl-[32px]', 'pl-[42px]', 'pl-[52px]', 'pl-[62px]'] as const;

const COLOR_SHADE_FAMILIES: Record<string, readonly string[]> = {
  '#c98079': ['#c98079', '#d56b64', '#cc8b85', '#d16d73'],
  '#d56b64': ['#d56b64', '#c98079', '#d16d73', '#cc8b85'],
  '#cc8b85': ['#cc8b85', '#b97a3a', '#ac918f', '#c98079'],
  '#d16d73': ['#d16d73', '#d56b64', '#d6c7b0', '#c2a29e'],
  '#65788a': ['#65788a', '#6fa0d5', '#adb9c1', '#7ea2d6'],
  '#6fa0d5': ['#6fa0d5', '#adb9c1', '#65788a', '#7ea2d6'],
  '#adb9c1': ['#adb9c1', '#6fa0d5', '#65788a', '#7ea2d6'],
  '#7ea2d6': ['#7ea2d6', '#a6cfc5', '#6fa0d5', '#65788a'],
  '#7dbfb2': ['#7dbfb2', '#d7db96', '#a6cfc5', '#b7bf4e'],
  '#d7db96': ['#d7db96', '#7dbfb2', '#b7bf4e', '#a6cfc5'],
  '#a6cfc5': ['#a6cfc5', '#7ea2d6', '#d7db96', '#7dbfb2'],
  '#b7bf4e': ['#b7bf4e', '#d7db96', '#7dbfb2', '#ac918f'],
  '#b97a3a': ['#b97a3a', '#cbd376', '#cc8b85', '#ac918f'],
  '#cbd376': ['#cbd376', '#b97a3a', '#ac918f', '#b7bf4e'],
  '#ac918f': ['#ac918f', '#bababa', '#b7bf4e', '#cbd376'],
  '#b08b8a': ['#b08b8a', '#c2a29e', '#d6c7b0', '#65788a'],
  '#c2a29e': ['#c2a29e', '#d6c7b0', '#b08b8a', '#d16d73'],
  '#d6c7b0': ['#d6c7b0', '#c2a29e', '#d16d73', '#b08b8a'],
  '#6f7780': ['#6f7780', '#bababa', '#ac918f', '#adb9c1'],
  '#bababa': ['#bababa', '#6f7780', '#ac918f', '#adb9c1'],
};

function getHierarchicalColor(
  collectionId: string,
  parentId: string | null,
  collections: ApiCollection[],
  pendingParentUpdates: Map<string, string | null> = new Map(),
): string {
  const getParentId = (id: string) => {
    return pendingParentUpdates.has(id)
      ? pendingParentUpdates.get(id)!
      : (collections.find((p) => p.id === id)?.parentId ?? null);
  };

  const getOriginalColor = (id: string) => {
    return collections.find((p) => p.id === id)?.color ?? '#65788a';
  };

  let depth = 0;
  let currParentId = parentId;
  let lastId = collectionId;

  while (currParentId) {
    depth++;
    lastId = currParentId;
    currParentId = getParentId(currParentId);
  }

  const rootColor = getOriginalColor(lastId);
  const family = COLOR_SHADE_FAMILIES[rootColor] || [rootColor];
  return family[depth % family.length];
}

interface FlatCollection {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  depth: number;
}

// Flatten the visible (non-inbox, non-archived) collections into a depth-annotated,
// order-sorted list suitable for a single sortable list with indentation.
function flattenCollections(collections: ApiCollection[]): FlatCollection[] {
  const visible = collections.filter((p) => !p.isArchived && !p.isInbox);
  const childrenOf = new Map<string | null, ApiCollection[]>();
  for (const p of visible) {
    const key = p.parentId && visible.some((v) => v.id === p.parentId) ? p.parentId : null;
    const list = childrenOf.get(key) ?? [];
    list.push(p);
    childrenOf.set(key, list);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.orderValue - b.orderValue || a.name.localeCompare(b.name));
  }
  const out: FlatCollection[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const p of childrenOf.get(parentId) ?? []) {
      out.push({ id: p.id, name: p.name, color: p.color, parentId, depth });
      walk(p.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

// Compute the projected parent/depth for the dragged item given the horizontal drag offset.
function getProjection(
  items: FlatCollection[],
  activeId: string,
  overId: string,
  dragOffset: number,
) {
  const overIndex = items.findIndex((i) => i.id === overId);
  const activeIndex = items.findIndex((i) => i.id === activeId);
  const newItems = arrayMove(items, activeIndex, overIndex);
  const prev = newItems[overIndex - 1];
  const next = newItems[overIndex + 1];
  const dragDepth = Math.round(dragOffset / INDENT);
  const projectedDepth = (items[activeIndex]?.depth ?? 0) + dragDepth;
  const maxDepth = Math.min(prev ? prev.depth + 1 : 0, MAX_DEPTH - 1);
  const minDepth = next ? next.depth : 0;
  const depth = Math.max(minDepth, Math.min(projectedDepth, maxDepth));

  let parentId: string | null = null;
  if (depth > 0 && prev) {
    if (depth === prev.depth) parentId = prev.parentId;
    else if (depth > prev.depth) parentId = prev.id;
    else {
      const ancestor = newItems
        .slice(0, overIndex)
        .reverse()
        .find((i) => i.depth === depth);
      parentId = ancestor?.parentId ?? null;
    }
  }
  return { depth, parentId };
}

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
    activeId && flat.length
      ? getProjection(flat, activeId, overIdRef.current ?? activeId, offsetLeft)
      : null;

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

  const handleDragEnd = (event: DragEndEvent) => {
    const proj = projection;
    const { over } = event;
    setActiveId(null);
    setOffsetLeft(0);
    overIdRef.current = null;
    if (!over || !proj) return;

    const activeIndex = flat.findIndex((i) => i.id === event.active.id);
    const overIndex = flat.findIndex((i) => i.id === over.id);
    // The shared context also offers the Inbox nav item as a collection target.
    // It is a valid place to drop a *task*, but not a peer in this sortable list.
    if (activeIndex === -1 || overIndex === -1) return;

    const reordered = arrayMove(flat, activeIndex, overIndex).map((item) =>
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
          onClick={(e) => { e.preventDefault(); navigate('/collections'); }}
          className="text-[10px] leading-6 tracking-[0.1em] uppercase text-ink-light font-medium hover:text-ink transition-colors no-underline"
        >
          {t('nav.collections')}
        </a>
        <button
          type="button"
          aria-label={t('page.addCollection')}
          title={t('page.addCollection')}
          onClick={() => { setAdding(true); setNewName(''); }}
          className="bg-transparent border-0 cursor-pointer text-ink-light flex items-center p-0"
        >
          <Plus size={14} strokeWidth={1.5} />
        </button>
      </div>

      <SortableContext items={flat.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          {flat.map((item) => (
            <Fragment key={item.id}>
              <SortableCollectionRow
                item={item}
                depth={activeId === item.id && projection ? projection.depth : item.depth}
                isActive={selectedCollectionId === item.id}
                isEditing={editingId === item.id}
                draft={draft}
                onNavigate={() => navigate(`/collection/${item.id}`)}
                onStartRename={() => { setEditingId(item.id); setDraft(item.name); }}
                onDraftChange={setDraft}
                onCommitRename={() => handleRename(item.id, draft)}
                onCancelRename={() => setEditingId(null)}
                onAddSub={() => handleStartSubCollection(item.id)}
                onDelete={() => handleDelete(item.id, item.name)}
              />
              {subAddingParentId === item.id && (
                <div className={`flex items-center h-6 pr-2 ${SUB_INPUT_PADDING_CLASSES[Math.min(item.depth, SUB_INPUT_PADDING_CLASSES.length - 1)]}`}>
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
                    className="flex-1 min-w-0 h-6 text-[13px] leading-6 text-ink bg-transparent border-0 border-b border-dot outline-none px-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
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
            className="w-full h-6 text-[13px] leading-6 text-ink bg-transparent border-0 border-b border-dot outline-none px-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
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

interface RowProps {
  item: FlatCollection;
  depth: number;
  isActive: boolean;
  isEditing: boolean;
  draft: string;
  onNavigate: () => void;
  onStartRename: () => void;
  onDraftChange: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onAddSub: () => void;
  onDelete: () => void;
}

function SortableCollectionRow({
  item,
  depth,
  isActive,
  isEditing,
  draft,
  onNavigate,
  onStartRename,
  onDraftChange,
  onCommitRename,
  onCancelRename,
  onAddSub,
  onDelete,
}: RowProps) {
  const { t } = useI18n();
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // One payload serves both roles: this row is a peer to drag against when a
  // collection is moving, and a container to file into when a task is.
  const data: CollectionDragData & CollectionDropData = {
    kind: 'collection',
    collectionId: item.id,
    parentId: item.parentId,
    isInbox: false,
  };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data,
  });
  const { activeDrag, overId } = usePlannerDrag();
  const isTaskTarget = activeDrag?.kind === 'task' && overId === item.id;
  const depthClass = DEPTH_PADDING_CLASSES[Math.min(depth, DEPTH_PADDING_CLASSES.length - 1)];

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Translate.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
        }}
        data-drop-target={isTaskTarget ? 'true' : undefined}
        className={`collection-row flex items-center gap-[7px] h-6 pr-2 text-[13px] text-ink ${depthClass} ${isActive ? 'collection-row--active font-medium' : ''} ${isTaskTarget ? 'collection-row--drop-target rounded-[4px] bg-[var(--planner-hover,rgba(44,44,44,0.06))] outline outline-1 outline-dot' : ''}`}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextPos({ x: e.clientX, y: e.clientY });
        }}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          if (!touch) return;
          const pos = { x: touch.clientX, y: touch.clientY };
          touchTimerRef.current = setTimeout(() => {
            setContextPos(pos);
          }, 400);
        }}
        onTouchMove={() => {
          if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
        }}
        onTouchEnd={() => {
          if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
        }}
      >
        <span
          {...attributes}
          {...listeners}
          className="w-4 flex items-center justify-center shrink-0 cursor-grab"
          aria-label={`Reorder ${item.name}`}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0 block [filter:saturate(0.55)]"
            style={{ background: item.color }}
          />
        </span>
        {isEditing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename();
              if (e.key === 'Escape') onCancelRename();
            }}
            className="flex-1 h-5 text-[13px] text-ink bg-transparent border-0 border-b border-dot outline-none"
          />
        ) : (
          <>
            <button
              type="button"
              onClick={onNavigate}
              onDoubleClick={onStartRename}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 text-left bg-transparent border-0 cursor-pointer text-[13px] text-ink truncate p-0 ${isActive ? 'opacity-100' : 'opacity-60'}`}
            >
              {item.name}
            </button>
            <button
              type="button"
              className="collection-row__action bg-transparent border-0 cursor-pointer text-ink-light text-sm leading-none py-0 px-0.5 shrink-0"
              aria-label={`${t('page.addSubCollection')} ${item.name}`}
              title={t('page.addSubCollection')}
              onClick={onAddSub}
            >
              +
            </button>
            <button
              type="button"
              className="collection-row__action bg-transparent border-0 cursor-pointer text-ink-light text-sm leading-none py-0 px-0.5 shrink-0"
              aria-label={t('page.deleteNamed', { name: item.name })}
              title={t('page.deleteCollection')}
              onClick={onDelete}
            >
              ×
            </button>
          </>
        )}
      </div>

      {contextPos && (
        <ContextMenu
          position={contextPos}
          onClose={() => setContextPos(null)}
          items={[
            {
              type: 'item',
              label: t('common.rename'),
              icon: <Pencil size={14} />,
              onClick: onStartRename,
            },
            {
              type: 'item',
              label: t('page.addSubCollection'),
              icon: <FolderPlus size={14} />,
              onClick: onAddSub,
            },
            { type: 'separator' },
            {
              type: 'item',
              label: t('common.delete'),
              icon: <Trash2 size={14} />,
              destructive: true,
              onClick: onDelete,
            },
          ]}
        />
      )}
    </>
  );
}
