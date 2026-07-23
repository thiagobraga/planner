# Test Coverage — Security Hardening Changes

Tests written to cover the security hardening changes from
`.specs/2026-07-18-production-security-hardening/`. Each covers a new code path
introduced or hardened during that phase.

## Tests added

### `api/src/routes/__tests__/security.test.ts` (+8 tests)

| Test | What it covers |
|------|---------------|
| CSP report-uri directive | `Content-Security-Policy` contains `report-uri /api/v1/csp-violation` |
| Permissions-Policy header | Header present with camera, microphone, geolocation, payment restricted |
| Cross-Origin-Opener-Policy | `same-origin` policy set |
| Cross-Origin-Embedder-Policy | `require-corp` policy set |
| Oversized body rejection | POST >100kb returns 413 with `PAYLOAD_TOO_LARGE` |
| Non-JSON POST rejection | POST without `application/json` returns 415 |
| Non-JSON PATCH rejection | PATCH without `application/json` returns 415 |
| HSTS header | `Strict-Transport-Security` present via Helmet default |

### `api/src/utils/__tests__/securityLogger.test.ts` (18 tests)

| Test | What it covers |
|------|---------------|
| 14 event-type tests | Every `SecurityEventType` logs correct `type` field |
| Request context inclusion | `requestId` and `ip` present when `req` is provided |
| Request context omission | Fields absent when no `req` is given |
| Backup methods | `backupCreated`, `backupRestored`, `backupRestoreVerified`, `backupFailed` |
| Metadata | `authLoginFailure` includes `reason` in metadata |

### `api/src/middleware/__tests__/requestContext.test.ts` (4 tests)

| Test | What it covers |
|------|---------------|
| X-Socket-Id stored | `currentSourceId()` returns the header value |
| Absent header | `currentSourceId()` returns `undefined` |
| Array header values | `undefined` for multi-value headers |
| Concurrent isolation | Nested requests don't leak context |

### `api/src/utils/__tests__/taskValidation.test.ts` (20 tests)

| Test | What it covers |
|------|---------------|
| Valid create/update | No error for well-formed input |
| Missing/empty/long title | Rejected with field-specific detail |
| Priority bounds | Below 1, above 4, non-integer rejected |
| Invalid type | Non-task/note value rejected |
| Malformed dueDate | Non-ISO date rejected |
| Reorder position | Negative, non-integer, non-number rejected |

## Coverage metrics

| File | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| `securityLogger.ts` | 100% | 95.83% | 100% | 100% |
| `taskValidation.ts` | 100% | 100% | 100% | 100% |
| `requestContext.ts` | 100% | 100% | 100% | 100% |
| `errorHandler.ts` | 100% | 100% | 100% | 100% |

The one uncovered branch in `securityLogger.ts` (line 42) is the
`req?.socket?.remoteAddress` fallback — unreachable in Express because
`req.ip` is always set by the framework.

## Coverage gaps

These have been moved to `.specs/2026-07-23-test-coverage-phase2/` for the next phase.
