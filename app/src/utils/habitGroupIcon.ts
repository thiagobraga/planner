const HABIT_GROUP_ICONS = ['☀️', '🌙', '🌿', '💊', '🧹', '💪', '📚', '🎯'];

export function randomHabitGroupIcon(random = Math.random): string {
  return HABIT_GROUP_ICONS[Math.floor(random() * HABIT_GROUP_ICONS.length)]!;
}
