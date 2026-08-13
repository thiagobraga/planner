import { useState, useCallback, useRef } from 'react';
import type { ApiTask } from '../api/client';
import { apiReorganizeTasks, type ReorganizeMove } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';

type ReorganizeState = 'idle' | 'preview' | 'persisting';

export interface Section {
  date: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: any[];
}

interface ReorganizePreview {
  moves: ReorganizeMove[];
  sections: Section[];
}

export interface UseReorganizeReturn {
  showButton: boolean;
  state: ReorganizeState;
  startPreview: () => void;
  confirmReorganize: () => Promise<void>;
  cancelReorganize: () => void;
  previewSections: Section[] | null;
}

// Generate YYYY-MM-DD from date
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Parse YYYY-MM-DD to Date
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Get date label (Today, Tomorrow, or relative)
function getDateLabel(dateStr: string, todayStr: string, t?: (key: string) => string): string {
  const today = parseDate(todayStr);
  const date = parseDate(dateStr);

  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';

  if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
  return `in ${diffDays} days`;
}

export function useReorganize(
  todayDate: string,
  sections: Section[] | null,
  onPreview?: () => void,
  onRevert?: () => void,
): UseReorganizeReturn {
  const [state, setState] = useState<ReorganizeState>('idle');
  const [previewData, setPreviewData] = useState<ReorganizePreview | null>(null);
  const savedSectionsRef = useRef<Section[] | null>(null);
  const queryClient = useQueryClient();

  // Calculate if reorganize button should show: ≥8 uncompleted root tasks in today + overdue
  const showButton = useCallback(() => {
    if (!sections) return false;

    let rootTaskCount = 0;
    for (const section of sections) {
      // Only count today and past dates
      if (section.date > todayDate) break;

      for (const task of section.tasks) {
        // Count only root tasks (no parentTaskId) of type 'task'
        if (!task.parentTaskId && task.type === 'task') {
          rootTaskCount++;
        }
      }
    }

    return rootTaskCount >= 8;
  }, [sections, todayDate]);

  const startPreview = useCallback(() => {
    if (!sections) return;

    // Save original sections
    savedSectionsRef.current = JSON.parse(JSON.stringify(sections));

    // Collect root tasks from today + overdue sections
    const tasksToRedistribute: (ApiTask & { originalIndex: number; sectionIndex: number })[] = [];

    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
      const section = sections[sectionIndex];

      // Stop at future dates
      if (section.date > todayDate) break;

      for (let taskIndex = 0; taskIndex < section.tasks.length; taskIndex++) {
        const task = section.tasks[taskIndex];

        // Only root tasks of type 'task'
        if (!task.parentTaskId && task.type === 'task' && !task.isCompleted) {
          tasksToRedistribute.push({
            ...task,
            originalIndex: taskIndex,
            sectionIndex,
          });
        }
      }
    }

    // Redistribute: ≤5 tasks per day starting from today
    const moves: ReorganizeMove[] = [];
    const previewSections: Section[] = JSON.parse(JSON.stringify(sections));

    let dayOffset = 0;
    let taskCountInCurrentDay = 0;

    for (const task of tasksToRedistribute) {
      // Increment day every 5 tasks
      if (taskCountInCurrentDay >= 5) {
        dayOffset++;
        taskCountInCurrentDay = 0;
      }

      const targetDate = new Date(parseDate(todayDate));
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const newDueDate = formatDate(targetDate);

      // Record move only if date actually changed
      if (task.dueDate !== newDueDate) {
        moves.push({
          taskId: task.id,
          dueDate: newDueDate,
        });
      }

      // Update preview sections: remove from old, add to new
      // First, remove from original section
      const originalSection = previewSections[task.sectionIndex];
      originalSection.tasks.splice(task.originalIndex, 1);

      // Find or create target section in preview
      let targetSectionIndex = previewSections.findIndex((s) => s.date === newDueDate);
      if (targetSectionIndex === -1) {
        // Create new section
        const newSection: Section = {
          date: newDueDate,
          label: getDateLabel(newDueDate, todayDate),
          tasks: [],
        };

        // Insert in chronological order
        targetSectionIndex = 0;
        for (let i = 0; i < previewSections.length; i++) {
          if (previewSections[i].date < newDueDate) {
            targetSectionIndex = i + 1;
          } else {
            break;
          }
        }
        previewSections.splice(targetSectionIndex, 0, newSection);
      }

      // Add task to target section
      previewSections[targetSectionIndex].tasks.push({
        ...task,
        dueDate: newDueDate,
      });

      taskCountInCurrentDay++;
    }

    setPreviewData({ moves, sections: previewSections });
    setState('preview');

    onPreview?.();
  }, [sections, todayDate, onPreview]);

  const confirmReorganize = useCallback(async () => {
    if (!previewData || state !== 'preview') return;

    setState('persisting');

    try {
      await apiReorganizeTasks(previewData.moves);

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['todayTasks'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingTasks'] });

      setState('idle');
      setPreviewData(null);
      savedSectionsRef.current = null;
    } catch (err) {
      // On error, revert to preview state so user can retry or cancel
      setState('preview');
      throw err;
    }
  }, [previewData, state, queryClient]);

  const cancelReorganize = useCallback(() => {
    setState('idle');
    setPreviewData(null);

    if (savedSectionsRef.current) {
      onRevert?.();
      savedSectionsRef.current = null;
    }
  }, [onRevert]);

  return {
    showButton: showButton(),
    state,
    startPreview,
    confirmReorganize,
    cancelReorganize,
    previewSections: previewData?.sections ?? null,
  };
}
