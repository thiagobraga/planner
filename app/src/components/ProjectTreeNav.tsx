import { useMemo, useState, useCallback, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
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

const INDENT = 16;
const MAX_DEPTH = 4; // backend enforces nesting depth of 4

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
    apiCreateProject({ name: trimmed, color: nextColor(), parentId })
      .then((created) => setProjectsCache((prev) => [...prev, created]))
      .catch(() => qc.invalidateQueries({ queryKey: ['projects'] }));
  };

  const handleRename = (id: string, name: string) => {
    const trimmed = name.trim();
    setEditingId(null);
    if (!trimmed) return;
    setProjectsCache((prev) => prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
    apiUpdateProject(id, { name: trimmed }).catch(() => qc.invalidateQueries({ queryKey: ['projects'] }));
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete project "${name}" and all its tasks? This cannot be undone.`)) return;
    setProjectsCache((prev) => prev.filter((p) => p.id !== id));
    apiDeleteProject(id)
      .then(() => navigate('/today'))
      .catch(() => qc.invalidateQueries({ queryKey: ['projects'] }));
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

    // Reassign order by global position; persist anything whose parent/order changed.
    const orderById = new Map(reordered.map((item, idx) => [item.id, idx]));
    const changed: Array<{ id: string; parentId: string | null; orderValue: number }> = [];
    setProjectsCache((prev) =>
      prev.map((p) => {
        if (!orderById.has(p.id)) return p;
        const orderValue = orderById.get(p.id)!;
        const parentId = p.id === event.active.id ? proj.parentId : p.parentId;
        if (p.orderValue !== orderValue || p.parentId !== parentId) {
          changed.push({ id: p.id, parentId, orderValue });
        }
        return { ...p, orderValue, parentId };
      }),
    );

    Promise.all(
      changed.map((c) =>
        apiUpdateProject(c.id, { parentId: c.parentId, orderValue: c.orderValue }),
      ),
    ).catch(() => qc.invalidateQueries({ queryKey: ['projects'] }));
  };

  return (
    <div style={{ marginTop: '24px', flex: 1 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            lineHeight: '24px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-light)',
            fontWeight: 500,
          }}
        >
          Projects
        </span>
        <button
          type="button"
          aria-label="Add project"
          title="Add project"
          onClick={() => { setAdding(true); setNewName(''); }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-ink-light)',
            display: 'flex',
            alignItems: 'center',
            padding: 0,
          }}
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
            <SortableProjectRow
              key={item.id}
              item={item}
              depth={activeId === item.id && projection ? projection.depth : item.depth}
              isEditing={editingId === item.id}
              draft={draft}
              onNavigate={() => navigate(`/project/${item.id}`)}
              onStartRename={() => { setEditingId(item.id); setDraft(item.name); }}
              onDraftChange={setDraft}
              onCommitRename={() => handleRename(item.id, draft)}
              onCancelRename={() => setEditingId(null)}
              onAddSub={() => handleCreate(window.prompt('New sub-project name')?.trim() ?? '', item.id)}
              onDelete={() => handleDelete(item.id, item.name)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {adding && (
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={() => { handleCreate(newName, null); setAdding(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { handleCreate(newName, null); setAdding(false); }
            if (e.key === 'Escape') setAdding(false);
          }}
          placeholder="Project name…"
          style={{
            width: 'calc(100% - 24px)',
            margin: '0 12px',
            height: '24px',
            fontSize: '13px',
            fontFamily: '"Lora", serif',
            color: 'var(--color-ink)',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--color-dot)',
            outline: 'none',
          }}
        />
      )}

      {flat.length === 0 && !adding && (
        <div
          style={{
            fontSize: '12px',
            lineHeight: '24px',
            color: 'var(--color-ink-light)',
            padding: '0 12px',
            fontStyle: 'italic',
            opacity: 0.6,
          }}
        >
          No projects yet
        </div>
      )}
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

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        height: '24px',
        paddingLeft: `${12 + depth * INDENT}px`,
        paddingRight: '8px',
        fontSize: '13px',
        color: 'var(--color-ink)',
      }}
      className="project-row"
    >
      <span
        {...attributes}
        {...listeners}
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: projectColorHex(item.colorName),
          flexShrink: 0,
          cursor: 'grab',
        }}
        aria-label="Drag to reorder"
      />
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
          style={{
            flex: 1,
            height: '20px',
            fontSize: '13px',
            fontFamily: '"Lora", serif',
            color: 'var(--color-ink)',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--color-dot)',
            outline: 'none',
          }}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={onNavigate}
            onDoubleClick={onStartRename}
            style={{
              flex: 1,
              textAlign: 'left',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: '"Lora", serif',
              fontSize: '13px',
              color: 'var(--color-ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              padding: 0,
            }}
          >
            {item.name}
          </button>
          <button
            type="button"
            className="project-row__action"
            aria-label={`Add sub-project to ${item.name}`}
            title="Add sub-project"
            onClick={onAddSub}
            style={actionBtnStyle}
          >
            +
          </button>
          <button
            type="button"
            className="project-row__action"
            aria-label={`Delete ${item.name}`}
            title="Delete project"
            onClick={onDelete}
            style={actionBtnStyle}
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}

const actionBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-ink-light)',
  fontSize: '14px',
  lineHeight: 1,
  padding: '0 2px',
  flexShrink: 0,
};
