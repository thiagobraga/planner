import { TaskList } from '../TaskList';
import { EditableText } from '../ui/EditableText';
import { blurOnEscape } from '../../utils/editableText';
import { useI18n } from '../../i18n/I18nContext';
import type { DailyListProps, DaySection } from '../../types/daily';

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
  pastSections,
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

  const todaySection = currentSections.filter((section) => section.key === todayKey);
  const pastKeys = new Set(pastSections.map((section) => section.key));
  const migrateTasks = currentSections
    .filter((section) => section.key !== todayKey && !pastKeys.has(section.key))
    .flatMap((section) => section.tasks)
    .filter((task) => !task.isCompleted);

  const renderCurrent = (sections: typeof currentSections) =>
    sections.map((section) => {
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
              {isToday && <> · <span className="text-today">{t('page.today')}</span></>}
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
      });

  const renderDay = (section: DaySection, isPast: boolean) => (
    <div key={`${isPast ? 'past' : 'upcoming'}-${section.key}`} data-day-date={section.key} className="mt-6">
      <div style={HEADING_STYLE} className={HEADING_CLASS}>
        {section.label}
      </div>

      <TaskList
        tasks={section.tasks}
        containerId={`day:${section.key}`}
        dayDate={section.key}
        dimNotes={isPast}
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
            onKeyDown={blurOnEscape}
            placeholder={t('common.addTask')}
            aria-label={t('common.addTask')}
            className={ADD_INPUT_CLASS}
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-162">
      {pastSections.map((section) => renderDay(section, true))}

      {renderCurrent(todaySection)}

      {futureSections.map((section) => renderDay(section, false))}

      {migrateTasks.length > 0 && (
        <div data-day-date="migrate" className="mt-6">
          <div style={HEADING_STYLE} className={HEADING_CLASS}>{t('board.migrate')}</div>
          <TaskList
            tasks={migrateTasks}
            containerId="migrate"
            dimNotes
            onTaskToggle={onTaskToggle}
            {...taskListProps}
          />
        </div>
      )}
    </div>
  );
}
