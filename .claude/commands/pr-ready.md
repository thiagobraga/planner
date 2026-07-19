Run the full pre-PR verification suite for this monorepo and report results.

Execute these steps in order:

## Step 1 - Type-check

```bash
docker compose exec api npm exec tsc --noEmit
docker compose exec app npm exec tsc --noEmit
```

Report: PASS or list of type errors with file:line.

## Step 2 - Lint

```bash
docker compose exec api npm run lint
docker compose exec app npm run lint
```

Report: PASS or list of lint errors.

## Step 3 - Unit tests

```bash
docker compose exec api npm test
docker compose exec app npm test
```

Report: PASS or failing test names with assertion errors quoted exactly.

## Step 4 - Summary

Print a table:
| Check | Status | Notes |
|-------|--------|-------|
| Types (api) | ✓/✗ | ... |
| Types (app) | ✓/✗ | ... |
| Lint | ✓/✗ | ... |
| Tests | ✓/✗ | N passed, M failed |

If all pass: "Ready to push."
If any fail: list blockers and suggest fixes.
