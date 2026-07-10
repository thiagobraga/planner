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
import { TaskItem, type Task, type TaskItemProps } from './TaskItem';

type TaskCallbacks = Pick<
  TaskItemProps,
  'onStartEdit' | 'onEditCommit' | 'onEditCancel' | 'onDelete' | 'onAddBelow' | 'onIndent' | 'onNavigate'
>;

interface TaskListProps extends TaskCallbacks {
  tasks: Task[];
  selectedTaskId?: string;
  editingId?: string;
  hideDueDate?: boolean;
  onTaskClick?: (id: string) => void;
  onTaskToggle?: (id: string) => void;
  onReorder?: (tasks: Task[]) => void;
}

export function TaskList({
  tasks,
  selectedTaskId,
  editingId,
  hideDueDate,
  onTaskClick,
  onTaskToggle,
  onReorder,
  onStartEdit,
  onEditCommit,
  onEditCancel,
  onDelete,
  onAddBelow,
  onIndent,
  onNavigate,
}: TaskListProps) {
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
    return null;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div
          role="list"
          aria-label="task list"
          className="flex flex-col gap-0"
        >
          {tasks.map((task) => (
            <div key={task.id} role="listitem">
              <TaskItem
                task={task}
                isSelected={task.id === selectedTaskId}
                isEditing={task.id === editingId}
                hideDueDate={hideDueDate}
                onToggle={onTaskToggle}
                onClick={onTaskClick}
                onStartEdit={onStartEdit}
                onEditCommit={onEditCommit}
                onEditCancel={onEditCancel}
                onDelete={onDelete}
                onAddBelow={onAddBelow}
                onIndent={onIndent}
                onNavigate={onNavigate}
              />
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
