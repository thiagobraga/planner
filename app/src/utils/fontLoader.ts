export function ensureFontLoaded(font: 'lora' | 'patrick'): void {
  if (font === 'lora') {
    return;
  }

  if (font === 'patrick') {
    const elementId = 'font-patrick-hand';
    if (document.getElementById(elementId)) {
      return;
    }

    const link = document.createElement('link');
    link.id = elementId;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap';
    document.head.appendChild(link);
  }
}
