import { parseDueDate } from "../parsers/dateParser.js";
import { listCollections } from "../services/collectionService.js";
import { listLabels } from "../services/labelService.js";
import { listHabits } from "../services/habitService.js";
import { localDateInTimezone } from "../services/viewService.js";
import type { NamedRef, ResolvedDue } from "../types/mcp.js";

/** A failure the agent can fix by changing its arguments; surfaced as a tool error, not a crash. */
export class ToolInputError extends Error {}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The user's calendar date, e.g. "2026-10-06", wherever the server runs. */
export function todayFor(timeZone: string, now: Date): string {
  return localDateInTimezone(now, timeZone);
}

/**
 * Natural-language or ISO due date, resolved against the user's own "today".
 *
 * The date grammar reads the process-local calendar, so it is handed a Date
 * whose local fields spell the user's date: "tomorrow" then means tomorrow
 * where the user is, not where the server is.
 */
export function resolveDue(phrase: string, timeZone: string, now: Date): ResolvedDue {
  const trimmed = phrase.trim();
  if (ISO_DATE.test(trimmed)) {
    return { dueDate: trimmed, dueTime: null, recurrenceRule: null };
  }

  const [year, month, day] = todayFor(timeZone, now).split("-").map(Number);
  const localNoon = new Date(year!, month! - 1, day!, 12, 0, 0);
  try {
    const parsed = parseDueDate(trimmed, { now: localNoon });
    return {
      dueDate: parsed.date,
      dueTime: parsed.time ?? null,
      recurrenceRule: parsed.recurrence ?? null,
    };
  } catch {
    throw new ToolInputError(
      `Could not understand the date "${phrase}". Try "today", "tomorrow", "friday", "next friday 3pm", "in 3 days", "dec 24", "every monday" or YYYY-MM-DD.`,
    );
  }
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
