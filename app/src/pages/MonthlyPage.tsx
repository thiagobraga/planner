import { useMemo } from 'react';
import { MonthlyRows } from '../components/MonthlyRows';
import { getPhrase } from '../utils/phrases';

export function MonthlyPage() {
  const phrase = useMemo(() => getPhrase('monthly'), []);

  return (
    <div className="monthly-page w-full max-w-[832px]">
      <header className="sticky-page-header max-w-162">
        <h1 className="text-[18px] leading-6 h-6 font-semibold text-ink m-0 p-0">
          Monthly
        </h1>
        <p className="text-[13px] leading-6 h-6 text-ink-light opacity-60 m-0 p-0">
          {phrase}
        </p>
      </header>

      <div className="h-6" />

      <MonthlyRows />
    </div>
  );
}
