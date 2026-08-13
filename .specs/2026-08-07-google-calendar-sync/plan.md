# Google Calendar Sync — Plan

## Context

With the addition of the `event` type (Feature 1: `.specs/2026-08-07-event-support`) and Google OAuth (Feature 2: `.specs/2026-08-07-google-login`), we can plan synchronization between Planner events and Google Calendar.

### Dependencies
- **Feature 1** (Event Support) must be implemented first — events are the primary sync entity
- **Feature 2** (Google Login) must be implemented first — provides the Google OAuth infrastructure that calendar sync extends with additional scopes
- **Feature 4** (Privacy & Legal, `.specs/2026-08-07-privacy-legal`) — privacy policy must disclose calendar data processing

### Complexity Warning
Calendar sync is significantly more complex than the other two features. This plan is designed for **phased delivery** to manage risk.

---

## Decisions (Confirmed)

| Decision | Answer |
|----------|--------|
| Google consent screen verification | **Testing mode** (100 manually-added test users until app matures) |
| Incremental authorization | **Yes** — request calendar scope only when user connects in Settings |
| Key rotation | **Hardened strategy** with versioned keys and lazy + batch rotation |
| Sync configuration | **Rich UI** — calendar selection, dedicated calendar creation, type toggles |
| Initial sync | **Yes** — sync existing events when connecting, with user preview |

---

## Analysis: What Should Sync?

### Events ✅ (Primary — Phase 1)

| Direction | Behavior |
|-----------|----------|
| Planner → GCal | Events with `due_date` appear on Google Calendar |
| GCal → Planner | Google Calendar events appear as Planner events |

**Rationale**: Events are the natural semantic mapping. A BuJo event (`○ Dentist appointment`) is equivalent to a Google Calendar event.

### Tasks with Due Dates ⚠️ (Phase 1 — User opt-in)

| Direction | Behavior |
|-----------|----------|
| Planner → GCal | Tasks with `due_date` appear on selected Google Calendar |
| GCal → Planner | Not in Phase 1 |

**Decision**: Available from Phase 1 but **off by default**. User enables via the sync configuration screen. Tasks sync to the same target calendar as events.

### Notes ⚠️ (Phase 1 — User opt-in, off by default)

Notes with `due_date` can optionally sync. Most notes won't have dates, so this is a niche use case. Available in the configuration UI but disabled by default.

### Habits ❌ (Never)
Habits have their own tracking system with streaks and weekly grids. Calendar sync would break the habit model.

---

## Phased Delivery

### Phase 1: Planner → Google Calendar (One-way push) ← **This spec**
- User connects Google Calendar in Settings with rich configuration UI
- User selects target calendar or creates a dedicated "Planner" calendar
- User chooses what to sync: events (default on), tasks, notes (off by default)
- When a synced item is created/updated/deleted, it's pushed to Google Calendar
- Initial sync pushes existing items that match the configuration

### Phase 2: Google Calendar → Planner (Two-way sync) — Future spec
- Google Calendar push notifications (webhooks) notify Planner of changes
- New/updated/deleted GCal events are synced back to Planner as events
- Conflict resolution needed (which version wins if both sides change?)

### Phase 3: Full bidirectional with Google Tasks — Future spec
- Google Tasks API integration for task ↔ task sync
- Separate from Calendar API

---

## GDPR / LGPD Considerations (Beyond Feature 2)

### Extended OAuth Scopes

| Scope | Purpose | Sensitivity |
|-------|---------|-------------|
| `openid email profile` | Login (Feature 2) | Non-sensitive |
| `https://www.googleapis.com/auth/calendar` | Read calendars list + read/write events | **Sensitive** |

> [!NOTE]
> We use `calendar` (full access) instead of `calendar.events` because we need to:
> 1. List the user's calendars (for the selection UI)
> 2. Create a new "Planner" calendar (optional)
> 3. Read/write events on the selected calendar

### Google OAuth Consent Screen — Testing Mode

Since calendar scopes are **sensitive**, Google requires app verification before general availability. We'll launch in **testing mode**:

- Limited to 100 manually-added test users
- No Google verification required
- Users must be added to the Google Cloud Console test user list
- When ready for production: submit for verification (2–6 week process)

### Data Flow Analysis

