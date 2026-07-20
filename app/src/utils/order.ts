/** The gap the server leaves between adjacent rows, so inserts rarely renumber. */
export const ORDER_STEP = 1000;

interface Ordered {
  orderValue: number;
}

/**
 * The order value for a row appended to the end of `rows`.
 *
 * Stored order values are gap-based - the server assigns `index * 1000` - so a
 * new row has to be placed past the largest one present. Counting the rows
 * instead produced a value like 5, which sorts *between* the existing 0 and
 * 1000: a task typed at the bottom of the list appeared near the top until the
 * server's answer arrived and moved it again.
 */
export function nextOrderValue(rows: readonly Ordered[]): number {
  if (rows.length === 0) return 0;
  const highest = rows.reduce((max, row) => Math.max(max, row.orderValue ?? 0), 0);
  return highest + ORDER_STEP;
}
