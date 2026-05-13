import { TaskItem } from '../components/TaskItem';

const overdueTasks = [
  { id: '1', title: 'Submit expense report', priority: 1, dueDate: 'yesterday' },
];

const todayTasks = [
  { id: '2', title: 'Morning standup', priority: 2, dueDate: '9:00 am' },
  { id: '3', title: 'Code review for auth module', priority: 2, dueDate: '2:00 pm' },
  { id: '4', title: 'Prepare presentation slides', priority: 3 },
];

export function TodayPage() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div style={{ maxWidth: '600px' }}>
      <h1
        style={{
          fontFamily: '"Lora", serif',
          fontSize: '24px',
          lineHeight: '48px',
          height: '48px',
          fontWeight: 600,
          color: 'var(--color-ink)',
          margin: 0,
        }}
      >
        Today
      </h1>
      <p
        style={{
          fontSize: '13px',
          lineHeight: '24px',
          height: '24px',
          color: 'var(--color-ink-light)',
          margin: 0,
        }}
      >
        {today}
      </p>

      {/* Overdue section */}
      {overdueTasks.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h2
            style={{
              fontSize: '10px',
              lineHeight: '24px',
              height: '24px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
              margin: 0,
              fontWeight: 500,
            }}
          >
            Overdue
          </h2>
          {overdueTasks.map((task) => (
            <TaskItem key={task.id} title={task.title} priority={task.priority} dueDate={task.dueDate} />
          ))}
        </div>
      )}

      {/* Today section */}
      <div style={{ marginTop: '24px' }}>
        <h2
          style={{
            fontSize: '10px',
            lineHeight: '24px',
            height: '24px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-light)',
            margin: 0,
            fontWeight: 500,
          }}
        >
          Today
        </h2>
        {todayTasks.map((task) => (
          <TaskItem key={task.id} title={task.title} priority={task.priority} dueDate={task.dueDate} />
        ))}
      </div>
    </div>
  );
}
