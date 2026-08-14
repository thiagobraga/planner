import { useState, useCallback, useRef } from 'react';
import type { ApiTask } from '../api/client';
import { apiReorganizeTasks, type ReorganizeMove } from '../api/client';

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
function getDateLabel(dateStr: string, todayStr: string): string {
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
  formatLabel?: (dateStr: string) => string,
  onConfirmed?: () => void,
): UseReorganizeReturn {
  const [state, setState] = useState<ReorganizeState>('idle');
  const [previewData, setPreviewData] = useState<ReorganizePreview | null>(null);
  const savedSectionsRef = useRef<Section[] | null>(null);

  // Calculate if reorganize button should show: ≥8 uncompleted root tasks in today + overdue
  const showButton = useCallback(() => {
    if (!sections) return false;

    let rootTaskCount = 0;
    for (const section of sections) {
      // Only count today and past dates
      if (section.date > todayDate) break;

      for (const task of section.tasks) {
        // Count only uncompleted root tasks (no parentTaskId) of type 'task'
        if (!task.parentTaskId && task.type === 'task' && !task.isCompleted) {
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

    // Collect root tasks from today + overdue sections, in display order
    const tasksToRedistribute: ApiTask[] = [];
    for (const section of sections) {
      if (section.date > todayDate) break; // stop at future dates
      for (const task of section.tasks) {
        if (!task.parentTaskId && task.type === 'task' && !task.isCompleted) {
          tasksToRedistribute.push(task);
        }
      }
    }

    // Assign each candidate task a target date: ≤5 tasks per day starting from today
    const assignments = new Map<string, { newDueDate: string; moved: boolean }>();
    const moves: ReorganizeMove[] = [];
    let dayOffset = 0;
    let taskCountInCurrentDay = 0;

    for (const task of tasksToRedistribute) {
      if (taskCountInCurrentDay >= 5) {
        dayOffset++;
        taskCountInCurrentDay = 0;
      }

      const targetDate = new Date(parseDate(todayDate));
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const newDueDate = formatDate(targetDate);
      const moved = task.dueDate !== newDueDate;

      assignments.set(task.id, { newDueDate, moved });
      if (moved) moves.push({ taskId: task.id, dueDate: newDueDate });

      taskCountInCurrentDay++;
    }

    // Rebuild sections from scratch: never mutate/splice the original arrays by
    // index, since that index goes stale as sibling tasks are removed from the
    // same section — filter/regroup fresh instead.
    const bucketsByDate = new Map<string, Section['tasks']>();
    const ensureBucket = (date: string) => {
      let bucket = bucketsByDate.get(date);
      if (!bucket) {
        bucket = [];
        bucketsByDate.set(date, bucket);
      }
      return bucket;
    };

    for (const section of sections) {
      const bucket = ensureBucket(section.date);
      for (const task of section.tasks) {
        const assignment = assignments.get(task.id);
        if (!assignment) {
          bucket.push(task); // untouched: completed, subtask, note, or future
        }
      }
    }

    for (const task of tasksToRedistribute) {
      const assignment = assignments.get(task.id);
      if (!assignment) continue;
      const bucket = ensureBucket(assignment.newDueDate);
      bucket.push({ ...task, dueDate: assignment.newDueDate, moved: assignment.moved });
    }

    const previewSections: Section[] = Array.from(bucketsByDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, tasks]) => {
        const original = sections.find((s) => s.date === date);
        const label = original?.label ?? formatLabel?.(date) ?? getDateLabel(date, todayDate);
        return { date, label, tasks };
      });

    setPreviewData({ moves, sections: previewSections });
    setState('preview');

    onPreview?.();
  }, [sections, todayDate, onPreview, formatLabel]);

  const confirmReorganize = useCallback(async () => {
    if (!previewData || state !== 'preview') return;

    setState('persisting');

    try {
      await apiReorganizeTasks(previewData.moves);

      setState('idle');
      setPreviewData(null);
      savedSectionsRef.current = null;
      onConfirmed?.();
    } catch (err) {
      // On error, revert to preview state so user can retry or cancel
      setState('preview');
      throw err;
    }
  }, [previewData, state, onConfirmed]);

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
