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
    <section className="mt-8">
      <h2 className="text-base leading-6 font-semibold text-ink">
        {title}
      </h2>
      <div className="h-3" />
      {children}
    </section>
  );
}

export function StyleguidePage() {
  return (
    <div className="max-w-190">
      <h1 className="text-lg leading-6 font-semibold text-ink">
        Styleguide
      </h1>
      <p className="text-[13px] leading-6 text-ink-light opacity-60">
        UI Kit
      </p>

      <Section title="Navigation Icons">
        <div className="grid grid-cols-4 gap-3">
          {ICONS.map(({ label, Icon }) => (
            <div key={label}>
              <div className="h-6 flex items-center gap-[10px] text-ink text-sm leading-6">
                <span className="w-4 flex items-center justify-center opacity-60">
                  <Icon size={15} strokeWidth={1.5} />
                </span>
                <span>{label}</span>
              </div>
              <div className="mt-2 w-8 h-8 flex items-center justify-center text-ink opacity-[0.72]">
                <Icon size={16} strokeWidth={1.5} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Monthly Calendar">
        <p className="text-[13px] leading-6 text-ink-light opacity-75 mb-3">
          May 2026 specimen
        </p>
        <MonthlyCalendarSpecimen />
      </Section>

      <Section title="Monthly Rows">
        <p className="text-[13px] leading-6 text-ink-light opacity-75 mb-3">
          Row-based monthly view with week dividers
        </p>
        <div className="p-4 border border-dot rounded">
          <MonthlyRows />
        </div>
      </Section>
    </div>
  );
}
