import { useMemo, useState } from 'react';
import { MonthlyRows } from '../components/monthly/MonthlyRows';
import { Button } from '../components/ui/Button';
import { getPhrase } from '../utils/phrases';

export function MonthlyPage() {
  const phrase = useMemo(() => getPhrase('monthly'), []);
  const today = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  return (
    <div className="monthly-page relative w-full">
      <header className="page-header-copy sticky-page-header max-w-162">
        <h1 className="text-[18px] leading-6 h-6 font-semibold text-ink m-0 p-0">
          Monthly
        </h1>
        <p className="page-header-subtitle text-[13px] leading-6 h-6 text-ink-light opacity-60 m-0 p-0">
          {phrase}
        </p>
      </header>

      <div className="page-header-toolbar monthly-page-header-controls sticky top-6 z-20 -mt-6 ml-auto w-fit">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSelected({ year: today.getFullYear(), month: today.getMonth() })}
        >
          Today
        </Button>
      </div>

      <div className="max-w-[832px]">
        <div className="h-6" />

        <MonthlyRows
          year={selected.year}
          month={selected.month}
          onMonthChange={(year, month) => setSelected({ year, month })}
        />
      </div>
    </div>
  );
}
