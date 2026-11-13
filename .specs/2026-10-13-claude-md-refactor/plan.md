# Refactor agent instructions, workflows, and specs

## Why this exists

The root instructions have grown by patching. On 2026-11-07 the working copy is 350 lines and 30,294 bytes, with repeated rules and a few facts that no longer match the code. The `.claude` agents, commands, and skills add another 1,424 lines, and several of them still describe JWT and localStorage auth, mock-database tests, or migration transactions that the current code does not use.

The result is noisy for every agent session and risky for work that follows an outdated example. This refactor makes the instructions smaller and accurate, gives each workflow one clear home, and makes new specs easier to read and maintain.

## What changes for people

- Agent sessions load less context and find each rule in one place.
- Workflows match the current session auth, sync contract, test rules, and worktree layout.
- New specs are one readable plan with a short task list instead of two files with repeated detail.
- Personal habits can live in personal instructions, while Planner keeps the rules a collaborator needs.
- App behavior does not change.

## Scope

In scope:

- `CLAUDE.md` and its symlinked names.
- Existing `.claude/agents`, `.claude/commands`, and `.claude/skills` files.
- The spec convention in `CLAUDE.md` and this spec.
- A proposal for sharing personal rules across agent clients.
- Focused reference docs for material that does not need to load every session.

Out of scope unless a later review approves it:

- Application behavior and production deployment.
- Changing the tracked Playwright MCP configuration. The audit documents it only.
- Changing the commit trailer policy or adding an enforcement hook. Both need a separate evidence review.
- Rewriting all existing specs. Only new specs and specs being actively revised use the new format.

## Decisions

- **Size target:** `CLAUDE.md` stays at or below 230 lines and 17 KB. The target is a requirement, not a suggestion, but content is not dropped just to hit a number.
- **Keep the essentials inline:** project identity, commands, mutation and activity invariants, auth boundaries, design rules, coding and test rules, commit and branch rules, spec convention, and worktree workflow.
- **Move reference material out:** deploy and rollback, the full sync event and socket details, and the API route reference go to focused docs. `CLAUDE.md` keeps a one-line trigger for each.
- **Delete what the code already shows:** per-service one-liners that only restate a filename, the full route-file list, the schema table list, the key-files block, and page-table rows that do not explain a redirect, an admin-only rule, or logged-out routing.
- **One statement per rule:** merge duplicates into the strongest version and remove the other copies.
- **Preserve symlinks:** `AGENTS.md`, `GEMINI.md`, and `.github/copilot-instructions.md` stay symlinks to `CLAUDE.md`.
- **Keep the current isolation prompt:** a direct coding task without a spec or plan still asks about a worktree or branch. This is not narrowed to features and substantial fixes.
- **Split personal from shared rules:** general communication style, research habits, engineering habits, and commit aliases are candidates for user-level instructions. Planner keeps security, testing, architecture, design, and workflow requirements that affect the repository and its collaborators.
- **Commit aliases belong to the personal workflow:** compare the current global aliases with Planner's aliases and decide each one before moving or deleting anything. Planner keeps the repository-wide commit and branch requirements.
- **Review the trailer policy with evidence:** the current file says `Claude (<model>)`, while recent history shows `Claude Sonnet 5.5`. Compare client behavior, existing hooks, and attribution needs before changing policy or adding a hook.
- **Keep existing workflow entry points:** audit and improve the current agents, commands, and skills instead of replacing them wholesale. New capabilities are added only where they have a distinct job.
- **Choose the right surface per capability:** use a skill for repeatable guidance, an agent for independent specialist work, and a command only for a useful explicit entry point.
- **New security workflow is read-only by default:** audit auth, authorization, secrets, CSRF, input boundaries, and data safety, then report evidence. Fixes happen only when separately requested.
- **New MCP workflow covers development and verification:** tool design, registration, scopes, authorization, service reuse, and tests. Using Planner as a task list is covered by the separate agent-task-tool spec, not duplicated here.
- **Release and deploy workflow is checks-only:** verify readiness and document rollback, but never deploy or change production without an explicit request and confirmation for risky actions.
- **Testing is risk-based:** require unit, real integration, and E2E coverage where the change needs it. Report checks that could not run. UI changes still need desktop and narrow-screen screenshots.
- **Specs use one file:** new specs have only `plan.md`. The plan explains the work in readable prose, with a short checklist at the end. Existing specs are consolidated only when actively revised, preserving decisions and progress.
- **Do not repeat the standard workflow in every plan:** worktree setup, PR creation, hooks, and generic verification already live in the shared instructions. A plan mentions only task-specific exceptions, dependencies, risks, or verification needs.
- **Review every change:** additions, deletions, and policy changes are shown to the owner before they are applied. Personal instruction files are proposed first and edited only after approval.

