export interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  group_id: string | null;
  order_value: number;
  created_at: string;
}

export interface HabitGroupRow {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  order_value: number;
}

export interface Habit {
  id: string;
  name: string;
  parentId: string | null;
  groupId: string | null;
  orderValue: number;
  createdAt: string;
  completions: string[];
}

export interface HabitGroup {
  id: string;
  name: string;
  icon: string | null;
  orderValue: number;
}

export type HabitEntityType = "habit" | "habit_completion" | "habit_group";

export interface CreateHabitInput {
  name: string;
  parentId?: string | null;
  groupId?: string | null;
}

export interface UpdateHabitInput {
  name?: string;
  parentId?: string | null;
  groupId?: string | null;
  orderValue?: number;
}

export interface CompletionResult {
  habitId: string;
  date: string;
  isCompleted: boolean;
}

export interface UpdateHabitGroupInput {
  name?: string;
  icon?: string | null;
  orderValue?: number;
}

export interface MoveHabitInput {
  parentId: string | null;
  groupId: string | null;
  position: number;
}

export interface MoveHabitResult {
  moved: Habit[];
  reordered: Habit[];
}

export interface MoveHabitGroupInput {
  position: number;
}

export interface MoveHabitGroupResult {
  reordered: HabitGroup[];
}
