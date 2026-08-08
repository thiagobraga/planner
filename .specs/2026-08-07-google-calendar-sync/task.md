# Google Calendar Sync — Tasks

> **Dependencies**: Requires Feature 1 (Event Support), Feature 2 (Google Login), and Feature 4 (Privacy & Legal) to be completed first.

## Phase 1: Planner → Google Calendar (One-way push)

### Backend — Database & Config
- [ ] Create migration `038_calendar_sync.sql`:
  - [ ] `google_calendar_connections` table (encrypted tokens, calendar config, sync preferences)
  - [ ] `tasks.google_calendar_event_id` column + index
  - [ ] `calendar_sync_log` table + index
- [ ] Add `GOOGLE_TOKEN_ENCRYPTION_KEY` to `.env.example`
- [ ] Add `GOOGLE_TOKEN_ENCRYPTION_KEY_PREV` to `.env.example` (documented as optional)
- [ ] Add `ENCRYPTION_KEY_VERSION` to `.env.example`

### Backend — Token Encryption
- [ ] Create `utils/tokenEncryption.ts` (AES-256-GCM, versioned format `v{N}:iv:tag:ciphertext`)
- [ ] Support versioned keys (current + previous)
- [ ] Implement lazy rotation (re-encrypt on read if old key version)
- [ ] Write unit tests for encrypt/decrypt round-trip
- [ ] Write unit tests for versioned format parsing
- [ ] Write unit tests for lazy rotation behavior

### Backend — Calendar Sync Service
- [ ] Create `services/calendarSyncService.ts`
- [ ] Add `googleapis` dependency
- [ ] Implement `getCalendarList(authCode)` — exchange code, return user's calendars
- [ ] Implement `createDedicatedCalendar(userId, name)` — create new GCal calendar
- [ ] Implement `connectCalendar(userId, config)` — store tokens + config, trigger initial sync
- [ ] Implement `disconnectCalendar(userId)` — revoke Google tokens, delete row, clear `google_calendar_event_id` on tasks
- [ ] Implement `getConnectionStatus(userId)` — return config + last sync time
- [ ] Implement `updateSyncPreferences(userId, prefs)` — update what types to sync
- [ ] Implement `getSyncPreview(userId)` — count items per type that would sync
- [ ] Implement `syncItemToGoogle(userId, task)` — push to GCal
- [ ] Implement `updateItemOnGoogle(userId, task)` — update existing GCal event
- [ ] Implement `deleteItemFromGoogle(userId, taskId, gcalEventId)` — remove from GCal
- [ ] Implement `runInitialSync(userId)` — push all matching existing items
- [ ] Implement token refresh logic (when access token expired)

### Backend — Key Rotation
- [ ] Implement `rotateEncryptionKeys()` — batch re-encrypt all tokens
- [ ] Admin endpoint `POST /api/v1/admin/rotate-encryption-keys`
- [ ] Write unit tests for batch rotation
- [ ] Document rotation procedure in README or ops guide

### Backend — Integration with Task Service
- [ ] Hook into `taskService.ts` — fire-and-forget sync after create/update/delete
- [ ] Check `google_calendar_connections` sync preferences per type
- [ ] Only sync items with `due_date` set
- [ ] Ensure sync failures never block task operations (fire-and-forget with error logging)

### Backend — Routes
- [ ] Create `routes/calendar.ts`
- [ ] `POST /api/v1/calendar/authorize` — exchange auth code, return calendar list
- [ ] `POST /api/v1/calendar/connect` — save config + trigger initial sync
- [ ] `GET /api/v1/calendar/preview` — sync preview (counts per type)
- [ ] `GET /api/v1/calendar/status` — connection status
- [ ] `PATCH /api/v1/calendar/preferences` — update sync preferences
- [ ] `POST /api/v1/calendar/disconnect` — revoke and delete
- [ ] Register routes in `routes/index.ts`

### Backend — Tests
- [ ] Unit test: token encryption round-trip
- [ ] Unit test: versioned key format
- [ ] Unit test: lazy rotation re-encrypts
- [ ] Unit test: batch rotation all rows
- [ ] Unit test: `connectCalendar` stores config correctly
- [ ] Unit test: `disconnectCalendar` revokes and deletes
- [ ] Unit test: `getCalendarList` returns calendars
- [ ] Unit test: `createDedicatedCalendar` creates via Google API
- [ ] Unit test: `getSyncPreview` returns correct counts
- [ ] Unit test: `syncItemToGoogle` correct API params
- [ ] Unit test: `syncItemToGoogle` respects type preferences
- [ ] Unit test: `updateItemOnGoogle` updates existing
- [ ] Unit test: `deleteItemFromGoogle` removes
- [ ] Unit test: token refresh on expiry
- [ ] Unit test: sync failure doesn't block task creation
- [ ] Integration test: authorize → configure → connect → sync → disconnect (mocked Google API)

