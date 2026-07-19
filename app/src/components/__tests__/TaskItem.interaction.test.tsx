import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { describe, it, expect, vi } from 'vitest';
import { TaskItem, type Task } from '../TaskItem';
import { NO_DRAG_ATTR, DRAG_HANDLE_ATTR } from '../dnd/sensors';

function renderRow(props: Partial<React.ComponentProps<typeof TaskItem>> = {}, task: Partial<Task> = {}) {
  const full: Task = {
    id: 't1',
    title: 'Write the thing',
    priority: 4,
    isCompleted: false,
    orderValue: 0,
    type: 'task',
    ...task,
  };
  return render(
    <DndContext>
      <SortableContext items={[full.id]}>
        <TaskItem task={full} {...props} />
      </SortableContext>
    </DndContext>,
  );
}

const row = () => screen.getByRole('button', { name: 'Write the thing' });

describe('TaskItem: click no longer selects', () => {
  it('does nothing on a single click', () => {
    const onStartEdit = vi.fn();
    renderRow({ onStartEdit });

    fireEvent.click(row());

    expect(onStartEdit).not.toHaveBeenCalled();
    // Selection is gone entirely, so no row ever reports itself as selected.
    expect(row()).not.toHaveAttribute('aria-selected');
    expect(row().className).not.toContain('task-item--selected');
  });

  it('opens inline editing on double-click', () => {
    const onStartEdit = vi.fn();
    renderRow({ onStartEdit });

    fireEvent.doubleClick(row());

    expect(onStartEdit).toHaveBeenCalledWith('t1');
  });

  it('does not open editing while already editing', () => {
    const onStartEdit = vi.fn();
    renderRow({ onStartEdit, isEditing: true });

    // The row is not exposed as a button while its input is live.
    fireEvent.doubleClick(screen.getByRole('textbox'));

    expect(onStartEdit).not.toHaveBeenCalled();
  });
});

describe('TaskItem: toggle stays isolated', () => {
  it('toggles completion without starting an edit', () => {
    const onToggle = vi.fn();
    const onStartEdit = vi.fn();
    renderRow({ onToggle, onStartEdit });

    const toggle = screen.getByRole('button', { name: 'Complete: Write the thing' });
    fireEvent.click(toggle);
    fireEvent.doubleClick(toggle);

    expect(onToggle).toHaveBeenCalledWith('t1');
    expect(onStartEdit).not.toHaveBeenCalled();
  });
});

describe('TaskItem: drag surfaces', () => {
  it('marks the toggle as non-draggable so its press is not swallowed', () => {
    renderRow();
    const toggle = screen.getByRole('button', { name: 'Complete: Write the thing' });
    expect(toggle.closest(`[${NO_DRAG_ATTR}]`)).not.toBeNull();
  });

  it('marks the edit input as non-draggable', () => {
    renderRow({ isEditing: true });
    expect(screen.getByRole('textbox').closest(`[${NO_DRAG_ATTR}]`)).not.toBeNull();
  });

  it('leaves the row itself draggable', () => {
    renderRow();
    expect(row().closest(`[${NO_DRAG_ATTR}]`)).toBeNull();
  });

  it('exposes a named, focusable drag handle for keyboard dragging', () => {
    renderRow();
    const handle = screen.getByRole('button', { name: 'Reorder Write the thing' });
    expect(handle).toHaveAttribute(DRAG_HANDLE_ATTR);
    expect(handle).toHaveAttribute('tabIndex', '0');
  });
});

describe('TaskItem: projected depth', () => {
  it('renders at its stored indent when not dragging', () => {
    renderRow({}, { indent: 2 });
    expect(row().style.paddingLeft).toBe('48px');
  });

  it('renders at the projected depth instead, previewing where it will land', () => {
    renderRow({ projectedDepth: 1 }, { indent: 3 });
    expect(row().style.paddingLeft).toBe('24px');
  });

  it('treats a projected depth of 0 as top level rather than falling back', () => {
    renderRow({ projectedDepth: 0 }, { indent: 4 });
    expect(row().style.paddingLeft).toBe('0px');
  });
});

describe('TaskItem: collection badge', () => {
  it('renders a badge beside the title when one is supplied', () => {
    renderRow({ collectionBadge: <span>music</span> });
    expect(screen.getByText('music')).toBeInTheDocument();
  });

  it('renders no badge when none is supplied', () => {
    const { container } = renderRow();
    expect(container.querySelector('.task-item-collection')).toBeNull();
  });
});
