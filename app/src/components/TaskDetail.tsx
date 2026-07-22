import { useState, useEffect, useRef } from 'react';
import type { Task } from './TaskItem';

const PRIORITIES = [
  { value: 1, label: 'P1 - Critical' },
  { value: 2, label: 'P2 - High' },
  { value: 3, label: 'P3 - Medium' },
  { value: 4, label: 'P4 - Normal' },
];

// Tailwind classes for the selected-state border + background of each priority button.
const priorityBtnSelectedClasses: Record<number, string> = {
  1: 'border-accent bg-accent',
  2: 'border-priority-2 bg-priority-2',
  3: 'border-priority-3 bg-priority-3',
  4: 'border-ink-light bg-ink-light',
};

// Tailwind text-color class for the priority info label below the buttons.
const priorityTextClasses: Record<number, string> = {
  1: 'text-accent',
  2: 'text-priority-2',
  3: 'text-priority-3',
  4: 'text-ink-light',
};

interface Comment {
  id: string;
  text: string;
  createdAt: string;
}

interface TaskDetailProps {
  task: Task | null;
  onClose: () => void;
  onUpdate?: (id: string, updates: Partial<Task>) => void;
  onDelete?: (id: string) => void;
}

export function TaskDetail({ task, onClose, onUpdate, onDelete }: TaskDetailProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [recurrenceRule, setRecurrenceRule] = useState<object | null>(null);
  const [priority, setPriority] = useState(4);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [subtasks, setSubtasks] = useState<Array<{ id: string; title: string; isCompleted: boolean }>>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setDueDate(task.dueDate ?? '');
      setRecurrenceRule(task.recurrenceRule ?? null);
      setPriority(task.priority);
      setConfirmDelete(false);
    }
  }, [task?.id]);

  const handleTitleBlur = () => {
    if (task && title.trim() && title !== task.title) {
      onUpdate?.(task.id, { title: title.trim() });
    }
  };

  const handleDescBlur = () => {
    if (task && description !== task.description) {
      onUpdate?.(task.id, { description });
    }
  };

  const handleDueDateBlur = () => {
    if (task && dueDate !== task.dueDate) {
      onUpdate?.(task.id, { dueDate: dueDate || undefined });
    }
  };

  const handlePriorityChange = (p: number) => {
    setPriority(p);
    if (task) onUpdate?.(task.id, { priority: p });
  };

  const handleRecurrenceChange = (type: string) => {
    if (type === 'none') {
      setRecurrenceRule(null);
      if (task) onUpdate?.(task.id, { recurrenceRule: null });
    } else {
      const rule = { type, interval: 1 };
      setRecurrenceRule(rule);
      if (task) onUpdate?.(task.id, { recurrenceRule: rule });
    }
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    const t = newSubtask.trim();
    if (!t) return;
    setSubtasks((prev) => [...prev, { id: Date.now().toString(), title: t, isCompleted: false }]);
    setNewSubtask('');
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    const t = newComment.trim();
    if (!t) return;
    setComments((prev) => [
      ...prev,
      { id: Date.now().toString(), text: t, createdAt: new Date().toLocaleTimeString() },
    ]);
    setNewComment('');
  };

  const handleDeleteConfirm = () => {
    if (!task) return;
    if (confirmDelete) {
      onDelete?.(task.id);
      onClose();
    } else {
      setConfirmDelete(true);
    }
  };

  if (!task) return null;

  const priorityInfo = PRIORITIES.find((p) => p.value === priority)!;

  return (
    <aside
      aria-label="Task detail"
      className="w-[360px] min-w-[320px] h-full border-l border-dot bg-cream flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-dot shrink-0">
        <span className="text-[11px] tracking-[0.08em] uppercase text-ink-light">
          Task
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close task detail"
          className="bg-transparent border-0 text-ink-light cursor-pointer text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Title */}
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          aria-label="Task title"
          className="w-full text-lg leading-7 font-semibold text-ink bg-transparent border-0 border-b border-dot outline-none px-0 pt-0 pb-2 mb-5"
        />

        {/* Description */}
        <div className="mb-5">
          <label className="block text-[11px] tracking-[0.08em] uppercase text-ink-light mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescBlur}
            rows={3}
            placeholder="Add notes…"
            aria-label="Task description"
            className="w-full text-[13px] leading-5 text-ink bg-transparent border border-dot rounded outline-none p-2 resize-y"
          />
        </div>

        {/* Due date */}
        <div className="mb-5">
          <label
            htmlFor="task-due-date"
            className="block text-[11px] tracking-[0.08em] uppercase text-ink-light mb-1.5"
          >
            Due Date
          </label>
          <input
            id="task-due-date"
            type="text"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            onBlur={handleDueDateBlur}
            placeholder="e.g. today, tomorrow, 2025-12-31"
            aria-label="Due date"
            className="w-full text-[13px] leading-6 text-ink bg-transparent border border-dot rounded outline-none py-1 px-2"
          />
        </div>

        {/* Recurrence */}
        <div className="mb-5">
          <label
            htmlFor="task-recurrence"
            className="block text-[11px] tracking-[0.08em] uppercase text-ink-light mb-1.5"
          >
            Repeat
          </label>
          <select
            id="task-recurrence"
            value={(recurrenceRule as { type?: string } | null)?.type || 'none'}
            onChange={(e) => handleRecurrenceChange(e.target.value)}
            className="w-full text-[13px] leading-6 text-ink bg-transparent border border-dot rounded outline-none py-1 px-2"
          >
            <option value="none">None</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        {/* Priority */}
        <div className="mb-5">
          <div className="text-[11px] tracking-[0.08em] uppercase text-ink-light mb-1.5">
            Priority
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => handlePriorityChange(p.value)}
                aria-pressed={priority === p.value}
                className={`py-[3px] px-2.5 rounded border text-xs cursor-pointer transition-all duration-[120ms] ${priority === p.value
                    ? `${priorityBtnSelectedClasses[p.value]} text-white`
                    : 'border-dot bg-transparent text-ink'
                  }`}
              >
                {p.label.split(' ')[0]}
              </button>
            ))}
          </div>
          <div className={`mt-1.5 text-xs italic ${priorityTextClasses[priority]}`}>
            {priorityInfo.label}
          </div>
        </div>

        {/* Subtasks */}
        <div className="mb-5">
          <div className="text-[11px] tracking-[0.08em] uppercase text-ink-light mb-2">
            Subtasks ({subtasks.filter((s) => s.isCompleted).length}/{subtasks.length})
          </div>

          {subtasks.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center gap-2 py-1 border-b border-dot"
            >
              <input
                type="checkbox"
                checked={sub.isCompleted}
                onChange={() =>
                  setSubtasks((prev) =>
                    prev.map((s) => (s.id === sub.id ? { ...s, isCompleted: !s.isCompleted } : s)),
                  )
                }
                aria-label={`Subtask: ${sub.title}`}
                className="cursor-pointer accent-accent"
              />
              <span
                className={`text-[13px] flex-1 ${sub.isCompleted ? 'text-ink-light line-through' : 'text-ink'}`}
              >
                {sub.title}
              </span>
            </div>
          ))}

          <form onSubmit={handleAddSubtask} className="mt-1.5 flex gap-1.5">
            <input
              type="text"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              placeholder="Add subtask…"
              aria-label="New subtask"
              className="flex-1 text-[13px] leading-6 text-ink bg-transparent border border-dashed border-dot rounded outline-none py-[2px] px-2"
            />
            <button
              type="submit"
              disabled={!newSubtask.trim()}
              className={`py-[2px] px-2.5 bg-transparent border border-dot rounded text-xs text-ink-light ${newSubtask.trim() ? 'cursor-pointer' : 'cursor-default'}`}
            >
              +
            </button>
          </form>
        </div>

        {/* Comments */}
        <div className="mb-5">
          <div className="text-[11px] tracking-[0.08em] uppercase text-ink-light mb-2">
            Comments
          </div>

          {comments.map((c) => (
            <div
              key={c.id}
              className="py-2 px-2.5 bg-dot/30 rounded mb-1.5"
            >
              <div className="text-[13px] text-ink leading-5">
                {c.text}
              </div>
              <div className="text-[10px] text-ink-light mt-1 italic">
                {c.createdAt}
              </div>
            </div>
          ))}

          <form onSubmit={handleAddComment} className="flex flex-col gap-1.5">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment…"
              aria-label="New comment"
              rows={2}
              className="text-[13px] text-ink bg-transparent border border-dot rounded outline-none py-1.5 px-2 resize-y"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className={`self-end py-[3px] px-3 border-0 rounded text-xs ${newComment.trim() ? 'bg-ink text-cream cursor-pointer' : 'bg-dot text-ink-light cursor-default'}`}
            >
              Add comment
            </button>
          </form>
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t border-dot px-5 py-3 flex justify-end gap-2 shrink-0">
        <button
          type="button"
          onClick={handleDeleteConfirm}
          className={`py-1 px-3.5 bg-transparent border rounded text-xs cursor-pointer transition-all duration-[120ms] ${confirmDelete ? 'border-accent text-accent' : 'border-dot text-ink-light'}`}
        >
          {confirmDelete ? 'Confirm delete' : 'Delete'}
        </button>
      </div>
    </aside>
  );
}
