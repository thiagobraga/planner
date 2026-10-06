/**
 * A post-login destination taken from the URL, kept to same-origin paths so a
 * crafted ?next= link cannot bounce a fresh session to another site.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}
