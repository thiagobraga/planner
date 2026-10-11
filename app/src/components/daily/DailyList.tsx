import { TaskList } from '../TaskList';
import { EditableText } from '../ui/EditableText';
import { useI18n } from '../../i18n/I18nContext';
import { addDaysISO } from '../../utils/dailySections';
import type { DailyListProps } from '../../types/daily';

const HEADING_STYLE = { lineHeight: 'var(--task-line-height, 24px)' };
const HEADING_CLASS = 'text-[11px] tracking-[0.08em] uppercase text-ink-light h-6 m-0 font-semibold';
const ADD_INPUT_CLASS = 'task-input task-add-input flex-1 text-[14px] leading-6 text-ink bg-transparent border-none outline-none p-0';

function Bullet() {
  return (
    <span className="w-6 text-center text-[10px] leading-6 text-ink opacity-25 select-none shrink-0">
      •
    </span>
  );
}

export function DailyList({
  futureSections,
  currentSections,
  todayKey,
  isPreview,
  todaySectionRef,
  inputRef,
  input,
  onInputChange,
  onAddToday,
  onAddTodayKeyDown,
  futureInputs,
  onFutureInputChange,
  onAddFuture,
  onTaskToggle,
  taskListProps,
}: DailyListProps) {
  const { t } = useI18n();
  const tomorrowKey = addDaysISO(todayKey, 1);

  return (
    <div className="max-w-162">
      {futureSections.map((section) => (
        <div key={`upcoming-${section.key}`} data-day-date={section.key} className="mt-6">
          <div style={HEADING_STYLE} className={HEADING_CLASS}>
            {section.label}
            {section.key === tomorrowKey && <> · <span className="text-moss">TOMORROW</span></>}
          </div>

          <TaskList
            tasks={section.tasks}
            containerId={`day:${section.key}`}
            dayDate={section.key}
            dimNotes={false}
            hideDueDate
            onTaskToggle={onTaskToggle}
            {...taskListProps}
          />

          {!isPreview && (
            <div className="flex items-start min-h-6">
              <Bullet />
              <EditableText
                value={futureInputs[section.key] ?? ''}
                onValueChange={(text) => onFutureInputChange(section.key, text)}
                onEnter={(text) => onAddFuture(section.key, text)}
                onBlur={() => onAddFuture(section.key, futureInputs[section.key] ?? '')}
                placeholder={t('common.addTask')}
                aria-label={t('common.addTask')}
                className={ADD_INPUT_CLASS}
                spellCheck={false}
              />
            </div>
          )}
        </div>
      ))}

      {currentSections.map((section) => {
        const isToday = section.key === todayKey;
        return (
          <div
            key={section.key}
            ref={isToday ? todaySectionRef : undefined}
            data-day-date={section.key}
            className={`mt-6 ${isToday ? 'scroll-mt-24' : ''}`}
          >
            <div style={HEADING_STYLE} className={HEADING_CLASS}>
              {section.label}
              {isToday && <> · <span className="text-accent-light">{t('page.today')}</span></>}
            </div>

            <TaskList
              tasks={section.tasks}
              containerId={`day:${section.key}`}
              dayDate={section.key}
              dimNotes={section.key < todayKey}
              hideDueDate
              onTaskToggle={onTaskToggle}
              {...taskListProps}
            />

            {isToday && (
              <div className="flex items-start min-h-6">
                <Bullet />
                <EditableText
                  ref={inputRef}
                  value={input}
                  onValueChange={onInputChange}
                  onEnter={onAddToday}
                  onBlur={() => onAddToday(input)}
                  onKeyDown={onAddTodayKeyDown}
                  placeholder={t('common.addTask')}
                  aria-label={t('common.addTask')}
                  className={ADD_INPUT_CLASS}
                  spellCheck={false}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
