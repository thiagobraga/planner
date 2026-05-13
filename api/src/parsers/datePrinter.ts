import type { DueDate, RecurrenceRule } from './dateParser.js';

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function printRecurrence(rule: RecurrenceRule): string {
  switch (rule.type) {
    case 'daily':
      if (rule.interval === 1) return 'every day';
      return `every ${rule.interval} days`;

    case 'weekly':
      if (rule.weekdays && rule.weekdays.length === 1 && rule.interval === 1) {
        return `every ${WEEKDAY_NAMES[rule.weekdays[0]]}`;
      }
      if (rule.interval === 1) return 'every 1 week';
      return `every ${rule.interval} weeks`;

    case 'monthly':
      if (rule.dayOfMonth !== undefined && rule.interval === 1) {
        return `every month on the ${rule.dayOfMonth}${ordinalSuffix(rule.dayOfMonth)}`;
      }
      if (rule.interval === 1) return 'every month';
      return `every ${rule.interval} months`;

    case 'yearly':
      if (rule.interval === 1) return 'every year';
      return `every ${rule.interval} years`;
  }
}

function printTime(time: string): string {
  return time;
}

export function printDueDate(due: DueDate): string {
  const parts: string[] = [];

  if (due.recurrence) {
    parts.push(printRecurrence(due.recurrence));
  } else {
    parts.push(due.date);
  }

  if (due.time) {
    parts.push(printTime(due.time));
  }

  return parts.join(' ');
}
