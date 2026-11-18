/** What the user picks in Settings. `system` follows the OS color scheme. */
export type BackgroundPreference = 'beige' | 'white' | 'dark' | 'nord-light' | 'nord-dark' | 'system';

/** The palette actually applied to `<html data-theme>`. */
export type ResolvedTheme = 'beige' | 'white' | 'dark' | 'nord-light' | 'nord-dark';

export type PaletteThemeId = ResolvedTheme;
export type PaletteFamilyId = 'neutral' | 'accent' | 'danger' | 'warning' | 'info' | 'success';
export type PaletteShade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

export interface ThemePaletteShade {
  shade: PaletteShade;
  value: string;
  token: string;
  usage: string[];
}

export interface ThemePaletteFamily {
  id: PaletteFamilyId;
  name: string;
  shades: ThemePaletteShade[];
}

export interface ThemePalette {
  id: PaletteThemeId;
  name: string;
  families: ThemePaletteFamily[];
  semantics: Record<string, string>;
}
