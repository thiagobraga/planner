import { describe, expect, it } from 'vitest';
import { listDays, type ListDaysInput } from '../dailyListDays';
import type { Task } from '../../components/TaskItem';

const task = { id: 't', title: 'T', priority: 4, isCompleted: false, orderValue: 0, type: 'task' } as Task;
const base: ListDaysInput = {
  sections: [{ key: '2026-11-16', label: 'NOV 16', tasks: [task] }],
  from: '2026-11-12',
  to: '2026-11-18',
  todayKey: '2026-11-14',
  hideEmptyDays: false,
  preview: false,
  locale: 'en',
  dateFormat: 'MMM DD ddd',
};

const keys = (days: { key: string }[] | null) => days?.map((d) => d.key);

describe('listDays', () => {
  it('splits a range around today', () => {
    const days = listDays(base);
    expect(keys(days.past)).toEqual(['2026-11-12', '2026-11-13']);
    expect(keys(days.future)).toEqual(['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18']);
    expect(days.browsed).toBeNull();
    expect(days.future[1].tasks).toEqual([task]);
  });

  it('shows every day of a range away from today', () => {
    const days = listDays({ ...base, from: '2026-11-15', to: '2026-11-17' });
    expect(keys(days.browsed)).toEqual(['2026-11-15', '2026-11-16', '2026-11-17']);
    expect(days.past).toEqual([]);
  });

  it('hides empty future days for Upcoming but keeps the days before today', () => {
    const days = listDays({ ...base, hideEmptyDays: true });
    expect(keys(days.future)).toEqual(['2026-11-16']);
    expect(keys(days.past)).toEqual(['2026-11-12', '2026-11-13']);
  });

  it('drops the days before today during a Reorganize preview', () => {
    expect(listDays({ ...base, preview: true }).past).toEqual([]);
  });
});
