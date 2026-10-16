import { parseDuePhrase } from "../services/dateService.js";
import { listCollections } from "../services/collectionService.js";
import { listLabels } from "../services/labelService.js";
import { listHabits } from "../services/habitService.js";
import { localDateInTimezone } from "../services/viewService.js";
import type { NamedRef, ResolvedDue } from "../types/mcp.js";
import type { RecurrenceRule } from "../types/recurrence.js";

/** A failure the agent can fix by changing its arguments; surfaced as a tool error, not a crash. */
export class ToolInputError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The user's calendar date, e.g. "2026-10-06", wherever the server runs. */
export function todayFor(timeZone: string, now: Date): string {
  return localDateInTimezone(now, timeZone);
}

/** Natural-language or ISO due date in the user's timezone; see parseDuePhrase. */
export function resolveDue(phrase: string, timeZone: string, now: Date): ResolvedDue {
  try {
    return parseDuePhrase(phrase, timeZone, now);
  } catch {
    throw new ToolInputError(
      `Could not understand the date "${phrase}". Try "today", "tomorrow", "friday", "next friday 3pm", "in 3 days", "dec 24", "every monday" or YYYY-MM-DD.`,
    );
  }
}

/** Layers the agent's `from_completion` / `until` options onto the rule parsed from `due`. */
export function withRecurrenceOptions(
  due: ResolvedDue,
  options: { fromCompletion?: boolean; until?: string },
  timeZone: string,
  now: Date,
): ResolvedDue {
  if (options.fromCompletion === undefined && options.until === undefined) return due;
  if (!due.recurrenceRule) {
    throw new ToolInputError('from_completion and until need a repeating due such as "every saturday".');
  }
  const rule: RecurrenceRule = { ...due.recurrenceRule };
  if (options.fromCompletion !== undefined) rule.fromCompletion = options.fromCompletion;
  if (options.until !== undefined) rule.until = resolveDue(options.until, timeZone, now).dueDate;
  return { ...due, recurrenceRule: rule };
}

function pickByName<T extends NamedRef>(items: T[], ref: string, kind: string): T {
  const byId = items.find((item) => item.id === ref);
  if (byId) return byId;

  const wanted = ref.trim().replace(/^[#@]/, "").toLowerCase();
  const matches = items.filter((item) => item.name.toLowerCase() === wanted);
  if (matches.length === 1) return matches[0]!;

  const listing = (list: T[]) => list.map((item) => `${item.name} (id:${item.id})`).join(", ");
  if (matches.length > 1) {
    throw new ToolInputError(`More than one ${kind} is named "${ref}": ${listing(matches)}. Pass the id instead.`);
  }
  throw new ToolInputError(
    items.length === 0
      ? `No ${kind} named "${ref}". There are none yet.`
      : `No ${kind} named "${ref}". Available: ${listing(items)}.`,
  );
}

export async function resolveCollection(userId: string, ref: string): Promise<NamedRef> {
  const collections = (await listCollections(userId)).filter((c) => !c.isArchived);
  return pickByName(collections, ref, "collection");
}

export async function resolveLabels(userId: string, refs: string[]): Promise<string[]> {
  if (refs.length === 0) return [];
  const labels = await listLabels(userId);
  return refs.map((ref) => pickByName(labels, ref, "label").id);
}

export async function resolveHabit(userId: string, ref: string): Promise<NamedRef> {
  return pickByName(await listHabits(userId), ref, "habit");
}

export function assertUuid(value: string, what = "id"): void {
  if (!UUID.test(value)) {
    throw new ToolInputError(`"${value}" is not a valid ${what}. Use the id:... value from a listing.`);
  }
}
