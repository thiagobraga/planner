import type { Preferences } from '../../types/api';

export const WEEK_START_OPTIONS: Array<{
  value: Preferences['weekStart'];
  label: string;
}> = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
];

export const DATE_FORMAT_OPTIONS: Array<{
  value: string;
  label: string;
  example: string;
}> = [
  { value: 'MMM DD ddd', label: 'Month Day Weekday', example: 'AUG 05 WED' },
  { value: 'DD/MM ddd', label: 'Day/Month Weekday', example: '05/08 QUA' },
  { value: 'DD-MM-YYYY ddd', label: 'Full Date Weekday', example: '05-08-2026 WED' },
  { value: 'ddd MMM DD', label: 'Weekday Month Day', example: 'WED AUG 05' },
  { value: 'YYYY-MM-DD', label: 'ISO Standard', example: '2026-08-05' },
];

