import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { apiCreateSection, apiDeleteSection, apiDeleteTask, apiUpdateSection } from '../api/client';
import type {
  DeletingSectionState,
  SectionContextMenuState,
  SectionGroup,
} from '../types/collections';
import type { StoreSection, Task } from '../types/task';

let sectionTempCounter = 0;
function tempSectionId() {
  return `temp-sec-${++sectionTempCounter}`;
}

export function buildSectionGroups(tasks: Task[], sections: StoreSection[]): SectionGroup[] {
  const groups: SectionGroup[] = [];

  // Top-level tasks (sectionId-less)
  groups.push({
    section: null,
    tasks: tasks.filter((t) => !t.sectionId),
  });

  // One group per section, ordered by orderValue
  for (const section of [...sections].sort((a, b) => a.orderValue - b.orderValue)) {
    groups.push({
      section,
      tasks: tasks.filter((t) => t.sectionId === section.id),
    });
  }

  return groups;
}

export function useCollectionSections(opts: {
  id: string;
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  sections: StoreSection[];
  setSections: Dispatch<SetStateAction<StoreSection[]>>;
  invalidate: () => Promise<void>;
}) {
  const { id, tasks, setTasks, sections, setSections, invalidate } = opts;

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionContextMenu, setSectionContextMenu] = useState<SectionContextMenuState | null>(null);
  const [deletingSection, setDeletingSection] = useState<DeletingSectionState | null>(null);

  const handleSectionRightClick = useCallback((sectionId: string, position: { x: number; y: number }) => {
    setSectionContextMenu({ sectionId, position });
  }, []);

  const handleAddSection = useCallback(() => {
    const sectionId = tempSectionId();
    setSections((prev) => [
      ...prev,
      { id: sectionId, name: '', collectionId: id, orderValue: prev.length * 1000 },
    ]);
    setEditingSectionId(sectionId);
  }, [id, setSections]);

  const handleDeleteSection = useCallback(
    (sectionId: string) => {
      const section = sections.find((s) => s.id === sectionId);
      if (!section) return;
      const taskCount = tasks.filter((t) => t.sectionId === sectionId).length;
      setDeletingSection({ id: sectionId, name: section.name, taskCount });
    },
    [sections, tasks],
  );

  const handleCommitSectionName = useCallback(
    (sectionId: string, name: string) => {
      const trimmed = name.trim();
      setEditingSectionId(null);
      if (!trimmed) {
        if (sectionId.startsWith('temp-')) {
          setSections((prev) => prev.filter((s) => s.id !== sectionId));
        } else {
          handleDeleteSection(sectionId);
        }
        return;
      }
      setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, name: trimmed } : s)));
      if (sectionId.startsWith('temp-')) {
        apiCreateSection(id, { name: trimmed })
          .then((created) => {
            setSections((prev) => prev.map((s) => (s.id === sectionId ? created : s)));
          })
          .catch(() => {
            setSections((prev) => prev.filter((s) => s.id !== sectionId));
          });
      } else {
        apiUpdateSection(sectionId, { name: trimmed }).catch(() => {});
      }
    },
    [handleDeleteSection, id, setSections],
  );

  const handleCancelSectionEdit = useCallback(
    (sectionId: string) => {
      setEditingSectionId(null);
      if (sectionId.startsWith('temp-')) {
        setSections((prev) => prev.filter((s) => s.id !== sectionId));
      }
    },
    [setSections],
  );

  const handleConfirmDeleteSectionAndTasks = useCallback(() => {
    if (!deletingSection) return;
    const { id: sectionId } = deletingSection;
    const taskIds = tasks.filter((t) => t.sectionId === sectionId).map((t) => t.id);
    setDeletingSection(null);
    setTasks((prev) => prev.filter((t) => t.sectionId !== sectionId));
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    Promise.all(taskIds.map((taskId) => apiDeleteTask(taskId)))
      .then(() => apiDeleteSection(sectionId))
      .catch(() => invalidate());
  }, [deletingSection, invalidate, setSections, setTasks, tasks]);

  const handleConfirmMoveTasksToTopLevel = useCallback(() => {
    if (!deletingSection) return;
    const { id: sectionId } = deletingSection;
    setDeletingSection(null);
    setTasks((prev) => prev.map((t) => (t.sectionId === sectionId ? { ...t, sectionId: undefined } : t)));
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    apiDeleteSection(sectionId).catch(() => invalidate());
  }, [deletingSection, invalidate, setSections, setTasks]);

  // A section being named for the first time renders as an inline input in the
  // "+ New section" row itself, rather than up in the grouped list, so the
  // input appears exactly where the user clicked.
  const addingSection = sections.find((s) => s.id.startsWith('temp-'));
  const [topLevelGroup, ...sectionGroups] = buildSectionGroups(
    tasks,
    sections.filter((s) => !s.id.startsWith('temp-')),
  );

  return {
    editingSectionId,
    setEditingSectionId,
    sectionContextMenu,
    setSectionContextMenu,
    deletingSection,
    setDeletingSection,
    addingSection,
    topLevelGroup,
    sectionGroups,
    handleSectionRightClick,
    handleAddSection,
    handleDeleteSection,
    handleCommitSectionName,
    handleCancelSectionEdit,
    handleConfirmDeleteSectionAndTasks,
    handleConfirmMoveTasksToTopLevel,
  };
}
