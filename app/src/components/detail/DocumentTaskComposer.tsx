import { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';

interface DocumentTaskComposerProps {
  /** Creates the child task and resolves to its id. */
  onCreate: (title: string) => Promise<string>;
  onInserted: (taskId: string) => void;
  onCancel: () => void;
}

/** One line for a new subtask's title; Enter creates the real child and drops its block at the caret. */
export function DocumentTaskComposer({ onCreate, onInserted, onCancel }: DocumentTaskComposerProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async () => {
    const value = title.trim();
    if (!value || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      onInserted(await onCreate(value));
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <div className="detail-task-composer">
      <input
        autoFocus
        type="text"
        aria-label={t('detail.newTaskTitle')}
        placeholder={t('detail.newTaskTitle')}
        value={title}
        disabled={busy}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void submit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      {failed && <span role="alert" className="detail-error-text">{t('detail.taskCreateFailed')}</span>}
    </div>
  );
}
