import { describe, it, expect } from 'vitest';
import type { ApiTask } from '../../api/client';
import type { ApiDailyView } from '../../types/daily';
import { apiToTask, buildSections, dateFromISO, dayLabel, flattenDaily } from '../dailySections';

function api(id: string, dueDate: string | undefined, extra: Partial<ApiTask> = {}): ApiTask {
  return { id, title: id, priority: 4, collectionId: 'c', isCompleted: false, orderValue: 0, depth: 0, type: 'task', dueDate, ...extra };
}

const TODAY = '2026-10-07';

describe('flattenDaily', () => {
  it('merges overdue and every day, keeping a task that sits in both once', () => {
    const monday = api('monday', '2026-10-05');
    const view: ApiDailyView = {
      from: '2026-10-05',
      to: '2026-10-07',
      today: TODAY,
      overdue: [api('old', '2026-10-01'), monday],
      days: [
        { date: '2026-10-05', tasks: [monday] },
        { date: '2026-10-06', tasks: [] },
        { date: '2026-10-07', tasks: [api('now', TODAY)] },
      ],
    };

    expect(flattenDaily(view).map((t) => t.id)).toEqual(['old', 'monday', 'now']);
  });
});

describe('buildSections', () => {
  it('groups by due date, newest day first, and always keeps today', () => {
    const tasks = [apiToTask(api('a', '2026-10-05')), apiToTask(api('b', '2026-10-09'))];

    const sections = buildSections(tasks, 'en', TODAY);

    expect(sections.map((s) => s.key)).toEqual(['2026-10-09', TODAY, '2026-10-05']);
    expect(sections[1]!.tasks).toEqual([]);
  });

  it('orders a day by orderValue then creation time', () => {
    const tasks = [
      apiToTask(api('late', TODAY, { orderValue: 2 })),
      apiToTask(api('b', TODAY, { orderValue: 1, createdAt: '2026-10-02T00:00:00Z' })),
      apiToTask(api('a', TODAY, { orderValue: 1, createdAt: '2026-10-01T00:00:00Z' })),
    ];

    expect(buildSections(tasks, 'en', TODAY)[0]!.tasks.map((t) => t.id)).toEqual(['a', 'b', 'late']);
  });

  it('puts an undated task under today rather than dropping it', () => {
    const sections = buildSections([apiToTask(api('loose', undefined))], 'en', TODAY);

    expect(sections).toHaveLength(1);
    expect(sections[0]!.tasks.map((t) => t.id)).toEqual(['loose']);
  });

  it('trims a timestamp suffix from the due date', () => {
    const sections = buildSections([apiToTask(api('ts', '2026-10-05T00:00:00.000Z'))], 'en', TODAY);

    expect(sections.map((s) => s.key)).toEqual([TODAY, '2026-10-05']);
  });

  it('labels days with the chosen format', () => {
    const [section] = buildSections([], 'en', TODAY, 'YYYY-MM-DD');

    expect(section!.label).toBe(TODAY);
  });
});

describe('dayLabel', () => {
  it('uppercases month and weekday and strips pt-BR dots', () => {
    expect(dayLabel(dateFromISO('2026-10-07'), 'en')).toBe('OCT 07 WED');
    expect(dayLabel(dateFromISO('2026-10-07'), 'pt-BR')).toBe('OUT 07 QUA');
  });
});
