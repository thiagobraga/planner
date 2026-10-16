import { useRef, useState } from 'react';
import type { RecurrenceRule, TaskSchedule } from '../../types/task';
import { fmtISO, type WeekStart } from '../../utils/date';
import { usePreferences } from '../../hooks/usePreferences';
import { DateScreen } from './datePicker/DateScreen';
import { TimeScreen } from './datePicker/TimeScreen';
import { RepeatScreen } from './datePicker/RepeatScreen';

interface TaskDatePickerPanelProps {
  value: TaskSchedule;
  onSave: (value: TaskSchedule) => void;
  onClose: () => void;
}

type Screen = 'date' | 'time' | 'repeat';

const EMPTY: TaskSchedule = {
  dueDate: null,
  dueTime: null,
  deadlineDate: null,
  deadlineTime: null,
  durationMinutes: null,
  recurrenceRule: null,
};

// A time only means something on a date, and a repeat needs a first occurrence.
function normalize(draft: TaskSchedule): TaskSchedule {
  return {
    ...draft,
    dueTime: draft.dueDate ? draft.dueTime : null,
    deadlineTime: draft.deadlineDate ? draft.deadlineTime : null,
    recurrenceRule: draft.dueDate ? draft.recurrenceRule : null,
  };
}

/** Set date, time, duration, deadline and repeat in one draft; nothing is saved until Save. */
export function TaskDatePickerPanel({ value, onSave, onClose }: TaskDatePickerPanelProps) {
  const { data: prefs } = usePreferences();
  const weekStart: WeekStart = prefs?.weekStart ?? 'sunday';
  const [draft, setDraft] = useState<TaskSchedule>(value);
  const [stack, setStack] = useState<Screen[]>(['date']);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const timeSnapshot = useRef<TaskSchedule>(value);

  const screen = stack[stack.length - 1];
  const patch = (changes: Partial<TaskSchedule>) => setDraft((d) => ({ ...d, ...changes }));

  const open = (next: Screen) => {
    setDirection('forward');
    setStack((s) => [...s, next]);
  };
  const back = () => {
    setDirection('back');
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  };

  const openTime = (withDeadline: boolean) => {
    const today = fmtISO(new Date());
    timeSnapshot.current = draft;
    patch({
      dueDate: draft.dueDate ?? today,
      ...(withDeadline && !draft.deadlineDate ? { deadlineDate: draft.dueDate ?? today } : {}),
    });
    open('time');
  };

  const applyRepeat = (rule: RecurrenceRule | null) => {
    patch({ recurrenceRule: rule, ...(rule && !draft.dueDate ? { dueDate: fmtISO(new Date()) } : {}) });
    back();
  };

  const save = () => onSave(normalize(draft));

  return (
    <div
      className="task-date-picker w-[320px] max-w-[calc(100vw-32px)] overflow-hidden font-journal text-ink"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && screen !== 'date') {
          e.stopPropagation();
          back();
        }
      }}
    >
      <div key={stack.length + screen} className={`date-picker-screen date-picker-screen-${direction}`} data-screen={screen}>
        {screen === 'date' && (
          <DateScreen
            draft={draft}
            onChange={patch}
            weekStart={weekStart}
            onOpenTime={openTime}
            onOpenRepeat={() => open('repeat')}
            onSave={save}
            onRemove={() => onSave(EMPTY)}
            onClose={onClose}
          />
        )}
        {screen === 'time' && (
          <TimeScreen
            draft={draft}
            onChange={patch}
            onBack={back}
            onCancel={() => {
              setDraft(timeSnapshot.current);
              back();
            }}
            onSave={save}
            onOpenRepeat={() => open('repeat')}
            onClose={onClose}
          />
        )}
        {screen === 'repeat' && (
          <RepeatScreen
            rule={draft.recurrenceRule}
            anchorDate={draft.dueDate}
            weekStart={weekStart}
            onApply={applyRepeat}
            onBack={back}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
