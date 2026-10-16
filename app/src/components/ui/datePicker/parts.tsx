import type { ReactNode } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';

export const ICON = { size: 16, strokeWidth: 1.5, 'aria-hidden': true } as const;

/** Bordered 32px field shell shared by text, time, date and select inputs. */
export const fieldShell =
  'flex h-8 items-center gap-2 rounded-xs border border-border bg-(--planner-control-bg) px-2 text-ink transition-colors duration-(--motion-fast) focus-within:border-ink';

export const bareInput =
  'h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-ink outline-none placeholder:text-ink-light disabled:opacity-40';

export function ScreenHeader({ title, icon, onBack, onClose }: {
  title: string;
  icon?: ReactNode;
  onBack?: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const iconButton =
    'flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-xs border-none bg-transparent text-ink-light transition-colors duration-(--motion-fast) hover:bg-dot/30 hover:text-ink';
  return (
    <div className="flex h-12 items-center gap-2 px-3">
      {onBack ? (
        <button type="button" aria-label={t('datePicker.back')} onClick={onBack} className={iconButton}>
          <ArrowLeft {...ICON} />
        </button>
      ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-ink">{icon}</span>
      )}
      <h2 className="m-0 flex-1 truncate text-[16px] font-medium leading-6 text-ink">{title}</h2>
      <button type="button" aria-label={t('common.close')} onClick={onClose} className={iconButton}>
        <X {...ICON} />
      </button>
    </div>
  );
}

export function SectionLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div id={id} className="flex h-6 items-center text-[11px] font-medium uppercase tracking-[0.08em] text-ink-light">
      {children}
    </div>
  );
}

export function Divider() {
  return <div role="presentation" className="mx-3 h-px bg-border" />;
}

/** A labelled two-state switch between two options, e.g. scheduled date | completion. */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-8 w-full overflow-hidden rounded-xs border border-border">
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`flex-1 cursor-pointer border-y-0 border-r-0 border-solid border-border text-[13px] transition-colors duration-(--motion-fast) ${
              index > 0 ? 'border-l' : 'border-l-0'
            } ${active ? 'bg-ink text-cream' : 'bg-(--planner-control-bg) text-ink hover:bg-(--planner-control-bg-hover)'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
