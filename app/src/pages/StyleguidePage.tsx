import { ChevronRight, Repeat2 } from 'lucide-react';
import { BjTask, MonthlyIcon } from '../components/Sidebar';
import { MonthlyCalendarSpecimen } from '../components/MonthlyCalendarSpecimen';
import { MonthlyRows } from '../components/MonthlyRows';

const ICONS = [
  { label: 'Daily', Icon: BjTask },
  { label: 'Inbox', Icon: ChevronRight },
  { label: 'Monthly', Icon: MonthlyIcon },
  { label: 'Habits', Icon: Repeat2 },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: '32px' }}>
      <h2
        style={{
          fontFamily: '"Lora", serif',
          fontSize: '16px',
          lineHeight: '24px',
          fontWeight: 600,
          color: 'var(--color-ink)',
          margin: 0,
        }}
      >
        {title}
      </h2>
      <div style={{ height: '12px' }} />
      {children}
    </section>
  );
}

export function StyleguidePage() {
  return (
    <div style={{ maxWidth: '760px' }}>
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
        Styleguide
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
        UI Kit
      </p>

      <Section title="Navigation Icons">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px' }}>
          {ICONS.map(({ label, Icon }) => (
            <div key={label}>
              <div
                style={{
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: 'var(--color-ink)',
                  fontSize: '14px',
                  lineHeight: '24px',
                }}
              >
                <span style={{ width: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>
                  <Icon size={15} strokeWidth={1.5} />
                </span>
                <span>{label}</span>
              </div>
              <div
                style={{
                  marginTop: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-ink)',
                  opacity: 0.72,
                }}
              >
                <Icon size={16} strokeWidth={1.5} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Monthly Calendar">
        <p
          style={{
            fontSize: '13px',
            lineHeight: '24px',
            color: 'var(--color-ink-light)',
            opacity: 0.75,
            margin: '0 0 12px',
          }}
        >
          May 2026 specimen
        </p>
        <MonthlyCalendarSpecimen />
      </Section>

      <Section title="Monthly Rows">
        <p
          style={{
            fontSize: '13px',
            lineHeight: '24px',
            color: 'var(--color-ink-light)',
            opacity: 0.75,
            margin: '0 0 12px',
          }}
        >
          Row-based monthly view with week dividers
        </p>
        <div style={{ padding: '16px', border: '1px solid var(--color-dot)', borderRadius: '4px' }}>
          <MonthlyRows />
        </div>
      </Section>
    </div>
  );
}
