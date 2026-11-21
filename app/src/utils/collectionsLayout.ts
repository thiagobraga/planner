export function isDesktopCollections(): boolean {
  return window.matchMedia?.('(min-width: 768px)').matches ?? false;
}
