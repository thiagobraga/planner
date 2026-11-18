import { findDailyTasks } from "../repositories/dailyRepository.js";
import { AppError } from "../utils/AppError.js";
import type { DailyView } from "../types/daily.js";
import { addDaysISO, formatTask, getViewPreferences } from "./viewService.js";

/** Covers the month grid: six weeks. */
export const MAX_DAILY_RANGE_DAYS = 42;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validationError(field: string, message: string): AppError {
  return new AppError({
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    statusCode: 400,
    details: [{ field, message }],
  });
}

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function validateRange(from: string, to: string): number {
  if (!isRealDate(from)) throw validationError("from", "from must be a real date in YYYY-MM-DD format");
  if (!isRealDate(to)) throw validationError("to", "to must be a real date in YYYY-MM-DD format");
  if (from > to) throw validationError("to", "to must not be before from");

  const length = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  if (length > MAX_DAILY_RANGE_DAYS) {
    throw validationError("to", `range must not exceed ${MAX_DAILY_RANGE_DAYS} days`);
  }
  return length;
}

export async function getDailyView(userId: string, from: string, to: string, now: Date = new Date()): Promise<DailyView> {
  const length = validateRange(from, to);
  const settings = await getViewPreferences(userId, now);

  const rows = await findDailyTasks(userId, settings.todayDate, from, to, settings.hideCompletedTasks, settings.showNotes);

  const overdue: DailyView["overdue"] = [];
  const byDate = new Map<string, DailyView["overdue"]>();
  for (let i = 0; i < length; i++) byDate.set(addDaysISO(from, i), []);

  for (const row of rows) {
    const task = formatTask(row);
    // pg hands DATE columns back as JS Dates; the day keys are plain strings.
    const date = task.dueDate instanceof Date ? task.dueDate.toISOString().slice(0, 10) : String(task.dueDate).slice(0, 10);
    if (date < settings.todayDate) overdue.push(task);
    byDate.get(date)?.push(task);
  }

  return {
    from,
    to,
    today: settings.todayDate,
    overdue,
    days: Array.from(byDate, ([date, tasks]) => ({ date, tasks })),
  };
}
