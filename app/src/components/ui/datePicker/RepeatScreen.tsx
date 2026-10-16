import { useState } from 'react';
import { ChevronDown, Repeat } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import type { TranslationKey } from '../../../i18n/catalogs';
import type { RecurrenceRule } from '../../../types/task';
import { fmtISO, weekdayInitials, type WeekStart } from '../../../utils/date';
import { parseISODate } from '../../../utils/dateQuickOptions';
import { isWeekdaysRule, recurrenceSummary } from '../../../utils/recurrenceSummary';
import { Button } from '../Button';
import { Radio } from '../Radio';
import { Divider, ICON, ScreenHeader, SectionLabel, Segmented, bareInput, fieldShell } from './parts';

type Preset = 'none' | 'daily' | 'weekly' | 'weekdays' | 'custom';
type Unit = RecurrenceRule['type'];

const UNIT_LABELS: Record<Unit, TranslationKey> = {
  daily: 'recurrence.days',
  weekly: 'recurrence.weeks',
  monthly: 'recurrence.months',
  yearly: 'recurrence.years',
};

const WEEKDAYS = [1, 2, 3, 4, 5];

function presetOf(rule: RecurrenceRule | null, anchorDow: number): Preset {
  if (!rule) return 'none';
  const plain = rule.interval === 1 && rule.dayOfMonth === undefined && rule.month === undefined;
  if (plain && rule.type === 'daily') return 'daily';
  if (isWeekdaysRule(rule)) return 'weekdays';
  if (plain && rule.type === 'weekly' && rule.weekdays?.length === 1 && rule.weekdays[0] === anchorDow) return 'weekly';
  return 'custom';
}

interface RepeatScreenProps {
  rule: RecurrenceRule | null;
  /** The task's date (YYYY-MM-DD), which names the weekday for "every week on ...". */
  anchorDate: string | null;
  weekStart: WeekStart;
  onApply: (rule: RecurrenceRule | null) => void;
  onBack: () => void;
  onClose: () => void;
}

