import { useMemo } from 'react';
import { getPhrase } from '../utils/phrases';
import { MonthlyRows } from '../components/MonthlyRows';

export function MonthlyPage() {
  const phrase = useMemo(() => getPhrase('monthly'), []);

  return (
    <div style={{ maxWidth: '648px' }}>
      <h1
        style={{
          fontFamily: '"Lora", serif',
          fontSize: '18px',
          lineHeight: '24px',
          fontWeight: 600,
          color: 'var(--color-ink)',
          margin: 0,
        }}
      >
        Monthly
      </h1>
      <p
        style={{
          fontSize: '13px',
          lineHeight: '24px',
          color: 'var(--color-ink-light)',
          opacity: 0.6,
          margin: 0,
        }}
      >
        {phrase}
      </p>

      <div style={{ height: '24px' }} />

      <MonthlyRows />
    </div>
  );
}
