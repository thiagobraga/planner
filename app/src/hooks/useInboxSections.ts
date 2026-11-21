import { useCallback } from 'react';
import { apiCreateSection, apiDeleteSection, apiDeleteTask, apiUpdateSection } from '../api/client';
import type { InboxSectionsOptions } from '../types/inbox';
import { tempId } from './useInboxTaskRows';

/** Inbox section create, rename, delete (with or without its tasks). */
export function useInboxSections({
  inboxCollectionId, sections, setSections, tasks, setTasks, setEditingSectionId, setSectionContextMenu,
  deletingSection, setDeletingSection, invalidate }: InboxSectionsOptions) {
  const handleSectionRightClick = useCallback((sectionId: string, position: { x: number; y: number }) => {
    setSectionContextMenu({ sectionId, position });
  }, [setSectionContextMenu]);

  const handleAddSection = useCallback(() => {
    if (!inboxCollectionId) return;
    const sectionId = tempId();
    setSections((prev) => [
      ...prev,
      { id: sectionId, name: '', collectionId: inboxCollectionId, orderValue: prev.length * 1000 },
    ]);
    setEditingSectionId(sectionId);
  }, [inboxCollectionId, setEditingSectionId, setSections]);

  const handleDeleteSection = useCallback((sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId)!;
    const taskCount = tasks.filter((t) => t.sectionId === sectionId).length;
    setDeletingSection({ id: sectionId, name: section.name, taskCount });
  }, [sections, tasks, setDeletingSection]);

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
        apiCreateSection(inboxCollectionId!, { name: trimmed })
          .then((created) => {
            setSections((prev) =>
              prev.map((s) => (s.id === sectionId ? created : s))
            );
          })
          .catch(() => {
            setSections((prev) => prev.filter((s) => s.id !== sectionId));
          });
      } else {
        apiUpdateSection(sectionId, { name: trimmed }).catch(() => { });
      }
    },
    [handleDeleteSection, inboxCollectionId, setEditingSectionId, setSections]
  );

  const handleCancelSectionEdit = useCallback((sectionId: string) => {
    setEditingSectionId(null);
    if (sectionId.startsWith('temp-')) {
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
    }
  }, [setEditingSectionId, setSections]);

  const handleConfirmDeleteSectionAndTasks = useCallback(() => {
    const { id: sectionId } = deletingSection!;
    const taskIds = tasks.filter((t) => t.sectionId === sectionId).map((t) => t.id);
    setDeletingSection(null);
    setTasks((prev) => prev.filter((t) => t.sectionId !== sectionId));
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    Promise.all(taskIds.map((taskId) => apiDeleteTask(taskId)))
      .then(() => apiDeleteSection(sectionId))
      .catch(() => invalidate());
  }, [deletingSection, tasks, invalidate, setDeletingSection, setSections, setTasks]);

  const handleConfirmMoveTasksToTopLevel = useCallback(() => {
    const { id: sectionId } = deletingSection!;
    setDeletingSection(null);
    setTasks((prev) => prev.map((t) => (t.sectionId === sectionId ? { ...t, sectionId: undefined } : t)));
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    apiDeleteSection(sectionId).catch(() => invalidate());
  }, [deletingSection, invalidate, setDeletingSection, setSections, setTasks]);

  return {
    handleSectionRightClick, handleAddSection, handleDeleteSection, handleCommitSectionName,
    handleCancelSectionEdit, handleConfirmDeleteSectionAndTasks, handleConfirmMoveTasksToTopLevel };
}
