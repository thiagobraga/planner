/** What the user picks in Settings. `system` follows the OS color scheme. */
export type BackgroundPreference = 'beige' | 'white' | 'dark' | 'nord-light' | 'nord-dark' | 'system';

/** The palette actually applied to `<html data-theme>`. */
export type ResolvedTheme = 'beige' | 'white' | 'dark' | 'nord-light' | 'nord-dark';
