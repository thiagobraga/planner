import { describe, it, expect } from 'vitest';
import { isWeekdaysRule, recurrenceSummary } from '../recurrenceSummary';
import type { RecurrenceRule } from '../../types/task';

describe('recurrenceSummary', () => {
  const cases: Array<[RecurrenceRule, string, string]> = [
    [{ type: 'daily', interval: 1 }, 'Every day', 'Todos os dias'],
    [{ type: 'daily', interval: 3 }, 'Every 3 days', 'A cada 3 dias'],
    [{ type: 'weekly', interval: 1 }, 'Every week', 'Toda semana'],
    [{ type: 'weekly', interval: 1, weekdays: [6] }, 'Every week on Saturday', 'Toda semana, no sábado'],
    [{ type: 'weekly', interval: 2, weekdays: [6] }, 'Every 2 weeks on Saturdays', 'A cada 2 semanas, aos sábados'],
    [{ type: 'weekly', interval: 2, weekdays: [1] }, 'Every 2 weeks on Mondays', 'A cada 2 semanas, às segundas'],
    [{ type: 'weekly', interval: 1, weekdays: [3, 1] }, 'Every week on Mon, Wed', 'Toda semana: seg, qua'],
    [{ type: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] }, 'Weekdays (Mon-Fri)', 'Dias úteis (seg-sex)'],
    [{ type: 'monthly', interval: 1 }, 'Every month', 'Todo mês'],
    [{ type: 'monthly', interval: 2, dayOfMonth: 5 }, 'Every 2 months on day 5', 'A cada 2 meses, no dia 5'],
    [{ type: 'yearly', interval: 1 }, 'Every year', 'Todo ano'],
    [{ type: 'yearly', interval: 2 }, 'Every 2 years', 'A cada 2 anos'],
  ];

  it.each(cases)('%j', (rule, en, pt) => {
    expect(recurrenceSummary(rule, 'en')).toBe(en);
    expect(recurrenceSummary(rule, 'pt-BR')).toBe(pt);
  });

  it('mentions completion counting and the end date', () => {
    const rule: RecurrenceRule = { type: 'weekly', interval: 2, weekdays: [6], fromCompletion: true, until: '2026-12-31' };
    expect(recurrenceSummary(rule, 'en')).toBe('Every 2 weeks on Saturdays, after completion, until Dec 31, 2026');
    expect(recurrenceSummary(rule, 'pt-BR')).toBe('A cada 2 semanas, aos sábados, após a conclusão, até 31 de dez. de 2026');
  });
});

describe('isWeekdaysRule', () => {
  it('matches only every week on Monday to Friday', () => {
    expect(isWeekdaysRule({ type: 'weekly', interval: 1, weekdays: [5, 4, 3, 2, 1] })).toBe(true);
    expect(isWeekdaysRule({ type: 'weekly', interval: 2, weekdays: [1, 2, 3, 4, 5] })).toBe(false);
    expect(isWeekdaysRule({ type: 'weekly', interval: 1, weekdays: [1, 2] })).toBe(false);
    expect(isWeekdaysRule(null)).toBe(false);
  });
});
