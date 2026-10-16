import type { RecurrenceRule } from '../types/task';
import { parseISODate } from './dateQuickOptions';

type Locale = 'en' | 'pt-BR';

const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PT_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
// Portuguese weekday names are masculine for sábado/domingo and feminine for the "-feira" days.
const PT_ON_ONE = ['no domingo', 'na segunda', 'na terça', 'na quarta', 'na quinta', 'na sexta', 'no sábado'];
const PT_ON_EVERY = ['aos domingos', 'às segundas', 'às terças', 'às quartas', 'às quintas', 'às sextas', 'aos sábados'];

/** Every week, Monday to Friday: the "Weekdays" preset. */
export function isWeekdaysRule(rule: RecurrenceRule | null): boolean {
  if (!rule || rule.type !== 'weekly' || rule.interval !== 1) return false;
  const days = [...(rule.weekdays ?? [])].sort();
  return days.join(',') === '1,2,3,4,5';
}

function sortedWeekdays(rule: RecurrenceRule): number[] {
  return [...(rule.weekdays ?? [])].sort((a, b) => a - b);
}

function englishBase(rule: RecurrenceRule): string {
  const n = rule.interval;
  switch (rule.type) {
    case 'daily':
      return n === 1 ? 'Every day' : `Every ${n} days`;
    case 'weekly': {
      if (isWeekdaysRule(rule)) return 'Weekdays (Mon-Fri)';
      const head = n === 1 ? 'Every week' : `Every ${n} weeks`;
      const days = sortedWeekdays(rule);
      if (days.length === 0) return head;
      if (days.length === 1) return `${head} on ${EN_DAYS[days[0]]}${n === 1 ? '' : 's'}`;
      return `${head} on ${days.map((d) => EN_SHORT[d]).join(', ')}`;
    }
    case 'monthly': {
      const head = n === 1 ? 'Every month' : `Every ${n} months`;
      return rule.dayOfMonth ? `${head} on day ${rule.dayOfMonth}` : head;
    }
    case 'yearly':
      return n === 1 ? 'Every year' : `Every ${n} years`;
  }
}

function portugueseBase(rule: RecurrenceRule): string {
  const n = rule.interval;
  switch (rule.type) {
    case 'daily':
      return n === 1 ? 'Todos os dias' : `A cada ${n} dias`;
    case 'weekly': {
      if (isWeekdaysRule(rule)) return 'Dias úteis (seg-sex)';
      const head = n === 1 ? 'Toda semana' : `A cada ${n} semanas`;
      const days = sortedWeekdays(rule);
      if (days.length === 0) return head;
      if (days.length === 1) return `${head}, ${(n === 1 ? PT_ON_ONE : PT_ON_EVERY)[days[0]]}`;
      return `${head}: ${days.map((d) => PT_SHORT[d]).join(', ')}`;
    }
    case 'monthly': {
      const head = n === 1 ? 'Todo mês' : `A cada ${n} meses`;
      return rule.dayOfMonth ? `${head}, no dia ${rule.dayOfMonth}` : head;
    }
    case 'yearly':
      return n === 1 ? 'Todo ano' : `A cada ${n} anos`;
  }
}

/** One readable sentence for a rule, e.g. "A cada 2 semanas, aos sábados". */
export function recurrenceSummary(rule: RecurrenceRule, locale: Locale): string {
  const pt = locale === 'pt-BR';
  const parts = [pt ? portugueseBase(rule) : englishBase(rule)];
  if (rule.fromCompletion) parts.push(pt ? 'após a conclusão' : 'after completion');
  if (rule.until) {
    const until = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
      parseISODate(rule.until),
    );
    parts.push(pt ? `até ${until}` : `until ${until}`);
  }
  return parts.join(', ');
}
