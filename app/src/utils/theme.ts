import type { BackgroundPreference, ResolvedTheme } from '../types/theme';

/** Browser and PWA colors use sidebar colors for the original themes and page colors for Nord. */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  beige: '#ebe6de',
  white: '#f1f1f1',
  dark: '#292219',
  'nord-light': '#eceff4',
  'nord-dark': '#2e3440',
};

/**
 * Literal preview colors per option. Swatches must show their own palette no
 * matter which theme is active, so they cannot use the theme tokens.
 */
export const THEME_SWATCHES: Record<BackgroundPreference, { paper: string; dot: string; mark: string }> = {
  beige: { paper: 'linear-gradient(#f5f0e8, #f5f0e8)', dot: '#d8d3cb', mark: '#44443d' },
  white: { paper: 'linear-gradient(#ffffff, #ffffff)', dot: '#d4d4d4', mark: '#44443d' },
  dark: { paper: 'linear-gradient(#292219, #292219)', dot: '#3b3229', mark: '#ede3d3' },
  'nord-light': { paper: 'linear-gradient(#eceff4, #eceff4)', dot: '#d8dee9', mark: '#2e3440' },
  'nord-dark': { paper: 'linear-gradient(#2e3440, #2e3440)', dot: '#434c5e', mark: '#eceff4' },
  system: { paper: 'linear-gradient(135deg, #f5f0e8 50%, #292219 50%)', dot: 'rgba(139, 134, 126, 0.45)', mark: '#44443d' },
};

export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export function resolveTheme(preference: BackgroundPreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'beige';
  return preference;
}

export function updateDocumentThemeColor(
  theme: ResolvedTheme,
  targetDocument: Document = document,
): void {
  let meta = targetDocument.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = targetDocument.createElement('meta');
    meta.name = 'theme-color';
    targetDocument.head.append(meta);
  }
  meta.content = THEME_COLORS[theme];
}
