import { useEffect } from 'react';
import { Button } from '../ui/Button';
import { useI18n } from '../../i18n/I18nContext';
import type { BoardColumnDeleteOption } from '../../hooks/useBoardColumnDrag';

export interface ColumnDeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  reassignOptions: BoardColumnDeleteOption[];
  selectedReassignToId: string | null;
  errorMessage: string | null;
  onChangeReassignToId: (value: string | null) => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function ColumnDeleteModal({
  isOpen,
  title,
  message,
  reassignOptions,
  selectedReassignToId,
  errorMessage,
  onChangeReassignToId,
  onDelete,
  onCancel,
}: ColumnDeleteModalProps) {
  const { t } = useI18n();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
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
      aria-labelledby="column-delete-modal-title"
      onClick={onCancel}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(44,44,44,0.3)] backdrop-blur-[2px]"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="mx-4 w-full max-w-[400px] rounded-md border border-dot px-8 py-6 shadow-[0_8px_32px_rgba(44,44,44,0.15)]"
        style={{ backgroundColor: 'var(--planner-overlay-bg)' }}
      >
        <h2 id="column-delete-modal-title" className="mb-2 text-base font-semibold text-ink">
          {t('board.deleteColumnTitle', { name: title })}
        </h2>
        <p className="mb-4 text-[13px] leading-6 text-ink-light">{message}</p>

        {reassignOptions.length > 0 && (
          <label className="mb-4 block text-[13px] leading-6 text-ink">
            <span className="mb-2 block">{t('board.reassignTasksTo')}</span>
            <select
              aria-label={t('board.reassignTasksTo')}
              className="w-full rounded-xs border border-border bg-transparent px-3 py-2 text-sm text-ink outline-none"
              value={selectedReassignToId ?? ''}
              onChange={(event) => onChangeReassignToId(event.target.value || null)}
            >
              {reassignOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mb-4 rounded-xs border border-accent/30 bg-accent/10 px-3 py-2 text-[13px] leading-6 text-accent"
          >
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button variant="destructive" onClick={onDelete} className="w-full">
            {t('common.delete')}
          </Button>
          <Button variant="secondary" onClick={onCancel} className="w-full">
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}
