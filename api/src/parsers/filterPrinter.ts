import type { FilterExpr } from './filterParser.js';

// Precedence: text/atom > not > and > or
function precedence(e: FilterExpr): number {
  switch (e.type) {
    case 'or': return 1;
    case 'and': return 2;
    case 'not': return 3;
    default: return 4;
  }
}

function escapeQuoted(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function printBinary(parent: FilterExpr, opSymbol: string, left: FilterExpr, right: FilterExpr): string {
  const parentPrec = precedence(parent);
  const leftStr = precedence(left) < parentPrec ? `(${printFilter(left)})` : printFilter(left);
  const rightStr = precedence(right) <= parentPrec ? `(${printFilter(right)})` : printFilter(right);
  return `${leftStr} ${opSymbol} ${rightStr}`;
}

export function printFilter(e: FilterExpr): string {
  switch (e.type) {
    case 'or':
      return printBinary(e, '|', e.left, e.right);
    case 'and':
      return printBinary(e, '&', e.left, e.right);
    case 'not': {
      const inner = e.expr;
      const innerStr = precedence(inner) < precedence(e) ? `(${printFilter(inner)})` : printFilter(inner);
      return `!${innerStr}`;
    }
    case 'project':
      return `#${e.name}`;
    case 'label':
      return `@${e.name}`;
    case 'priority':
      return `p${e.level}`;
    case 'today':
      return 'today';
    case 'overdue':
      return 'overdue';
    case 'noDate':
      return 'no date';
    case 'dueOn':
      return `due: ${e.date}`;
    case 'dueBefore':
      return `due before: ${e.date}`;
    case 'dueAfter':
      return `due after: ${e.date}`;
    case 'assignedTo':
      return `assigned to: ${e.user}`;
    case 'text':
      return `"${escapeQuoted(e.value)}"`;
  }
}
