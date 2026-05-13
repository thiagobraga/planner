import { useState, useEffect, useRef } from 'react';
import type { Task } from './TaskItem';

const PRIORITIES = [
  { value: 1, label: 'P1 — Critical', color: 'var(--color-accent)' },
  { value: 2, label: 'P2 — High', color: '#e67e22' },
  { value: 3, label: 'P3 — Medium', color: '#3498db' },
  { value: 4, label: 'P4 — Normal', color: 'var(--color-ink-light)' },
];

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
      style={{
        width: '360px',
        minWidth: '320px',
        height: '100%',
        borderLeft: '1px solid var(--color-dot)',
        background: 'var(--color-cream)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-dot)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '11px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-light)',
          }}
        >
          Task
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close task detail"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-ink-light)',
            cursor: 'pointer',
            fontSize: '20px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* Title */}
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          aria-label="Task title"
          style={{
            width: '100%',
            fontSize: '18px',
            lineHeight: '28px',
            fontFamily: '"Lora", serif',
            fontWeight: 600,
            color: 'var(--color-ink)',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--color-dot)',
            outline: 'none',
            padding: '0 0 8px 0',
            marginBottom: '20px',
            boxSizing: 'border-box',
          }}
        />

        {/* Description */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-light)',
              marginBottom: '6px',
            }}
          >
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescBlur}
            rows={3}
            placeholder="Add notes…"
            aria-label="Task description"
            style={{
              width: '100%',
              fontSize: '13px',
              lineHeight: '20px',
              fontFamily: '"Lora", serif',
              color: 'var(--color-ink)',
              background: 'transparent',
              border: '1px solid var(--color-dot)',
              borderRadius: '4px',
              outline: 'none',
              padding: '8px',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Due date */}
        <div style={{ marginBottom: '20px' }}>
          <label
            htmlFor="task-due-date"
            style={{
              display: 'block',
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-light)',
              marginBottom: '6px',
            }}
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
            style={{
              width: '100%',
              fontSize: '13px',
              lineHeight: '24px',
              fontFamily: '"Lora", serif',
              color: 'var(--color-ink)',
              background: 'transparent',
              border: '1px solid var(--color-dot)',
              borderRadius: '4px',
              outline: 'none',
              padding: '4px 8px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Priority */}
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-light)',
              marginBottom: '6px',
            }}
          >
            Priority
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => handlePriorityChange(p.value)}
                aria-pressed={priority === p.value}
                style={{
                  padding: '3px 10px',
                  borderRadius: '4px',
                  border: `1px solid ${priority === p.value ? p.color : 'var(--color-dot)'}`,
                  background: priority === p.value ? p.color : 'transparent',
                  color: priority === p.value ? 'white' : 'var(--color-ink)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 120ms',
                  fontFamily: '"Lora", serif',
                }}
              >
                {p.label.split(' ')[0]}
              </button>
            ))}
          </div>
          <div
            style={{
              marginTop: '6px',
              fontSize: '12px',
              color: priorityInfo.color,
              fontStyle: 'italic',
            }}
          >
            {priorityInfo.label}
          </div>
        </div>

        {/* Subtasks */}
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-light)',
              marginBottom: '8px',
            }}
          >
            Subtasks ({subtasks.filter((s) => s.isCompleted).length}/{subtasks.length})
          </div>

          {subtasks.map((sub) => (
            <div
              key={sub.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 0',
                borderBottom: '1px solid var(--color-dot)',
              }}
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
                style={{ cursor: 'pointer', accentColor: 'var(--color-accent)' }}
              />
              <span
                style={{
                  fontSize: '13px',
                  color: sub.isCompleted ? 'var(--color-ink-light)' : 'var(--color-ink)',
                  textDecoration: sub.isCompleted ? 'line-through' : 'none',
                  flex: 1,
                }}
              >
                {sub.title}
              </span>
            </div>
          ))}

          <form onSubmit={handleAddSubtask} style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              placeholder="Add subtask…"
              aria-label="New subtask"
              style={{
                flex: 1,
                fontSize: '13px',
                lineHeight: '24px',
                fontFamily: '"Lora", serif',
                color: 'var(--color-ink)',
                background: 'transparent',
                border: '1px dashed var(--color-dot)',
                borderRadius: '4px',
                outline: 'none',
                padding: '2px 8px',
              }}
            />
            <button
              type="submit"
              disabled={!newSubtask.trim()}
              style={{
                padding: '2px 10px',
                background: 'transparent',
                border: '1px solid var(--color-dot)',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: newSubtask.trim() ? 'pointer' : 'default',
                color: 'var(--color-ink-light)',
                fontFamily: '"Lora", serif',
              }}
            >
              +
            </button>
          </form>
        </div>

        {/* Comments */}
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-light)',
              marginBottom: '8px',
            }}
          >
            Comments
          </div>

          {comments.map((c) => (
            <div
              key={c.id}
              style={{
                padding: '8px 10px',
                background: 'rgba(212, 207, 199, 0.3)',
                borderRadius: '4px',
                marginBottom: '6px',
              }}
            >
              <div style={{ fontSize: '13px', color: 'var(--color-ink)', lineHeight: '20px' }}>
                {c.text}
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: 'var(--color-ink-light)',
                  marginTop: '4px',
                  fontStyle: 'italic',
                }}
              >
                {c.createdAt}
              </div>
            </div>
          ))}

          <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment…"
              aria-label="New comment"
              rows={2}
              style={{
                fontSize: '13px',
                fontFamily: '"Lora", serif',
                color: 'var(--color-ink)',
                background: 'transparent',
                border: '1px solid var(--color-dot)',
                borderRadius: '4px',
                outline: 'none',
                padding: '6px 8px',
                resize: 'vertical',
              }}
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              style={{
                alignSelf: 'flex-end',
                padding: '3px 12px',
                background: newComment.trim() ? 'var(--color-ink)' : 'var(--color-dot)',
                color: newComment.trim() ? 'var(--color-cream)' : 'var(--color-ink-light)',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: newComment.trim() ? 'pointer' : 'default',
                fontFamily: '"Lora", serif',
              }}
            >
              Add comment
            </button>
          </form>
        </div>
      </div>

      {/* Footer actions */}
      <div
        style={{
          borderTop: '1px solid var(--color-dot)',
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={handleDeleteConfirm}
          style={{
            padding: '4px 14px',
            background: 'transparent',
            border: `1px solid ${confirmDelete ? 'var(--color-accent)' : 'var(--color-dot)'}`,
            borderRadius: '4px',
            fontSize: '12px',
            color: confirmDelete ? 'var(--color-accent)' : 'var(--color-ink-light)',
            cursor: 'pointer',
            fontFamily: '"Lora", serif',
            transition: 'all 120ms',
          }}
        >
          {confirmDelete ? 'Confirm delete' : 'Delete'}
        </button>
      </div>
    </aside>
  );
}
