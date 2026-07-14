Run the full pre-PR verification suite for this monorepo and report results.

Execute these steps in order:

## Step 1 - Type-check

```bash
cd /p/projects/planner
pnpm -F api tsc --noEmit
pnpm -F app tsc --noEmit
```

Report: PASS or list of type errors with file:line.

## Step 2 - Lint

```bash
pnpm lint
```

Report: PASS or list of lint errors.

## Step 3 - Unit tests

```bash
pnpm test
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
