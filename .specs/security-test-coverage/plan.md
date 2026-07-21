# Security + Test Coverage — Plan

## Strategy

Address the highest-priority security gaps first, then shore up missing test
coverage.  Each change is small and independently testable — commit after every
green test run.

## Gaps addressed

### Security (in order)

1. **Missing Permissions-Policy header & CSP report-uri** — quick Helmet config
   change; the existing security test gets two new assertions.
2. **No request body size limit** — `express.json({ limit })` is not configured,
   so Express defaults to 100kb which is fine but should be explicit.
3. **No security logger tests** — `securityLogger.ts` has zero coverage.
4. **No requestContext middleware tests** — `requestContext.ts` has zero
   coverage (notFound test exists but requestContext does not).

### Test coverage

5. **Input validation for task routes** — task routes pass `req.body` straight
   to the service with zero schema validation in the route layer.  Add a
   lightweight validation helper for route-level guards (title length, priority
   range, type enum).
6. **Dependency scanning config** — add `"snyk"` or `"npm audit"` as a CI script
   (via package.json).

Non-goals for this round: real-DB integration tests (requires infra), e2e
Playwright tests for core workflows (separate effort), full zod/joi schema
library install (architecture decision deferred).
