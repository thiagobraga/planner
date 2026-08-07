import { useEffect } from 'react';
import { Button } from './ui/Button';
import { useI18n } from '../i18n/I18nContext';

interface SectionDeleteModalProps {
  isOpen: boolean;
  sectionName: string;
  taskCount: number;
  onDeleteTasks: () => void;
  onMoveToTopLevel: () => void;
  onCancel: () => void;
}

export function SectionDeleteModal({
  isOpen,
  sectionName,
  taskCount,
  onDeleteTasks,
  onMoveToTopLevel,
  onCancel,
}: SectionDeleteModalProps) {
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
      aria-labelledby="section-delete-modal-title"
      onClick={onCancel}
      className="fixed inset-0 z-[100] bg-[rgba(44,44,44,0.3)] backdrop-blur-[2px] flex items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-cream border border-dot rounded-md py-6 px-8 max-w-[400px] w-full mx-4 shadow-[0_8px_32px_rgba(44,44,44,0.15)]"
      >
        <h2 id="section-delete-modal-title" className="text-base font-semibold text-ink mb-2">
          {t('page.deleteSection', { name: sectionName })}
        </h2>
        <p className="text-[13px] leading-6 text-ink-light mb-6">
          {taskCount > 0
            ? t('page.deleteSectionMessage', { count: String(taskCount) })
            : t('page.deleteSectionEmptyMessage')}
        </p>
        <div className="flex flex-col gap-2">
          {taskCount > 0 && (
            <Button variant="secondary" onClick={onDeleteTasks} className="w-full text-accent">
              {t('page.deleteSectionAndTasks')}
            </Button>
          )}
          <Button variant="secondary" onClick={onMoveToTopLevel} className="w-full">
            {t('page.deleteSectionMoveTasks')}
          </Button>
          <Button variant="primary" onClick={onCancel} className="w-full">
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}
