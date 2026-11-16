import type { PhoneLabels } from '../../types/navigation';

const STORAGE_KEY = 'planner.phoneLabels';

export function readPhoneLabels(): PhoneLabels {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'hidden' ? 'hidden' : 'shown';
  } catch {
    return 'shown';
  }
}

export function writePhoneLabels(value: PhoneLabels): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage may be blocked (private mode); the choice then lasts for this page only.
  }
}
