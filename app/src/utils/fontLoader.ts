export type FontOption = 'lora' | 'klee' | 'playpen' | 'hubballi';

export const FONT_SMALL_CAPS: Record<FontOption, boolean> = {
  lora: false,
  klee: false,
  playpen: false,
  hubballi: false,
};

export function ensureFontLoaded(font: FontOption): void {
  if (font === 'lora') {
    return;
  }

  const elementId = `font-${font}`;
  if (document.getElementById(elementId)) {
    return;
  }

  const link = document.createElement('link');
  link.id = elementId;
  link.rel = 'stylesheet';
  if (font === 'klee') {
    link.href = 'https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&display=swap';
  } else if (font === 'playpen') {
    link.href = 'https://fonts.googleapis.com/css2?family=Playpen+Sans:wght@300..700&display=swap';
  } else if (font === 'hubballi') {
    link.href = 'https://fonts.googleapis.com/css2?family=Hubballi&display=swap';
  }
  document.head.appendChild(link);
}
