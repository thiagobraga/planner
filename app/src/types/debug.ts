export interface DebugCardProps {
  id: string;
  orderValue: number;
  createdAt?: string;
  /** Nesting depth; 0 for a root item. */
  level?: number;
  parentId?: string | null;
}
