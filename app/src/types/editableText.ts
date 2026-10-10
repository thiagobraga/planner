import type { HTMLAttributes, Ref } from 'react';

export interface EditableTextProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'contentEditable' | 'defaultValue' | 'placeholder'> {
  ref?: Ref<HTMLDivElement>;
  /** Controlled text. Omit it and pass `defaultValue` for an uncontrolled field. */
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onValueChange?: (text: string, el: HTMLDivElement) => void;
  /** Enter never inserts a line break; it calls this instead (skipped mid IME composition). */
  onEnter?: (text: string) => void;
}

export interface TextRange {
  start: number;
  end: number;
}
