import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { StoreSection, Task } from './task';

type Setter<T> = Dispatch<SetStateAction<T>>;

export interface InboxTaskRowsOptions {
  tasks: Task[];
  tasksRef: MutableRefObject<Task[]>;
  setTasks: Setter<Task[]>;
  setEditingId: Setter<string | undefined>;
  setSelectedId: Setter<string | undefined>;
  setIndentError: Setter<boolean>;
  invalidate: () => Promise<void>;
  locale: 'en' | 'pt-BR';
  hideCompletedTasks: boolean;
  includeCompleted: boolean;
}

export interface InboxAddOptions {
  input: string;
  setInput: Setter<string>;
  setSectionTaskInput: Setter<Record<string, string>>;
  setTasks: Setter<Task[]>;
  setEditingId: Setter<string | undefined>;
  invalidate: () => Promise<void>;
  locale: 'en' | 'pt-BR';
}

export interface InboxDeletingSection {
  id: string;
  name: string;
  taskCount: number;
}

export interface InboxSectionMenu {
  sectionId: string;
  position: { x: number; y: number };
}

export interface InboxSectionsOptions {
  inboxCollectionId: string | undefined;
  sections: StoreSection[];
  setSections: Setter<StoreSection[]>;
  tasks: Task[];
  setTasks: Setter<Task[]>;
  setEditingSectionId: Setter<string | null>;
  setSectionContextMenu: Setter<InboxSectionMenu | null>;
  deletingSection: InboxDeletingSection | null;
  setDeletingSection: Setter<InboxDeletingSection | null>;
  invalidate: () => Promise<void>;
}
