import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";

interface PreferencesRow {
  user_id: string;
  time_zone: string;
  week_start: string;
  theme: string;
  notifications_enabled: boolean;
  font: string;
}

function formatPreferences(row: PreferencesRow) {
  return {
    userId: row.user_id,
    timeZone: row.time_zone,
    weekStart: row.week_start,
    theme: row.theme,
    notificationsEnabled: row.notifications_enabled,
    font: row.font,
  };
}

const VALID_WEEK_STARTS = ["sunday", "monday"] as const;
const VALID_THEMES = ["light", "dark", "system"] as const;
const VALID_FONTS = ["lora", "patrick"] as const;

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
    errors.push({ field: "font", message: "font must be 'lora' or 'patrick'" });
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

  return formatPreferences(result.rows[0] as PreferencesRow);
}
