import { useI18n } from '../../i18n/I18nContext';
import { Button } from '../ui/Button';

export function CollectionNotFound() {
  const { t } = useI18n();
  return <h1 className="m-0 text-lg font-semibold text-ink">{t('collections.notFound')}</h1>;
}

export function CollectionLoadState({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const { t } = useI18n();
  return failed ? (
    <div className="flex flex-col items-start gap-6">
      <h1 className="m-0 text-lg font-semibold text-ink">{t('collections.loadFailed')}</h1>
      <Button onClick={onRetry}>{t('collections.retry')}</Button>
    </div>
  ) : (
    <p className="m-0 text-sm text-ink-light" role="status">{t('common.loading')}</p>
  );
}
