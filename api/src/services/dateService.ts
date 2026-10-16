import { parseDueDate } from "../parsers/dateParser.js";
import { localDateInTimezone } from "./viewService.js";
import type { ResolvedDue } from "../types/mcp.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Natural-language or ISO due date, resolved against the user's own "today".
 * Throws when the phrase is not understood.
 *
 * The date grammar reads the process-local calendar, so it is handed a Date
 * whose local fields spell the user's date: "tomorrow" then means tomorrow
 * where the user is, not where the server is.
 */
export function parseDuePhrase(phrase: string, timeZone: string, now: Date, locale?: string): ResolvedDue {
  const trimmed = phrase.trim();
  if (ISO_DATE.test(trimmed)) {
    return { dueDate: trimmed, dueTime: null, recurrenceRule: null };
  }

  const [year, month, day] = localDateInTimezone(now, timeZone).split("-").map(Number);
  const localNoon = new Date(year!, month! - 1, day!, 12, 0, 0);
  const parsed = parseDueDate(trimmed, { now: localNoon, locale });
  return {
    dueDate: parsed.date,
    dueTime: parsed.time ?? null,
    recurrenceRule: parsed.recurrence ?? null,
  };
}
