import { describe, it, expect } from 'vitest';
import { parseDueDate } from '../dateParser.js';

// Thursday 2026-10-15, local noon.
const NOW = new Date(2026, 9, 15, 12, 0, 0);
const pt = (input: string) => parseDueDate(input, { now: NOW, locale: 'pt-BR' });

describe('parseDueDate in Portuguese', () => {
  it.each([
    ['hoje', '2026-10-15'],
    ['amanhã', '2026-10-16'],
    ['amanha', '2026-10-16'],
    ['depois de amanhã', '2026-10-17'],
    ['ontem', '2026-10-14'],
    ['sexta', '2026-10-16'],
    ['sexta-feira', '2026-10-16'],
    ['sáb', '2026-10-17'],
    ['quinta', '2026-10-22'],
    ['próxima sexta', '2026-10-23'],
    ['proximo sabado', '2026-10-24'],
    ['em 3 dias', '2026-10-18'],
    ['em 1 dia', '2026-10-16'],
    ['em 2 semanas', '2026-10-29'],
    ['em 1 mês', '2026-11-15'],
    ['17 de outubro', '2026-10-17'],
    ['3 de jan de 2027', '2027-01-03'],
    ['17/10', '2026-10-17'],
    ['5/1/2027', '2027-01-05'],
    ['fim de semana', '2026-10-17'],
    ['este fim de semana', '2026-10-17'],
  ])('%s -> %s', (input, date) => {
    expect(pt(input).date).toBe(date);
  });

  it('reads a time with "às", "h" and "h30"', () => {
    expect(pt('amanhã às 15:00')).toEqual({ date: '2026-10-16', time: '15:00' });
    expect(pt('sexta 9h')).toEqual({ date: '2026-10-16', time: '09:00' });
    expect(pt('hoje as 18h30')).toEqual({ date: '2026-10-15', time: '18:30' });
  });

  it('reads recurrences', () => {
    expect(pt('todo dia').recurrence).toEqual({ type: 'daily', interval: 1 });
    expect(pt('todos os dias').recurrence).toEqual({ type: 'daily', interval: 1 });
    expect(pt('todo sábado')).toEqual({
      date: '2026-10-17',
      recurrence: { type: 'weekly', interval: 1, weekdays: [6] },
    });
    expect(pt('toda segunda às 9:00')).toEqual({
      date: '2026-10-19',
      time: '09:00',
      recurrence: { type: 'weekly', interval: 1, weekdays: [1] },
    });
    expect(pt('a cada 3 dias').recurrence).toEqual({ type: 'daily', interval: 3 });
    expect(pt('a cada 2 semanas').recurrence).toEqual({ type: 'weekly', interval: 2 });
    expect(pt('a cada 2 meses').recurrence).toEqual({ type: 'monthly', interval: 2 });
    expect(pt('todo mês').recurrence).toEqual({ type: 'monthly', interval: 1 });
    expect(pt('todo ano').recurrence).toEqual({ type: 'yearly', interval: 1 });
  });

  it('keeps US month-first slashes outside pt-BR', () => {
    expect(parseDueDate('10/17/2026', { now: NOW }).date).toBe('2026-10-17');
  });

  it('reads English weekend and "at"', () => {
    expect(parseDueDate('this weekend', { now: NOW }).date).toBe('2026-10-17');
    expect(parseDueDate('tomorrow at 3pm', { now: NOW })).toEqual({ date: '2026-10-16', time: '15:00' });
  });
});

// Error handling is covered here rather than in the property test, which only
// feeds inputs the grammar accepts.
describe('parseDueDate error handling', () => {
  it('throws a descriptive error for an empty input', () => {
    expect(() => parseDueDate('')).toThrow(/Unrecognized date expression: ""/);
  });

  it('throws for whitespace-only input', () => {
    expect(() => parseDueDate('   ')).toThrow(/Unrecognized date expression/);
  });

  it('quotes the unrecognized slice when the parser reports a location', () => {
    expect(() => parseDueDate('tomorrow!!')).toThrow(
      /Unrecognized date expression: "!!"/,
    );
  });

  it('quotes the whole trimmed input when the parser reports no location', () => {
    expect(() => parseDueDate('not a date at all')).toThrow(
      /Unrecognized date expression: "not a date at all"/,
    );
  });
});
