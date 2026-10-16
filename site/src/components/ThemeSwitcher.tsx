import { useSyncExternalStore } from 'react';
import type { ThemeSwitcherProps } from '../types/theme';
import { getTheme, setTheme, subscribeToTheme, THEME_OPTIONS } from '../utils/theme';

export function ThemeSwitcher({ label = 'Color theme' }: ThemeSwitcherProps) {
  const theme = useSyncExternalStore(subscribeToTheme, getTheme);

  return (
    <div className="theme-switcher" role="group" aria-label={label}>
      {THEME_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          className="theme-option"
          aria-pressed={theme === option}
          onClick={() => setTheme(option)}
        >
          <span className={`theme-swatch theme-swatch-${option}`} aria-hidden="true" />
          {option.charAt(0).toUpperCase() + option.slice(1)}
        </button>
      ))}
    </div>
  );
}
