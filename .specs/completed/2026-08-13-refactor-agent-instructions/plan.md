# Refactor AI Agent Instruction Files & Specs Workflow Guidance

## Goal
Validate, streamline, and synchronize all AI agent instruction files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md`) so they contain complete, accurate, and identical core information with less text redundancy. Standardize key engineering & spec development rules (Karpathy skills, TDD, Playwright & E2E, coverage targets, dedicated type files, screenshot logging, worktree prompting on direct tasks, worktree lifecycle, em-dash ban, multi-agent instruction sync).

## Audit Findings & Standardized Guidance

### 1. Andrej Karpathy Engineering Principles
- **Andrej Karpathy Skills**: At the start of development, agents must apply Karpathy core engineering principles: first-principles reasoning, extreme simplicity, no premature abstractions, clean readable code, zero fluff, and deep understanding before modifying logic.

### 2. Specs & Development Workflow Rules
- **Direct Task Prompting**: If a task starts directly without a spec or `/plan`, the agent must ask the user whether they want to run in a Git worktree, create a branch, or set up an isolated dev stack before making changes.
- **Applicability**: Rules apply to specs, simple features, and bugfixes alike.
- **TDD Workflow**: Test-Driven Development (red-green-refactor) is mandatory (`.specs/2026-08-13-tdd-playwright`).
- **Test Coverage**: Unit tests, real DB/Redis integration tests, and Playwright E2E coverage for user-visible flows (`.specs/2026-08-07-full-coverage-tests`). Require automated verification (Vitest + Playwright) before marking done.
- **Dedicated Type Files**: Place all TypeScript interfaces/types in dedicated files under `app/src/types/` and `api/src/types/` (`.specs/2026-08-08-dedicated-type-files`).
- **Visual Screenshots**: Save test screenshots to `./app/dist/screenshots/*.png` inside worktree and output as clickable markdown links.

### 3. Worktree Lifecycle & Teardown Protocol
- **Do NOT Auto-Teardown During Review**: Keep worktree container running during user review. Only tear down when explicitly asked ("accept PR and remove leftovers", "remove leftovers", "tear down worktrees").
- **"Worktrees Cleanup" Protocol**: When asked for "worktrees cleanup", check if worktree branches are merged into remote `main`. Return a list of safe worktrees to remove, and ask confirmation before removing.
- **Subagents & Multi-Worktrees**: Subagents use dedicated worktrees and subdomains (e.g., `claude2.planner.local`, `codex2.planner.local`, `antigravity2.planner.local`).

### 4. Code Style & Comment Rules
- **No AI Slop Comments**: Comments only for non-obvious WHY, never for WHAT.
- **Strict Em Dash (─ or —) Ban**: Never use em dash (─ or —) in comments, code, or markdown documentation. Always use simple dash `-` instead.

### 5. Core Agent Files Parity & Synchronization
- **Missing Dev Hosts**: Add `coverage.planner.local` to all agent files.
- **Git Hooks**: Include `bash .hooks/setup-hooks.sh` in Quickstart for fresh clones and worktrees.
- **Auth Routes**: Include logged-out `AuthShell.tsx` route details.
- **Multi-Agent Instruction Synchronization Rule**: Explicit rule requiring all agent instruction files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`) to be updated together in sync.

## Execution Strategy
1. Refactor `AGENTS.md` with streamlined text and updated specs/engineering rules.
2. Refactor `CLAUDE.md` to match `AGENTS.md` exactly while retaining Claude-specific header.
3. Refactor `GEMINI.md` to match `AGENTS.md` exactly while retaining `## Gemini CLI Notes`.
4. Refactor `.github/copilot-instructions.md` with identical rules in Copilot CLI format.
5. Verify parity across all files.
