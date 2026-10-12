import { useRef, useState } from 'react';
import { EditableText } from './ui/EditableText';
import { useI18n } from '../i18n/I18nContext';
import type { TaskAddInputProps } from '../types/taskAddInput';

export function TaskAddInput({ onCreate }: TaskAddInputProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const draftRef = useRef('');
  const [failedTitle, setFailedTitle] = useState('');

  const updateDraft = (text: string) => {
    draftRef.current = text;
    setDraft(text);
  };

  const submit = (text: string) => {
    const title = text.trim();
    if (!title) return;
    // Clear before creating so an Enter followed by blur cannot submit twice.
    updateDraft('');
    setFailedTitle('');
    void onCreate(title).catch(() => {
      if (!draftRef.current) updateDraft(title);
      setFailedTitle(title);
    });
  };

  return (
    <div>
      <div className="flex items-start min-h-6">
        <span aria-hidden="true" className="w-6 text-center text-[10px] leading-6 text-ink opacity-25 select-none shrink-0">•</span>
        <EditableText
          value={draft}
          onValueChange={updateDraft}
          onEnter={submit}
          onBlur={() => submit(draftRef.current)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              updateDraft('');
              setFailedTitle('');
            }
          }}
          placeholder={t('common.addTask')}
          aria-label={t('common.addTask')}
          className="task-input task-add-input flex-1 text-[14px] leading-6 text-ink bg-transparent border-none outline-none p-0"
          spellCheck={false}
        />
      </div>
      {failedTitle && <p role="alert" className="m-0 ml-6 text-sm leading-6 text-accent">{t('board.addTaskFailed')}: {failedTitle}</p>}
    </div>
  );
}
