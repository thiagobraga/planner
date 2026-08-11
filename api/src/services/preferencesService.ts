import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";
import { buildEvent, publishEvent } from "./syncService.js";
import { validate as isUuid } from "uuid";

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
  locale: string;
  date_format: string;
  collapsed_collection_ids: string[];
  board_view_modes: BoardViewModes;
}

export type BoardGroupBy = "status" | "section" | "priority";
export type BoardViewMode = "list" | "kanban";
export type BoardViewModes = Record<string, { view?: BoardViewMode; groupBy?: BoardGroupBy }>;

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
    locale: row.locale,
    dateFormat: row.date_format ?? 'MMM DD ddd',
    collapsedCollectionIds: row.collapsed_collection_ids,
    boardViewModes: row.board_view_modes ?? {},
  };
}

const VALID_WEEK_STARTS = ["sunday", "monday"] as const;
const VALID_THEMES = ["light", "dark", "system"] as const;
const VALID_FONTS = ["lora", "playpen", "hubballi"] as const;
const VALID_BACKGROUNDS = ["beige", "white"] as const;
const VALID_LOCALES = ["en", "pt-BR"] as const;
const VALID_GROUP_BYS = ["status", "section", "priority"] as const;
const VALID_VIEW_MODES = ["list", "kanban"] as const;
export const VALID_DATE_FORMATS = [
  "MMM DD ddd",
  "DD/MM ddd",
  "DD-MM-YYYY ddd",
  "ddd MMM DD",
  "YYYY-MM-DD",
] as const;

export function isValidIanaTimezone(tz: string): boolean {
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
  locale?: string;
  dateFormat?: string;
  collapsedCollectionIds?: string[];
  boardViewModes?: BoardViewModes;
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

  if (input.locale !== undefined && !VALID_LOCALES.includes(input.locale as (typeof VALID_LOCALES)[number])) {
    errors.push({ field: "locale", message: "locale must be one of: en, pt-BR" });
  }

  if (input.dateFormat !== undefined && !VALID_DATE_FORMATS.includes(input.dateFormat as (typeof VALID_DATE_FORMATS)[number])) {
    errors.push({ field: "dateFormat", message: `dateFormat must be one of: ${VALID_DATE_FORMATS.join(', ')}` });
  }

  if (
    input.collapsedCollectionIds !== undefined
    && (!Array.isArray(input.collapsedCollectionIds)
      || !input.collapsedCollectionIds.every((id) => typeof id === "string" && isUuid(id)))
  ) {
    errors.push({
      field: "collapsedCollectionIds",
      message: "collapsedCollectionIds must be an array of UUID strings",
    });
  }

  if (input.boardViewModes !== undefined) {
    const entries = typeof input.boardViewModes === "object"
      && input.boardViewModes !== null
      && !Array.isArray(input.boardViewModes)
      ? Object.entries(input.boardViewModes)
      : null;
    const validEntries = entries !== null
      && entries.length <= 200
      && entries.every(([collectionId, mode]) => {
        if (!isUuid(collectionId) || typeof mode !== "object" || mode === null || Array.isArray(mode)) {
          return false;
        }
        const { view, groupBy } = mode as { view?: unknown; groupBy?: unknown };
        return (view === undefined || VALID_VIEW_MODES.includes(view as BoardViewMode))
          && (groupBy === undefined || VALID_GROUP_BYS.includes(groupBy as BoardGroupBy));
      });

    if (!validEntries) {
      errors.push({
        field: "boardViewModes",
        message: "boardViewModes must contain at most 200 UUID keys with valid view and groupBy values",
      });
    }
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
  if (input.locale !== undefined) {
    setClauses.push(`locale = $${paramIndex++}`);
    values.push(input.locale);
  }
  if (input.dateFormat !== undefined) {
    setClauses.push(`date_format = $${paramIndex++}`);
    values.push(input.dateFormat);
  }
  if (input.collapsedCollectionIds !== undefined) {
    setClauses.push(`collapsed_collection_ids = $${paramIndex++}`);
    values.push([...new Set(input.collapsedCollectionIds)]);
  }
  if (input.boardViewModes !== undefined) {
    setClauses.push(`board_view_modes = $${paramIndex++}`);
    values.push(input.boardViewModes);
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