### Frontend — Sync Configuration Dialog
- [ ] Create `CalendarSyncDialog` component (modal)
- [ ] Step 1: Google OAuth popup → get auth code
- [ ] Step 2: POST /calendar/authorize → show calendar list
- [ ] Step 3: Configuration screen:
  - [ ] Radio: "Create dedicated Planner calendar" (default) vs "Use existing calendar"
  - [ ] Editable calendar name input (when creating new)
  - [ ] Calendar dropdown (when using existing)
  - [ ] Sync type checkboxes: Events (default on), Tasks, Notes (off by default)
  - [ ] Live item counts from preview endpoint
  - [ ] Info note about items without due dates
- [ ] Step 4: POST /calendar/connect → confirm + trigger initial sync
- [ ] Cancel button at every step
- [ ] Design: Lora font, cream palette, 1px borders, paper-journal aesthetic

### Frontend — Settings Integration
- [ ] Add "Integrations" section to Settings page
- [ ] Add `/settings/integrations` route
- [ ] Connected state: show target calendar name, sync status, last sync time
- [ ] "Edit preferences" button → reopen config dialog (without OAuth step)
- [ ] "Disconnect" button with confirmation
- [ ] Disconnected state: "Connect Google Calendar" button

### Frontend — Sync Indicator
- [ ] Show sync badge icon on items with `google_calendar_event_id`
- [ ] Style: small calendar icon, subtle, non-intrusive

### Frontend — API Client
- [ ] `apiAuthorizeCalendar(authCode)` → POST /calendar/authorize
- [ ] `apiConnectCalendar(config)` → POST /calendar/connect
- [ ] `apiGetCalendarPreview()` → GET /calendar/preview
- [ ] `apiGetCalendarStatus()` → GET /calendar/status
- [ ] `apiUpdateCalendarPreferences(prefs)` → PATCH /calendar/preferences
- [ ] `apiDisconnectCalendar()` → POST /calendar/disconnect

### Frontend — Tests
- [ ] Unit test: CalendarSyncDialog renders with calendar list
- [ ] Unit test: "Create dedicated calendar" option selected by default
- [ ] Unit test: Calendar name editable when creating new
- [ ] Unit test: Sync type checkboxes toggle correctly
- [ ] Unit test: Preview counts display
- [ ] Unit test: Settings shows connected/disconnected states
- [ ] Unit test: Edit preferences reopens config
- [ ] Unit test: Disconnect calls API
- [ ] Unit test: Sync badge appears on synced items

### GDPR / LGPD
- [ ] Update Privacy Policy with calendar data disclosure (see privacy-legal spec)
- [ ] Document data sent to Google (titles, dates)
- [ ] Verify disconnect revokes all access and deletes tokens
- [ ] Verify account deletion cascades to token deletion + revocation

### Manual Verification
- [ ] Settings → Connect Google Calendar → authorize
- [ ] Configuration screen → create "Planner" calendar
- [ ] Check Events + Tasks → Connect & Sync
- [ ] Verify dedicated calendar appears on Google Calendar
- [ ] Create event with due date → appears on GCal
- [ ] Create task with due date → appears on GCal (if tasks enabled)
- [ ] Create note without due date → does NOT sync
- [ ] Edit event → GCal updates
- [ ] Delete event → removed from GCal
- [ ] Edit preferences → uncheck tasks → tasks stop syncing
- [ ] Disconnect → no more syncing, tokens deleted
- [ ] Reconnect with existing calendar → works

---

## Phase 2: Two-Way Sync (Future Spec)
- [ ] Google push notifications webhook (`calendar.events.watch()`)
- [ ] Sync token incremental pull
- [ ] Conflict resolution (last-write-wins)
- [ ] Webhook channel renewal cron
- [ ] Handle edits originating from Google Calendar

## Phase 3: Google Tasks API (Future Spec)
- [ ] Google Tasks API integration
- [ ] Separate scope (`auth/tasks`)
- [ ] Task ↔ Google Task mapping
- [ ] User preference toggle
