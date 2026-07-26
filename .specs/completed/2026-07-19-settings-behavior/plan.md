# Settings Behavior Preferences

**Status:** Ready for implementation  
**Scope:** API preference storage, server-side view filtering, settings navigation, and frontend optimistic updates  
**Canonical route:** `/settings/general`

## Outcome

Add two persisted behavior preferences that default to the current visible behavior:

- `Hide completed tasks`
- `Hide old notes`

Both toggles live in General settings and survive reloads and sync events. `/settings/behavior` remains a legacy alias that redirects to General. When enabled, the server must hide the matching rows from Daily, Inbox, and Collection views without changing Monthly history behavior.

## Key Rules

- Defaults stay off so current users see no behavior change until they opt in.
- Old notes means `type = 'note'` rows whose due date is strictly before the user’s local current date.
- Completed rows are hidden in Daily, Inbox, and Collection when the completed toggle is on.
- Monthly remains a historical notes archive and is not filtered by these preferences.
- Upcoming remains unchanged.
- Preference changes must invalidate the affected view caches locally and on sync.

## Implementation Notes

- Add a migration with non-null boolean columns and false defaults.
- Extend the preferences contract and sync payload to include the new fields.
- Move the behavior toggles into General settings, keep keyboard navigation for the remaining tabs, and retain `/settings/behavior` as a redirect.
- Make completion toggles remove rows immediately when hiding is enabled, with rollback on failure.
- Cover the behavior with focused service, route, page, and settings tests.
