Review the code changes in this session (or $ARGUMENTS if provided) against these project-specific criteria:

## Architecture Checks
- Mutations follow the 5-step data flow: REST → service → PostgreSQL → `publishEvent()` → Socket.IO
- `publishEvent()` in `api/src/services/syncService.ts` is called after every DB mutation that needs broadcasting
- Auth middleware (`api/src/middleware/auth.ts`) used on all protected routes — validates JWT AND checks DB session
- New routes registered in `api/src/routes/index.ts` under `/api/v1/`

## Frontend Checks
- State changes go through Zustand stores in `app/src/stores/` — not local state for shared data
- Optimistic updates use helpers from `app/src/stores/optimistic.ts` (applyOptimistic, revertOptimistic, upsertById, removeById, patchById)
- API calls use the Fetch wrapper at `app/src/api/client.ts` — not raw fetch
- Real-time updates handled in `app/src/hooks/useSync.ts` — not inline socket listeners

## Design System Checks (CLAUDE.md / DESIGN.md)
- Font: Lora serif only — no sans-serif anywhere
- Colors: warm cream/beige background, brick-red accent used sparingly (≤10% of screen)
- Elevation: flat — tint + 1px border only; no box-shadow on cards
- Vertical rhythm: 24px baseline

## Testing Checks
- New services have unit tests in `api/src/services/__tests__/`
- Edge cases covered by property-based tests (fast-check) where applicable — recurrence, filters, auth
- Frontend hooks/components tested in `app/src/hooks/__tests__/` or `app/src/components/__tests__/`

## Security Checks
- No secrets/tokens in logs or error messages
- Rate limiting in place for auth endpoints (10 attempts / 15 min via Redis)
- JWT expiry is 7 days — no indefinite tokens

Report findings as: `path:line: <severity>: <problem>. <fix>.`
Severities: BLOCKER, WARNING, NITPICK.
