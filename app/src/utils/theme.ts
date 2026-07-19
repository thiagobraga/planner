export type BackgroundTheme = 'beige' | 'white';

export const THEME_COLORS: Record<BackgroundTheme, string> = {
  beige: '#f5f0e8',
  white: '#ffffff',
};

export function updateDocumentThemeColor(
  background: BackgroundTheme,
  targetDocument: Document = document,
): void {
  let meta = targetDocument.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = targetDocument.createElement('meta');
    meta.name = 'theme-color';
    targetDocument.head.append(meta);
  }
  meta.content = THEME_COLORS[background];
}
