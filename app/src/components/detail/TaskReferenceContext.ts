import { createContext, useContext } from 'react';
import type { TaskReferenceContextValue } from '../../types/detail';

const EMPTY: TaskReferenceContextValue = { items: new Map(), onToggle: () => {}, onOpen: () => {} };

/** Gives embedded task blocks the canonical subtree, so they never keep a copy of a title or completion. */
export const TaskReferenceContext = createContext<TaskReferenceContextValue>(EMPTY);

export function useTaskReferences(): TaskReferenceContextValue {
  return useContext(TaskReferenceContext);
}
