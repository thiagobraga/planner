import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getTodayView, getUpcomingView, getInboxView, getCollectionView } from "../../services/viewService.js";
import { searchEntities } from "../../services/searchService.js";
import { evaluateFilterQuery } from "../../services/filterService.js";
import { parseFilter } from "../../parsers/filterParser.js";
import type { McpAuthContext } from "../../types/mcp.js";
import { formatTaskList } from "../format.js";
import { resolveCollection, todayFor, ToolInputError } from "../resolve.js";
import { collectionNameMap, getUserTimezone, runTool } from "../toolkit.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

/** The upcoming service only serves 7-30 day windows; shorter asks are trimmed here. */
const MIN_UPCOMING_WINDOW = 7;

export function registerViewTools(server: McpServer, ctx: McpAuthContext): void {
  server.registerTool(
    "get_today",
    {
      title: "Today",
      description: "Overdue tasks plus everything due today, in the user's timezone. Start here for 'what's on my plate'.",
      annotations: READ_ONLY,
    },
    () =>
      runTool(async () => {
        const [view, names] = await Promise.all([getTodayView(ctx.userId, ctx.now()), collectionNameMap(ctx.userId)]);
        return [
          `Today is ${view.date}.`,
          `Overdue (${view.overdue.length}):`,
          formatTaskList(view.overdue, names, "Nothing overdue."),
          `Due today (${view.today.length}):`,
          formatTaskList(view.today, names, "Nothing due today."),
        ].join("\n");
      }),
  );

  server.registerTool(
    "get_upcoming",
    {
      title: "Upcoming",
      description: "Tasks due over the next N days (default 7, max 30), grouped by day. Days with nothing due are skipped.",
      inputSchema: { days: z.number().int().min(1).max(30).default(7) },
      annotations: READ_ONLY,
    },
    ({ days }) =>
      runTool(async () => {
        const [view, names] = await Promise.all([
          getUpcomingView(ctx.userId, Math.max(days, MIN_UPCOMING_WINDOW), ctx.now()),
          collectionNameMap(ctx.userId),
        ]);
        const sections = view.days
          .slice(0, days)
          .filter((day) => day.tasks.length > 0)
          .map((day) => `${day.date}:\n${formatTaskList(day.tasks, names)}`);
        return sections.length > 0 ? sections.join("\n") : `Nothing due in the next ${days} days.`;
      }),
  );

  server.registerTool(
    "get_inbox",
    {
      title: "Inbox",
      description: "Tasks in the Inbox that have not been filed into a collection yet.",
      annotations: READ_ONLY,
    },
    () =>
      runTool(async () => {
        const view = await getInboxView(ctx.userId, ctx.now());
        return formatTaskList(view.tasks, new Map(), "Inbox is empty.");
      }),
  );

  server.registerTool(
    "get_collection",
    {
      title: "Collection",
      description: "Tasks in one collection, grouped by section. Accepts a collection name or id (see list_collections).",
      inputSchema: { collection: z.string().min(1).describe("Collection name or id") },
      annotations: READ_ONLY,
    },
    ({ collection }) =>
      runTool(async () => {
        const ref = await resolveCollection(ctx.userId, collection);
        const view = await getCollectionView(ctx.userId, ref.id, ctx.now());
        const noName = new Map<string, string>();
        const groups = [{ id: null as string | null, name: "No section" }, ...view.sections.map((s: { id: string; name: string }) => ({ id: s.id as string | null, name: s.name }))];
        const lines = [`Collection "${view.collection.name}" (id:${view.collection.id}):`];
        for (const group of groups) {
          const tasks = view.tasks.filter((t) => (t.sectionId ?? null) === group.id);
          if (tasks.length === 0) continue;
          lines.push(`${group.name}${group.id ? ` (section id:${group.id})` : ""}:`, formatTaskList(tasks, noName));
        }
        if (lines.length === 1) lines.push("No tasks.");
        return lines.join("\n");
      }),
  );

  server.registerTool(
    "search",
    {
      title: "Search",
      description: "Case-insensitive text search across task titles and notes, collection names and label names.",
      inputSchema: { query: z.string().min(2).max(200) },
      annotations: READ_ONLY,
    },
    ({ query }) =>
      runTool(async () => {
        const results = await searchEntities(ctx.userId, query);
        const block = (title: string, items: { id: string; text: string }[]) =>
          items.length === 0 ? [] : [`${title}:`, ...items.map((item) => `- ${item.text} · id:${item.id}`)];
        const lines = [
          ...block("Tasks", results.tasks),
          ...block("Collections", results.collections),
          ...block("Labels", results.labels),
        ];
        return lines.length > 0 ? lines.join("\n") : `No results for "${query}".`;
      }),
  );

  server.registerTool(
    "filter_tasks",
    {
      title: "Filter tasks",
      description: [
        "Run a filter query over all tasks the user can see. Syntax:",
        "#Collection, @label, p1..p4, today, overdue, no date, due: YYYY-MM-DD, due before: YYYY-MM-DD,",
        'due after: YYYY-MM-DD, assigned to: me, "quoted text". Combine with & (and), | (or), ! (not) and parentheses.',
        "Example: (today | overdue) & p1",
      ].join(" "),
      inputSchema: { query: z.string().min(1).max(500) },
      annotations: READ_ONLY,
    },
    ({ query }) =>
      runTool(async () => {
        try {
          parseFilter(query);
        } catch (err) {
          throw new ToolInputError(`Invalid filter: ${(err as Error).message}`);
        }
        const today = todayFor(await getUserTimezone(ctx.userId), ctx.now());
        const tasks = await evaluateFilterQuery(ctx.userId, query, today);
        return formatTaskList(tasks, new Map(), "No tasks match.");
      }),
  );
}
