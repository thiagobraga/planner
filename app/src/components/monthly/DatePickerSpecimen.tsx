import { useState } from 'react';
import { fmtISO, startOfDay, type WeekStart } from '../../utils/date';
import { MonthCalendar } from '../ui/MonthCalendar';

export function DatePickerSpecimen({ weekStart }: { weekStart: WeekStart }) {
  const todayISO = fmtISO(startOfDay(new Date()));
  const [selected, setSelected] = useState(todayISO);

  return (
    <MonthCalendar value={selected} onSelect={setSelected} weekStart={weekStart} maxDate={todayISO} density="compact" />
  );
}
