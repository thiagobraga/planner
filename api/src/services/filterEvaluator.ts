import type { FilterExpr } from '../parsers/filterParser.js';

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

function matches(expr: FilterExpr, task: EvalTask, ctx: EvalContext): boolean {
  switch (expr.type) {
    case 'and':
      return matches(expr.left, task, ctx) && matches(expr.right, task, ctx);
    case 'or':
      return matches(expr.left, task, ctx) || matches(expr.right, task, ctx);
    case 'not':
      return !matches(expr.expr, task, ctx);
    case 'collection':
      return task.collectionName === expr.name;
    case 'label':
      return task.labelNames.includes(expr.name);
    case 'priority':
      return task.priority === expr.level;
    case 'today':
      return task.dueDate === ctx.today;
    case 'overdue':
      return !!task.dueDate && task.dueDate < ctx.today;
    case 'noDate':
      return !task.dueDate;
    case 'dueOn':
      return task.dueDate === expr.date;
    case 'dueBefore':
      return !!task.dueDate && task.dueDate < expr.date;
    case 'dueAfter':
      return !!task.dueDate && task.dueDate > expr.date;
    case 'assignedTo':
      if (expr.user === 'me') return task.assigneeUser === ctx.currentUser;
      return task.assigneeUser === expr.user;
    case 'text': {
      const needle = expr.value.toLowerCase();
      return (
        task.title.toLowerCase().includes(needle) ||
        (task.description?.toLowerCase().includes(needle) ?? false)
      );
    }
  }
}

export function evaluateFilter(expr: FilterExpr, tasks: EvalTask[], ctx: EvalContext): EvalTask[] {
  return tasks.filter((t) => matches(expr, t, ctx));
}
