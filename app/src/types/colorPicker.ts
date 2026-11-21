import type { Dispatch, SetStateAction } from 'react';
import type { PickerState } from './ui';
import type { Rgb } from './utils';

export interface ColorPickerSlidersProps {
  state: PickerState;
  setState: Dispatch<SetStateAction<PickerState>>;
  rgb: Rgb;
  cssColor: string;
  commitCurrent: () => void;
  applySwatch: (color: string) => void;
}
