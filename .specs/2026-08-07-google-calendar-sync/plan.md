# Google Calendar Sync — Plan

## Context

With the addition of the `event` type (Feature 1: `.specs/2026-08-07-event-support`) and Google OAuth (Feature 2: `.specs/2026-08-07-google-login`), we can plan synchronization between Planner events and Google Calendar.

### Dependencies
- **Feature 1** (Event Support) must be implemented first — events are the primary sync entity
- **Feature 2** (Google Login) must be implemented first — provides the Google OAuth infrastructure that calendar sync extends with additional scopes

### Complexity Warning
Calendar sync is significantly more complex than the other two features. This plan is designed for **phased delivery** to manage risk.

---

## Analysis: What Should Sync?

### Events ✅ (Primary — Phase 1)

| Direction | Behavior |
|-----------|----------|
| Planner → GCal | Events with `due_date` appear on Google Calendar |
| GCal → Planner | Google Calendar events appear as Planner events |

**Rationale**: Events are the natural semantic mapping. A BuJo event (`○ Dentist appointment`) is equivalent to a Google Calendar event.

### Tasks with Due Dates ⚠️ (Secondary — Phase 3)

| Direction | Behavior |
|-----------|----------|
| Planner → GCal | Tasks with `due_date` + `due_time` could appear as GCal events or Google Tasks |
| GCal → Planner | Not applicable |

**Options**:
1. **Sync as Google Calendar events** — visual overlap, but tasks and events look different in GCal
2. **Sync with Google Tasks API** — better semantic match (task ↔ task), but Google Tasks has very limited fields (no priority, no sections, no recurrence rules matching ours)
3. **Don't sync tasks** — keep calendar clean, tasks stay in Planner only

**Recommendation**: Phase 3 — start with events only. Optionally add task sync as a user preference later. If we do, Google Tasks API is the better fit despite its limitations.

### Notes ❌ (Never)
Notes are informational markers with no time dimension. They have no calendar equivalent.

### Habits ❌ (Never)
Habits have their own tracking system with streaks and weekly grids. Calendar sync would break the habit model.

---

## Phased Delivery

### Phase 1: Planner → Google Calendar (One-way push)
- User connects Google Calendar in Settings
- When a Planner event with `due_date` is created/updated/deleted, it's pushed to Google Calendar
- Simplest to implement, immediate user value

### Phase 2: Google Calendar → Planner (Two-way sync)
- Google Calendar push notifications (webhooks) notify Planner of changes
- New/updated/deleted GCal events are synced back to Planner as events
- Conflict resolution needed (which version wins if both sides change?)

### Phase 3: Optional Task Sync
- User preference: "Also sync tasks with due dates to Google Calendar"
- Tasks appear as Google Calendar events with a `[Task]` prefix or distinct color

> [!IMPORTANT]
> **This plan covers Phase 1 in detail.** Phases 2 and 3 are outlined architecturally but will have their own specs when the time comes.

---

## GDPR / LGPD Considerations (Beyond Feature 2)

### Extended OAuth Scopes

| Scope | Purpose | Sensitivity |
|-------|---------|-------------|
| `openid email profile` | Login (Feature 2) | Non-sensitive |
| `https://www.googleapis.com/auth/calendar.events` | Read/write calendar events | **Sensitive** |

> [!WARNING]
> Calendar scopes are classified as **"sensitive"** by Google. This triggers:
> - Google OAuth consent screen verification process (can take 2–6 weeks)
> - Required privacy policy URL on the consent screen
> - Limited to 100 test users until verified
>
> **Mitigation**: Use **incremental authorization** — request calendar scope only when the user explicitly connects calendar in Settings, not at login time.

### Data Flow Analysis

| Direction | What travels | Stored? |
|-----------|-------------|---------|
| Planner → Google | Event titles, dates, times | By Google (their policy) |
| Google → Planner | Calendar event IDs | ✅ For sync tracking |
| Google → Planner | Refresh tokens | ✅ **Encrypted at rest** |
| Google → Planner | Access tokens | ✅ Short-lived, encrypted |
| Google → Planner | Full calendar data | ❌ Only synced events |

### Additional Privacy Policy Requirements
- Disclose that event titles and dates are sent to Google
- Disclose that Google Calendar data is received and stored
- Explain opt-in nature (user must explicitly connect)
- Provide disconnect mechanism that revokes Google access and deletes stored tokens
- Comply with [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)

### Right to Deletion
- Account deletion must:
  1. Revoke Google Calendar tokens
  2. Delete `google_tokens` record
  3. Optionally: delete synced events from Google Calendar (or leave them — user preference?)

---

## Backend Architecture

### Migration `038_calendar_sync.sql`