## Detailed design

### 1. `CLAUDE.md`

#### Structure

Keep the file focused on what an agent must know before touching Planner:

- The symlink rule and a short project description.
- Rules that apply on every task.
- Quickstart, commands, and dev hosts.
- The mutation flow and the sync and activity invariants.
- Backend boundaries and the few service notes that are not obvious from filenames.
- Frontend state layers and the non-obvious route rules.
- Design system rules with a link to `DESIGN.md`.
- Coding, testing, security, and data rules.
- Commit and branch rules.
- The single-file spec convention.
- The worktree lifecycle, kept concise.

The final section order is decided during the rule inventory. Existing headings that people or tooling link to are preserved unless the link is updated.

#### Rule inventory

Before editing, number every rule and fact in the current file. For each one record the section, any duplicate, and whether it is kept, merged, moved, or deleted. The mapping goes in the PR description so a reviewer can see that nothing important was lost.

Known duplicates to resolve:

- Hook setup appears in the quickstart, a separate git-hooks section, and the worktree workflow.
- Screenshot rules appear in the conventions and twice in the lifecycle.
- `Co-Authored-By` appears in the aliases, the trailer list, and the lifecycle.
- The `/api/v1` rule appears in the backend notes, conventions, and API reference.
- `publishEvent()` appears in the backend notes, mutation flow, realtime section, and conventions.
- TDD and Conventional Commits appear in both the conventions and the lifecycle.

#### Facts to verify against the code

- Socket auth uses the session cookie. Remove the old `{ auth: { token } }` guidance.
- Rooms are `user:{userId}` and `collection:{collectionId}`. Do not keep the old `project:{projectId}` name.
- API route names match the route files, including `collections`, not `projects`.
- The migration count is not hard-coded. The current range is already stale.
- Node minimum is `>=24`; CI uses Node 26. State the real minimum once.
- The worktree placeholder is `<slug>` or a defined agent name, never an undefined `<agent>`.
- The spec convention is updated to the one-file format described below.
- The commit trailer rule matches the approved policy after the separate review.
- Links and paths in the file point to files that exist.

#### Moves

- `docs/deploy.md`: production deploy and rollback. Keep one sentence in `CLAUDE.md` and the rule that production migrations stay backward-compatible.
- `docs/realtime.md`: the full `SyncEvent` shape, room names, socket authentication, `sourceId`, and actor attribution. Keep the `publishEvent()` rule inline once.
- `docs/api.md`: route groups and OAuth endpoints. Keep the base URL, auth methods, and error shape inline.
- Add a one-line trigger beside each pointer so an agent knows when to open the doc.

#### Deletions and compaction

- Remove per-service one-liners that only repeat the filename.
- Remove the route-file list and the schema table list.
- Remove the key-files block; the architecture and source tree already provide it.
- Reduce the pages table to redirects, admin-only routes, and logged-out `AuthShell` routes.
- Drop the Karpathy section if every useful bullet is already covered by the rules. Otherwise keep only the bullets that add something.
- Replace the per-agent trailer list with one compact table after the policy review.
- Keep the worktree lifecycle but remove repeated screenshots, commits, and hook setup.

### 2. `.claude` audit

#### Agents

- `code-reviewer`: replace JWT language with the current session and API-token model, verify the sync event fields, and review the pinned model.
- `db-migrator`: remove the outdated schema overview and resolve the transaction contradiction. The migration runner already wraps each file in a transaction, so migration files must not add their own `BEGIN` and `COMMIT`. Review the model.
- `frontend-builder`: remove references to pages that no longer exist, verify the current component and styling patterns, and replace "if possible" test language with the risk-based testing rule. Review the model.
- `sync-debugger`: fix the auth description, event field names, room names, and missing `sourceId` and actor context. Review the model.
- `test-runner`: its description says it writes tests, but its tool list cannot edit files. Decide whether it is a diagnosis-only agent or give it the tools and instructions to write tests. Review the model.

