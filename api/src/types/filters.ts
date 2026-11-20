export type FilterExpr =
  | { type: 'and'; left: FilterExpr; right: FilterExpr }
  | { type: 'or'; left: FilterExpr; right: FilterExpr }
  | { type: 'not'; expr: FilterExpr }
  | { type: 'collection'; name: string }
  | { type: 'label'; name: string }
  | { type: 'priority'; level: 1 | 2 | 3 | 4 }
  | { type: 'today' }
  | { type: 'overdue' }
  | { type: 'noDate' }
  | { type: 'dueOn'; date: string }
  | { type: 'dueBefore'; date: string }
  | { type: 'dueAfter'; date: string }
  | { type: 'assignedTo'; user: string }
  | { type: 'text'; value: string };

export interface FilterParseError extends Error {
  position: number;
}

export interface FilterRow {
  id: string;
  user_id: string;
  name: string;
  query: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFilterInput {
  name: string;
  query: string;
}

export interface UpdateFilterInput {
  name?: string;
  query?: string;
}

export interface EvalTask {
  id: string;
  title: string;
  description?: string | null;
  collectionName: string;
  labelNames: string[];
  priority: 1 | 2 | 3 | 4;
  dueDate?: string | null;
  assigneeUser?: string | null;
  isCompleted: boolean;
}

export interface EvalContext {
  today: string;
  currentUser: string;
}
