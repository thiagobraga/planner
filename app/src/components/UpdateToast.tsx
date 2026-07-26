import { useVersionCheck } from '../hooks/useVersionCheck';
import { useI18n } from '../i18n/I18nContext';

/**
 * Global "a new build has been deployed" banner. Renders nothing until the
 * API's build version changes since this tab loaded (see useVersionCheck).
 * Reload is always safe here - the session lives in an httpOnly cookie
 * backed by the DB, not client state, so refreshing keeps the user signed in.
 */
export function UpdateToast() {
  const updateAvailable = useVersionCheck();
  const { t } = useI18n();

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[110] flex justify-center px-4 py-6 sm:inset-x-auto sm:top-4 sm:right-4 sm:justify-end sm:px-0 sm:py-0 pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex items-center gap-3 py-2 px-3.5 text-[13px] leading-5 text-accent bg-accent/12 backdrop-blur-sm border border-accent rounded-md"
      >
        <span>{t('update.available')}</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="font-semibold underline underline-offset-2"
        >
          {t('update.refresh')}
        </button>
      </div>
    </div>
  );
}
