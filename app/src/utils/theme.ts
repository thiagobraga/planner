import type { BackgroundPreference, ResolvedTheme } from '../types/theme';

export const THEME_COLORS: Record<ResolvedTheme, string> = {
  beige: '#f5f0e8',
  white: '#ffffff',
  dark: '#221a14',
};

/**
 * Literal preview colors per option. Swatches must show their own palette no
 * matter which theme is active, so they cannot use the theme tokens.
 */
export const THEME_SWATCHES: Record<BackgroundPreference, { paper: string; dot: string; mark: string }> = {
  beige: { paper: 'linear-gradient(#f5f0e8, #f5f0e8)', dot: '#d8d3cb', mark: '#44443d' },
  white: { paper: 'linear-gradient(#ffffff, #ffffff)', dot: '#d4d4d4', mark: '#44443d' },
  dark: { paper: 'linear-gradient(#292219, #292219)', dot: '#3b3229', mark: '#ede3d3' },
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