export function RepeatScreen({ rule, anchorDate, weekStart, onApply, onBack, onClose }: RepeatScreenProps) {
  const { t, locale } = useI18n();
  const anchor = anchorDate ? parseISODate(anchorDate) : new Date();
  const anchorDow = anchor.getDay();

  const [preset, setPreset] = useState<Preset>(() => presetOf(rule, anchorDow));
  const [interval, setIntervalText] = useState(String(rule?.interval ?? 1));
  const [unit, setUnit] = useState<Unit>(rule?.type ?? 'weekly');
  const [weekdays, setWeekdays] = useState<number[]>(rule?.weekdays ?? [anchorDow]);
  const [fromCompletion, setFromCompletion] = useState(rule?.fromCompletion ?? false);
  const [endsOn, setEndsOn] = useState<string | null>(rule?.until ?? null);

  const build = (): RecurrenceRule | null => {
    let base: RecurrenceRule;
    switch (preset) {
      case 'none':
        return null;
      case 'daily':
        base = { type: 'daily', interval: 1 };
        break;
      case 'weekly':
        base = { type: 'weekly', interval: 1, weekdays: [anchorDow] };
        break;
      case 'weekdays':
        base = { type: 'weekly', interval: 1, weekdays: WEEKDAYS };
        break;
      case 'custom': {
        const n = Math.min(999, Math.max(1, Math.round(Number(interval)) || 1));
        base = { type: unit, interval: n };
        if (unit === 'weekly' && weekdays.length > 0) base.weekdays = [...weekdays].sort((a, b) => a - b);
        // Keep a monthly/yearly anchor the user set elsewhere (e.g. "every month on the 5th").
        if (rule?.type === unit && rule.dayOfMonth !== undefined) base.dayOfMonth = rule.dayOfMonth;
        if (rule?.type === unit && rule.month !== undefined) base.month = rule.month;
        break;
      }
    }
    if (fromCompletion) base.fromCompletion = true;
    if (endsOn) base.until = endsOn;
    return base;
  };

  const result = build();
  const weekPreset = recurrenceSummary({ type: 'weekly', interval: 1, weekdays: [anchorDow] }, locale);
  const weekdaysPreset = recurrenceSummary({ type: 'weekly', interval: 1, weekdays: WEEKDAYS }, locale);
  const [weekdaysHead, weekdaysRange] = weekdaysPreset.split(' (');

  const presets: Array<{ value: Preset; label: React.ReactNode }> = [
    { value: 'none', label: t('recurrence.none') },
    { value: 'daily', label: recurrenceSummary({ type: 'daily', interval: 1 }, locale) },
    { value: 'weekly', label: weekPreset },
    { value: 'weekdays', label: <>{weekdaysHead} <span className="text-ink-light">({weekdaysRange}</span></> },
    { value: 'custom', label: t('recurrence.custom') },
  ];

  const order = weekStart === 'monday' ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  const initials = weekdayInitials(weekStart, locale);
  const dayName = (dow: number) =>
    new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(2026, 9, 4 + dow)); // 2026-10-04 is a Sunday

  const toggleDay = (dow: number) =>
    setWeekdays((days) => (days.includes(dow) ? days.filter((d) => d !== dow) : [...days, dow]));

  return (
    <>
      <ScreenHeader title={t('datePicker.repeat')} onBack={onBack} onClose={onClose} />

      <div role="radiogroup" aria-label={t('datePicker.repeat')} className="flex flex-col gap-2 px-3 pb-3">
        {presets.map((option) => (
          <Radio
            key={option.value}
            name="task-date-picker-repeat"
            value={option.value}
            checked={preset === option.value}
            onChange={() => setPreset(option.value)}
            label={option.label}
          />
        ))}
      </div>

      {preset === 'custom' && (
        <>
          <Divider />
          <section className="date-picker-reveal flex flex-col gap-2 p-3" aria-labelledby="task-date-picker-frequency">
            <SectionLabel id="task-date-picker-frequency">{t('recurrence.frequency')}</SectionLabel>
            <div className="flex items-center gap-2">
              <span className="text-[14px] text-ink">{t('recurrence.every')}</span>
              <div className={`${fieldShell} w-16`}>
                <input
                  type="number"
                  min={1}
                  max={999}
                  inputMode="numeric"
                  aria-label={t('recurrence.interval')}
                  value={interval}
                  onChange={(e) => setIntervalText(e.target.value)}
                  className={`${bareInput} tabular-nums`}
                />
              </div>
              <div className={`${fieldShell} relative flex-1`}>
                <select
                  aria-label={t('recurrence.unit')}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as Unit)}
                  className={`${bareInput} cursor-pointer appearance-none pr-5`}
                >
                  {(Object.keys(UNIT_LABELS) as Unit[]).map((u) => (
                    <option key={u} value={u}>{t(UNIT_LABELS[u])}</option>
                  ))}
                </select>
                <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" className="pointer-events-none absolute right-2 text-ink-light" />
              </div>
            </div>
            {unit === 'weekly' && (
              <div role="group" aria-label={t('recurrence.onDays')} className="flex justify-between pt-1">
                {order.map((dow, index) => {
                  const on = weekdays.includes(dow);
                  return (
                    <button
                      key={dow}
                      type="button"
                      aria-pressed={on}
                      aria-label={dayName(dow)}
                      onClick={() => toggleDay(dow)}
                      className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border text-[12px] transition-[background-color,color,border-color,transform] duration-(--motion-fast) active:scale-95 ${
                        on ? 'border-ink bg-ink text-cream' : 'border-border bg-(--planner-control-bg) text-ink hover:border-ink-lighter'
                      }`}
                    >
                      {initials[index]}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {preset !== 'none' && (
        <>
          <Divider />
          <section className="flex flex-col gap-2 p-3">
            <SectionLabel>{t('recurrence.countFrom')}</SectionLabel>
            <Segmented
              label={t('recurrence.countFrom')}
              value={fromCompletion ? 'completion' : 'scheduled'}
              onChange={(v) => setFromCompletion(v === 'completion')}
              options={[
                { value: 'scheduled', label: t('recurrence.scheduled') },
                { value: 'completion', label: t('recurrence.completion') },
              ]}
            />
            <SectionLabel>{t('recurrence.ends')}</SectionLabel>
            <div role="radiogroup" aria-label={t('recurrence.ends')} className="flex items-center gap-6">
              <Radio name="task-date-picker-ends" checked={endsOn === null} onChange={() => setEndsOn(null)} label={t('recurrence.never')} />
              <Radio
                name="task-date-picker-ends"
                checked={endsOn !== null}
                onChange={() => setEndsOn(fmtISO(new Date(anchor.getFullYear(), anchor.getMonth() + 1, anchor.getDate())))}
                label={t('recurrence.onDate')}
              />
            </div>
            {endsOn !== null && (
              <div className={`${fieldShell} date-picker-reveal`}>
                <input
                  type="date"
                  aria-label={t('recurrence.endDate')}
                  value={endsOn}
                  min={anchorDate ?? undefined}
                  onChange={(e) => e.target.value && setEndsOn(e.target.value)}
                  className={`${bareInput} tabular-nums`}
                />
              </div>
            )}
          </section>
        </>
      )}

      <div className="mx-3 mb-3 flex min-h-8 items-center gap-3 rounded-xs bg-dot/30 px-3 py-1 text-[13px] text-ink" aria-live="polite">
        <Repeat {...ICON} className="shrink-0 text-ink-light" />
        <span data-testid="recurrence-summary">{result ? recurrenceSummary(result, locale) : t('recurrence.none')}</span>
      </div>

      <div className="flex h-12 items-center justify-end gap-2 border-t border-border px-3">
        <Button variant="tertiary" size="md" onClick={onBack}>{t('common.cancel')}</Button>
        <Button variant="primary" size="md" onClick={() => onApply(result)} className="min-w-24">{t('common.save')}</Button>
      </div>
    </>
  );
}
