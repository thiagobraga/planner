Run tests for: $ARGUMENTS

Interpret $ARGUMENTS as:

- empty → run all tests
- `api` → API tests only
- `app` → frontend tests only
- `property` → property-based tests only (`*.property.test.ts`)
- `integration` → integration/sync tests only
- any other string → find and run matching test file(s)

## Commands

**All tests:**

```bash
cd /p/projects/planner && pnpm test
```

**API only:**

```bash
pnpm -F api test
```

**App only:**

```bash
pnpm -F app test
```

**Single file - find then run:**

```bash
find /p/projects/planner -name "*$ARGUMENTS*.test.ts" -not -path "*/node_modules/*"
# then run the matched path, e.g.:
pnpm -F api vitest run src/services/__tests__/taskService.test.ts
pnpm -F app vitest run src/hooks/__tests__/useSync.test.ts
```

**Property tests only:**

```bash
find /p/projects/planner -name "*.property.test.ts" -not -path "*/node_modules/*"
pnpm -F api vitest run --reporter=verbose src/services/__tests__
```

**Integration/sync tests only:**

```bash
find /p/projects/planner -name "*.integration.test.ts" -o -name "*.sync.test.ts" | grep -v node_modules
```

## Test file locations

- API unit tests: `api/src/services/__tests__/*.test.ts`
- API property tests: `api/src/services/__tests__/*.property.test.ts`
- API sync tests: `api/src/services/__tests__/*.sync.test.ts`
- Frontend hook tests: `app/src/hooks/__tests__/*.test.ts`
- Frontend component tests: `app/src/components/__tests__/*.test.ts`
- Frontend integration tests: `app/src/hooks/__tests__/*.integration.test.ts`

## After running

Report:

- Total: N passed, M failed, K skipped
- Failures: test name + assertion error quoted exactly + file:line
- Suggest fix for each failure if cause is clear
