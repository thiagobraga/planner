const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const START_OFFSET = 4;

const MONTH_TASKS: Record<number, string[]> = {
  4: ['Rent'],
  8: ['Review goals'],
  13: ['Project check-in'],
  16: ['Weekly reset'],
  21: ['Send invoices'],
  28: ['Plan June'],
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface MonthlyCalendarSpecimenProps {
  compact?: boolean;
}

export function MonthlyCalendarSpecimen({ compact = false }: MonthlyCalendarSpecimenProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: '0',
        borderTop: '1px solid var(--color-dot)',
        borderLeft: '1px solid var(--color-dot)',
      }}
    >
      {WEEKDAYS.map((day) => (
        <div
          key={day}
          style={{
            height: '24px',
            lineHeight: '24px',
            padding: compact ? '0 4px' : '0 8px',
            fontSize: '10px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-light)',
            borderRight: '1px solid var(--color-dot)',
            borderBottom: '1px solid var(--color-dot)',
            fontWeight: 500,
          }}
        >
          {day}
        </div>
      ))}

      {Array.from({ length: START_OFFSET }).map((_, i) => (
        <div
          key={`blank-${i}`}
          style={{
            minHeight: compact ? '56px' : '72px',
            borderRight: '1px solid var(--color-dot)',
            borderBottom: '1px solid var(--color-dot)',
            background: 'rgba(255,255,255,0.18)',
          }}
        />
      ))}

      {DAYS.map((day) => {
        const tasks = MONTH_TASKS[day] ?? [];
        return (
          <div
            key={day}
            style={{
              minHeight: compact ? '56px' : '72px',
              padding: compact ? '4px' : '4px 8px',
              borderRight: '1px solid var(--color-dot)',
              borderBottom: '1px solid var(--color-dot)',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                lineHeight: '20px',
                color: 'var(--color-ink)',
                fontWeight: day === 16 ? 600 : 400,
              }}
            >
              {day}
            </div>
            {tasks.map((task) => (
              <div
                key={task}
                style={{
                  fontSize: '11px',
                  lineHeight: '18px',
                  color: 'var(--color-ink-light)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {task}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
