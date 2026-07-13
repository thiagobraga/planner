import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { ContextMenu } from '../ui/ContextMenu';
import { HabitGrid, WEEKS, fmtISO } from './HabitGrid';

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function currentChainLength(today: Date, completions: Set<string>): number {
  let n = 0;
  let d = today;
  while (completions.has(fmtISO(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

function longestChainLength(completions: Set<string>, today: Date, lookback: number): number {
  let best = 0;
  let run = 0;
  for (let i = lookback; i >= 0; i--) {
    if (completions.has(fmtISO(addDays(today, -i)))) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

function thirtyDayRate(completions: Set<string>, today: Date): number {
  let n = 0;
  for (let i = 0; i < 30; i++) {
    if (completions.has(fmtISO(addDays(today, -i)))) n++;
  }
  return Math.round((n / 30) * 100);
}

export interface HabitBlockProps {
  name: string;
  note?: string;
  completions: Set<string>;
  today: Date;
  onToggle: (isoDate: string, isCompleted: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function HabitBlock({
  name,
  note,
  completions,
  today,
  onToggle,
  onEdit,
  onDelete,
}: HabitBlockProps) {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  const chain = currentChainLength(today, completions);
  const longest = longestChainLength(completions, today, WEEKS * 7 - 1);
  const rate = thirtyDayRate(completions, today);

  return (
    <section className="mt-12">
      {/* Habit header line */}
      <div className="flex items-baseline gap-[14px]">
        <h2 className="text-base leading-6 font-semibold text-ink">{name}</h2>
        {note && <span className="text-xs text-ink-light italic">{note}</span>}
        <button
          type="button"
          aria-label={`Options for ${name}`}
          className="ml-auto self-center p-1 rounded-[4px] text-ink-light hover:text-ink hover:bg-dot/30 cursor-pointer transition-colors duration-75"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setMenuPosition({ x: rect.left, y: rect.bottom + 4 });
          }}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {menuPosition && (
        <ContextMenu
          position={menuPosition}
          onClose={() => setMenuPosition(null)}
          items={[
            { type: 'item', label: 'Edit', onClick: onEdit },
            { type: 'separator' },
            { type: 'item', label: 'Delete', destructive: true, onClick: onDelete },
          ]}
        />
      )}

      {/* Chain count + stats */}
      <div className="flex items-end gap-6 mt-6 mb-6">
        <div className="flex items-baseline gap-2">
          <span
            className={`text-[48px] leading-[48px] font-semibold tracking-[-0.02em] ${chain > 0 ? 'text-ink' : 'text-ink-light'}`}
          >
            {chain}
          </span>
          <span className="text-[11px] tracking-widest uppercase text-ink-light font-medium">
            day{chain === 1 ? '' : 's'} unbroken
          </span>
        </div>

        <div className="flex-1 flex gap-5 justify-end text-xs text-ink-light pb-1">
          <span>
            longest <span className="text-ink font-medium">{longest}</span>
          </span>
          <span>
            last 30 days <span className="text-ink font-medium">{rate}%</span>
          </span>
        </div>
      </div>

      <HabitGrid completions={completions} today={today} onToggle={onToggle} />
    </section>
  );
}
