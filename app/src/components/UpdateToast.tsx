import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';

interface UpdateToastProps {
  updateAvailable: boolean;
}

export function UpdateToast({ updateAvailable }: UpdateToastProps) {
  const { t } = useI18n();
  const [tooltipOpen, setTooltipOpen] = useState(false);

  if (!updateAvailable) return null;

  const refresh = () => window.location.reload();

  return (
    <div className="update-indicator">
      <div className="update-indicator-mobile">
        <button
          type="button"
          aria-label={t('update.available')}
          aria-expanded={tooltipOpen}
          onClick={() => setTooltipOpen((open) => !open)}
          className="flex h-8 w-full items-center justify-center border-none bg-transparent p-0"
        >
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-moss ring-2 ring-moss/20" />
        </button>
        {tooltipOpen && (
          <div
            aria-live="polite"
            className="absolute bottom-full left-12 z-[120] mb-2 flex items-center gap-3 whitespace-nowrap rounded-md border border-moss bg-cream px-3.5 py-2 text-[13px] leading-5 text-ink shadow-overlay"
          >
            <span>{t('update.available')}</span>
            <button
              type="button"
              onClick={refresh}
              className="font-semibold text-moss underline underline-offset-2"
            >
              {t('update.refresh')}
            </button>
          </div>
        )}
      </div>

      <div className="update-indicator-desktop fixed inset-x-0 top-0 z-[110] justify-center px-4 py-6 pointer-events-none sm:inset-x-auto sm:top-4 sm:right-4 sm:justify-end sm:px-0 sm:py-0">
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex items-center gap-3 rounded-md border border-moss bg-moss/12 px-3.5 py-2 text-[13px] leading-5 text-moss backdrop-blur-sm"
        >
          <span>{t('update.available')}</span>
          <button
            type="button"
            onClick={refresh}
            className="font-semibold underline underline-offset-2"
          >
            {t('update.refresh')}
          </button>
        </div>
      </div>
    </div>
  );
}
