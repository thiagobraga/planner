import { Fragment } from 'react';
import { TaskList } from '../TaskList';
import type { StatusTaskListProps } from '../../types/board';

export function StatusTaskList({ groups, taskListProps, afterFirstGroup }: StatusTaskListProps) {
  return (
    <div className="status-task-groups">
      {groups.map((group, index) => (
        <Fragment key={group.id}>
        <section className="status-task-group">
          <header className="status-task-group-header">
            <span aria-hidden="true" style={{ backgroundColor: group.color }} />
            <h2>{group.title}</h2>
            {group.tasks.some((task) => !task.parentTaskId) && (
              <span>{group.tasks.filter((task) => !task.parentTaskId).length}</span>
            )}
          </header>
          <TaskList
            {...taskListProps}
            tasks={group.tasks}
            containerId={`status:${group.id}`}
          />
        </section>
        {index === 0 && afterFirstGroup}
        </Fragment>
      ))}
    </div>
  );
}
