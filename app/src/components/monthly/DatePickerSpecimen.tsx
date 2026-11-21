import { useState } from 'react';
import { fmtISO, startOfDay } from '../../utils/date';
import type { WeekStart } from '../../types/utils';
import { MonthCalendar } from '../ui/MonthCalendar';

export function DatePickerSpecimen({ weekStart }: { weekStart: WeekStart }) {
  const todayISO = fmtISO(startOfDay(new Date()));
  const [selected, setSelected] = useState(todayISO);

  return (
    <MonthCalendar value={selected} onSelect={setSelected} weekStart={weekStart} maxDate={todayISO} density="compact" />
  );
}
