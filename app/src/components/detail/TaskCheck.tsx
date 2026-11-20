import { Check } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

/** The square task checkbox: 16px in the header, 12px on rows, with an invisible hit area of at least 24px (44px on touch). */
export function TaskCheck({ checked, label, size, onToggle }: { checked: boolean; label: string; size: 'large' | 'small'; onToggle: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? t('task.reopen', { title: label }) : t('task.complete', { title: label })}
      className={`detail-check detail-check--${size}`}
      onClick={onToggle}
    >
      <span className="detail-check-box" aria-hidden="true">
        {checked && <Check size={size === 'large' ? 11 : 9} strokeWidth={3} />}
      </span>
    </button>
  );
}
