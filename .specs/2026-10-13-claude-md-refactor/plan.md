# Refactor CLAUDE.md: smaller, accurate, same behavior

## Problem

`CLAUDE.md` is 343 lines and about 26 KB. Every agent session loads all of it, but most of it is reference material that agents can read from the code when needed. The file also repeats itself, contradicts itself in a few places, and has grown by patching instead of editing.

Examples found while reading it:

- **Repeated rules.** Hook setup appears 3 times, screenshots 3 times, `Co-Authored-By` 3 times, "all routes under `/api/v1/`" 4 times, "`publishEvent()` is the only broadcast entry point" 4 times, Conventional Commits and TDD twice each.
- **Stale or contradictory facts.**
  - The Socket.IO section says to connect with `{ auth: { token } }`, while the Backend section says sockets use the session cookie and tokens cannot open sockets.
  - The data flow mentions rooms `project:{projectId}`, the Real-time section says `collection:{collectionId}`.
  - The API reference lists `/projects`, but the route file is `collections`.
  - The Co-Authored-By format (`Claude (<model>)`) differs from the one the Claude Code harness injects.
- **Discoverable lists.** One line per service file (`labelService - label CRUD`), the full route-file list, the schema table list and the "Key Files" block duplicate what `ls` and the Backend/Frontend lists already show. They go stale on every change.
- **Rarely needed detail in the always-loaded file.** The production deploy paragraph, the full `SyncEvent` type and the long worktree lifecycle are needed in a few tasks, not in every session.
- **Friction.** "Direct Task Worktree Prompting" makes agents ask about a worktree on every direct coding task, even small edits and CI fixes. The lifecycle uses an undefined `<agent>` placeholder.

## Goals

- File is clearly smaller: target 230 lines or fewer and 17 KB or less, about a third less.
- Agents behave the same: every rule that exists today still exists once, in a place agents will find.
- Every fact in the file is true today, checked against the code.
- No duplicates: each rule or fact lives in one place.

## User-visible behavior

Nothing changes in the app. For developers and agents:

- Sessions start with less context to read.
- Rules are easier to find and edit because there is one place per topic.
- Detail that is moved out stays one link away and is named in `CLAUDE.md` with a one-line trigger ("before touching deploy, read `docs/deploy.md`").

## Decisions

- **Keep inline** what agents must follow on every task: project summary, commands, mutation flow and its invariants (`publishEvent`, `recordActivity`, auth, CSRF), design system rules, coding conventions, commit and branch rules, plan/spec convention, worktree rules.
- **Move out** reference material to `docs/` with a pointer and a trigger: production deploy and rollback, full `SyncEvent` type and rooms, API route reference.
- **Delete** what the code already shows: per-service one-liners that only restate the file name, route-file list, schema table list, the "Key Files" block, the pages table beyond the non-obvious redirect rules.
- **Merge** duplicated rules into the single strongest statement.
- **Co-Authored-By:** one rule, stated once, with a compact per-agent table and a literal example for each. The git history has about 50 variants for 5 agents: parentheses or not (`Claude (Sonnet 5.5)` vs `Claude Sonnet 5.5`), `Co-Authored-By` vs `Co-authored-by`, raw model ids vs readable names, effort written as `high`, `High`, `, high` or `(High)`, trailers with no model, and two different Antigravity emails. The new rule:
  - Prefix is always `Co-Authored-By:` with that exact casing.
  - Name is `<Agent> <Model>` without parentheses (matches what the Claude Code harness injects), e.g. `Claude Sonnet 5.5`.
  - Model is mandatory and readable (`Sonnet 5.5`, `GPT-6`), never a raw id; a bare `Claude`, `Antigravity` or `Copilot` is not allowed.
  - Effort is optional, lowercase, space-separated, no commas or extra parentheses, e.g. `GPT-6 high`. Claude Code omits it.
  - One fixed email per agent: `noreply@anthropic.com`, `codex@openai.com`, `copilot@github.com`, `noreply@opencode.ai`, `noreply@antigravity.ai`.
  - A `commit-msg` hook rejects a trailer that is missing the model or breaks the format, so the rule is enforced and not only written.
  - Existing commits are not rewritten: that would need a force-push on published history, and the variants do not affect GitHub attribution. GitHub-generated trailers (Copilot Autofix, the Copilot noreply address) are out of scope.
- **Worktree prompt:** keep asking, but only for work that needs isolation (features, bugfixes touching app or API). Skip it for docs, CI-only and one-line fixes. This is a behavior change, so it needs the owner's approval before it lands.
- `AGENTS.md`, `GEMINI.md` and `.github/copilot-instructions.md` stay symlinks. Only `CLAUDE.md` is edited.
- The edit is done in one PR with a rule-by-rule mapping, so reviewers can check nothing was lost.

## Relevant Files

- `CLAUDE.md` (the file being refactored; the other three names are symlinks)
- `docs/deploy.md` (new: production deploy and rollback)
- `docs/realtime.md` (new: `SyncEvent`, rooms, socket auth)
- `docs/api.md` (new: route reference)
- `.hooks/commit-msg` (new: validates the `Co-Authored-By` trailer), `.hooks/setup-hooks.sh`
- `DESIGN.md` (linked from the Design System section, unchanged)
- `scripts/blue-green-deploy.sh`, `compose.prod.yml`, `compose.prod.color.yml` (facts in the deploy doc)
- `api/src/index.ts`, `api/src/services/syncService.ts`, `api/src/routes/` (source of truth for socket auth, rooms, routes)
- `~/.claude/CLAUDE.md` (user global file: commit aliases and read-before-edit overlap; not edited by this spec)
