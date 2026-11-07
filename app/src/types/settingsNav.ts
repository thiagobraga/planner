import type { NavStyle } from './navigation';

export interface NavStyleFieldProps {
  value: NavStyle;
  onChange: (value: NavStyle) => void;
  disabled: boolean;
  error: boolean;
}
