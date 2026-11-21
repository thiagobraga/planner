import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
} from 'react';
import type { ParsedDateInput, RecurrenceRule, TaskSchedule } from './task';
import type { Hsv, WeekStart } from './utils';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
export type ButtonSize = 'lg' | 'md' | 'sm' | 'xs';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  children: ReactNode;
}

export interface ButtonGroupItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  showLabel?: boolean;
  disabled?: boolean;
}

export type ButtonGroupSelection<T extends string> =
  | { mode: 'single'; value: T; onChange: (value: T) => void }
  | { mode: 'multi'; value: T[]; onChange: (value: T) => void };

export type ButtonGroupProps<T extends string> = ButtonGroupSelection<T> & {
  items: ButtonGroupItem<T>[];
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
}

export interface ChipProps {
  children: ReactNode;
  className?: string;
}

export interface CollectionChipProps {
  name: string;
  /** Literal CSS color value (hex/rgb(a)/hsl(a)); falls back to ink-light. */
  color?: string;
  /** Section of the task, attached to the chip on a transparent background. */
  section?: string;
  className?: string;
}

export interface ColorPickerPopoverProps {
  position: { x: number; y: number };
  value: string;
  onCommit: (color: string) => void;
  onClose: () => void;
}

export interface PickerState {
  hsv: Hsv;
  alpha: number;
}

export type ChannelKey = 'r' | 'g' | 'b' | 'h' | 's' | 'l';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  errorText?: string;
  className?: string;
  id?: string;
  alwaysOpen?: boolean;
}

export interface InlineNameInputProps {
  defaultValue: string;
  placeholder?: string;
  className?: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
  commitOnEscape?: boolean;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  trailing?: ReactNode;
  error?: boolean;
  helpText?: string;
  errorText?: string;
}

export type Priority = 1 | 2 | 3 | 4;

export interface PriorityDotProps {
  /** 1-4; omit or pass undefined for the default (grey) dot. */
  priority?: Priority;
  /** Render the "P1"..."P4" label after the dot. */
  showLabel?: boolean;
  className?: string;
}

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'blocked';

export interface StatusPillProps {
  status: TaskStatus;
  className?: string;
}

export interface StripNavigatorProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  direction: 'previous' | 'next';
  bordered?: boolean;
}

export interface TaskRowSpecimenData {
  title: string;
  priority?: Priority;
  tags?: string[];
  date?: string;
  completed?: boolean;
  selected?: boolean;
  flagged?: boolean;
}

export interface ToggleProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  id?: string;
  className?: string;
}

export interface MonthCalendarProps {
  /** Selected day as YYYY-MM-DD. */
  value: string | null;
  onSelect: (iso: string) => void;
  weekStart: WeekStart;
  /** Days after this YYYY-MM-DD are disabled. */
  maxDate?: string;
  /** `compact` is the 24px Styleguide grid; `comfortable` the date picker's. */
  density?: 'compact' | 'comfortable';
}

export type DatePickerScreen = 'date' | 'time' | 'repeat';

export interface TaskDatePickerPanelProps {
  value: TaskSchedule;
  onSave: (value: TaskSchedule) => void;
  onClose: () => void;
}

export type DatePreview = { status: 'idle' | 'none' } | { status: 'found'; result: ParsedDateInput };

export interface DateScreenProps {
  draft: TaskSchedule;
  onChange: (patch: Partial<TaskSchedule>) => void;
  weekStart: WeekStart;
  onOpenTime: (focusDeadline: boolean) => void;
  onOpenRepeat: () => void;
  onSave: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export interface TimeScreenProps {
  draft: TaskSchedule;
  onChange: (patch: Partial<TaskSchedule>) => void;
  onBack: () => void;
  onCancel: () => void;
  onSave: () => void;
  onOpenRepeat: () => void;
  onClose: () => void;
}

export type RepeatPreset = 'none' | 'daily' | 'weekly' | 'weekdays' | 'custom';
export type RepeatUnit = RecurrenceRule['type'];

export interface RepeatScreenProps {
  rule: RecurrenceRule | null;
  /** The task's date (YYYY-MM-DD), which names the weekday for "every week on ...". */
  anchorDate: string | null;
  weekStart: WeekStart;
  onApply: (rule: RecurrenceRule | null) => void;
  onBack: () => void;
  onClose: () => void;
}
