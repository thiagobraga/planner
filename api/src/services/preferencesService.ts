import type { BoardGroupBy, BoardViewModes, DailyView, NavStyle, ViewLayout, ViewRange, ViewStyle } from "../types/preferences.js";
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
  show_notes: boolean;
  show_checkboxes: boolean;
  nav_style: NavStyle;
  agent_change_notices: boolean;
  locale: string;
  date_format: string;
  collapsed_collection_ids: string[];
  board_view_modes: BoardViewModes;
  daily_view: DailyView;
  full_width: boolean;
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
    showNotes: row.show_notes,
    showCheckboxes: row.show_checkboxes,
    navStyle: row.nav_style,
    agentChangeNotices: row.agent_change_notices,
    locale: row.locale,
    dateFormat: row.date_format ?? 'MMM DD ddd',
    collapsedCollectionIds: row.collapsed_collection_ids,
    boardViewModes: row.board_view_modes ?? {},
    dailyView: row.daily_view,
    fullWidth: row.full_width,
  };
}

const VALID_NAV_STYLES = ["text", "icon-left", "icon-top"] as const;
const VALID_WEEK_STARTS = ["sunday", "monday"] as const;
const VALID_THEMES = ["light", "dark", "system"] as const;
const VALID_FONTS = ["lora", "playpen", "hubballi"] as const;
const VALID_BACKGROUNDS = ["beige", "white", "dark", "system", "nord-light", "nord-dark"] as const;
const VALID_LOCALES = ["en", "pt-BR"] as const;
const VALID_GROUPINGS: readonly BoardGroupBy[] = ["status", "section", "priority", "none", "collection"];
const VALID_LAYOUTS: readonly ViewLayout[] = ["list", "columns", "table", "calendar"];
const VALID_STYLES: readonly ViewStyle[] = ["notebook", "cards"];
const VALID_RANGES: readonly ViewRange[] = [
  "today", "tomorrow", "week", "next7", "upcoming", "month",
  "d1", "d2", "d3", "d4", "d5", "d6", "w1", "w2", "w3",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDailyView(value: unknown): value is DailyView {
  return isPlainObject(value)
    && Object.keys(value).length === 2
    && VALID_STYLES.includes(value.style as ViewStyle)
    && VALID_RANGES.includes(value.range as ViewRange);
}

function isValidBoardMode(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const { layout, style, groupBy, ...rest } = value;
  return Object.keys(rest).length === 0
    && (layout === undefined || VALID_LAYOUTS.includes(layout as ViewLayout))
    && (style === undefined || VALID_STYLES.includes(style as ViewStyle))
    && (groupBy === undefined || VALID_GROUPINGS.includes(groupBy as BoardGroupBy));
}
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
  showNotes?: boolean;
  showCheckboxes?: boolean;
  navStyle?: string;
  agentChangeNotices?: boolean;
  locale?: string;
  dateFormat?: string;
  collapsedCollectionIds?: string[];
  /** Entries are merged into the stored ones, key by key. */
  boardViewModes?: BoardViewModes;
  dailyView?: DailyView;
  fullWidth?: boolean;
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
    errors.push({ field: "background", message: `background must be one of: ${VALID_BACKGROUNDS.join(", ")}` });
  }

  if (input.smallCaps !== undefined && typeof input.smallCaps !== "boolean") {
    errors.push({ field: "smallCaps", message: "smallCaps must be a boolean" });
  }

  if (input.hideCompletedTasks !== undefined && typeof input.hideCompletedTasks !== "boolean") {
    errors.push({ field: "hideCompletedTasks", message: "hideCompletedTasks must be a boolean" });
  }

  if (input.showNotes !== undefined && typeof input.showNotes !== "boolean") {
    errors.push({ field: "showNotes", message: "showNotes must be a boolean" });
  }

  if (input.showCheckboxes !== undefined && typeof input.showCheckboxes !== "boolean") {
    errors.push({ field: "showCheckboxes", message: "showCheckboxes must be a boolean" });
  }

  if (input.navStyle !== undefined && !VALID_NAV_STYLES.includes(input.navStyle as NavStyle)) {
    errors.push({ field: "navStyle", message: "navStyle must be one of: text, icon-left, icon-top" });
  }

  if (input.agentChangeNotices !== undefined && typeof input.agentChangeNotices !== "boolean") {
    errors.push({ field: "agentChangeNotices", message: "agentChangeNotices must be a boolean" });
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
    const entries = isPlainObject(input.boardViewModes) ? Object.entries(input.boardViewModes) : null;
    const validEntries = entries !== null
      && entries.length <= 200
      && entries.every(([collectionId, mode]) => isUuid(collectionId) && isValidBoardMode(mode));

    if (!validEntries) {
      errors.push({
        field: "boardViewModes",
        message: "boardViewModes must contain at most 200 UUID keys with valid layout, style and groupBy values",
      });
    }
  }

  if (input.dailyView !== undefined && !isValidDailyView(input.dailyView)) {
    errors.push({ field: "dailyView", message: "dailyView must be { style, range } with known values" });
  }

  if (input.fullWidth !== undefined && typeof input.fullWidth !== "boolean") {
    errors.push({ field: "fullWidth", message: "fullWidth must be a boolean" });
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
  if (input.showNotes !== undefined) {
    setClauses.push(`show_notes = $${paramIndex++}`);
    values.push(input.showNotes);
  }
  if (input.showCheckboxes !== undefined) {
    setClauses.push(`show_checkboxes = $${paramIndex++}`);
    values.push(input.showCheckboxes);
  }
  if (input.navStyle !== undefined) {
    setClauses.push(`nav_style = $${paramIndex++}`);
    values.push(input.navStyle);
  }
  if (input.agentChangeNotices !== undefined) {
    setClauses.push(`agent_change_notices = $${paramIndex++}`);
    values.push(input.agentChangeNotices);
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
    // Each sent entry is merged into the stored one, so changing one field of one
    // collection never drops its other fields or the other collections.
    setClauses.push(`board_view_modes = board_view_modes || COALESCE((
      SELECT jsonb_object_agg(entry.key, COALESCE(board_view_modes -> entry.key, '{}'::jsonb) || entry.value)
      FROM jsonb_each($${paramIndex++}::jsonb) AS entry
    ), '{}'::jsonb)`);
    values.push(input.boardViewModes);
  }
  if (input.dailyView !== undefined) {
    setClauses.push(`daily_view = $${paramIndex++}`);
    values.push({ style: input.dailyView.style, range: input.dailyView.range });
  }
  if (input.fullWidth !== undefined) {
    setClauses.push(`full_width = $${paramIndex++}`);
    values.push(input.fullWidth);
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