All pinned model identifiers are checked against the supported client models. For each role, decide whether to inherit the session model or pin one, and record the reason.

#### Commands

- `debug-sync`: replace JWT and localStorage instructions with the session-cookie and Socket.IO flow. Replace the login-and-token curl example with a current session flow.
- `new-component`: verify the current component style, export convention, and CSS approach before keeping the template.
- `new-service`: remove the mock-database test template because the project requires real DB and Redis integration tests. Fix the event shape, route registration, type placement, and placeholder names.
- `review`: replace the JWT expiry claim and old auth language with the current session validation and DB check.
- `test`: remove the hard-coded `/p/projects/planner` path so it works in a worktree. Make the property and integration commands match the real test layout.
- `pr-ready`: align checks with the current scripts, include build verification where the repository expects it, and avoid claiming checks that were not run.

#### Skills

- `db-migration`: fix the old `projects` foreign-key example, the migration count, and the transaction guidance. Keep the runner behavior as the source of truth.
- `design-audit`: verify the current CSS variable names and allowed shadows against `DESIGN.md` and `app/src/index.css`. Remove stale claims about orange and blue priority colors if they no longer apply. Add accessibility checks that match the project rules.
- `new-page`: verify the canonical page example and route registration. Remove stale line references, old API imports, and the fixed page template if the current pages no longer follow it.
- `new-store`: add the current sync entity types, including `status`, and verify the store and sync patterns.
- `new-sync-entity`: update the entity union, event construction, `sourceId`, actor context, and test expectations.

#### New capabilities

- **Security review:** add a read-only security workflow skill. It reports findings with file and line evidence and does not edit code. Reference it from the review command and the code reviewer.
- **MCP tools:** add a development and verification skill for Planner MCP tools. It covers tool design, registration, token scopes, authorization, service reuse, and integration tests. Add a separate command only if scaffolding a new tool is repetitive enough to justify it.
- **Release and deploy:** add a checks-only deploy review skill. It verifies release readiness, documents rollback, and never changes production without an explicit request. It should not duplicate the full `pr-ready` checks.
- **Test and E2E:** improve the existing test command and test-runner agent before adding a new skill. Add a focused E2E or Playwright skill only if the audit shows the current workflow cannot cover browser and visual checks cleanly.

Every new file is reviewed before creation. The exact surface for each capability is decided during the audit and recorded in this plan.

### 3. Spec convention

Replace the current two-file rule in `CLAUDE.md` with this:

- Create `.specs/yyyy-mm-dd-<slug>/`.
- Write one `plan.md` that explains the problem, the user-visible behavior, the decisions, the detailed design, the relevant files, the risks, and the verification needs.
- Write in clear, human language. The plan should read like a person explaining the work, not like a generated template.
- Technical detail is welcome when it removes ambiguity. Avoid line-number references and large code blocks unless they are essential.
- Put the checklist at the end of the plan. One grouped list is the default because work often crosses sections. Section-level lists are allowed when they are genuinely clearer.
- Keep tasks short and human-readable. A task says what outcome is needed, not the exact file, line, or code. The plan holds the detail.
  - Prefer "Add the new socket implementation" over a task containing a file path, a line number, and a code block.
- Do not repeat the standard worktree, PR, hook, or verification checklist in every plan. Mention only task-specific exceptions, dependencies, risks, or checks.
- Update checkboxes as work progresses.
- New specs and specs being actively revised use this format. Consolidate a touched spec by preserving its decisions and progress, then removing the separate task file.

This spec itself is consolidated under the new rule. `task.md` is removed after its remaining work is represented in the checklist below.

### 4. Personal and shared instructions

The starting split is:

- Personal: communication style, research habits, general engineering habits, commit aliases, and the preference for small reversible changes.
- Planner: architecture, design system, auth, security, data protection, testing, commit and branch requirements, and the worktree lifecycle.

