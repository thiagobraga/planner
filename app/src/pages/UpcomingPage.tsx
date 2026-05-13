import { TaskItem } from '../components/TaskItem';

function getUpcomingDays(count: number) {
  const days = [];
  const today = new Date();
  for (let i = 1; i <= count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      date: d,
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    });
  }
  return days;
}

const mockByDay: Record<number, { id: string; title: string; priority: number }[]> = {
  1: [{ id: '1', title: 'Team sync', priority: 2 }],
  2: [
    { id: '2', title: 'Deploy v0.2', priority: 1 },
    { id: '3', title: 'Write changelog', priority: 3 },
  ],
  4: [{ id: '4', title: 'Dentist appointment', priority: 4 }],
  7: [{ id: '5', title: 'Weekly review', priority: 2 }],
};

export function UpcomingPage() {
  const days = getUpcomingDays(7);

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
        Upcoming
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
        Next 7 days
      </p>

      <div style={{ marginTop: '24px' }}>
        {days.map((day, idx) => {
          const tasks = mockByDay[idx + 1] || [];
          return (
            <div key={idx}>
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
                {day.label}
              </h2>
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <TaskItem key={task.id} title={task.title} priority={task.priority} />
                ))
              ) : (
                <div
                  style={{
                    height: '24px',
                    lineHeight: '24px',
                    fontSize: '12px',
                    color: 'var(--color-ink-light)',
                    opacity: 0.4,
                    fontStyle: 'italic',
                  }}
                >
                  —
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
