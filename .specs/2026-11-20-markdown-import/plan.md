# Markdown spec import (S8 of development-home)

## What it does

An agent or script turns one spec folder into one parent card in a collection. `plan.md` becomes the card's rich description; `task.md`, when present, sits under a "Tasks (task.md)" heading in the same description. Checklist items (`- [ ]`, `- [x]`, `- [~]`) become real subtasks, embedded in the description where they were written; nested checklist items become nested subtasks.

- **Dry run first.** Preview reports the destination, one card, one document, subtask counts (done and in progress), and warnings. Nothing is written.
- **Nothing lost silently.** Tables, HTML, images, unsafe links and headings deeper than level 3 stay as text and each produces a warning. Text that looks like a credential produces a warning. Checklist nesting past the depth limit is merged into its parent with a warning.
- **States.** `[x]` imports completed (in the completion status when the collection has one). `[~]` goes to an in-progress status (named Doing, Fazendo, In progress or Em andamento); without one it stays open with a warning.
- **Retries are safe.** Importing the same source with the same content returns the earlier import. Changed content on the same source path is refused until the earlier import is undone.
- **Undo.** Removes exactly what the import created, except tasks someone changed since (edited, completed, moved, commented, given new subtasks, or a description edited past its first revision). Those and their parents are kept and listed.
- **Provenance.** The manifest keeps the original `plan.md` and `task.md` text, the source hash, every created task id and the warnings.

Available as REST (`POST /imports/markdown/preview`, `POST /imports/markdown`, `DELETE /imports/:manifestId`) and MCP (`import_markdown` with `dry_run`, `undo_import`; write tokens only).

## Not in this slice

A UI for importing; the pilot import and cutover (S9) run through the API with a token the user creates. Deduplicating against existing cards uses reviewed mappings in S9, not title guesses here. MCP requests stay under the 100kb JSON limit; REST import accepts up to 1mb.

## Relevant files

- `api/src/db/migrations/054_import_manifests.sql`
- `api/src/types/import.ts`
- `api/src/services/import/{markdownParse,importBuild,importService}.ts`
- `api/src/routes/{imports,index}.ts`, `api/src/index.ts` (import body limit)
- `api/src/mcp/tools/imports.ts`, `api/src/mcp/server.ts`
- Tests: `api/src/services/import/__tests__/*`, `api/src/routes/__tests__/imports.integration.test.ts`, `api/src/mcp/__tests__/server.integration.test.ts`
- `CLAUDE.md`