Some rules intentionally exist in both places. A personal preference should not be the only place a collaborator can learn a requirement that affects the repository.

Investigate a safe shared source for global instructions across Claude Code, OpenCode, Codex, Gemini CLI, Copilot, and any other client in use. Check supported include or import mechanisms before proposing symlinks. Do not read credentials or private local settings. Do not edit personal files until the owner approves the exact changes.

### 5. Playwright MCP and tracker configuration

Document the current Playwright MCP setup and whether the tracked `.claude/settings.json` entry is read by the client. Do not change the configuration in this refactor. The finding belongs in the agent setup documentation so the next person does not repeat the investigation.

### 6. Commit trailer review

Gather evidence before changing anything:

- Compare the current documented format with what the Claude Code harness actually injects.
- Check the existing hook tests and the commit history variants.
- Decide whether a `commit-msg` hook is worth adding.
- If a policy changes, update the single rule and the compact table together.

No hook or policy change is part of this spec until that review is approved.

### 7. Verification

- Every rule from the inventory maps to its new line, doc, or reason for deletion.
- `CLAUDE.md` is at or below 230 lines and 17 KB.
- The three symlinks still point to `CLAUDE.md`.
- Every referenced file exists.
- No em dash characters appear in changed documentation.
- No stale JWT, localStorage token, `project:` room, or `/projects` route guidance remains in `.claude`.
- Model identifiers are valid, or the role inherits the session model.
- The new workflows are tested by reading their instructions against the current code and, where possible, by running the commands they describe.
- A fresh agent session can still add a mutation, commit with the approved trailer, and offer isolation for a direct coding task.
- Personal instruction changes are proposed and approved before editing.
- The spec moves to `.specs/completed/` only after the implementation and verification are complete.

Browser and stack checks are decided after the audit. They are required only if the changed workflows affect rendered UI or need a running API.

## Risks and open decisions

- **Porting current edits:** the working copy has uncommitted `CLAUDE.md` changes. Start the worktree from `main`, copy the relevant edits deliberately, and leave the original checkout untouched.
- **Alias mapping:** the global Claude aliases and Planner aliases do not map one-to-one. Review each alias before moving anything.
- **Global sharing:** client support for includes and symlinks differs. Do not replace generated files just to force parity.
- **Model pins:** supported model names change. Verify before editing, and do not guess a replacement.
- **Lost rules:** the inventory and PR mapping table are the guard against deleting something important.
- **Over-compression:** the size target is a ceiling, not a reason to remove a rule that prevents a real failure.

## Relevant files

- `CLAUDE.md` and the three symlinks.
- `docs/deploy.md`, `docs/realtime.md`, `docs/api.md`, and any small agent setup note added by the audit.
- `.claude/agents/*.md`
- `.claude/commands/*.md`
- `.claude/skills/*/SKILL.md`
- `.hooks/setup-hooks.sh` and a possible `.hooks/commit-msg` only if approved.
- `DESIGN.md`, `app/src/index.css`, and the current source files used to verify examples.
- `api/src/index.ts`, `api/src/services/syncService.ts`, `api/src/routes/`, and the current migration runner.
- `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md`, and the supported OpenCode global configuration, read only for the sharing proposal.
- This spec folder.

## Tasks

- [x] Consolidate this spec into one plan.
- [ ] Inventory every rule and identify duplicates.
- [ ] Verify the facts against the current code.
- [ ] Move focused reference material into docs.
- [ ] Rewrite the shared instructions under the size target.
- [ ] Audit and update the agents.
- [ ] Audit and update the commands.
- [ ] Audit and update the skills.
- [ ] Add the security review workflow.
- [ ] Add the MCP development workflow.
- [ ] Add the release and deploy checks.
- [ ] Improve the test and E2E workflow.
- [ ] Propose the personal and shared instruction split.
- [ ] Review the commit trailer policy.
- [ ] Document the Playwright MCP finding.
- [ ] Verify links, sizes, symlinks, and fresh-session behavior.
- [ ] Open the PR and move the spec after verified completion.

.worktrees/  
Tem que ser padrão para todos os projetos, mas é bom estar nos projetos de forma simples. Detalhar mais no Claude do user.
