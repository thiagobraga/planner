import { Fragment, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus } from 'lucide-react';
import {
  fetchProjects,
  apiCreateProject,
  apiUpdateProject,
  apiDeleteProject,
  PROJECT_COLORS,
  projectColorHex,
  type ApiProject,
} from '../api/client';
import { ConfirmModal } from './ConfirmModal';

const INDENT = 22;
const MAX_DEPTH = 4; // backend enforces nesting depth of 4
const DEPTH_PADDING_CLASSES = ['pl-3', 'pl-[22px]', 'pl-[44px]', 'pl-[66px]', 'pl-[88px]'] as const;
// Indentation for the new-subproject input: parent depth → parent base + INDENT (22 px).
// depth-0 parent: pl-3 (12) + 22 = 34 px, depth-1: 22+22=44, depth-2: 44+22=66, …
const SUB_INPUT_PADDING_CLASSES = ['pl-[34px]', 'pl-[44px]', 'pl-[66px]', 'pl-[88px]', 'pl-[110px]'] as const;

const COLOR_SHADE_FAMILIES: Record<string, readonly string[]> = {
  red: ['red', 'berry_red', 'salmon', 'magenta'],
  berry_red: ['berry_red', 'red', 'magenta', 'salmon'],
  salmon: ['salmon', 'orange', 'taupe', 'red'],
  magenta: ['magenta', 'berry_red', 'lavender', 'violet'],
  blue: ['blue', 'sky_blue', 'light_blue', 'teal'],
  sky_blue: ['sky_blue', 'light_blue', 'blue', 'teal'],
  light_blue: ['light_blue', 'sky_blue', 'blue', 'teal'],
  teal: ['teal', 'mint_green', 'sky_blue', 'blue'],
  green: ['green', 'lime_green', 'mint_green', 'olive_green'],
  lime_green: ['lime_green', 'green', 'olive_green', 'mint_green'],
  mint_green: ['mint_green', 'teal', 'lime_green', 'green'],
  olive_green: ['olive_green', 'lime_green', 'green', 'taupe'],
  orange: ['orange', 'yellow', 'salmon', 'taupe'],
  yellow: ['yellow', 'orange', 'taupe', 'olive_green'],
  taupe: ['taupe', 'grey', 'olive_green', 'yellow'],
  grape: ['grape', 'violet', 'lavender', 'blue'],
  violet: ['violet', 'lavender', 'grape', 'magenta'],
  lavender: ['lavender', 'violet', 'magenta', 'grape'],
  charcoal: ['charcoal', 'grey', 'taupe', 'light_blue'],
  grey: ['grey', 'charcoal', 'taupe', 'light_blue'],
};

function getHierarchicalColor(
  projectId: string,
  parentId: string | null,
  projects: ApiProject[],
  pendingParentUpdates: Map<string, string | null> = new Map(),
): string {
  const getParentId = (id: string) => {
    return pendingParentUpdates.has(id)
      ? pendingParentUpdates.get(id)!
      : (projects.find((p) => p.id === id)?.parentId ?? null);
  };

  const getOriginalColor = (id: string) => {
    return projects.find((p) => p.id === id)?.color ?? 'blue';
  };

  let depth = 0;
  let currParentId = parentId;
  let lastId = projectId;

  while (currParentId) {
    depth++;
    lastId = currParentId;
    currParentId = getParentId(currParentId);
  }

  const rootColor = getOriginalColor(lastId);
  const family = COLOR_SHADE_FAMILIES[rootColor] || [rootColor];
  return family[depth % family.length];
}

interface FlatProject {
  id: string;
  name: string;
  colorName: string;
  parentId: string | null;
  depth: number;
}

