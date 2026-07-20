import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { buildEvent, publishEvent } from "./syncService.js";

interface PreferencesRow {
  user_id: string;
  time_zone: string;
  week_start: string;
  theme: string;
  notifications_enabled: boolean;
  font: string;
  show_dots: boolean;
  background: string;
  small_caps: boolean;
  hide_completed_tasks: boolean;
  hide_old_notes: boolean;
}

function formatPreferences(row: PreferencesRow) {
  return {
    userId: row.user_id,
    timeZone: row.time_zone,
    weekStart: row.week_start,
    theme: row.theme,
    notificationsEnabled: row.notifications_enabled,
    font: row.font,
    showDots: row.show_dots,
    background: row.background,
    smallCaps: row.small_caps,
    hideCompletedTasks: row.hide_completed_tasks,
    hideOldNotes: row.hide_old_notes,
  };
}

const VALID_WEEK_STARTS = ["sunday", "monday"] as const;
const VALID_THEMES = ["light", "dark", "system"] as const;
const VALID_FONTS = ["lora", "playpen", "hubballi"] as const;
const VALID_BACKGROUNDS = ["beige", "white"] as const;

function isValidIanaTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface UpdatePreferencesInput {
  timeZone?: string;
  weekStart?: string;
  theme?: string;
  notificationsEnabled?: boolean;
  font?: string;
  showDots?: boolean;
  background?: string;
  smallCaps?: boolean;
  hideCompletedTasks?: boolean;
  hideOldNotes?: boolean;
}

export function validatePreferences(input: UpdatePreferencesInput): UpdatePreferencesInput {
  const errors: { field: string; message: string }[] = [];

  if (input.timeZone !== undefined) {
    if (typeof input.timeZone !== "string" || !isValidIanaTimezone(input.timeZone)) {
      errors.push({ field: "timeZone", message: "Invalid IANA timezone" });
    }
  }

  if (input.weekStart !== undefined && !VALID_WEEK_STARTS.includes(input.weekStart as (typeof VALID_WEEK_STARTS)[number])) {
    errors.push({ field: "weekStart", message: "weekStart must be 'sunday' or 'monday'" });
  }

  if (input.theme !== undefined && !VALID_THEMES.includes(input.theme as (typeof VALID_THEMES)[number])) {
    errors.push({ field: "theme", message: "theme must be 'light', 'dark', or 'system'" });
  }

  if (input.notificationsEnabled !== undefined && typeof input.notificationsEnabled !== "boolean") {
    errors.push({ field: "notificationsEnabled", message: "notificationsEnabled must be a boolean" });
  }

  if (input.font !== undefined && !VALID_FONTS.includes(input.font as (typeof VALID_FONTS)[number])) {
    errors.push({ field: "font", message: "font must be one of: lora, playpen, hubballi" });
  }

  if (input.showDots !== undefined && typeof input.showDots !== "boolean") {
    errors.push({ field: "showDots", message: "showDots must be a boolean" });
  }

  if (input.background !== undefined && !VALID_BACKGROUNDS.includes(input.background as (typeof VALID_BACKGROUNDS)[number])) {
    errors.push({ field: "background", message: "background must be one of: beige, white" });
  }

  if (input.smallCaps !== undefined && typeof input.smallCaps !== "boolean") {
    errors.push({ field: "smallCaps", message: "smallCaps must be a boolean" });
  }

  if (input.hideCompletedTasks !== undefined && typeof input.hideCompletedTasks !== "boolean") {
    errors.push({ field: "hideCompletedTasks", message: "hideCompletedTasks must be a boolean" });
  }

  if (input.hideOldNotes !== undefined && typeof input.hideOldNotes !== "boolean") {
    errors.push({ field: "hideOldNotes", message: "hideOldNotes must be a boolean" });
  }

  if (errors.length > 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: errors,
    });
  }

  return input;
}

export async function getPreferences(userId: string) {
  const result = await pool.query(
    `SELECT * FROM preferences WHERE user_id = $1`,
    [userId],
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Preferences not found",
      statusCode: 404,
    });
  }

  return formatPreferences(result.rows[0] as PreferencesRow);
}

export async function updatePreferences(userId: string, input: UpdatePreferencesInput) {
  validatePreferences(input);

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.timeZone !== undefined) {
    setClauses.push(`time_zone = $${paramIndex++}`);
    values.push(input.timeZone);
  }
  if (input.weekStart !== undefined) {
    setClauses.push(`week_start = $${paramIndex++}`);
    values.push(input.weekStart);
  }
  if (input.theme !== undefined) {
    setClauses.push(`theme = $${paramIndex++}`);
    values.push(input.theme);
  }
  if (input.notificationsEnabled !== undefined) {
    setClauses.push(`notifications_enabled = $${paramIndex++}`);
    values.push(input.notificationsEnabled);
  }
  if (input.font !== undefined) {
    setClauses.push(`font = $${paramIndex++}`);
    values.push(input.font);
  }
  if (input.showDots !== undefined) {
    setClauses.push(`show_dots = $${paramIndex++}`);
    values.push(input.showDots);
  }
  if (input.background !== undefined) {
    setClauses.push(`background = $${paramIndex++}`);
    values.push(input.background);
  }
  if (input.smallCaps !== undefined) {
    setClauses.push(`small_caps = $${paramIndex++}`);
    values.push(input.smallCaps);
  }
  if (input.hideCompletedTasks !== undefined) {
    setClauses.push(`hide_completed_tasks = $${paramIndex++}`);
    values.push(input.hideCompletedTasks);
  }
  if (input.hideOldNotes !== undefined) {
    setClauses.push(`hide_old_notes = $${paramIndex++}`);
    values.push(input.hideOldNotes);
  }

  if (setClauses.length === 0) {
    return getPreferences(userId);
  }

  values.push(userId);
  const result = await pool.query(
    `UPDATE preferences SET ${setClauses.join(", ")} WHERE user_id = $${paramIndex} RETURNING *`,
    values,
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Preferences not found",
      statusCode: 404,
    });
  }

  const preferences = formatPreferences(result.rows[0] as PreferencesRow);
  publishEvent(
    buildEvent({
      entityType: "preferences",
      eventType: "updated",
      entityId: userId,
      userId,
      payload: preferences,
    }),
  ).catch((err) => console.error("[sync] publish failed", err));

  return preferences;
}
