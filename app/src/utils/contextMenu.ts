/**
 * Shift + right click always belongs to the browser, so its own menu (inspect,
 * copy link, spellcheck) stays reachable over every custom menu in the app.
 */
export function isNativeContextMenu(event: { shiftKey: boolean }): boolean {
  return event.shiftKey;
}