| Direction | What travels | Stored by Planner? |
|-----------|-------------|-----|
| Planner → Google | Event/task titles, dates, times | No (stored by Google) |
| Google → Planner | Calendar list (names, IDs) | Target calendar ID + name only |
| Google → Planner | Calendar event IDs | ✅ For sync tracking |
| Google → Planner | Refresh tokens | ✅ **Encrypted at rest** (AES-256-GCM) |
| Google → Planner | Access tokens | ✅ Short-lived, encrypted |

### Privacy Policy Requirements (See `.specs/2026-08-07-privacy-legal/`)
- Disclose that event/task titles and dates are sent to Google
- Disclose that Google Calendar data (calendar list) is received
- Explain opt-in nature (user must explicitly connect and configure)
- Provide disconnect mechanism that revokes Google access and deletes stored tokens
- Comply with [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)

---

## Encryption Key Rotation Strategy

Google refresh tokens are encrypted at rest using AES-256-GCM. The system supports **key rotation** without service interruption.

### Storage Format

Encrypted values are stored as: `v{version}:iv:tag:ciphertext` (all segments base64-encoded except version prefix).

### Environment Variables

```bash
# Current encryption key (required)
GOOGLE_TOKEN_ENCRYPTION_KEY=<64-char-hex-string>       # 32 bytes = AES-256

# Previous key for rotation transition (optional)
GOOGLE_TOKEN_ENCRYPTION_KEY_PREV=<64-char-hex-string>
```

### Database Column

```sql
-- In google_calendar_connections table
key_version SMALLINT NOT NULL DEFAULT 1
```

### Decryption Logic

```typescript
function decryptToken(encrypted: string, keyVersion: number): string {
  const key = keyVersion === currentKeyVersion
    ? CURRENT_KEY
    : PREVIOUS_KEY;

  if (!key) throw new AppError('ENCRYPTION_KEY_MISSING', 
    `No key available for version ${keyVersion}`, 500);

  return decrypt(encrypted, key);
}
```

### Lazy Rotation

When a token is decrypted with the **previous** key, it is immediately re-encrypted with the **current** key and the row is updated:

```typescript
async function getDecryptedTokens(userId: string): Promise<Tokens> {
  const row = await db.query('SELECT ... FROM google_calendar_connections WHERE user_id = $1', [userId]);
  
  const accessToken = decryptToken(row.access_token_enc, row.key_version);
  const refreshToken = decryptToken(row.refresh_token_enc, row.key_version);

  // Lazy rotation: re-encrypt with current key if using old version
  if (row.key_version !== currentKeyVersion) {
    await reEncryptRow(row.id, accessToken, refreshToken, currentKeyVersion);
  }

  return { accessToken, refreshToken, expiresAt: row.token_expires_at };
}
```

### Batch Rotation (Admin Endpoint)

`POST /api/v1/admin/rotate-encryption-keys` — re-encrypts all tokens with the current key:

```typescript
// Process in batches of 100 to avoid long-running transactions
const rows = await db.query('SELECT id, access_token_enc, refresh_token_enc, key_version FROM google_calendar_connections WHERE key_version != $1', [currentKeyVersion]);
for (const batch of chunk(rows, 100)) {
  await db.transaction(async (tx) => {
    for (const row of batch) {
      const access = decryptToken(row.access_token_enc, row.key_version);
      const refresh = decryptToken(row.refresh_token_enc, row.key_version);
      await tx.query('UPDATE google_calendar_connections SET access_token_enc = $1, refresh_token_enc = $2, key_version = $3 WHERE id = $4',
        [encrypt(access, CURRENT_KEY), encrypt(refresh, CURRENT_KEY), currentKeyVersion, row.id]);
    }
  });
}
```

### Rotation Procedure

1. Generate new 32-byte key: `openssl rand -hex 32`
2. Set `GOOGLE_TOKEN_ENCRYPTION_KEY_PREV` = current key value
3. Set `GOOGLE_TOKEN_ENCRYPTION_KEY` = new key
4. Increment `CURRENT_KEY_VERSION` in config
5. Restart API servers
6. Call `POST /api/v1/admin/rotate-encryption-keys` (or wait for lazy rotation)
7. After confirming all rows have `key_version = N`, remove `GOOGLE_TOKEN_ENCRYPTION_KEY_PREV`

---

## Backend Architecture

### Migration `038_calendar_sync.sql`

