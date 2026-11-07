import { useI18n } from '../i18n/I18nContext';

import type { UpdateToastProps } from '../types/navigationUpdate';

export function UpdateToastBanner({
  message,
  refreshLabel,
  onRefresh,
}: {
  message: string;
  refreshLabel: string;
  onRefresh: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex items-center gap-3 rounded-md border border-moss px-3.5 py-2 text-[13px] leading-5"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-moss) 18%, var(--planner-overlay-bg))',
        color: 'color-mix(in srgb, var(--color-moss) 40%, var(--color-ink))',
      }}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onRefresh}
        className="font-semibold underline underline-offset-2"
      >
        {refreshLabel}
      </button>
    </div>
  );
}

export function UpdateToast({ updateAvailable }: UpdateToastProps) {
  const { t } = useI18n();
  if (!updateAvailable) return null;

  return (
    <span role="status" className="flex items-center gap-2 text-xs text-ink-light">
      <span className="sr-only">{t('update.available')}</span>
      <button type="button" title={t('update.available')} onClick={() => window.location.reload()} className="underline underline-offset-2">
        {t('update.refresh')}
      </button>
    </span>
  );
}
