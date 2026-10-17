import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Download, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ConfirmModal';
import { apiDeleteAccount, apiExportAccountData } from '../../api/client';
import { useI18n } from '../../i18n/I18nContext';
import { notifyUnauthorized } from '../../utils/authEvents';
import type { AccountExportData } from '../../types/account';

function triggerJsonDownload(data: AccountExportData) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const datePart = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `planner-data-export-${datePart}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AccountDataSection() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const exportMutation = useMutation({
    mutationFn: () => apiExportAccountData(),
    onSuccess: (data) => {
      triggerJsonDownload(data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiDeleteAccount(),
    onSuccess: () => {
      notifyUnauthorized();
      navigate('/login', { replace: true });
    },
  });

  return (
    <section
      className="space-y-4 border-t border-[var(--planner-settings-separator)] pt-8"
      aria-labelledby="account-data-heading"
    >
      <div>
        <h3
          id="account-data-heading"
          className="text-[10px] leading-5 tracking-[0.12em] uppercase text-ink-light font-medium"
        >
          {t('settings.accountData.title')}
        </h3>
        <p className="mt-1 text-[13px] leading-6 text-ink-light opacity-80">
          {t('settings.accountData.description')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={exportMutation.isPending || deleteMutation.isPending}
          onClick={() => exportMutation.mutate()}
        >
          <span className="inline-flex items-center gap-2">
            <Download size={14} strokeWidth={1.5} />
            <span>
              {exportMutation.isPending
                ? t('settings.accountData.exporting')
                : t('settings.accountData.export')}
            </span>
          </span>
        </Button>

        <Button
          type="button"
          variant="destructive"
          size="md"
          disabled={exportMutation.isPending || deleteMutation.isPending}
          onClick={() => setConfirmDeleteOpen(true)}
        >
          <span className="inline-flex items-center gap-2">
            <Trash2 size={14} strokeWidth={1.5} />
            <span>
              {deleteMutation.isPending
                ? t('settings.accountData.deleting')
                : t('settings.accountData.delete')}
            </span>
          </span>
        </Button>
      </div>

      {exportMutation.isError && (
        <p role="alert" className="text-[13px] leading-6 text-accent">
          {exportMutation.error instanceof Error
            ? exportMutation.error.message
            : t('settings.accountData.exportError')}
        </p>
      )}

      {deleteMutation.isError && (
        <p role="alert" className="text-[13px] leading-6 text-accent">
          {deleteMutation.error instanceof Error
            ? deleteMutation.error.message
            : t('settings.accountData.deleteError')}
        </p>
      )}

      <div className="flex items-center gap-4 pt-2 text-[13px] leading-6 text-ink-light">
        <Link
          to="/privacy"
          className="text-ink-light hover:text-ink underline underline-offset-2 transition-colors duration-[var(--motion-fast)]"
        >
          {t('auth.privacyPolicy')}
        </Link>
        <span aria-hidden="true">·</span>
        <Link
          to="/terms"
          className="text-ink-light hover:text-ink underline underline-offset-2 transition-colors duration-[var(--motion-fast)]"
        >
          {t('auth.termsOfService')}
        </Link>
      </div>

      <ConfirmModal
        isOpen={confirmDeleteOpen}
        title={t('settings.accountData.deleteTitle')}
        message={t('settings.accountData.deleteMessage')}
        confirmLabel={t('settings.accountData.delete')}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          deleteMutation.mutate();
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </section>
  );
}
