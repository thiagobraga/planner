# Test Coverage — Security Hardening

## Phase 1: Hardening & Initial Tests (Completed)
- [x] Create `.specs/` folders with plan and task files
- [x] Add Permissions-Policy header and CSP report-uri to Helmet config
- [x] Add explicit request body size limit to Express JSON config
- [x] Add npm audit CI step to package.json scripts
- [x] Security headers: CSP report-uri, Permissions-Policy, COOP, COEP, HSTS
- [x] Request body size rejection (413)
- [x] Content-type enforcement (415)
- [x] taskValidation.test.ts — route-level input validation (23 tests, 100% coverage)
- [x] securityLogger.test.ts — all 18 event types
- [x] requestContext.test.ts — AsyncLocalStorage isolation
- [x] security.test.ts — Permissions-Policy + CSP report-uri and body size limit


