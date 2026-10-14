# Tasks

Legend: `[ ]` not started, `[~]` in progress, `[x]` done.

Baseline (measured on `main`, commit `7fed18f`): 343 lines, 26594 bytes.

1. [x] Spec (`plan.md`, this file)
2. [ ] Set up
   - [ ] Branch `docs/claude-md-refactor` in worktree `../planner-claude-md` (docs only, no stack needed)
   - [ ] Save the baseline: `git show main:CLAUDE.md > /tmp/claude-md.before` for the mapping step
3. [ ] Inventory every rule
   - [ ] Number each rule and fact in the current file in a scratch table: `id | text | section | duplicate of | verdict (keep / merge / move / delete)`
   - [ ] Mark duplicates found so far: hooks setup (Quickstart, Git Hooks, workflow step 3), screenshots (Conventions, workflow steps 4 and 5), `Co-Authored-By` (aliases, trailer rule, step 5), `/api/v1` (Backend, Conventions, API Reference), `publishEvent` (Backend, mutation flow, Real-time, Conventions), Conventional Commits and TDD (Conventions, step 5)
4. [ ] Verify every fact against the code (fix, do not copy)
   - [ ] Socket auth: `api/src/index.ts` and `app/src/utils/socket.ts` use the session cookie. Remove `{ auth: { token } }` from the Real-time section
   - [ ] Rooms: `api/src/services/syncService.ts` builds `user:*` and `collection:*`. Replace `project:{projectId}` in the mutation flow
   - [ ] Routes: compare the API Reference with `api/src/routes/index.ts` (`/projects` vs `collections`, `/activity` placement)
   - [ ] Migrations range `001-048` (currently 48 numbered files, drop the count)
   - [ ] Node: `engines` is `>=24`, CI uses 26 (`2a.quality.yml`); state the real minimum once
   - [ ] `Co-Authored-By`: compare the `Claude (<model>)` format with the trailer the harness injects and keep one rule
   - [ ] `<agent>` placeholder in `COMPOSE_PROJECT_NAME` and `APP_SUBDOMAIN`: define it or replace it with `<slug>`
5. [ ] Move reference material out
   - [ ] `docs/deploy.md`: the Production deploy paragraph, including rollback; keep one sentence plus pointer in `CLAUDE.md` ("Keep production migrations backward-compatible" stays inline)
   - [ ] `docs/realtime.md`: `SyncEvent` type, rooms, socket auth; keep the `publishEvent()` rule inline once
   - [ ] `docs/api.md`: route groups and OAuth endpoints; keep base URL, auth and error shape inline (3 lines)
   - [ ] Add one pointer line per doc with its trigger
6. [ ] Rewrite `CLAUDE.md`
   - [ ] Delete discoverable lists: per-service one-liners that only restate the name, route-file list, schema table list, Key Files block
   - [ ] Keep non-obvious service notes only (`syncService`, `activityService.recordActivity`, `dailyService`, `completionSync`, `oauthService`, `mcp/`)
   - [ ] Merge duplicated rules (task 3) into one statement each
   - [ ] Drop the Karpathy section if every bullet is covered by Conventions, otherwise reduce it to the two bullets that are not
   - [ ] Compact the per-agent `Co-Authored-By` list into a table
   - [ ] Reduce the pages table to the non-obvious rules (redirects, admin-only, `AuthShell` routes)
   - [ ] Worktree prompt: scope it to features and fixes, skip docs-only and CI-only work (needs owner approval, see `plan.md`)
   - [ ] Keep the headings other tooling or humans link to (`Plan Mode - Specs Convention`, worktree lifecycle)
7. [ ] Check nothing was lost
   - [ ] Mapping table in the PR description: every rule from task 3 points to its new line, doc, or reason for deletion
   - [ ] Targets: `wc -l CLAUDE.md` is 230 or less, `wc -c CLAUDE.md` is 17000 or less
   - [ ] `ls -l AGENTS.md GEMINI.md .github/copilot-instructions.md` still show symlinks to `CLAUDE.md`
   - [ ] No em dashes: `grep -nP '\x{2014}|\x{2013}' CLAUDE.md docs/*.md` returns nothing
   - [ ] Every link and path in the file exists: `grep -oE '`[a-zA-Z0-9_./-]+\.(ts|tsx|md|sh|yml)`' CLAUDE.md | tr -d '`' | sort -u | xargs ls`
   - [ ] Behavior probe in a fresh Claude Code session on the branch: ask it to (a) add a mutation, (b) commit, (c) start a feature. Confirm it still calls `publishEvent()`, uses Conventional Commits with a trailer, and offers a worktree
8. [ ] Ship
   - [ ] Small Conventional Commits: `docs: move deploy notes to docs/deploy.md`, `docs: move realtime reference`, `docs: refactor CLAUDE.md`
   - [ ] PR with the mapping table and before/after size
   - [ ] Move this spec to `.specs/completed/`
