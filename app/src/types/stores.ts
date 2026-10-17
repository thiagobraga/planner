/** Store domain types — extracted from Zustand stores and optimistic update helpers.
 * Importers rewrite `import type { X } from '../store'` etc. to `import type { X } from '../types/stores'`.
 */

import type { OptimisticOp, RunOptimisticOptions } from '../stores/optimistic';

export type { OptimisticOp, RunOptimisticOptions };