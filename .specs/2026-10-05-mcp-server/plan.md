# MCP Server - Plan

Part 2 of 4 in the "AI agents talk to Planner" roadmap. Depends on `2026-10-05-api-tokens`.

## Why

I want to talk to Planner from AI agents: "what's on my plate today?", "add 'call the dentist' for next Friday in Personal", "mark the groceries task done", "move everything overdue to tomorrow", "did I log my reading habit this week?".

The Model Context Protocol (MCP) is the standard way agents discover and call external tools. One MCP server works in Claude Code, Claude Desktop, claude.ai, Cursor, VS Code, Gemini CLI, Codex and ChatGPT, so I do not have to write glue per client.

## What the user sees

### Connecting an agent

1. In **Settings > Integrations** I create an API token (from `2026-10-05-api-tokens`).
2. Below the token list there is a **Connect an AI agent** panel showing the MCP URL (`https://<my-planner-host>/api/v1/mcp`) and copy-paste snippets for common clients:

   Claude Code:
   ```
   claude mcp add --transport http planner https://planner.example.com/api/v1/mcp \
     --header "Authorization: Bearer plnr_xxxxxxxx"
   ```

   Generic JSON config (Claude Desktop / Cursor / VS Code):
   ```json
   {
     "mcpServers": {
       "planner": {
         "type": "http",
         "url": "https://planner.example.com/api/v1/mcp",
         "headers": { "Authorization": "Bearer plnr_xxxxxxxx" }
       }
     }
   }
   ```
3. The agent now lists Planner's tools and can use them.

### What the agent can do

Tools are shaped around what I would ask, not a 1:1 copy of the REST API. Each one returns compact, readable results (titles, dates, ids) so the agent does not burn context.

**Reading (works with a Read-only token)**

| Tool | What it answers |
| --- | --- |
| `get_today` | Overdue + today's tasks and events, in my timezone |
| `get_upcoming` | The next N days (default 7, max 30) grouped by day |
| `get_inbox` | Unsorted tasks waiting to be organized |
| `get_collection` | Tasks in one collection, grouped by section |
| `list_collections` | My collections (and shared ones) with ids, for picking a destination |
| `list_labels` | Labels with ids |
| `search` | Full-text search across tasks, collections, labels |
| `filter_tasks` | Run a filter-DSL query (same syntax as saved filters), e.g. `p1 & overdue` |
| `list_habits` | Habits with this week's completions and current streak |

**Writing (needs a Read & write token)**

| Tool | What it does |
| --- | --- |
| `create_task` | Title, optional notes, due ("next friday 3pm", "every monday"), deadline, priority, collection by name or id, labels by name |
| `update_task` | Change any of the above |
| `complete_task` / `reopen_task` | Check / uncheck (recurring tasks roll to the next occurrence) |
| `move_task` | To another collection / section / status |
| `reschedule_tasks` | Move several tasks to a new due date in one call ("push all overdue to tomorrow") |
| `delete_task` | Permanent; marked destructive so clients ask me before running it |
| `log_habit` | Toggle a habit for a date (default today) |

Natural-language dates are understood by Planner itself (the same parser Quick Add uses) and resolved in **my** timezone, so the agent does not have to guess what "tomorrow" means.

Collections and labels can be referenced by name; if a name is ambiguous the tool returns the candidates instead of guessing.

### Real-time

Anything an agent changes appears immediately in every open Planner tab, the same as a change from another device.

### Safety

- A Read-only token only exposes the read tools (write tools are not even listed).
- `delete_task` and `reschedule_tasks` carry MCP `destructiveHint` so clients prompt before running them.
- Same per-request rate limit as the REST API.
- Revoking the token in Settings cuts the agent off on its next call.

## Out of scope

- OAuth sign-in for claude.ai / ChatGPT connectors - `2026-10-05-mcp-oauth`.
- MCP resources, prompts, and server-to-client notifications. Tools only for v1.
- Managing comments, reminders, sections, statuses, saved filters, preferences via MCP. Add later if needed.
- A separate stdio / npm package. The remote endpoint covers every current client.

## Relevant Files

**API**
- `api/package.json` (add `@modelcontextprotocol/sdk`, `zod`)
- `api/src/mcp/server.ts` (new) - builds an `McpServer` for a given auth context
- `api/src/mcp/tools/views.ts` (new)
- `api/src/mcp/tools/tasks.ts` (new)
- `api/src/mcp/tools/collections.ts` (new)
- `api/src/mcp/tools/habits.ts` (new)
- `api/src/mcp/format.ts` (new) - compact text/JSON formatters
- `api/src/mcp/resolve.ts` (new) - collection/label name -> id, date phrase -> fields
- `api/src/routes/mcp.ts` (new) - Streamable HTTP endpoint
- `api/src/routes/index.ts`
- `api/src/types/mcp.ts` (new)
- Reused services: `viewService.ts`, `taskService.ts`, `collectionService.ts`, `labelService.ts`, `searchService.ts`, `filterService.ts` / `filterEvaluator.ts`, `habitService.ts`
- Reused parsers: `parsers/dateParser.ts` (`parseDueDate`), `parsers/filterParser.ts` (`parseFilter`)
- Tests: `api/src/mcp/__tests__/*.test.ts`

**App**
- `app/src/components/settings/ConnectAgentPanel.tsx` (new)
- `app/src/components/settings/ApiTokensSection.tsx`
- `app/src/i18n/locales/en.ts`, `app/src/i18n/locales/pt-BR.ts`
- `app/src/pages/HelpPage.tsx` / `app/src/i18n/helpContent.ts` (short "Use Planner from AI agents" entry)

**Docs**
- `CLAUDE.md`, `README.md`
