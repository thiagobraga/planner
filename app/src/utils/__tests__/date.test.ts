import { describe, expect, it } from 'vitest';
import {
  buildMonthDays,
  weekdayColumnIndex,
  weekdayInitials,
  weekdayShortNames,
  extractNaturalDate,
  parseNaturalDate,
} from '../date';

describe('week start date helpers', () => {
  it('orders weekday labels from the configured first day', () => {
    expect(weekdayInitials('sunday')).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    expect(weekdayInitials('monday')).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(weekdayShortNames('sunday')).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(weekdayShortNames('monday')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('returns Brazilian Portuguese weekday labels', () => {
    expect(weekdayInitials('sunday', 'pt-BR')).toEqual(['D', 'S', 'T', 'Q', 'Q', 'S', 'S']);
    expect(weekdayShortNames('monday', 'pt-BR')).toEqual(['seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.', 'dom.']);
  });

  it('maps JavaScript weekdays into the configured calendar columns', () => {
    expect(weekdayColumnIndex(0, 'sunday')).toBe(0);
    expect(weekdayColumnIndex(0, 'monday')).toBe(6);
    expect(weekdayColumnIndex(1, 'monday')).toBe(0);
  });

  it('builds month offsets without changing the represented dates', () => {
    const today = new Date(2026, 7, 31);
    const sundayFirst = buildMonthDays(2026, 7, today, 'sunday');
    const mondayFirst = buildMonthDays(2026, 7, today, 'monday');

    expect(sundayFirst[0]).toMatchObject({ iso: '2026-08-01', dayOfMonth: 1, dow: 6 });
    expect(mondayFirst[0]).toMatchObject({ iso: '2026-08-01', dayOfMonth: 1, dow: 5 });
    expect(mondayFirst.map((day) => day.iso)).toEqual(sundayFirst.map((day) => day.iso));
  });
});

describe('Brazilian Portuguese natural dates', () => {
  it.each([
    ['hoje', 0],
    ['amanhã', 1],
    ['em 3 dias', 3],
  ])('parses %s', (phrase, offset) => {
    const parsed = parseNaturalDate(`Comprar pão ${phrase}`, 'pt-BR');
    const expected = new Date();
    expected.setDate(expected.getDate() + offset);

    expect(parsed?.isoDate).toBe([
      expected.getFullYear(),
      String(expected.getMonth() + 1).padStart(2, '0'),
      String(expected.getDate()).padStart(2, '0'),
    ].join('-'));
    expect(parsed?.preview).toMatch(/[a-zá-ú]/iu);
  });

  it('extracts Portuguese phrases and keeps recurrence metadata', () => {
    expect(extractNaturalDate('Revisar agenda toda semana', undefined, 'pt-BR')).toMatchObject({
      title: 'Revisar agenda',
      recurrenceRule: { type: 'weekly', interval: 1 },
    });
    expect(extractNaturalDate('Planejar próxima segunda-feira', undefined, 'pt-BR').title).toBe('Planejar');
  });

  it('parses masculine Portuguese weekday phrases', () => {
    const recurring = parseNaturalDate('Revisar todo domingo', 'pt-BR');
    expect(recurring?.recurrenceRule).toEqual({ type: 'weekly', interval: 1, weekdays: [0] });
    expect(recurring?.text).toBe('todo domingo');

    const nextSaturday = parseNaturalDate('Comprar pão próximo sábado', 'pt-BR');
    expect(nextSaturday?.text).toBe('próximo sábado');
    expect(new Date(`${nextSaturday?.isoDate}T12:00:00`).getDay()).toBe(6);
  });

  it('keeps English phrases working by default', () => {
    expect(extractNaturalDate('Plan tomorrow').title).toBe('Plan');
  });
});
