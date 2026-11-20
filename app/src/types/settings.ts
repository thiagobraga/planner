import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react';
import type { useUpdatePreferences } from '../hooks/useUpdatePreferences';
import type { Preferences } from './api';

export type SettingsSection = 'general' | 'appearance' | 'integrations';

export interface SettingsCardProps {
  title: string;
  headingId: string;
  children: ReactNode;
}

export interface PreferenceToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  title: string;
  description: string;
  id: string;
}

export interface SettingsTabListProps {
  activeSection: SettingsSection;
  compact: boolean;
  idPrefix: string;
  inverted?: boolean;
  onChange: (section: SettingsSection) => void;
}

export interface SettingsAppearanceProps {
  preferences: Preferences | undefined;
  updateMutation: ReturnType<typeof useUpdatePreferences>;
  panelHeadingId: string;
}

export interface SettingsTimeZoneProps {
  timeZoneInputId: string;
  detectedTimeZone: string;
  savedTimeZone: string;
  timeZoneDraft: string;
  timeZoneHighlight: number;
  timeZoneTriggerWidth: number;
  timeZoneTriggerRef: RefObject<HTMLDivElement | null>;
  timeZoneFloatingRef: RefObject<HTMLDivElement | null>;
  timeZoneListboxRef: RefObject<HTMLUListElement | null>;
  timeZoneTop: CSSProperties['top'];
  timeZoneLeft: CSSProperties['left'];
  disabled: boolean;
  isTimeZoneOpen: boolean;
  filteredTimeZones: string[];
  handleTimeZoneInputChange: (draft: string) => void;
  handleTimeZoneFocus: () => void;
  handleTimeZoneKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  closeTimeZoneDropdown: () => void;
  commitTimeZoneSelection: (zone: string) => void;
  setTimeZoneHighlight: (index: number) => void;
}