```sql
-- Google OAuth tokens for calendar access (separate from login)
-- Encrypted at rest — access_token_enc and refresh_token_enc contain AES-256-GCM ciphertext
CREATE TABLE google_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Track which Planner events are synced to Google Calendar
ALTER TABLE tasks ADD COLUMN google_calendar_event_id VARCHAR(255);
CREATE INDEX idx_tasks_gcal_event_id
  ON tasks (google_calendar_event_id)
  WHERE google_calendar_event_id IS NOT NULL;

-- Sync audit log
CREATE TABLE calendar_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('to_gcal', 'from_gcal')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'conflict')),
  error_message TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_calendar_sync_log_user ON calendar_sync_log (user_id, synced_at DESC);
```

### New Dependencies

```bash
npm install googleapis    # Google Calendar API client (includes auth)
```

Token encryption uses Node.js built-in `crypto` module (AES-256-GCM) — no additional dependency.

### New Environment Variables

```bash
GOOGLE_TOKEN_ENCRYPTION_KEY=<32-byte-hex-string>  # AES-256 key for encrypting tokens at rest
```

### Token Encryption Utility (`utils/tokenEncryption.ts`)

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY!, 'hex');

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all base64)
  return [iv, tag, encrypted].map(b => b.toString('base64')).join(':');
}

export function decrypt(encoded: string): string {
  const [ivB64, tagB64, dataB64] = encoded.split(':');
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return decipher.update(Buffer.from(dataB64, 'base64')) + decipher.final('utf8');
}
```

### New Service: `calendarSyncService.ts`

```typescript
// Phase 1 API surface
export async function connectCalendar(userId: string, authCode: string): Promise<void>
export async function disconnectCalendar(userId: string): Promise<void>
export async function getCalendarStatus(userId: string): Promise<{ connected: boolean; lastSync?: string }>
export async function syncEventToGoogle(userId: string, task: Task): Promise<void>
export async function updateEventOnGoogle(userId: string, task: Task): Promise<void>
export async function deleteEventFromGoogle(userId: string, taskId: string, gcalEventId: string): Promise<void>
```

**`connectCalendar` flow:**
1. Exchange `authCode` for Google tokens (access + refresh)
2. Encrypt both tokens using `tokenEncryption.encrypt()`
3. Store in `google_tokens` table
4. Optionally trigger initial sync of existing events

**`syncEventToGoogle` flow:**
1. Fetch user's Google tokens from DB
2. Decrypt access token; refresh if expired
3. Call Google Calendar API: `calendar.events.insert()`
4. Store returned `eventId` in `tasks.google_calendar_event_id`
5. Log to `calendar_sync_log`

### Integration with Task Service

In `taskService.ts`, after creating/updating/deleting an event:

```typescript
// After DB write and publishEvent()
if (task.type === 'event' && task.due_date) {
  // Fire-and-forget — sync failures shouldn't block the response
  calendarSyncService.syncEventToGoogle(userId, task).catch(err => {
    logger.error('Calendar sync failed', { taskId: task.id, error: err.message });
  });
}
```

> [!NOTE]
> Calendar sync is **fire-and-forget** — it must never block the user's request. Failures are logged and can be retried via a background job (Phase 2+).

### New Routes (`routes/calendar.ts`)

```typescript
// Initiate Google Calendar OAuth (incremental authorization)
POST /api/v1/calendar/connect    { authCode: string }
// Revoke access and delete tokens
POST /api/v1/calendar/disconnect
// Check connection status
GET  /api/v1/calendar/status
// Phase 2: Google push notification receiver
POST /api/v1/calendar/webhook    (no auth — verified by Google channel token)
```

Register in `routes/index.ts`.

---

## Frontend

### Settings Page — Integrations Section

Add a new "Integrations" section to the Settings page:

```
┌─────────────────────────────────────────────┐
│  ⚙ Settings                                │
│                                             │
│  General  │  Behavior  │  Integrations      │
│  ─────────┼────────────┼─────────────────   │
│                                             │
│  Google Calendar                            │
│  ┌───────────────────────────────────────┐  │
│  │  ○ Not connected                      │  │
│  │                                       │  │
│  │  Sync your Planner events with Google │  │
│  │  Calendar. Events with due dates will │  │
│  │  appear on your calendar.             │  │
│  │                                       │  │
│  │  [  Connect Google Calendar  ]        │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  After connecting:                          │
│  ┌───────────────────────────────────────┐  │
│  │  ● Connected                          │  │
│  │  Last synced: 2 minutes ago           │  │
│  │                                       │  │
│  │  [  Disconnect  ]                     │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Settings Route Addition

Add `/settings/integrations` as a new settings section (alongside `general` and `behavior`).

