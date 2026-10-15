// Tests build "today" from the local clock while preferences use timeZone 'UTC'.
// Pinning TZ keeps both on the same day regardless of the machine's timezone.
export function setup() {
  process.env.TZ = 'UTC';
}
