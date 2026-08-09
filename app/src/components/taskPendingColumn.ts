// The caret column an edit row should open at, set by whichever navigation
// action (ArrowUp/ArrowDown between rows) triggered the edit, and consumed
// once by the row that receives focus next.
let pendingCol: number | null = null;

export function setPendingColumn(col: number | null): void {
  pendingCol = col;
}

export function consumePendingColumn(): number | null {
  const c = pendingCol;
  pendingCol = null;
  return c;
}
