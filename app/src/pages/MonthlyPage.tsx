import { useMemo } from 'react';
import { getPhrase } from '../utils/phrases';
import { MonthlyRows } from '../components/MonthlyRows';

export function MonthlyPage() {
  const phrase = useMemo(() => getPhrase('monthly'), []);

  return (
    <div className="max-w-162">
      <h1 className="text-[18px] leading-6 font-semibold text-ink m-0">
        Monthly
      </h1>
      <p className="text-[13px] leading-6 text-ink-light opacity-60 m-0">
        {phrase}
      </p>

      <div className="h-6" />

      <MonthlyRows />
    </div>
  );
}
