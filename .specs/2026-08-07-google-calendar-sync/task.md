# Google Calendar Sync — Tasks

> **Dependencies**: Requires Feature 1 (Event Support) and Feature 2 (Google Login) to be completed first.

## Phase 1: Planner → Google Calendar (One-way push)

### Backend — Database
- [ ] Create migration `038_calendar_sync.sql`:
  - [ ] `google_tokens` table (encrypted access/refresh tokens)
  - [ ] `tasks.google_calendar_event_id` column
  - [ ] `calendar_sync_log` table

### Backend — Token Encryption
- [ ] Create `utils/tokenEncryption.ts` (AES-256-GCM encrypt/decrypt)
- [ ] Add `GOOGLE_TOKEN_ENCRYPTION_KEY` to `.env.example`
- [ ] Write unit tests for encrypt/decrypt round-trip

### Backend — Calendar Sync Service
- [ ] Create `services/calendarSyncService.ts`
- [ ] Implement `connectCalendar(userId, authCode)` — exchange code, encrypt, store tokens
- [ ] Implement `disconnectCalendar(userId)` — revoke Google tokens, delete from DB
- [ ] Implement `getCalendarStatus(userId)` — check if connected
- [ ] Implement `syncEventToGoogle(userId, task)` — push event to GCal
- [ ] Implement `updateEventOnGoogle(userId, task)` — update existing GCal event
- [ ] Implement `deleteEventFromGoogle(userId, taskId, gcalEventId)` — remove from GCal
- [ ] Implement token refresh logic (when access token expired)
- [ ] Add `googleapis` dependency

### Backend — Integration
- [ ] Hook into `taskService.ts` — fire-and-forget sync after event create/update/delete
- [ ] Only sync events with `type === 'event'` and `due_date` set
- [ ] Ensure sync failures don't block task operations

### Backend — Routes
- [ ] Create `routes/calendar.ts`
- [ ] `POST /api/v1/calendar/connect` — accept auth code
- [ ] `POST /api/v1/calendar/disconnect` — revoke access
- [ ] `GET /api/v1/calendar/status` — connection status
- [ ] Register routes in `routes/index.ts`

### Backend — Tests
- [ ] Unit test: token encryption round-trip
- [ ] Unit test: `connectCalendar` stores encrypted tokens
- [ ] Unit test: `disconnectCalendar` revokes and deletes
- [ ] Unit test: `syncEventToGoogle` correct Calendar API params
- [ ] Unit test: `updateEventOnGoogle` updates existing
- [ ] Unit test: `deleteEventFromGoogle` removes from GCal
- [ ] Unit test: token refresh on expiry
- [ ] Unit test: sync failure doesn't block task creation
- [ ] Integration test: connect → sync → disconnect (mocked Google API)

### Frontend — Settings Integration
- [ ] Add "Integrations" section to Settings page
- [ ] Add `/settings/integrations` route
- [ ] Calendar connection card (connected/disconnected states)
- [ ] "Connect Google Calendar" button → incremental OAuth flow
- [ ] "Disconnect" button
- [ ] Last synced timestamp display

### Frontend — Sync Indicator
- [ ] Show sync badge on events with `google_calendar_event_id`

### Frontend — Tests
- [ ] Unit test: Settings shows calendar connection UI
- [ ] Unit test: Connect/disconnect buttons
- [ ] Unit test: Status display states

### GDPR / LGPD
- [ ] Update Privacy Policy with calendar data disclosure
- [ ] Document what data flows to/from Google
- [ ] Verify disconnect revokes all access and deletes tokens
- [ ] Verify account deletion cascades to token deletion

### Manual Verification
- [ ] Settings → Connect Google Calendar → authorize
- [ ] Create event with due date → appears on Google Calendar
- [ ] Edit event → GCal updates
- [ ] Delete event → removed from GCal
- [ ] Event without due date → does NOT sync
- [ ] Disconnect → no more syncing
- [ ] Reconnect → existing events sync

---

## Phase 2: Two-Way Sync (Future Spec)
- [ ] Google push notifications webhook
- [ ] Sync token incremental pull
- [ ] Conflict resolution (last-write-wins)
- [ ] Webhook channel renewal cron

## Phase 3: Optional Task Sync (Future Spec)
- [ ] Google Tasks API integration
- [ ] User preference toggle
- [ ] Task ↔ Google Task mapping
