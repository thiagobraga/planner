import type { FontOption } from '../types/utils';

export const FONT_SMALL_CAPS: Record<FontOption, boolean> = {
  lora: false,
  playpen: false,
  hubballi: false,
};

export async function ensureFontLoaded(font: FontOption): Promise<void> {
  try {
    if (font === 'playpen') {
      await import('../styles/fonts/playpen.css');
    } else if (font === 'hubballi') {
      await import('../styles/fonts/hubballi.css');
    }
  } catch {
    // Keep the fallback font usable when an optional font cannot load offline.
  }
}
