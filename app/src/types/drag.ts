// Metadata attached to every draggable and droppable in the Planner.
//
// A single shell-level DndContext handles tasks, habits, habit groups and
// collections, so lifecycle handlers dispatch on `kind` to decide what a drag
// means. Everything a handler needs to compute a move lives on the payload -
// handlers never reach back into component state to find it.

/** Discriminator for anything that can be picked up. */
export type DragKind = 'task' | 'habit' | 'habit-group' | 'collection';

/**
 * Discriminator for anything that can be dropped on.
 *
 * `habit-group` is the group *header* - a row a group drag reorders against.
 * `habit-section` is the region beneath it, which accepts habits. They are
 * separate kinds because they resolve differently: a header by closest-center
 * like any sortable row, a section by pointer intersection like any container.
 */
export type DropKind = 'task' | 'habit' | 'habit-group' | 'habit-section' | 'collection' | 'day';

/**
 * Which ordered list a task position refers to.
 *
 * A task can sit in two hand-sorted lists at once - its collection and its day -
 * and those orderings are independent (see migration 025). The scope says which
 * one a given position belongs to.
 */
export type TaskOrderScope =
  | { kind: 'collection'; collectionId: string }
  | { kind: 'day'; dueDate: string };

export interface TaskDragData {
  kind: 'task';
  taskId: string;
  /** Null at the top level. */
  parentTaskId: string | null;
  collectionId: string;
  /** ISO YYYY-MM-DD, or null for an undated task. */
  dueDate: string | null;
  /** 0-based nesting level; max 5. */
  depth: number;
  /** The list this row is currently rendered in - a collection list or one Daily date section. */
  containerId: string;
  /**
   * `[taskId, ...descendantIds]` in render order. Dragging a parent carries this
   * whole block, and a drop targeting any of these IDs is a cycle and must be
   * rejected.
   */
  subtreeIds: string[];
}

export interface RootHabitDragData {
  kind: 'habit';
  habitId: string;
  /** Root habits have no parent. */
  parentId: null;
  /** Null when ungrouped. */
  groupId: string | null;
  /** A habit that has children cannot itself become a sub-habit. */
  childIds: string[];
}

export interface SubHabitDragData {
  kind: 'habit';
  habitId: string;
  parentId: string;
  /** Always null: a sub-habit inherits its parent's group. */
  groupId: null;
  /** Always empty: the hierarchy is one level deep. */
  childIds: [];
}

export type HabitDragData = RootHabitDragData | SubHabitDragData;

export interface HabitGroupDragData {
  kind: 'habit-group';
  groupId: string;
}

/**
 * A habit section as a drop target: the ungrouped list, or the body of one
 * group. Dropping a habit here appends it as a root of that scope, which is how
 * an empty group can be filled at all.
 */
export interface HabitSectionDropData {
  kind: 'habit-section';
  /** Null for the ungrouped section, which holds roots but is not a group. */
  groupId: string | null;
}

export interface CollectionDragData {
  kind: 'collection';
  collectionId: string;
  parentId: string | null;
}

/**
 * A sidebar collection row as a drop target. Dropping a task here files it into
 * that collection while keeping its due date, so a dated task stays on its day
 * and simply gains a collection.
 */
export interface CollectionDropData {
  kind: 'collection';
  collectionId: string;
  /** The Inbox is a collection too, but renders as its own nav item. */
  isInbox: boolean;
  /** Null for a root collection. */
  parentId: string | null;
}

/** One rendered Daily date section. Only rendered dates are valid targets. */
export interface DayDropData {
  kind: 'day';
  /** ISO YYYY-MM-DD. */
  date: string;
  containerId: string;
}

export type DragData =
  | TaskDragData
  | HabitDragData
  | HabitGroupDragData
  | CollectionDragData;

export type DropData =
  | TaskDragData
  | HabitDragData
  | HabitGroupDragData
  | HabitSectionDropData
  | CollectionDropData
  | DayDropData;

export function isTaskDrag(data: DragData | undefined): data is TaskDragData {
  return data?.kind === 'task';
}

export function isHabitDrag(data: DragData | undefined): data is HabitDragData {
  return data?.kind === 'habit';
}

export function isHabitGroupDrag(data: DragData | undefined): data is HabitGroupDragData {
  return data?.kind === 'habit-group';
}

export function isCollectionDrag(data: DragData | undefined): data is CollectionDragData {
  return data?.kind === 'collection';
}

/** A root habit is the only habit that can carry children or hold a group. */
export function isRootHabit(data: HabitDragData): data is RootHabitDragData {
  return data.parentId === null;
}
