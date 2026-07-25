import { useEffect } from 'react';
import { Button } from './ui/Button';
import { useI18n } from '../i18n/I18nContext';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useI18n();
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={onCancel}
      className="fixed inset-0 z-[100] bg-[rgba(44,44,44,0.3)] backdrop-blur-[2px] flex items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-cream border border-dot rounded-md py-6 px-8 max-w-[400px] w-full mx-4 shadow-[0_8px_32px_rgba(44,44,44,0.15)]"
      >
        <h2 id="confirm-modal-title" className="text-base font-semibold text-ink mb-2">
          {title}
        </h2>
        <p className="text-[13px] leading-6 text-ink-light mb-6">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
