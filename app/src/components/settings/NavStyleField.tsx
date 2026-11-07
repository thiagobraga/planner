import { useId } from 'react';
import { Radio } from '../ui/Radio';
import { useI18n } from '../../i18n/I18nContext';
import type { NavStyleFieldProps } from '../../types/settingsNav';

const OPTIONS = [
  ['text', 'nav.styleText'],
  ['icon-left', 'nav.styleIconLeft'],
  ['icon-top', 'nav.styleIconTop'],
] as const;

export function NavStyleField({ value, onChange, disabled, error }: NavStyleFieldProps) {
  const { t } = useI18n();
  const id = useId();

  return (
    <section className="space-y-3">
      <h3 id={id} className="text-[10px] leading-5 tracking-[0.12em] uppercase text-ink-light font-medium">
        {t('nav.style')}
      </h3>
      <div role="radiogroup" aria-labelledby={id} aria-describedby={`${id}-hint`} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {OPTIONS.map(([option, label]) => (
          <Radio
            key={option}
            name="navStyle"
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            disabled={disabled}
            label={t(label)}
            className={`w-full rounded-[6px] border px-3 py-3 transition-colors duration-[var(--motion-fast)] ${
              value === option
                ? 'border-ink-light bg-[var(--planner-control-bg-hover)]'
                : 'border-border bg-[var(--planner-control-bg)] hover:bg-[var(--planner-control-bg-hover)]'
            }`}
          />
        ))}
      </div>
      <p id={`${id}-hint`} className="text-sm leading-6 text-ink-light">{t('nav.stylePhoneHint')}</p>
      {error && <p role="alert" className="text-sm leading-6 text-accent">{t('nav.styleSaveError')}</p>}
    </section>
  );
}
