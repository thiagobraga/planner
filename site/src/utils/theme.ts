import type { SiteTheme } from '../types/theme';

export const THEME_STORAGE_KEY = 'planner-site-theme';
const THEME_CHANGE_EVENT = 'planner-site-theme-change';

export const THEME_OPTIONS: readonly SiteTheme[] = ['white', 'beige', 'dark'];
const THEME_COLORS: Record<SiteTheme, string> = {
  white: '#ffffff',
  beige: '#f5f0e8',
  dark: '#292219',
};

function isSiteTheme(value: unknown): value is SiteTheme {
  return value === 'white' || value === 'beige' || value === 'dark';
}

export function readStoredTheme(): SiteTheme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isSiteTheme(stored) ? stored : 'beige';
  } catch {
    return 'beige';
  }
}

export function getTheme(): SiteTheme {
  const applied = document.documentElement.dataset.theme;
  return isSiteTheme(applied) ? applied : readStoredTheme();
}

export function setTheme(theme: SiteTheme): void {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLORS[theme];
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browser settings can deny storage while still allowing the theme.
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function subscribeToTheme(onChange: () => void): () => void {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
}