### Sync Indicator on Events (Optional Phase 1 enhancement)

Show a small Google Calendar icon (or "synced" badge) on events that have a `google_calendar_event_id`:

```tsx
{task.google_calendar_event_id && (
  <span className="task-item-sync-badge" title="Synced to Google Calendar">📅</span>
)}
```

### Google OAuth Incremental Authorization Flow

```typescript
function handleConnectCalendar() {
  const client = google.accounts.oauth2.initCodeClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/calendar.events',
    callback: async (response) => {
      await apiConnectCalendar(response.code);
      // Refresh status
    },
  });
  client.requestCode();
}
```

> [!NOTE]
> This uses the **authorization code flow** (not the ID token flow from Feature 2). The auth code is sent to the backend, which exchanges it for access + refresh tokens. This is required because we need a refresh token to make API calls on behalf of the user when they're not online.

---

## Phase 2 & 3 Architecture Notes (For Future Specs)

### Phase 2: Two-Way Sync

- **Google Push Notifications**: Register a webhook channel via `calendar.events.watch()`. Google sends POST requests to `/api/v1/calendar/webhook` when events change.
- **Sync Token**: Use Google's `syncToken` mechanism for incremental sync (only get changes since last sync).
- **Conflict Resolution**: Last-write-wins with timestamp comparison. If Planner event was modified more recently, Planner version wins (and vice versa).
- **Webhook Renewal**: Google channels expire after ~7 days. Need a cron job to renew them.

### Phase 3: Task Sync

- **Google Tasks API** (`tasks.googleapis.com`) — separate from Calendar API
- **Scope**: `https://www.googleapis.com/auth/tasks`
- **Mapping**: Planner task → Google Task (title, due date, completed status)
- **Limitations**: Google Tasks has no priority, no sections, no subtask depth beyond 1

---

## Testing

### Backend
- [ ] Unit test: `encrypt` / `decrypt` round-trip
- [ ] Unit test: `connectCalendar` stores encrypted tokens
- [ ] Unit test: `disconnectCalendar` revokes and deletes tokens
- [ ] Unit test: `syncEventToGoogle` calls Calendar API with correct params
- [ ] Unit test: `updateEventOnGoogle` updates existing calendar event
- [ ] Unit test: `deleteEventFromGoogle` removes calendar event
- [ ] Unit test: Token refresh when access token is expired
- [ ] Integration test: connect → sync → disconnect flow (mocked Google API)
- [ ] Unit test: Sync failure doesn't block task creation

### Frontend
- [ ] Unit test: Settings shows calendar connection UI
- [ ] Unit test: Connect button initiates OAuth flow
- [ ] Unit test: Disconnect button calls API
- [ ] Unit test: Status display (connected/disconnected)

---

## Manual Verification

1. Go to Settings → Integrations → "Connect Google Calendar"
2. Google authorization popup → grant calendar access
3. Status changes to "Connected"
4. Create an event in Planner: `( Dentist appointment` with due date tomorrow
5. Open Google Calendar → verify event appears
6. Edit the event title in Planner → verify GCal updates
7. Delete the event in Planner → verify removed from GCal
8. Create an event without a due date → verify it does NOT sync
9. Disconnect calendar in Settings → verify no more syncing
10. Reconnect → verify existing events with due dates sync

---

## Open Questions

> [!IMPORTANT]
> **Google OAuth Consent Screen Verification**: Calendar scopes require Google's verification process (2–6 weeks). This blocks production launch. Should we:
> - **(A)** Submit for verification early (needs privacy policy page first)
> - **(B)** Launch in "testing" mode (limited to 100 manually-added test users)
> - **(C)** Delay this feature until the app is more mature

> [!IMPORTANT]
> **Incremental vs Upfront Authorization**: Should calendar scope be requested:
> - **(A)** Only when user clicks "Connect Calendar" in settings (recommended — less intrusive, GDPR-friendly)
> - **(B)** At login time alongside `openid email profile` (simpler code, but users see scary calendar permission at login)
>
> **Recommendation**: Option A — incremental authorization

> [!WARNING]
> **Token Encryption Key Rotation**: If `GOOGLE_TOKEN_ENCRYPTION_KEY` needs to be rotated, all stored tokens become unreadable. We need a key rotation strategy:
> - Store key version alongside encrypted data
> - On rotation: re-encrypt all tokens with new key in a migration
> - Support reading old-format tokens during transition

> [!IMPORTANT]
> **Initial Sync**: When a user connects Google Calendar, should we:
> - **(A)** Sync all existing Planner events with due dates to GCal immediately
> - **(B)** Only sync new events created after connecting
>
> **Recommendation**: Option A — sync existing events. Users expect it.