```sql
-- Google Calendar connection with encrypted tokens and sync preferences
CREATE TABLE google_calendar_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Encrypted OAuth tokens (AES-256-GCM)
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  key_version SMALLINT NOT NULL DEFAULT 1,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',

  -- Target calendar configuration
  target_calendar_id VARCHAR(255) NOT NULL,
  target_calendar_name VARCHAR(255),
  planner_owned_calendar BOOLEAN NOT NULL DEFAULT false,  -- true if we created this calendar

  -- Sync preferences (what types to push)
  sync_events BOOLEAN NOT NULL DEFAULT true,
  sync_tasks BOOLEAN NOT NULL DEFAULT false,
  sync_notes BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Track which Planner items are synced to Google Calendar
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
npm install googleapis    # Google Calendar API client
```

Token encryption uses Node.js built-in `crypto` module (AES-256-GCM) — no additional dependency.

### New Environment Variables

```bash
GOOGLE_TOKEN_ENCRYPTION_KEY=<64-char-hex-string>        # AES-256 key for token encryption
GOOGLE_TOKEN_ENCRYPTION_KEY_PREV=<64-char-hex-string>   # Previous key (optional, for rotation)
ENCRYPTION_KEY_VERSION=1                                 # Current key version number
```

### Utility: `utils/tokenEncryption.ts`

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const version = parseInt(process.env.ENCRYPTION_KEY_VERSION ?? '1', 10);
  return `v${version}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(encoded: string, key: Buffer): string {
  const parts = encoded.split(':');
  // Handle versioned format: v{N}:iv:tag:ciphertext
  const [ivB64, tagB64, dataB64] = parts.slice(-3);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return decipher.update(Buffer.from(dataB64, 'base64'), undefined, 'utf8') + decipher.final('utf8');
}
```

### New Service: `calendarSyncService.ts`

```typescript
// Connection management
export async function getCalendarList(authCode: string): Promise<Calendar[]>
export async function createDedicatedCalendar(userId: string, name?: string): Promise<Calendar>
export async function connectCalendar(userId: string, config: CalendarSyncConfig): Promise<void>
export async function disconnectCalendar(userId: string): Promise<void>
export async function getConnectionStatus(userId: string): Promise<CalendarConnectionStatus>
export async function updateSyncPreferences(userId: string, prefs: SyncPreferences): Promise<void>

// Sync preview (for configuration screen)
export async function getSyncPreview(userId: string): Promise<SyncPreview>

// Sync operations
export async function syncItemToGoogle(userId: string, task: Task): Promise<void>
export async function updateItemOnGoogle(userId: string, task: Task): Promise<void>
export async function deleteItemFromGoogle(userId: string, taskId: string, gcalEventId: string): Promise<void>
export async function runInitialSync(userId: string): Promise<SyncResult>

// Key rotation
export async function rotateEncryptionKeys(): Promise<{ rotated: number }>
```

**Key types:**

```typescript
interface CalendarSyncConfig {
  authCode: string;
  targetCalendarId: string | 'CREATE_NEW';
  newCalendarName?: string;   // Required when targetCalendarId === 'CREATE_NEW'
  syncEvents: boolean;        // Default: true
  syncTasks: boolean;         // Default: false
  syncNotes: boolean;         // Default: false
}

interface SyncPreview {
  events: { total: number; withDueDate: number };
  tasks: { total: number; withDueDate: number };
  notes: { total: number; withDueDate: number };
}

interface CalendarConnectionStatus {
  connected: boolean;
  targetCalendarName?: string;
  plannerOwnedCalendar?: boolean;
  syncEvents?: boolean;
  syncTasks?: boolean;
  syncNotes?: boolean;
  lastSyncAt?: string;
}
```

### Integration with Task Service

In `taskService.ts`, after creating/updating/deleting a task:

```typescript
// After DB write and publishEvent()
if (task.due_date) {
  const connection = await getConnectionStatus(userId);
  if (!connection.connected) return;

  const shouldSync =
    (task.type === 'event' && connection.syncEvents) ||
    (task.type === 'task' && connection.syncTasks) ||
    (task.type === 'note' && connection.syncNotes);

  if (shouldSync) {
    // Fire-and-forget — sync failures must never block the response
    calendarSyncService.syncItemToGoogle(userId, task).catch(err => {
      logger.error('Calendar sync failed', { taskId: task.id, error: err.message });
    });
  }
}
```

### New Routes (`routes/calendar.ts`)