// Flatten the visible (non-inbox, non-archived) projects into a depth-annotated,
// order-sorted list suitable for a single sortable list with indentation.
function flattenProjects(projects: ApiProject[]): FlatProject[] {
  const visible = projects.filter((p) => !p.isArchived && !p.isInbox);
  const childrenOf = new Map<string | null, ApiProject[]>();
  for (const p of visible) {
    const key = p.parentId && visible.some((v) => v.id === p.parentId) ? p.parentId : null;
    const list = childrenOf.get(key) ?? [];
    list.push(p);
    childrenOf.set(key, list);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.orderValue - b.orderValue || a.name.localeCompare(b.name));
  }
  const out: FlatProject[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const p of childrenOf.get(parentId) ?? []) {
      out.push({ id: p.id, name: p.name, colorName: p.color, parentId, depth });
      walk(p.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

// Compute the projected parent/depth for the dragged item given the horizontal drag offset.
function getProjection(
  items: FlatProject[],
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

export function ProjectTreeNav() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects });

  const flat = useMemo(() => flattenProjects(projects), [projects]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [subAddingParentId, setSubAddingParentId] = useState<string | null>(null);
  const [subNewName, setSubNewName] = useState('');
  const [deletingProject, setDeletingProject] = useState<{ id: string; name: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const projection =
    activeId && flat.length
      ? getProjection(flat, activeId, overIdRef.current ?? activeId, offsetLeft)
      : null;

  const setProjectsCache = useCallback(
    (updater: (prev: ApiProject[]) => ApiProject[]) => {
      qc.setQueryData<ApiProject[]>(['projects'], (prev) => updater(prev ?? []));
    },
    [qc],
  );

  const nextColor = () => PROJECT_COLORS[projects.length % PROJECT_COLORS.length].name;

  const handleCreate = (name: string, parentId: string | null) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    let color = nextColor();
    if (parentId) {
      color = getHierarchicalColor('temp-id', parentId, projects);
    }
    apiCreateProject({ name: trimmed, color, parentId })
      .then((created) => setProjectsCache((prev) => [...prev, created]))
      .catch(() => qc.invalidateQueries({ queryKey: ['projects'] }));
  };

  const handleCommitNewProject = () => {
    if (!adding) return;
    setAdding(false);
    handleCreate(newName, null);
    setNewName('');
  };

  const handleStartSubProject = (parentId: string) => {
    setAdding(false);
    setNewName('');
    setEditingId(null);
    setSubAddingParentId(parentId);
    setSubNewName('');
  };

  const handleCommitSubProject = () => {
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
    setProjectsCache((prev) => prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
    apiUpdateProject(id, { name: trimmed }).catch(() => qc.invalidateQueries({ queryKey: ['projects'] }));
  };

  const handleDelete = (id: string, name: string) => {
    setDeletingProject({ id, name });
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
      for (const p of projects) {
        if (p.parentId === parentId) {
          descendants.add(p.id);
          findDescendants(p.id);
        }
      }
    };
    findDescendants(event.active.id as string);

    setProjectsCache((prev) =>
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
        apiUpdateProject(c.id, { parentId: c.parentId, orderValue: c.orderValue, color: c.color }),
      ),
    ).catch(() => qc.invalidateQueries({ queryKey: ['projects'] }));
  };

  return (
    <div className="mt-6 flex-1">
      <div className="flex items-center justify-between px-3">
        <span className="text-[10px] leading-6 tracking-[0.1em] uppercase text-ink-light font-medium">
          Projects
        </span>
        <button
          type="button"
          aria-label="Add project"
          title="Add project"
          onClick={() => { setAdding(true); setNewName(''); }}
          className="bg-transparent border-0 cursor-pointer text-ink-light flex items-center p-0"
        >
          <Plus size={14} strokeWidth={1.5} />
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }: DragStartEvent) => setActiveId(String(active.id))}
        onDragMove={({ delta, over }: DragMoveEvent) => {
          setOffsetLeft(delta.x);
          overIdRef.current = over ? String(over.id) : null;
        }}
        onDragEnd={handleDragEnd}
        onDragCancel={() => { setActiveId(null); setOffsetLeft(0); overIdRef.current = null; }}
      >
        <SortableContext items={flat.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          {flat.map((item) => (
            <Fragment key={item.id}>
              <SortableProjectRow
                item={item}
                depth={activeId === item.id && projection ? projection.depth : item.depth}
                isEditing={editingId === item.id}
                draft={draft}
                onNavigate={() => navigate(`/project/${item.id}`)}
                onStartRename={() => { setEditingId(item.id); setDraft(item.name); }}
                onDraftChange={setDraft}
                onCommitRename={() => handleRename(item.id, draft)}
                onCancelRename={() => setEditingId(null)}
                onAddSub={() => handleStartSubProject(item.id)}
                onDelete={() => handleDelete(item.id, item.name)}
              />
              {subAddingParentId === item.id && (
                <div className={`flex items-center h-6 pr-2 ${SUB_INPUT_PADDING_CLASSES[Math.min(item.depth, SUB_INPUT_PADDING_CLASSES.length - 1)]}`}>
                  <input
                    autoFocus
                    value={subNewName}
                    onChange={(e) => setSubNewName(e.target.value)}
                    onBlur={handleCommitSubProject}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCommitSubProject();
                      if (e.key === 'Escape') {
                        setSubAddingParentId(null);
                        setSubNewName('');
                      }
                    }}
                    placeholder="Project name…"
                    className="flex-1 min-w-0 h-6 text-[13px] leading-6 text-ink bg-transparent border-0 border-b border-dot outline-none px-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                  />
                </div>
              )}
            </Fragment>
          ))}
        </SortableContext>
      </DndContext>

      {adding && (
        <div className="px-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleCommitNewProject}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitNewProject();
              if (e.key === 'Escape') setAdding(false);
            }}
            placeholder="Project name…"
            className="w-full h-6 text-[13px] leading-6 text-ink bg-transparent border-0 border-b border-dot outline-none px-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
          />
        </div>
      )}

      {flat.length === 0 && !adding && (
        <div className="text-xs leading-6 text-ink-light px-3 italic opacity-60">
          No projects yet
        </div>
      )}

      <ConfirmModal
        isOpen={deletingProject !== null}
        title="Delete Project"
        message={`Delete project "${deletingProject?.name}" and all its tasks? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (deletingProject) {
            setProjectsCache((prev) => prev.filter((p) => p.id !== deletingProject.id));
            apiDeleteProject(deletingProject.id)
              .then(() => navigate('/daily'))
              .catch(() => qc.invalidateQueries({ queryKey: ['projects'] }));
            setDeletingProject(null);
          }
        }}
        onCancel={() => setDeletingProject(null)}
      />
    </div>
  );
}

interface RowProps {
  item: FlatProject;
  depth: number;
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

function SortableProjectRow({
  item,
  depth,
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const depthClass = DEPTH_PADDING_CLASSES[Math.min(depth, DEPTH_PADDING_CLASSES.length - 1)];

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={`project-row flex items-center gap-[7px] h-6 pr-2 text-[13px] text-ink ${depthClass}`}
    >
      <span
        {...attributes}
        {...listeners}
        className="w-4 flex items-center justify-center shrink-0 cursor-grab"
        aria-label="Drag to reorder"
      >
        <span
          className="w-2 h-2 rounded-full shrink-0 block [filter:saturate(0.55)]"
          style={{ background: projectColorHex(item.colorName) }}
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
            className="flex-1 text-left bg-transparent border-0 cursor-pointer text-[13px] text-ink opacity-60 truncate p-0"
          >
            {item.name}
          </button>
          <button
            type="button"
            className="project-row__action bg-transparent border-0 cursor-pointer text-ink-light text-sm leading-none py-0 px-0.5 shrink-0"
            aria-label={`Add sub-project to ${item.name}`}
            title="Add sub-project"
            onClick={onAddSub}
          >
            +
          </button>
          <button
            type="button"
            className="project-row__action bg-transparent border-0 cursor-pointer text-ink-light text-sm leading-none py-0 px-0.5 shrink-0"
            aria-label={`Delete ${item.name}`}
            title="Delete project"
            onClick={onDelete}
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}
