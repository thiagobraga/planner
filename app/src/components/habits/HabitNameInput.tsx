import { useEffect, useRef } from 'react';
import { NO_DRAG_ATTR } from '../dnd/sensors';

interface HabitNameInputProps {
  defaultValue: string;
  placeholder?: string;
  className?: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

/**
 * Swap-to-input rename for a habit, sub-habit, group or Calendar card.
 *
 * Follows the task row pattern: Enter commits, Escape cancels, and blur commits
 * once. `committedRef` stops blur from firing a second commit after Enter has
 * already handled it.
 *
 * Marked non-draggable so that pressing into the field to place a caret edits
 * the name instead of picking the row up.
 */
export function HabitNameInput({
  defaultValue,
  placeholder,
  className = '',
  onCommit,
  onCancel,
}: HabitNameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  const commit = (value: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(value.trim());
  };

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={defaultValue}
      placeholder={placeholder}
      spellCheck={false}
      {...{ [NO_DRAG_ATTR]: '' }}
      className={`habit-timeline-row-name-input task-input min-w-0 flex-1 border-0 bg-transparent p-0 text-sm leading-6 text-ink outline-none ${className}`}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit(event.currentTarget.value);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          committedRef.current = true;
          onCancel();
        }
      }}
      onBlur={(event) => commit(event.currentTarget.value)}
    />
  );
}
