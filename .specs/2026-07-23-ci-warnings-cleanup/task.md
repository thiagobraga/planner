# CI Warnings Cleanup — Tasks

## React hook dependencies (app)
- [x] `app/src/pages/HabitsPage.tsx:92-93` — wrap `habits`/`groups` in `useMemo` (affects hooks at L149, L326, L376)
- [x] `app/src/pages/CollectionsPage.tsx:246,257` — add `invalidate` to useCallback deps
- [x] `app/src/hooks/useFloatingPosition.ts:136` — add `options.position` to effect deps
- [x] `app/src/components/ui/CustomSelect.tsx:82` — add `alwaysOpen` to effect deps
- [x] `app/src/components/TaskDetail.tsx:62` — add `task` to effect deps
- [x] `app/src/components/SearchOverlay.tsx:65` — move/memoize `flatResults`

## Unused vars/imports (api)
- [x] `api/src/services/__tests__/sessionLifecycle.test.ts` — drop unused `tokenHash` (L44), `afterEach` (L1)
- [x] `api/src/services/__tests__/rateLimitService.test.ts` — drop unused `afterEach` (L1)
- [x] `api/src/services/__tests__/authorization.property.test.ts` — drop unused `expect` (L1)
- [x] `api/src/routes/__tests__/security.test.ts` — drop unused `buildCookieOptions`, `buildCookieName` (L60)
- [x] `api/src/routes/__tests__/index.test.ts` — drop unused `beforeEach` (L1)
- [x] `api/src/middleware/__tests__/requestContext.test.ts` — drop unused `vi` (L1)
- [x] `api/src/engines/recurrenceEngine.ts:32` — remove dead `isLeapYear` (confirmed unused; `daysInMonth` already handles leap logic via `Date`)
- [x] `api/src/config.test.ts:2` — remove unused `fs` import (mock at L8 references string `"node:fs"`, not the binding)

## CI/CD version bumps
- [x] `.github/workflows/security.yml` — bump `codeql-action/init@v3`→`v4`, `codeql-action/analyze@v3`→`v4`, `codeql-action/upload-sarif@v3`→`v4`
- [x] `.github/workflows/deploy.yml` — bump `codeql-action/upload-sarif@v3`→`v4`

## CI annotation follow-up
- [x] `app/src/pages/InboxPage.tsx:249,261` — add `invalidate` to `useCallback` dependencies
- [x] `api/src/services/taskService.ts:6` — remove unused `addDaysISO` import
- [x] `api/src/services/sessionService.ts:3` — remove unused `AppError` import
- [x] `api/src/services/rateLimitService.ts:79,101` — remove unused `maxAccount` and `windowSeconds`
- [x] `api/src/services/authService.ts:14` — remove unused `getProgressiveDelay` import
- [x] `api/src/services/__tests__/taskService.property.test.ts:381` — mark generated `numDescendants` value intentionally unused
- [x] `api/src/services/__tests__/syncService.server.test.ts:53-54` — remove unused `getIO` and `redisSubClient` imports
- [x] `.github/workflows/pipeline.yml` — run PR CodeQL through the same caller workflow configuration as `main`
- [x] `.github/workflows/pipeline.yml` — run PR-safe API/app container scans with the same SARIF categories as `main`
- [x] `.github/workflows/quality.yml`, `.github/workflows/security.yml` — remove duplicate direct PR triggers after pipeline consolidation

## Tracked, no action yet
- [x] `actions/checkout@v4` Node.js 20 deprecation — upgraded all workflow uses to Node 24-native `actions/checkout@v5`
- [x] Remaining Node.js 20 deprecation warnings — upgraded `upload-artifact`, `setup-buildx-action`, and `build-push-action` to Node 24-native majors
