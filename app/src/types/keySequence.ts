export interface SequenceKeyEvent {
  key: string;
  isTextInputFocused: boolean;
  timestamp: number;
}

export interface SequenceState {
  /** How many keys of the sequence have been typed so far. */
  progress: number;
  lastAt: number;
}
