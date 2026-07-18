import type { ApiHabit, ApiHabitGroup } from '../api/client';

// A parent habit is never "half done" in the database - it has no completion rows
// at all. This is the derived state the UI renders in its place.
export type DayState = 'empty' | 'half' | 'full';

export interface HabitNode {
  id: string;
  name: string;
  parentId: string | null;
  groupId: string | null;
  orderValue: number;
  completions: Set<string>;
  children: HabitNode[];
}

export interface HabitGroupSection {
  group: ApiHabitGroup;
  habits: HabitNode[];
}

export interface HabitSections {
  ungrouped: HabitNode[];
  groups: HabitGroupSection[];
}

function toNode(habit: ApiHabit): HabitNode {
  return {
    id: habit.id,
    name: habit.name,
    parentId: habit.parentId,
    groupId: habit.groupId,
    orderValue: habit.orderValue,
    completions: new Set(habit.completions),
    children: [],
  };
}

function byOrder(a: HabitNode, b: HabitNode) {
  return a.orderValue - b.orderValue;
}

// Builds the one-level tree. A habit whose parentId points at something missing
// (deleted mid-session, or filtered out) is promoted to a root rather than dropped,
// so a habit can never silently vanish from the page.
export function buildHabitTree(habits: ApiHabit[]): HabitNode[] {
  const nodes = new Map<string, HabitNode>();
  for (const habit of habits) nodes.set(habit.id, toNode(habit));

  const roots: HabitNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent && parent.id !== node.id) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  for (const node of nodes.values()) node.children.sort(byOrder);
  return roots.sort(byOrder);
}

// Splits roots into the ungrouped list and one section per group, preserving
// group order. Groups with no habits still render, so a freshly created group
// is visible and can be filled.
export function buildHabitSections(habits: ApiHabit[], groups: ApiHabitGroup[]): HabitSections {
  const roots = buildHabitTree(habits);
  const known = new Set(groups.map((g) => g.id));

  const sections: HabitGroupSection[] = groups
    .slice()
    .sort((a, b) => a.orderValue - b.orderValue)
    .map((group) => ({ group, habits: [] as HabitNode[] }));
  const byGroupId = new Map(sections.map((s) => [s.group.id, s]));

  const ungrouped: HabitNode[] = [];
  for (const root of roots) {
    // A groupId pointing at a group we don't have falls back to ungrouped.
    if (root.groupId && known.has(root.groupId)) {
      byGroupId.get(root.groupId)!.habits.push(root);
    } else {
      ungrouped.push(root);
    }
  }

  return { ungrouped, groups: sections };
}

// A leaf is simply done or not. A parent reflects how many of its sub-habits are
// done: none, some, or all.
export function dayState(node: HabitNode, iso: string): DayState {
  if (node.children.length === 0) {
    return node.completions.has(iso) ? 'full' : 'empty';
  }

  let done = 0;
  for (const child of node.children) {
    if (child.completions.has(iso)) done++;
  }

  if (done === 0) return 'empty';
  return done === node.children.length ? 'full' : 'half';
}

// Clicking a parent drives every sub-habit to the same state: clear them all if
// they are already all done, otherwise complete the remaining ones.
export function parentToggleTarget(node: HabitNode, iso: string): boolean {
  return dayState(node, iso) !== 'full';
}

// Only leaves hold completions, so a parent click fans out to its children.
// Returns the habits whose stored state actually needs to change.
export function habitsToToggle(node: HabitNode, iso: string, target: boolean): HabitNode[] {
  if (node.children.length === 0) {
    return node.completions.has(iso) === target ? [] : [node];
  }
  return node.children.filter((child) => child.completions.has(iso) !== target);
}

// Flattens a node and its children into render order, for the timeline's flat row list.
export function flattenHabits(nodes: HabitNode[]): { node: HabitNode; depth: number }[] {
  const out: { node: HabitNode; depth: number }[] = [];
  for (const node of nodes) {
    out.push({ node, depth: 0 });
    for (const child of node.children) out.push({ node: child, depth: 1 });
  }
  return out;
}
