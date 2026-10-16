export const DURATION_PRESETS = [15, 30, 60, 120] as const;
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240, 480] as const;

/** "15 min", "1 h", "1 h 30". */
export function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}