```typescript
// Exchange auth code for tokens, return calendar list for selection
POST /api/v1/calendar/authorize     { authCode: string } → { calendars: Calendar[] }

// Complete connection with user's configuration choices
POST /api/v1/calendar/connect       { targetCalendarId, newCalendarName?, syncEvents, syncTasks, syncNotes }

// Get sync preview (counts of what would sync)
GET  /api/v1/calendar/preview       → { events: {total, withDueDate}, tasks: {...}, notes: {...} }

// Check connection status
GET  /api/v1/calendar/status        → { connected, targetCalendarName, syncEvents, ... }

// Update sync preferences (what types to sync)
PATCH /api/v1/calendar/preferences  { syncEvents?, syncTasks?, syncNotes? }

// Revoke access and delete tokens
POST /api/v1/calendar/disconnect

// Admin: batch re-encrypt tokens with current key
POST /api/v1/admin/rotate-encryption-keys  (admin-only)

// Phase 2: Google push notification receiver
POST /api/v1/calendar/webhook       (no auth — verified by Google channel token)
```

Register in `routes/index.ts`.

---

## Frontend — Sync Configuration UI

### Connection Flow

The connection is a **multi-step process** presented in a modal dialog:

```
Step 1: Google OAuth popup → get auth code
Step 2: POST /calendar/authorize → get calendar list
Step 3: Show configuration screen (see below)
Step 4: POST /calendar/connect → save configuration + trigger initial sync
```

### Configuration Screen (`CalendarSyncDialog`)

```
┌─────────────────────────────────────────────────────┐
│  Connect Google Calendar                        ✕   │
│─────────────────────────────────────────────────────│
│                                                     │
│  Where to sync                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ ○ Create a dedicated "Planner" calendar     │    │
│  │   Name: [Planner________________]           │    │
│  │                                             │    │
│  │ ○ Use an existing calendar                  │    │
│  │   ┌──────────────────────────────────┐      │    │
│  │   │ My Calendar                   ▼  │      │    │
│  │   │ Work                             │      │    │
│  │   │ Personal                         │      │    │
│  │   │ Family                           │      │    │
│  │   └──────────────────────────────────┘      │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  What to sync                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │ ☑ Events                      12 items      │    │
│  │   Events with due dates will appear on      │    │
│  │   your calendar                             │    │
│  │                                             │    │
│  │ ☐ Tasks with due dates        47 items      │    │
│  │   Tasks with due dates will appear as       │    │
│  │   calendar events                           │    │
│  │                                             │    │
│  │ ☐ Notes with due dates         3 items      │    │
│  │   Notes with due dates will appear as       │    │
│  │   calendar events                           │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌──────────────────────────────────────────── ┐    │
│  │  ℹ Items without due dates are not synced.  │    │
│  │  You can change these settings anytime in   │    │
│  │  Settings → Integrations.                   │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  [ Cancel ]                   [ Connect & Sync ]    │
└─────────────────────────────────────────────────────┘
```

**Key UX decisions:**
- "Create dedicated calendar" is the **default/recommended** option — keeps Planner items separate from the user's personal events
- Item counts are fetched from `GET /calendar/preview` and shown live
- Events are checked by default; tasks and notes are unchecked
- The calendar name defaults to "Planner" but is editable
- Design follows Planner aesthetics: Lora font, cream/ink palette, 1px borders

### Settings → Integrations (Post-connection)

After connecting, the Settings → Integrations page shows the active configuration:

```
┌─────────────────────────────────────────────────────┐
│  Google Calendar                                    │
│  ┌─────────────────────────────────────────────┐    │
│  │  ● Connected to "Planner" calendar          │    │
│  │  Last synced: 2 minutes ago                 │    │
│  │                                             │    │
│  │  Syncing: Events ✓  Tasks ✗  Notes ✗       │    │
│  │                                             │    │
│  │  [ Edit preferences ]    [ Disconnect ]     │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

"Edit preferences" opens the same configuration screen (minus the OAuth step) to change what types are synced.

### Settings Route Addition

Add `/settings/integrations` as a new settings section (alongside `general` and `behavior`).

### Sync Indicator on Items

Show a small sync badge on items that have a `google_calendar_event_id`:

```tsx
{task.google_calendar_event_id && (
  <span className="task-item-sync-badge" title="Synced to Google Calendar">
    <CalendarIcon size={12} />
  </span>
)}
```

### Google OAuth Incremental Authorization

```typescript
function handleConnectCalendar() {
  const client = google.accounts.oauth2.initCodeClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/calendar',
    callback: async (response) => {
      // Step 2: Exchange code and get calendar list
      const { calendars } = await apiAuthorizeCalendar(response.code);
      // Step 3: Show configuration dialog with calendar list
      openCalendarSyncDialog(calendars, response.code);
    },
  });
  client.requestCode();
}
```

> [!NOTE]
> This uses the **authorization code flow** (not the ID token flow from Feature 2). The auth code is sent to the backend, which exchanges it for access + refresh tokens. This is required because we need a refresh token for server-side API calls.

---

## Phase 2 & 3 Architecture Notes (For Future Specs)

### Phase 2: Two-Way Sync

- **Google Push Notifications**: Register a webhook channel via `calendar.events.watch()`. Google sends POST requests to `/api/v1/calendar/webhook` when events change.
- **Sync Token**: Use Google's `syncToken` mechanism for incremental sync (only get changes since last sync).
- **Conflict Resolution**: Last-write-wins with timestamp comparison. If Planner event was modified more recently, Planner version wins (and vice versa).
- **Webhook Renewal**: Google channels expire after ~7 days. Need a cron job to renew them.
- **Dedicated calendar advantage**: If user created a "Planner" calendar, we own it — no conflicts with external edits.

### Phase 3: Google Tasks API

- **Google Tasks API** (`tasks.googleapis.com`) — separate from Calendar API
- **Scope**: `https://www.googleapis.com/auth/tasks`
- **Mapping**: Planner task → Google Task (title, due date, completed status)
- **Limitations**: Google Tasks has no priority, no sections, no subtask depth beyond 1

---

## Testing

### Backend
- [ ] Unit test: `encrypt` / `decrypt` round-trip
- [ ] Unit test: versioned key format parsing
- [ ] Unit test: lazy rotation re-encrypts with current key
- [ ] Unit test: batch rotation processes all outdated rows
- [ ] Unit test: `connectCalendar` stores encrypted tokens with correct config
- [ ] Unit test: `disconnectCalendar` revokes tokens and deletes row
- [ ] Unit test: `getCalendarList` returns user's calendars
- [ ] Unit test: `createDedicatedCalendar` creates calendar via Google API
- [ ] Unit test: `getSyncPreview` returns correct counts per type
- [ ] Unit test: `syncItemToGoogle` calls Calendar API with correct params
- [ ] Unit test: `syncItemToGoogle` respects sync preferences (only syncs enabled types)
- [ ] Unit test: `updateItemOnGoogle` updates existing calendar event
- [ ] Unit test: `deleteItemFromGoogle` removes calendar event
- [ ] Unit test: Token refresh when access token is expired
- [ ] Unit test: Sync failure doesn't block task creation
- [ ] Integration test: authorize → configure → connect → sync → disconnect flow (mocked Google API)

### Frontend
- [ ] Unit test: Calendar sync dialog renders with calendar list
- [ ] Unit test: "Create dedicated calendar" option works
- [ ] Unit test: Sync type checkboxes toggle correctly
- [ ] Unit test: Preview counts display
- [ ] Unit test: Settings shows connection status
- [ ] Unit test: Edit preferences reopens configuration
- [ ] Unit test: Disconnect button calls API
- [ ] Unit test: Sync badge appears on synced items

---

## Manual Verification

1. Go to Settings → Integrations → "Connect Google Calendar"
2. Google authorization popup → grant calendar access
3. Configuration screen appears with calendar list
4. Select "Create dedicated Planner calendar" → name it "My Planner"
5. Check "Events" (default), check "Tasks with due dates"
6. Click "Connect & Sync" → initial sync runs
7. Open Google Calendar → verify "My Planner" calendar exists with synced events
8. Create a new event in Planner: `( Dentist tomorrow` → appears on GCal
9. Create a task with due date → appears on GCal (since tasks sync is enabled)
10. Create a note without due date → does NOT sync
11. Edit event title → GCal updates
12. Delete event → removed from GCal
13. Settings → Integrations → "Edit preferences" → uncheck "Tasks" → verify tasks stop syncing
14. Settings → Integrations → "Disconnect" → verify no more syncing, tokens deleted
15. Reconnect with different calendar → verify new target works
