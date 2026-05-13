import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { TaskItem, type Task } from './TaskItem';

interface TaskListProps {
  tasks: Task[];
  selectedTaskId?: string;
  onTaskClick?: (id: string) => void;
  onTaskToggle?: (id: string) => void;
  onReorder?: (tasks: Task[]) => void;
}

export function TaskList({ tasks, selectedTaskId, onTaskClick, onTaskToggle, onReorder }: TaskListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    onReorder?.(arrayMove(tasks, oldIndex, newIndex));
  };

  if (tasks.length === 0) {
    return (
      <div
        style={{
          padding: '24px 0',
          fontSize: '13px',
          color: 'var(--color-ink-light)',
          fontStyle: 'italic',
          lineHeight: '24px',
        }}
      >
        No tasks here yet.
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          role="list"
          aria-label="task list"
          style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
        >
          {tasks.map((task) => (
            <div key={task.id} role="listitem">
              <TaskItem
                task={task}
                isSelected={task.id === selectedTaskId}
                onToggle={onTaskToggle}
                onClick={onTaskClick}
              />
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
